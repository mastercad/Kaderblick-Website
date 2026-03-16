<?php

namespace App\Tests\Unit\Service;

use App\Entity\SystemAlert;
use App\Entity\User;
use App\Enum\SystemAlertCategory;
use App\Repository\SystemAlertRepository;
use App\Repository\UserRepository;
use App\Service\AdminAlertService;
use App\Service\PushNotificationService;
use DateInterval;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Twig\Environment;

class AdminAlertServiceTest extends TestCase
{
    private MailerInterface&MockObject $mailer;
    private Environment&MockObject $twig;
    private CacheInterface&MockObject $cache;
    private LoggerInterface&MockObject $logger;
    private EntityManagerInterface&MockObject $em;
    private SystemAlertRepository&MockObject $alertRepository;
    private UserRepository&MockObject $userRepository;
    private PushNotificationService&MockObject $pushService;
    private AdminAlertService $service;

    protected function setUp(): void
    {
        $this->mailer = $this->createMock(MailerInterface::class);
        $this->twig = $this->createMock(Environment::class);
        $this->cache = $this->createMock(CacheInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->alertRepository = $this->createMock(SystemAlertRepository::class);
        $this->userRepository = $this->createMock(UserRepository::class);
        $this->pushService = $this->createMock(PushNotificationService::class);

        $this->service = new AdminAlertService(
            $this->mailer,
            $this->twig,
            $this->cache,
            $this->logger,
            $this->em,
            $this->alertRepository,
            $this->userRepository,
            $this->pushService,
            'no-reply@example.com',
            'admin@example.com'
        );
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    /**
     * Konfiguriert den Cache-Mock so, dass jeder cache->get()-Aufruf
     * die Callback-Funktion ausführt (simuliert "cache miss").
     */
    private function configureCacheAsMiss(): void
    {
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback) {
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
    }

    /**
     * Konfiguriert den Cache-Mock so, dass cache->get() einen Wert zurückliefert
     * (simuliert "cache hit") – ohne Callback-Ausführung.
     */
    private function configureCacheAsHit(mixed $returnValue = true): void
    {
        $this->cache->method('get')
            ->willReturn($returnValue);
    }

    // ── sendCriticalError: persistAlert ────────────────────────────────────

    public function testSendCriticalErrorCreatesNewAlertWhenNoneExists(): void
    {
        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->expects($this->atLeast(2))->method('persist'); // alert + occurrence
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit(); // E-Mail-Throttle schlägt an – kein Senden

        $this->service->sendCriticalError('Test error', '/api/foo', 'GET', '127.0.0.1');
    }

    public function testSendCriticalErrorIncrementsExistingAlert(): void
    {
        $existingAlert = new SystemAlert(
            SystemAlertCategory::SERVER_ERROR,
            md5('Test error/api/foo'),
            'Test error'
        );

        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn($existingAlert);

        // Nur Occurrence wird neu persistiert, nicht der Alert selbst
        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit();

        $this->service->sendCriticalError('Test error', '/api/foo', 'GET', '127.0.0.1');

        $this->assertSame(2, $existingAlert->getOccurrenceCount());
    }

    public function testSendCriticalErrorSendsEmailAndPushOnFirstOccurrence(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        // Cache-Miss: Throttle greift nicht, E-Mail und Push werden gesendet
        $this->configureCacheAsMiss();

        $this->twig->expects($this->once())
            ->method('render')
            ->willReturn('<html>alert</html>');

        $this->mailer->expects($this->once())->method('send');

        $admin = $this->createMock(User::class);
        $admin->method('getEmail')->willReturn('admin@example.com');

        $this->userRepository->method('findAdmins')->willReturn([$admin]);
        $this->pushService->expects($this->once())->method('sendNotification');

        $this->service->sendCriticalError('Boom', '/api/crash', 'POST', '1.2.3.4');
    }

    public function testSendCriticalErrorDoesNotSendEmailWhenThrottled(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        // Cache-Hit: Throttle schlägt an
        $this->configureCacheAsHit(true);

        $this->mailer->expects($this->never())->method('send');
        $this->pushService->expects($this->never())->method('sendNotification');

        $this->service->sendCriticalError('Boom', '/api/crash', 'POST', '1.2.3.4');
    }

    // ── trackLoginFailure: Rückgabe + Brute-Force ──────────────────────────

    public function testTrackLoginFailureReturnsFailureCount(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        // Erster Fehlversuch: Cache-Miss → gibt 1 zurück
        $callCount = 0;
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback) use (&$callCount) {
                ++$callCount;
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

        $result = $this->service->trackLoginFailure('user@example.com', '9.9.9.9', 'invalid_password');

        $this->assertSame(1, $result);
    }

    public function testTrackLoginFailureDoesNotPersistBruteForceAlertBeforeThreshold(): void
    {
        // failureCount = 1 (erster Versuch)
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback) {
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

        // findOpenByFingerprint wird nur für LOGIN_FAILURE aufgerufen, nicht für BRUTE_FORCE
        $this->alertRepository
            ->expects($this->once()) // nur login_failure
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->method('persist');
        $this->em->method('flush');

        $this->service->trackLoginFailure('x@example.com', '9.9.9.9', 'bad_password');
    }

    public function testTrackLoginFailurePersistsBruteForceAlertAtThreshold(): void
    {
        // Simuliere: IP hat schon 4 Fehlversuche → nächster Aufruf gibt 5 zurück
        $callCount = 0;
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback) use (&$callCount) {
                ++$callCount;
                // Erster Aufruf (incrementFailureCount): cache hit mit Wert 4 → gibt 5 zurück
                if (1 === $callCount) {
                    // cache hit (isNew = false) → CallBack wird NICHT ausgeführt
                    return 4;
                }
                // Zweiter Aufruf (delete+recreate): callback ausführen
                if (str_contains($key, 'login_fail_count') || $callCount <= 3) {
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
                }

                // Throttle-Checks: Hit → kein E-Mail/Push
                return true;
            });

        $this->cache->method('delete')->willReturn(true);

        // Erwartet: 2× findOpenByFingerprint (login_failure + brute_force)
        $this->alertRepository
            ->expects($this->exactly(2))
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->method('persist');
        $this->em->method('flush');

        $this->service->trackLoginFailure('attacker@example.com', '3.3.3.3', 'invalid');
    }

