<?php

namespace App\Service;

use App\Entity\DemoRequest;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Throwable;

/**
 * Sendet Demo-Zugangsdaten an den Anfragenden.
 *
 * Die Demo-Umgebung enthält vorbereitete Fixture-Accounts für den Verein "FC Sonnenberg"
 * mit je einem Zugang für folgende Rollen:
 *   – Plattform-Admin   (superadmin.sonnenberg@demo-kaderblick.de)
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
            'role' => 'Plattform-Admin',
            'email' => 'superadmin.sonnenberg@demo-kaderblick.de',
            'description' => 'Vollzugriff auf alle Plattform-Funktionen, Benutzerverwaltung und Systemeinstellungen',
        ],
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
        private readonly ParameterBagInterface $params,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Erstellt die Demo-E-Mail mit allen Zugangsdaten und versendet sie an den Anfragenden.
     */
    public function sendDemoAccess(DemoRequest $demoRequest): void
    {
        $demoUrl = rtrim((string) $this->params->get('app.demo_url'), '/');

        try {
            $this->emailService->sendTemplatedEmail(
                $demoRequest->getEmail(),
                'Deine Kaderblick-Demo-Zugangsdaten',
                'demo_access_credentials',
                [
                    'demoRequest' => $demoRequest,
                    'demoUrl' => $demoUrl,
                    'accounts' => self::DEMO_ACCOUNTS,
                    'password' => self::DEMO_PASSWORD,
                ]
            );
        } catch (Throwable $e) {
            $this->logger->error(
                sprintf('Demo-Zugangsdaten konnten nicht an %s gesendet werden: %s', $demoRequest->getEmail(), $e->getMessage()),
                ['exception' => $e]
            );

            throw $e;
        }
    }

    /**
     * Gibt die konfigurierten Demo-Accounts zurück (z. B. für Tests / Vorschau).
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
}
