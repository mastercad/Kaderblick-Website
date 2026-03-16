<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\ApiResource\HealthController;
use DateInterval;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class HealthControllerTest extends TestCase
{
    private Connection&MockObject $connection;
    private CacheInterface&MockObject $cache;
    private string $projectDir;

    protected function setUp(): void
    {
        $this->connection = $this->createMock(Connection::class);
        $this->cache = $this->createMock(CacheInterface::class);
        $this->projectDir = sys_get_temp_dir() . '/health_test_' . uniqid('', true);
        mkdir($this->projectDir . '/config/jwt', 0777, true);
    }

    protected function tearDown(): void
    {
        $jwtDir = $this->projectDir . '/config/jwt';
        foreach (glob($jwtDir . '/*') ?: [] as $f) {
            unlink($f);
        }
        rmdir($jwtDir);
        rmdir($this->projectDir . '/config');
        rmdir($this->projectDir);
    }

    private function makeController(): HealthController
    {
        $controller = new HealthController($this->connection, $this->cache, $this->projectDir);

        // AbstractController::json() needs a container with serializer
        $container = new ContainerBuilder();
        $container->set('serializer', new class {
            /** @param array<string, mixed> $context */
            public function serialize(mixed $data, string $format, array $context = []): string
            {
                return json_encode($data, JSON_THROW_ON_ERROR);
            }
        });
        $controller->setContainer($container);

        return $controller;
    }

    private function stubDbOk(): void
    {
        $result = $this->createMock(Result::class);
        $this->connection->method('executeQuery')->willReturn($result);
    }

    private function stubCacheOk(): void
    {
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback): mixed {
                $item = new class implements ItemInterface {
                    public function getKey(): string
                    {
                        return '';
                    }

                    public function get(): mixed
                    {
                        return null;
                    }

                    public function isHit(): bool
                    {
                        return false;
                    }

                    public function set(mixed $value): static
                    {
                        return $this;
                    }

                    public function expiresAt(?DateTimeInterface $expiration): static
                    {
                        return $this;
                    }

                    public function expiresAfter(int|DateInterval|null $time): static
                    {
                        return $this;
                    }

                    public function tag(string|iterable $tags): static
                    {
                        return $this;
                    }

                    /** @return array<string, mixed> */
                    public function getMetadata(): array
                    {
                        return [];
                    }
                };

                return $callback($item);
            });
        $this->cache->method('delete')->willReturn(true);
    }

    private function createJwtKeys(): void
    {
        file_put_contents($this->projectDir . '/config/jwt/private.pem', 'fake-key');
        file_put_contents($this->projectDir . '/config/jwt/public.pem', 'fake-key');
    }

    // ── DB check ──────────────────────────────────────────────────────────

    public function testReturns503WhenDatabaseIsDown(): void
    {
        $this->connection->method('executeQuery')
            ->willThrowException(new RuntimeException('Connection refused'));

        $this->stubCacheOk();
        $this->createJwtKeys();

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame('error', $data['status']);
        $this->assertSame('error', $data['checks']['database']['status']);
    }

    // ── Cache check ───────────────────────────────────────────────────────

    public function testReturns503WhenCacheIsUnavailable(): void
    {
        $this->stubDbOk();
        $this->cache->method('get')
            ->willThrowException(new RuntimeException('Cache down'));

        $this->createJwtKeys();

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame('error', $data['checks']['cache']['status']);
    }

    // ── JWT key check ─────────────────────────────────────────────────────

    public function testReturns503WhenJwtPrivateKeyMissing(): void
    {
        $this->stubDbOk();
        $this->stubCacheOk();
        // Do NOT create JWT keys

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame('error', $data['checks']['jwtKeys']['status']);
        $this->assertStringContainsString('private key', $data['checks']['jwtKeys']['message']);
    }

    // ── All healthy ───────────────────────────────────────────────────────

    public function testReturns200WithOkStatusWhenEverythingIsHealthy(): void
    {
        $this->stubDbOk();
        $this->stubCacheOk();
        $this->createJwtKeys();

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertContains($data['status'], ['ok', 'degraded']); // 'degraded' if failed queue > 0
        $this->assertSame('ok', $data['checks']['database']['status']);
        $this->assertSame('ok', $data['checks']['cache']['status']);
        $this->assertSame('ok', $data['checks']['jwtKeys']['status']);
    }

    public function testResponseContainsTimestamp(): void
    {
        $this->stubDbOk();
        $this->stubCacheOk();
        $this->createJwtKeys();

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertArrayHasKey('timestamp', $data);
        $this->assertNotEmpty($data['timestamp']);
    }

    // ── Messenger queue degraded ──────────────────────────────────────────

    public function testReturnsDegradedStatusWhenFailedQueueHasMessages(): void
    {
        // First call (SELECT 1 for DB check) returns ok, second call returns failed count
        $resultOk = $this->createMock(Result::class);
        $resultFailed = $this->createMock(Result::class);
        $resultFailed->method('fetchOne')->willReturn('3');

        $this->connection->expects($this->exactly(2))
            ->method('executeQuery')
            ->willReturnOnConsecutiveCalls($resultOk, $resultFailed);

        $this->stubCacheOk();
        $this->createJwtKeys();

        $controller = $this->makeController();
        $response = $controller->check();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode()); // still 200 – degraded, not error
        $this->assertSame('degraded', $data['status']);
        $this->assertSame(3, $data['checks']['messengerQueue']['failedCount']);
    }
}
