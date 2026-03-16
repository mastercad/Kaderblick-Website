<?php

namespace App\Service;

use App\Entity\SystemAlert;
use App\Entity\SystemAlertOccurrence;
use App\Enum\SystemAlertCategory;
use App\Repository\SystemAlertRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Throwable;
use Twig\Environment;

/**
 * Sendet proaktive Admin-Benachrichtigungen bei kritischen Fehlern,
 * Login-Fehlversuchen und verdächtigen Aktivitäten.
 *
 * Alle Benachrichtigungen sind throttled (Rate Limiting via Cache),
 * um E-Mail-Flooding zu verhindern.
 *
 * Zusätzlich werden Alerts in der Datenbank persistiert (SystemAlert-Entity)
 * und als Push-Notification an alle Admin-Nutzer gesendet.
 */
class AdminAlertService
{
    /**
     * Schwellwert für Brute-Force-Alarm: Anzahl Fehlversuche pro IP
     * innerhalb von BRUTE_FORCE_WINDOW_SECONDS.
     */
    private const BRUTE_FORCE_THRESHOLD = 5;
    private const BRUTE_FORCE_WINDOW_SECONDS = 600; // 10 Minuten

    /** Throttle-Zeiträume in Sekunden */
    private const THROTTLE_CRITICAL_ERROR = 600;    // 10 Minuten pro Fehler-Fingerabdruck
    private const THROTTLE_LOGIN_FAILURE = 300;    //  5 Minuten pro IP+E-Mail
    private const THROTTLE_BRUTE_FORCE = 900;    // 15 Minuten pro IP
    private const THROTTLE_SYSTEM_HEALTH = 3600;   //  1 Stunde für Infrastruktur-Alerts

    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly Environment $twig,
        private readonly CacheInterface $cache,
        private readonly LoggerInterface $securityLogger,
        private readonly EntityManagerInterface $entityManager,
        private readonly SystemAlertRepository $systemAlertRepository,
        private readonly UserRepository $userRepository,
        private readonly PushNotificationService $pushNotificationService,
        private readonly string $mailerFrom,
        private readonly string $adminAlertEmail,
    ) {
    }

    /**
     * Sendet einen Alert für einen kritischen Server-Fehler (5xx).
     */
    public function sendCriticalError(
        string $errorMessage,
        string $requestUri,
        string $method,
        string $clientIp,
        ?Throwable $exception = null
    ): void {
        $fingerprint = md5($errorMessage . $requestUri);

        $alert = $this->persistAlert(
            SystemAlertCategory::SERVER_ERROR,
            $fingerprint,
            $errorMessage,
            [
                'requestUri' => $requestUri,
                'httpMethod' => $method,
                'clientIp' => $clientIp,
                'exceptionClass' => $exception ? get_class($exception) : null,
                'stackTrace' => $exception?->getTraceAsString(),
                'context' => null,
            ]
        );

        $cacheKey = 'admin_alert_critical_' . $fingerprint;

        $this->sendThrottled($cacheKey, self::THROTTLE_CRITICAL_ERROR, function () use (
            $errorMessage,
            $requestUri,
            $method,
            $clientIp,
            $exception,
            $alert
        ): void {
            $this->send(
                '[FEHLER] Kritischer Server-Fehler auf kaderblick.de',
                [
                    'type' => 'critical_error',
                    'headline' => 'Kritischer Server-Fehler',
                    'color' => '#c0392b',
                    'icon' => '🔴',
                    'details' => array_filter([
                        'Fehlermeldung' => $errorMessage,
                        'URL' => $method . ' ' . $requestUri,
                        'IP-Adresse' => $clientIp,
                        'Exception-Typ' => $exception ? get_class($exception) : null,
                    ]),
                    'trace' => $exception?->getTraceAsString(),
                ]
            );

            $this->sendAdminPush(
                '🔴 Server-Fehler',
                $errorMessage,
                $alert->getId() ?? 0
            );
        });
    }

    /**
     * Sendet einen Alert für einen fehlgeschlagenen Login-Versuch.
     * Prüft automatisch ob Brute-Force-Schwellwert erreicht ist.
     *
     * @return int Anzahl der Fehlversuche dieser IP in den letzten 10 Minuten
     */
    public function trackLoginFailure(string $email, string $clientIp, string $reason): int
    {
        $failureCount = $this->incrementFailureCount($clientIp);

        // Login-Failure persistieren
        $loginFingerprint = md5('login_failure_' . $clientIp . $email);
        $loginAlert = $this->persistAlert(
            SystemAlertCategory::LOGIN_FAILURE,
            $loginFingerprint,
            sprintf('Fehlgeschlagener Login für "%s" von %s: %s', $email ?: '(unbekannt)', $clientIp, $reason),
            [
                'requestUri' => '/api/auth/login',
                'httpMethod' => 'POST',
                'clientIp' => $clientIp,
                'exceptionClass' => null,
                'stackTrace' => null,
                'context' => ['email' => $email, 'reason' => $reason, 'failureCount' => $failureCount],
            ]
        );

        // Einzel-Login-Fehler melden (pro IP+E-Mail throttled)
        $loginCacheKey = 'admin_alert_login_' . md5($clientIp . $email);
        $this->sendThrottled($loginCacheKey, self::THROTTLE_LOGIN_FAILURE, function () use (
            $email,
            $clientIp,
            $reason,
            $failureCount,
            $loginAlert
        ): void {
            $this->send(
                '[WARNUNG] Fehlgeschlagener Login auf kaderblick.de',
                [
                    'type' => 'login_failure',
                    'headline' => 'Fehlgeschlagener Login-Versuch',
                    'color' => '#e67e22',
                    'icon' => '🔑',
                    'details' => [
                        'E-Mail (versucht)' => $email ?: '(unbekannt)',
                        'IP-Adresse' => $clientIp,
                        'Grund' => $reason,
                        'Fehlversuche (IP)' => $failureCount . ' in den letzten 10 Min.',
                    ],
                    'trace' => null,
                ]
            );

            $this->sendAdminPush(
                '🔑 Login-Fehler',
                sprintf('Fehlversuch für "%s" von %s', $email ?: '(unbekannt)', $clientIp),
                $loginAlert->getId() ?? 0
            );
        });

        // Brute-Force-Alarm, wenn Schwellwert überschritten
        if ($failureCount >= self::BRUTE_FORCE_THRESHOLD) {
            $bruteFingerprint = md5('brute_force_' . $clientIp);
            $bruteAlert = $this->persistAlert(
                SystemAlertCategory::BRUTE_FORCE,
                $bruteFingerprint,
                sprintf('Möglicher Brute-Force-Angriff von %s (%d Fehlversuche)', $clientIp, $failureCount),
                [
                    'requestUri' => '/api/auth/login',
                    'httpMethod' => 'POST',
                    'clientIp' => $clientIp,
                    'exceptionClass' => null,
                    'stackTrace' => null,
                    'context' => ['failureCount' => $failureCount, 'threshold' => self::BRUTE_FORCE_THRESHOLD],
                ]
            );

            $bruteCacheKey = 'admin_alert_brute_' . md5($clientIp);
            $this->sendThrottled($bruteCacheKey, self::THROTTLE_BRUTE_FORCE, function () use (
                $clientIp,
                $failureCount,
                $bruteAlert
            ): void {
                $this->send(
                    '[ALARM] Möglicher Brute-Force-Angriff auf kaderblick.de',
                    [
                        'type' => 'brute_force',
                        'headline' => 'Verdächtige Login-Aktivität (Brute Force?)',
                        'color' => '#8e44ad',
                        'icon' => '🚨',
                        'details' => [
                            'IP-Adresse' => $clientIp,
                            'Fehlversuche' => $failureCount . ' in den letzten 10 Min. (Schwellwert: ' . self::BRUTE_FORCE_THRESHOLD . ')',
                        ],
                        'trace' => null,
                    ]
                );

                $this->sendAdminPush(
                    '🚨 Brute-Force-Alarm',
                    sprintf('%d Fehlversuche von %s', $failureCount, $clientIp),
                    $bruteAlert->getId() ?? 0
                );
            });
        }

        return $failureCount;
    }

    /**
     * Persistiert und meldet einen erkannten Scan- oder Hack-Versuch
     * (z. B. Path Traversal, .env-Probe, WordPress-Scanner usw.).
     * Throttled: maximal einmal alle 15 Minuten pro IP+URI.
     */
    public function trackSuspiciousRequest(
        string $requestUri,
        string $method,
        string $clientIp,
        string $matchedPattern
    ): void {
        $fingerprint = md5('suspicious_' . $clientIp . $requestUri);

        $alert = $this->persistAlert(
            SystemAlertCategory::SUSPICIOUS_REQUEST,
            $fingerprint,
            sprintf('Verdächtige Anfrage von %s: %s %s', $clientIp, $method, $requestUri),
            [
                'requestUri' => $requestUri,
                'httpMethod' => $method,
                'clientIp' => $clientIp,
                'exceptionClass' => null,
                'stackTrace' => null,
                'context' => ['matchedPattern' => $matchedPattern],
            ]
        );

        $cacheKey = 'admin_alert_suspicious_' . $fingerprint;

        $this->sendThrottled($cacheKey, self::THROTTLE_BRUTE_FORCE, function () use (
            $requestUri,
            $method,
            $clientIp,
            $matchedPattern,
            $alert
        ): void {
            $this->send(
                '[WARNUNG] Scan-/Hack-Versuch auf kaderblick.de',
                [
                    'type' => 'suspicious_request',
                    'headline' => 'Verdächtige Anfrage erkannt',
                    'color' => '#d84315',
                    'icon' => '🔍',
                    'details' => [
                        'IP-Adresse' => $clientIp,
                        'Anfrage' => $method . ' ' . $requestUri,
                        'Erkanntes Muster' => $matchedPattern,
                    ],
                    'trace' => null,
                ]
            );

            $this->sendAdminPush(
                '🔍 Hack-Versuch erkannt',
                sprintf('%s %s von %s', $method, $requestUri, $clientIp),
                $alert->getId() ?? 0
            );
        });
    }

    /**
     * Persistiert und meldet fehlgeschlagene Nachrichten in der Messenger-Queue.
     * Throttled: maximal einmal pro Stunde.
     */
    public function trackQueueFailure(int $failedCount): void
    {
        $fingerprint = md5('queue_failure');

        $alert = $this->persistAlert(
            SystemAlertCategory::QUEUE_FAILURE,
            $fingerprint,
            sprintf('%d fehlgeschlagene Nachricht(en) in der Messenger-Queue', $failedCount),
            [
                'requestUri' => null,
                'httpMethod' => null,
                'clientIp' => null,
                'exceptionClass' => null,
                'stackTrace' => null,
                'context' => ['failedCount' => $failedCount],
            ]
        );

        $cacheKey = 'admin_alert_queue_failure';

        $this->sendThrottled($cacheKey, self::THROTTLE_SYSTEM_HEALTH, function () use ($failedCount, $alert): void {
            $this->send(
                '[WARNUNG] Fehlgeschlagene Nachrichten in der Messenger-Queue',
                [
                    'type' => 'queue_failure',
                    'headline' => 'Messenger-Queue: Fehlgeschlagene Nachrichten',
                    'color' => '#1565c0',
                    'icon' => '📭',
                    'details' => [
                        'Anzahl fehlgeschlagener Nachrichten' => $failedCount,
                        'Behebung' => 'bin/console messenger:failed:show / messenger:failed:retry',
                    ],
                    'trace' => null,
                ]
            );

            $this->sendAdminPush(
                '📭 Queue-Fehler',
                sprintf('%d fehlgeschlagene Nachrichten in der Messenger-Queue', $failedCount),
                $alert->getId() ?? 0
            );
        });
    }

    /**
     * Persistiert und meldet eine Festplatten-Warnung.
     * Throttled: maximal einmal pro Stunde pro Pfad.
     */
    public function trackDiskSpaceWarning(string $path, int $usedPercent, int $freeMiB): void
    {
        $fingerprint = md5('disk_space_' . $path);

        $alert = $this->persistAlert(
            SystemAlertCategory::DISK_SPACE,
            $fingerprint,
            sprintf('Festplatten-Warnung: %s – %d %% belegt, %d MiB frei', $path, $usedPercent, $freeMiB),
            [
                'requestUri' => null,
                'httpMethod' => null,
                'clientIp' => null,
                'exceptionClass' => null,
                'stackTrace' => null,
                'context' => ['path' => $path, 'usedPercent' => $usedPercent, 'freeMiB' => $freeMiB],
            ]
        );

        $cacheKey = 'admin_alert_disk_' . md5($path);

        $this->sendThrottled($cacheKey, self::THROTTLE_SYSTEM_HEALTH, function () use ($path, $usedPercent, $freeMiB, $alert): void {
            $this->send(
                '[WARNUNG] Festplattenspeicher kritisch auf kaderblick.de',
                [
                    'type' => 'disk_space',
                    'headline' => 'Festplattenspeicher kritisch',
                    'color' => '#f57f17',
                    'icon' => '💾',
                    'details' => [
                        'Pfad' => $path,
                        'Belegt' => $usedPercent . ' %',
                        'Frei' => $freeMiB . ' MiB',
                    ],
                    'trace' => null,
                ]
            );

            $this->sendAdminPush(
                '💾 Festplatte fast voll',
                sprintf('%d %% belegt – %d MiB frei (%s)', $usedPercent, $freeMiB, $path),
                $alert->getId() ?? 0
            );
        });
    }

    /**
     * Persistiert und meldet einen ausgefallenen Cron-Job.
     * Throttled: maximal einmal pro Stunde pro Command.
     */
    public function trackCronFailure(string $commandName, int $minutesMissed): void
    {
        $fingerprint = md5('cron_failure_' . $commandName);

        $alert = $this->persistAlert(
            SystemAlertCategory::CRON_FAILURE,
            $fingerprint,
            sprintf('Cron-Job "%s" hat seit %d Minuten nicht mehr gemeldet', $commandName, $minutesMissed),
            [
                'requestUri' => null,
                'httpMethod' => null,
                'clientIp' => null,
                'exceptionClass' => null,
                'stackTrace' => null,
                'context' => ['commandName' => $commandName, 'minutesMissed' => $minutesMissed],
            ]
        );

        $cacheKey = 'admin_alert_cron_' . md5($commandName);

        $this->sendThrottled($cacheKey, self::THROTTLE_SYSTEM_HEALTH, function () use ($commandName, $minutesMissed, $alert): void {
            $this->send(
                '[WARNUNG] Cron-Job ausgefallen auf kaderblick.de',
                [
                    'type' => 'cron_failure',
                    'headline' => 'Cron-Job meldet sich nicht mehr',
                    'color' => '#6d4c41',
                    'icon' => '⏰',
                    'details' => [
                        'Befehl' => $commandName,
                        'Letzte Ausführung' => sprintf('vor %d Minuten', $minutesMissed),
                    ],
                    'trace' => null,
                ]
            );

            $this->sendAdminPush(
                '⏰ Cron-Ausfall',
                sprintf('"%s" meldet sich seit %d Minuten nicht', $commandName, $minutesMissed),
                $alert->getId() ?? 0
            );
        });
    }

    // -------------------------------------------------------------------------
    // Interne Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Persistiert einen Alert in der Datenbank.
     * Existiert bereits ein offener Alert mit gleichem Fingerabdruck, wird er inkrementiert.
     *
     * @param array{requestUri: ?string, httpMethod: ?string, clientIp: ?string, exceptionClass: ?string, stackTrace: ?string, context: ?array<string,mixed>} $data
     */
    private function persistAlert(
        SystemAlertCategory $category,
        string $fingerprint,
        string $message,
        array $data
    ): SystemAlert {
        $alert = $this->systemAlertRepository->findOpenByFingerprint($fingerprint);

        if (null !== $alert) {
            $alert->incrementOccurrence();
        } else {
            $alert = new SystemAlert($category, $fingerprint, $message);
            $alert->setRequestUri($data['requestUri']);
            $alert->setHttpMethod($data['httpMethod']);
            $alert->setClientIp($data['clientIp']);
            $alert->setExceptionClass($data['exceptionClass']);
            $alert->setStackTrace($data['stackTrace']);
            $alert->setContext($data['context']);
            $this->entityManager->persist($alert);
        }

        // Jede einzelne Auslösung als Occurrence-Eintrag für Zeitreihen-Auswertungen
        $occurrence = new SystemAlertOccurrence($alert);
        $this->entityManager->persist($occurrence);

        try {
            $this->entityManager->flush();
        } catch (Throwable $e) {
            $this->securityLogger->error(
                sprintf('AdminAlertService: Alert konnte nicht persistiert werden: %s', $e->getMessage()),
                ['exception' => $e]
            );
        }

        return $alert;
    }

    /**
     * Sendet eine Push-Benachrichtigung an alle Admin-Nutzer.
     */
    private function sendAdminPush(string $title, string $body, int $alertId): void
    {
        $url = '/admin/system-alerts' . ($alertId > 0 ? '/' . $alertId : '');

        foreach ($this->userRepository->findAdmins() as $admin) {
            try {
                $this->pushNotificationService->sendNotification($admin, $title, $body, $url);
            } catch (Throwable $e) {
                $this->securityLogger->warning(
                    sprintf('AdminAlertService: Push an %s fehlgeschlagen: %s', $admin->getEmail(), $e->getMessage())
                );
            }
        }
    }

    /**
     * Führt $sendCallback nur aus, wenn in den letzten $ttl Sekunden
     * noch kein Alert mit demselben $cacheKey gesendet wurde.
     */
    private function sendThrottled(string $cacheKey, int $ttl, callable $sendCallback): void
    {
        $wasNew = false;
        $this->cache->get($cacheKey, static function (ItemInterface $item) use ($ttl, &$wasNew): true {
            $item->expiresAfter($ttl);
            $wasNew = true;

            return true;
        });

        if (!$wasNew) {
            // Alert für diesen Fingerabdruck wurde bereits kürzlich gesendet
            return;
        }

        try {
            $sendCallback();
        } catch (Throwable $e) {
            // Cache-Eintrag entfernen, damit beim nächsten Mal erneut versucht wird
            $this->cache->delete($cacheKey);
            $this->securityLogger->error(
                sprintf('AdminAlertService: E-Mail konnte nicht gesendet werden: %s', $e->getMessage()),
                ['exception' => $e]
            );
        }
    }

    /**
     * Inkrementiert den Fehlversuchs-Zähler für eine IP.
     * Fenster: BRUTE_FORCE_WINDOW_SECONDS ab dem ersten Fehlversuch.
     */
    private function incrementFailureCount(string $ip): int
    {
        $key = 'login_fail_count_' . md5($ip);
        $isNew = false;

        $current = $this->cache->get($key, static function (ItemInterface $item) use (&$isNew): int {
            $item->expiresAfter(self::BRUTE_FORCE_WINDOW_SECONDS);
            $isNew = true;

            return 1;
        });

        if (!$isNew) {
            // Zähler erhöhen (delete + recreate, da CacheInterface kein update kennt)
            $newCount = (int) $current + 1;
            $this->cache->delete($key);
            $this->cache->get($key, static function (ItemInterface $item) use ($newCount): int {
                $item->expiresAfter(self::BRUTE_FORCE_WINDOW_SECONDS);

                return $newCount;
            });

            return $newCount;
        }

        return 1;
    }

    /**
     * Sendet die eigentliche Alert-E-Mail via Twig-Template.
     *
     * @param array<string, mixed> $context
     */
    private function send(string $subject, array $context): void
    {
        $html = $this->twig->render('emails/admin_alert.html.twig', array_merge([
            'website_name' => 'Kaderblick',
            'current_year' => date('Y'),
            'timestamp' => date('d.m.Y H:i:s'),
        ], $context));

        $email = (new Email())
            ->from($this->mailerFrom)
            ->to($this->adminAlertEmail)
            ->subject($subject)
            ->html($html);

        $this->mailer->send($email);

        $this->securityLogger->warning(
            sprintf('AdminAlertService: Alert gesendet – %s', $subject),
            ['type' => $context['type'] ?? 'unknown']
        );
    }
}
