<?php

namespace App\Service;

use App\Entity\DemoRequest;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Throwable;

/**
 * Stößt die Provisionierung einer isolierten Demo-Instanz per GitHub-Actions-Workflow an.
 *
 * Die Demo-Umgebung enthält vorbereitete Fixture-Accounts für den Verein "FC Sonnenberg"
 * mit je einem Zugang für folgende Rollen:
 *   – Vereins-Admin     (admin.sonnenberg@demo-kaderblick.de)
 *   – Cheftrainer       (trainer1.sonnenberg@demo-kaderblick.de)
 *   – Spieler           (spieler1.sonnenberg@demo-kaderblick.de)
 *   – Elternteil        (elternteil.sonnenberg@demo-kaderblick.de)
 *
 * Passwort für alle: DemoPass1!
 */
class DemoProvisioningService
{
    /** Passwort aller Demo-Fixture-Accounts (gesetzt durch UserFixtures). */
    private const DEMO_PASSWORD = 'DemoPass1!';

    /**
     * Demo-Accounts geordnet nach Rolle (Role-Label, E-Mail).
     *
     * @var list<array{role: string, email: string, description: string}>
     */
    private const DEMO_ACCOUNTS = [
        [
            'role' => 'Vereins-Admin',
            'email' => 'admin.sonnenberg@demo-kaderblick.de',
            'description' => 'Vereinsverwaltung, Teamverwaltung, Spielerprofile und Terminplanung',
        ],
        [
            'role' => 'Cheftrainer',
            'email' => 'trainer1.sonnenberg@demo-kaderblick.de',
            'description' => 'Trainingsplanung, Spielerbeurteilung, Aufstellungen und Spieltagesberichte',
        ],
        [
            'role' => 'Spieler',
            'email' => 'spieler1.sonnenberg@demo-kaderblick.de',
            'description' => 'Persönliches Profil, Terminübersicht, Teilnahmebestätigung und Nachrichten',
        ],
        [
            'role' => 'Elternteil',
            'email' => 'elternteil.sonnenberg@demo-kaderblick.de',
            'description' => 'Überblick über Termine und Aktivitäten des eigenen Kindes',
        ],
    ];

    public function __construct(
        private readonly EmailService $emailService,
        private readonly HttpClientInterface $httpClient,
        private readonly ParameterBagInterface $params,
        private readonly LoggerInterface $logger,
        private readonly string $githubToken,
        private readonly string $githubRepoOwner,
        private readonly string $githubRepoName,
    ) {
    }

    /**
     * Löst den GitHub-Actions-Workflow "provision-demo-instance.yml" aus.
     * Der Workflow provisioniert eine vollständig isolierte Demo-Instanz und
     * benachrichtigt das Backend anschließend per HMAC-gesichertem Webhook.
     *
     * @throws \RuntimeException wenn der GitHub-API-Call fehlschlägt
     */
    public function sendDemoAccess(DemoRequest $demoRequest): void
    {
        $demoToken = $this->generateDemoToken();
        $requestId = (string) $demoRequest->getId();

        $payload = [
            'ref' => 'main',
            'inputs' => [
                'demo_token' => $demoToken,
                'request_id' => $requestId,
                'image_tag' => 'latest',
                'deploy_alfahosting' => 'true',
                'deploy_hetzner' => 'false',
            ],
        ];

        try {
            $response = $this->httpClient->request(
                'POST',
                sprintf(
                    'https://api.github.com/repos/%s/%s/actions/workflows/provision-demo-instance.yml/dispatches',
                    $this->githubRepoOwner,
                    $this->githubRepoName
                ),
                [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $this->githubToken,
                        'Accept' => 'application/vnd.github+json',
                        'X-GitHub-Api-Version' => '2022-11-28',
                    ],
                    'json' => $payload,
                ]
            );

            $statusCode = $response->getStatusCode();
            // GitHub antwortet mit 204 No Content bei Erfolg
            if (204 !== $statusCode) {
                throw new \RuntimeException(
                    sprintf(
                        'GitHub-API hat unerwartet mit Status %d geantwortet (erwartet 204).',
                        $statusCode
                    )
                );
            }

            $this->logger->info(
                sprintf('Demo-Provisionierung für Request %s ausgelöst (Token: %s)', $requestId, $demoToken),
                ['demo_token' => $demoToken, 'request_id' => $requestId]
            );
        } catch (Throwable $e) {
            $this->logger->error(
                sprintf(
                    'Demo-Provisionierung für Request %s fehlgeschlagen: %s',
                    $requestId,
                    $e->getMessage()
                ),
                ['exception' => $e, 'request_id' => $requestId]
            );

            throw $e;
        }
    }

    /**
     * Gibt die konfigurierten Demo-Accounts zurück (z. B. für E-Mail-Templates / Vorschau).
     *
     * @return list<array{role: string, email: string, description: string}>
     */
    public function getDemoAccounts(): array
    {
        return self::DEMO_ACCOUNTS;
    }

    public function getDemoPassword(): string
    {
        return self::DEMO_PASSWORD;
    }

    private function generateDemoToken(): string
    {
        return bin2hex(random_bytes(4));
    }
}