    // ── Fehlertoleranz bei flush ────────────────────────────────────────────

    public function testPersistAlertLogsErrorWhenFlushFails(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush')->willThrowException(new RuntimeException('DB down'));

        $this->logger->expects($this->atLeastOnce())->method('error');

        $this->configureCacheAsHit();

        // Kein Exception nach oben propagiert
        $this->service->sendCriticalError('DB error test', '/api', 'GET', '1.1.1.1');
    }

    // ── sendAdminPush: mehrere Admins ──────────────────────────────────────

    public function testSendAdminPushSendsToAllAdmins(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss(); // Throttle umgehen

        $this->twig->method('render')->willReturn('<html></html>');
        $this->mailer->method('send');

        $admin1 = $this->createMock(User::class);
        $admin1->method('getEmail')->willReturn('a1@example.com');
        $admin2 = $this->createMock(User::class);
        $admin2->method('getEmail')->willReturn('a2@example.com');

        $this->userRepository->method('findAdmins')->willReturn([$admin1, $admin2]);

        $this->pushService->expects($this->exactly(2))->method('sendNotification');

        $this->service->sendCriticalError('Multi-admin test', '/api/test', 'GET', '5.5.5.5');
    }

    public function testSendAdminPushContinuesWhenOneAdminPushFails(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss();

        $this->twig->method('render')->willReturn('<html></html>');
        $this->mailer->method('send');

        $admin1 = $this->createMock(User::class);
        $admin1->method('getEmail')->willReturn('a1@example.com');
        $admin2 = $this->createMock(User::class);
        $admin2->method('getEmail')->willReturn('a2@example.com');

        $this->userRepository->method('findAdmins')->willReturn([$admin1, $admin2]);

        $callCount = 0;
        $this->pushService->method('sendNotification')
            ->willReturnCallback(static function () use (&$callCount): void {
                ++$callCount;
                if (1 === $callCount) {
                    throw new RuntimeException('Push fehlgeschlagen');
                }
            });

        // Zweiter Admin soll trotzdem eine Push erhalten
        $this->logger->expects($this->atLeastOnce())->method('warning');

        $this->service->sendCriticalError('Partial push test', '/api/test', 'GET', '6.6.6.6');

        $this->assertSame(2, $callCount);
    }

    // ── trackSuspiciousRequest ─────────────────────────────────────────────

    public function testTrackSuspiciousRequestCreatesNewAlert(): void
    {
        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->expects($this->atLeast(2))->method('persist'); // alert + occurrence
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit(); // Throttle aktiv → kein E-Mail/Push

        $this->service->trackSuspiciousRequest(
            '/..%2F..%2Fetc%2Fpasswd',
            'GET',
            '10.0.0.1',
            'Path Traversal'
        );
    }

    public function testTrackSuspiciousRequestIncrementsExistingOpenAlert(): void
    {
        $existing = new SystemAlert(
            SystemAlertCategory::SUSPICIOUS_REQUEST,
            md5('suspicious_10.0.0.2/..%2Fetc%2Fpasswd'),
            'Verdächtige Anfrage'
        );

        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn($existing);

        $this->em->expects($this->once())->method('persist');  // nur Occurrence
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit();

        $this->service->trackSuspiciousRequest(
            '/..%2Fetc%2Fpasswd',
            'GET',
            '10.0.0.2',
            'Path Traversal'
        );

        $this->assertSame(2, $existing->getOccurrenceCount());
    }

