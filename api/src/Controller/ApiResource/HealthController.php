<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Throwable;

#[Route('/api/health', name: 'api_health_')]
class HealthController extends AbstractController
{
    public function __construct(
        private readonly Connection $connection,
        private readonly CacheInterface $cache,
        private readonly string $projectDir,
    ) {
    }

    /**
     * Deep health check – prüft DB, Cache, JWT-Keys und Messenger-Queue.
     * Keine Authentifizierung erforderlich (PUBLIC_ACCESS in security.yaml).
     * HTTP 200 = alles OK | HTTP 503 = kritische Komponente gestört.
     */
    #[Route('', name: 'check', methods: ['GET'])]
    public function check(): JsonResponse
    {
        $checks = [];
        $healthy = true;

        $checks['database'] = $this->checkDatabase();
        if ('ok' !== $checks['database']['status']) {
            $healthy = false;
        }

        $checks['cache'] = $this->checkCache();
        if ('ok' !== $checks['cache']['status']) {
            $healthy = false;
        }

        $checks['jwtKeys'] = $this->checkJwtKeys();
        if ('ok' !== $checks['jwtKeys']['status']) {
            $healthy = false;
        }

        // Messenger-Queue: degradiert, aber kein HTTP 503
        $checks['messengerQueue'] = $this->checkMessengerQueue();

        $overallStatus = $healthy ? 'ok' : 'error';
        if ($healthy && ($checks['messengerQueue']['failedCount'] ?? 0) > 0) {
            $overallStatus = 'degraded';
        }

        return $this->json([
            'status' => $overallStatus,
            'checks' => $checks,
            'timestamp' => (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
        ], $healthy ? 200 : 503);
    }

    /** @return array{status: string, responseTimeMs?: int, message?: string} */
    private function checkDatabase(): array
    {
        $start = microtime(true);
        try {
            $this->connection->executeQuery('SELECT 1');

            return [
                'status' => 'ok',
                'responseTimeMs' => (int) round((microtime(true) - $start) * 1000),
            ];
        } catch (Throwable) {
            return ['status' => 'error', 'message' => 'DB connection failed'];
        }
    }

    /** @return array{status: string, responseTimeMs?: int, message?: string} */
    private function checkCache(): array
    {
        $start = microtime(true);
        $testKey = 'health_check_' . bin2hex(random_bytes(8));
        try {
            $this->cache->get($testKey, static function (ItemInterface $item): string {
                $item->expiresAfter(5);

                return 'ok';
            });
            $this->cache->delete($testKey);

            return [
                'status' => 'ok',
                'responseTimeMs' => (int) round((microtime(true) - $start) * 1000),
            ];
        } catch (Throwable) {
            return ['status' => 'error', 'message' => 'Cache unavailable'];
        }
    }

    /** @return array{status: string, message?: string} */
    private function checkJwtKeys(): array
    {
        $privateKey = $this->projectDir . '/config/jwt/private.pem';
        $publicKey = $this->projectDir . '/config/jwt/public.pem';

        if (!file_exists($privateKey) || !is_readable($privateKey)) {
            return ['status' => 'error', 'message' => 'JWT private key missing or unreadable'];
        }

        if (!file_exists($publicKey) || !is_readable($publicKey)) {
            return ['status' => 'error', 'message' => 'JWT public key missing or unreadable'];
        }

        return ['status' => 'ok'];
    }

    /** @return array{status: string, failedCount: int} */
    private function checkMessengerQueue(): array
    {
        try {
            $failedCount = (int) $this->connection
                ->executeQuery("SELECT COUNT(*) FROM messenger_messages WHERE queue_name = 'failed'")
                ->fetchOne();

            return ['status' => 'ok', 'failedCount' => $failedCount];
        } catch (Throwable) {
            // Tabelle existiert ggf. nicht in allen Environments
            return ['status' => 'ok', 'failedCount' => 0];
        }
    }
}
