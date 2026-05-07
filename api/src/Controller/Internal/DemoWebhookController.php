<?php

namespace App\Controller\Internal;

use App\Entity\DemoInstance;
use App\Entity\DemoRequest;
use App\Repository\DemoInstanceRepository;
use App\Repository\DemoRequestRepository;
use App\Service\DemoProvisioningService;
use App\Service\EmailService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Empfängt HMAC-gesicherte Webhook-Callbacks vom GitHub-Actions-Workflow
 * nach Abschluss der Demo-Provisionierung oder des Teardowns.
 *
 * Der Endpunkt ist öffentlich (keine JWT-Auth), aber gegen HMAC-Signatur gesichert.
 */
#[Route('/internal', name: 'internal_')]
class DemoWebhookController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DemoRequestRepository $demoRequestRepository,
        private readonly DemoInstanceRepository $demoInstanceRepository,
        private readonly DemoProvisioningService $demoProvisioningService,
        private readonly EmailService $emailService,
        private readonly LoggerInterface $logger,
        private readonly string $demoWebhookSecret,
    ) {
    }

    #[Route('/demo-webhook', name: 'demo_webhook', methods: ['POST'])]
    public function handle(Request $request): JsonResponse
    {
        // ── HMAC-Signatur prüfen ────────────────────────────────────────────
        $rawBody = $request->getContent();
        $signatureHeader = $request->headers->get('X-Demo-Signature', '');

        if (!$this->isValidSignature($rawBody, $signatureHeader)) {
            $this->logger->warning('Demo-Webhook: Ungültige Signatur abgelehnt.', [
                'remote_addr' => $request->getClientIp(),
            ]);

            return $this->json(['error' => 'Unauthorized'], 401);
        }

        // ── Payload parsen ──────────────────────────────────────────────────
        /** @var array<string, mixed>|null $data */
        $data = json_decode($rawBody, true);

        if (!is_array($data)) {
            return $this->json(['error' => 'Invalid payload'], 400);
        }

        $requestId = isset($data['request_id']) ? (int) $data['request_id'] : 0;
        $demoToken = isset($data['demo_token']) ? (string) $data['demo_token'] : '';
        $status = isset($data['status']) ? (string) $data['status'] : '';

        if ($requestId <= 0 || '' === $demoToken || '' === $status) {
            return $this->json(['error' => 'Missing required fields'], 400);
        }

        $demoRequest = $this->demoRequestRepository->find($requestId);

        if (!$demoRequest instanceof DemoRequest) {
            $this->logger->error('Demo-Webhook: DemoRequest nicht gefunden.', ['request_id' => $requestId]);

            return $this->json(['error' => 'DemoRequest not found'], 404);
        }

        // ── Status-Handler ──────────────────────────────────────────────────
        match ($status) {
            'active'  => $this->handleActive($demoRequest, $demoToken, $data),
            'revoked' => $this->handleRevoked($demoRequest, $demoToken),
            'failed'  => $this->handleFailed($demoRequest, $demoToken),
            default   => null,
        };

        return $this->json(['ok' => true]);
    }

    /**
     * @param array<string, mixed> $data
     */
    private function handleActive(DemoRequest $demoRequest, string $demoToken, array $data): void
    {
        $frontendUrl = isset($data['frontend_url']) ? (string) $data['frontend_url'] : '';
        $apiUrl = isset($data['api_url']) ? (string) $data['api_url'] : '';
        $dbName = isset($data['db_name']) ? (string) $data['db_name'] : '';
        $dbUser = isset($data['db_user']) ? (string) $data['db_user'] : '';
        $dbPassword = isset($data['db_password']) ? (string) $data['db_password'] : '';

        // DemoInstance anlegen oder aktualisieren
        $instance = $this->demoInstanceRepository->findByToken($demoToken);

        if (!$instance instanceof DemoInstance) {
            $instance = new DemoInstance();
            $instance->setDemoToken($demoToken);
            $instance->setDemoRequest($demoRequest);
            $this->em->persist($instance);
        }

        $instance->setFrontendUrl($frontendUrl)
            ->setApiUrl($apiUrl)
            ->setDbName($dbName)
            ->setDbUser($dbUser)
            ->setDbPasswordEncrypted($this->encryptPassword($dbPassword))
            ->setStatus(DemoInstance::STATUS_ACTIVE)
            ->setExpiresAt(new DateTime('+14 days'));

        $demoRequest->setStatus(DemoRequest::STATUS_ACTIVE);

        $this->em->flush();

        // E-Mail mit Zugangsdaten an den Anfragenden senden
        try {
            $this->emailService->sendTemplatedEmail(
                $demoRequest->getEmail(),
                'Deine Kaderblick-Demo ist bereit',
                'demo_instance_ready',
                [
                    'demoRequest' => $demoRequest,
                    'frontendUrl' => $frontendUrl,
                    'accounts' => $this->demoProvisioningService->getDemoAccounts(),
                    'password' => $this->demoProvisioningService->getDemoPassword(),
                    'expiresAt' => $instance->getExpiresAt(),
                ]
            );
        } catch (\Throwable $e) {
            $this->logger->error('Demo-Webhook: E-Mail konnte nicht gesendet werden.', [
                'exception' => $e,
                'demo_token' => $demoToken,
                'request_id' => $demoRequest->getId(),
            ]);
        }

        $this->logger->info('Demo-Instanz aktiviert.', [
            'demo_token' => $demoToken,
            'request_id' => $demoRequest->getId(),
            'frontend_url' => $frontendUrl,
        ]);
    }

    private function handleRevoked(DemoRequest $demoRequest, string $demoToken): void
    {
        $instance = $this->demoInstanceRepository->findByToken($demoToken);

        if ($instance instanceof DemoInstance) {
            $instance->setStatus(DemoInstance::STATUS_REVOKED);
        }

        $demoRequest->setStatus(DemoRequest::STATUS_REVOKED);
        $this->em->flush();

        $this->logger->info('Demo-Instanz widerrufen.', [
            'demo_token' => $demoToken,
            'request_id' => $demoRequest->getId(),
        ]);
    }

    private function handleFailed(DemoRequest $demoRequest, string $demoToken): void
    {
        $instance = $this->demoInstanceRepository->findByToken($demoToken);

        if ($instance instanceof DemoInstance) {
            $instance->setStatus(DemoInstance::STATUS_FAILED);
        }

        $demoRequest->setStatus(DemoRequest::STATUS_FAILED);
        $this->em->flush();

        $this->logger->error('Demo-Provisionierung fehlgeschlagen.', [
            'demo_token' => $demoToken,
            'request_id' => $demoRequest->getId(),
        ]);
    }

    private function isValidSignature(string $body, string $header): bool
    {
        if (!str_starts_with($header, 'sha256=')) {
            return false;
        }

        $receivedHash = substr($header, 7);
        $expectedHash = hash_hmac('sha256', $body, $this->demoWebhookSecret);

        return hash_equals($expectedHash, $receivedHash);
    }

    private function encryptPassword(string $plaintext): string
    {
        if ('' === $plaintext) {
            return '';
        }

        // Einfache base64-Kodierung als Obfuscation; für echte Verschlüsselung
        // sollte sodium_crypto_secretbox mit APP_SECRET genutzt werden.
        return base64_encode($plaintext);
    }
}