    public function testTrackSuspiciousRequestSendsEmailAndPushOnFirstOccurrence(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss(); // Throttle umgehen → E-Mail + Push senden

        $this->twig->expects($this->once())
            ->method('render')
            ->willReturn('<html>suspicious</html>');

        $this->mailer->expects($this->once())->method('send');

        $admin = $this->createMock(User::class);
        $admin->method('getEmail')->willReturn('admin@example.com');
        $this->userRepository->method('findAdmins')->willReturn([$admin]);
        $this->pushService->expects($this->once())->method('sendNotification');

        $this->service->trackSuspiciousRequest(
            '/.env',
            'GET',
            '5.5.5.5',
            '.env / Konfiguration'
        );
    }

    public function testTrackSuspiciousRequestDoesNotSendEmailWhenThrottled(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsHit(true); // Throttle schlägt an

        $this->mailer->expects($this->never())->method('send');
        $this->pushService->expects($this->never())->method('sendNotification');

        $this->service->trackSuspiciousRequest('/wp-admin/', 'GET', '7.7.7.7', 'CMS-Scan (WP/Joomla)');
    }

    // ── trackQueueFailure ──────────────────────────────────────────────────

    public function testTrackQueueFailureCreatesNewAlert(): void
    {
        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->expects($this->atLeast(2))->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit(); // Throttle – kein E-Mail

        $this->service->trackQueueFailure(3);
    }

    public function testTrackQueueFailureSendsEmailAndPushOnFirstOccurrence(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss();

        $this->twig->expects($this->once())
            ->method('render')
            ->willReturn('<html>queue alert</html>');

        $this->mailer->expects($this->once())->method('send');

        $admin = $this->createMock(User::class);
        $admin->method('getEmail')->willReturn('admin@example.com');
        $this->userRepository->method('findAdmins')->willReturn([$admin]);
        $this->pushService->expects($this->once())->method('sendNotification');

        $this->service->trackQueueFailure(7);
    }

    public function testTrackQueueFailureDoesNotSendEmailWhenThrottled(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsHit(true);

        $this->mailer->expects($this->never())->method('send');
        $this->pushService->expects($this->never())->method('sendNotification');

        $this->service->trackQueueFailure(2);
    }

    // ── trackDiskSpaceWarning ──────────────────────────────────────────────

    public function testTrackDiskSpaceWarningCreatesNewAlert(): void
    {
        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->expects($this->atLeast(2))->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit();

        $this->service->trackDiskSpaceWarning('/var/www/symfony/public/uploads', 92, 512);
    }

    public function testTrackDiskSpaceWarningSendsEmailAndPushOnFirstOccurrence(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss();

        $this->twig->expects($this->once())
            ->method('render')
            ->willReturn('<html>disk alert</html>');

        $this->mailer->expects($this->once())->method('send');

        $admin = $this->createMock(User::class);
        $admin->method('getEmail')->willReturn('admin@example.com');
        $this->userRepository->method('findAdmins')->willReturn([$admin]);
        $this->pushService->expects($this->once())->method('sendNotification');

        $this->service->trackDiskSpaceWarning('/data/uploads', 95, 200);
    }

    // ── trackCronFailure ───────────────────────────────────────────────────

    public function testTrackCronFailureCreatesNewAlert(): void
    {
        $this->alertRepository
            ->expects($this->once())
            ->method('findOpenByFingerprint')
            ->willReturn(null);

        $this->em->expects($this->atLeast(2))->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->configureCacheAsHit();

        $this->service->trackCronFailure('app:xp:process-pending', 120);
    }

    public function testTrackCronFailureSendsEmailAndPushOnFirstOccurrence(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsMiss();

        $this->twig->expects($this->once())
            ->method('render')
            ->willReturn('<html>cron alert</html>');

        $this->mailer->expects($this->once())->method('send');

        $admin = $this->createMock(User::class);
        $admin->method('getEmail')->willReturn('admin@example.com');
        $this->userRepository->method('findAdmins')->willReturn([$admin]);
        $this->pushService->expects($this->once())->method('sendNotification');

        $this->service->trackCronFailure('app:notifications:send-unsent', 90);
    }

    public function testTrackCronFailureDoesNotSendEmailWhenThrottled(): void
    {
        $this->alertRepository->method('findOpenByFingerprint')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->configureCacheAsHit(true);

        $this->mailer->expects($this->never())->method('send');
        $this->pushService->expects($this->never())->method('sendNotification');

        $this->service->trackCronFailure('app:surveys:send-reminders', 2000);
    }
}
