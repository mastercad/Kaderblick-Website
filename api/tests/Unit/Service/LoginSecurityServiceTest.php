<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Service\LoginSecurityService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Cache\CacheInterface;

class LoginSecurityServiceTest extends TestCase
{
    private CacheInterface&MockObject $cache;
    private EntityManagerInterface&MockObject $em;
    private MailerInterface&MockObject $mailer;
    private LoginSecurityService $service;

    protected function setUp(): void
    {
        $this->cache = $this->createMock(CacheInterface::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->mailer = $this->createMock(MailerInterface::class);

        $this->service = new LoginSecurityService(
            $this->cache,
            $this->em,
            $this->mailer,
            'noreply@kaderblick.de',
            'https://kaderblick.de',
        );
    }

    private function makeUser(string $email = 'user@example.com'): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Max');

        return $user;
    }

    // ── isRateLimited() ──────────────────────────────────────────────────────

    public function testIsRateLimitedReturnsFalseWhenCountIsZero(): void
    {
        $this->cache->method('get')->willReturn(0);

        $this->assertFalse($this->service->isRateLimited('1.2.3.4'));
    }

    public function testIsRateLimitedReturnsFalseWhenCountBelowThreshold(): void
    {
        $this->cache->method('get')->willReturn(9);

        $this->assertFalse($this->service->isRateLimited('1.2.3.4'));
    }

    public function testIsRateLimitedReturnsTrueAtThreshold(): void
    {
        $this->cache->method('get')->willReturn(10);

        $this->assertTrue($this->service->isRateLimited('1.2.3.4'));
    }

    public function testIsRateLimitedReturnsTrueAboveThreshold(): void
    {
        $this->cache->method('get')->willReturn(50);

        $this->assertTrue($this->service->isRateLimited('5.5.5.5'));
    }

    // ── isAccountLocked() ────────────────────────────────────────────────────

    public function testIsAccountLockedReturnsFalseForUnlockedUser(): void
    {
        $user = $this->makeUser();

        $this->assertFalse($this->service->isAccountLocked($user));
    }

    public function testIsAccountLockedReturnsTrueForLockedUser(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());

        $this->assertTrue($this->service->isAccountLocked($user));
    }

    // ── handleSuccessfulLogin() – known device ─────────────────────────────

    public function testHandleSuccessfulLoginKnownDeviceDoesNotSendEmail(): void
    {
        $plainToken = 'my-known-device-token';
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', $plainToken)]);

        $this->mailer->expects($this->never())->method('send');
        $this->em->expects($this->never())->method('flush');

        $result = $this->service->handleSuccessfulLogin($user, $plainToken);
        $this->assertNull($result, 'Known device must return null (no new cookie needed)');
    }

    // ── handleSuccessfulLogin() – very first login (empty list) ─────────────

    public function testHandleSuccessfulLoginFirstEverLoginDoesNotSendEmail(): void
    {
        // No known devices yet → silent registration, no warning.
        $user = $this->makeUser('target@example.com');
        $user->setKnownDeviceTokens([]);

        $this->mailer->expects($this->never())->method('send');
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);
    }

    public function testHandleSuccessfulLoginFirstEverLoginStoresDeviceTokenHash(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([]);

        $this->em->method('flush');

        $newToken = $this->service->handleSuccessfulLogin($user, null);

        $this->assertNotNull($newToken);
        $this->assertContains(hash('sha256', $newToken), $user->getKnownDeviceTokens());
    }

    public function testHandleSuccessfulLoginFirstEverLoginFlushesOnce(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([]);

        $this->em->expects($this->once())->method('flush');

        $this->service->handleSuccessfulLogin($user, null);
    }

    public function testHandleSuccessfulLoginFirstEverLoginDoesNotSetLockToken(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([]);

        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        // No warning email issued → no lock token should be generated.
        $this->assertNull($user->getAccountLockToken());
        $this->assertNull($user->getAccountLockTokenExpiresAt());
    }

    public function testHandleSuccessfulLoginFirstEverLoginReturnsNewToken(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([]);

        $this->em->method('flush');

        $result = $this->service->handleSuccessfulLogin($user, null);

        $this->assertNotNull($result);
        $this->assertNotEmpty($result);
    }

    // ── handleSuccessfulLogin() – unknown device (has prior known devices) ───

    public function testHandleSuccessfulLoginNewDeviceSendsWarningEmail(): void
    {
        $user = $this->makeUser('target@example.com');
        // User already logged in once before from a different device.
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $sentEmail = null;
        $this->mailer->expects($this->once())
            ->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        $this->assertNotNull($sentEmail);
        $this->assertSame('target@example.com', $sentEmail->getTo()[0]->getAddress());
    }

    public function testHandleSuccessfulLoginNewDeviceEmailHasSecuritySubject(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        $this->assertStringContainsString('Sicherheitshinweis', $sentEmail->getSubject());
    }

    public function testHandleSuccessfulLoginNewDeviceEmailContainsLockUrl(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        $this->assertStringContainsString('/api/security/lock-account?token=', $sentEmail->getHtmlBody());
    }

    public function testHandleSuccessfulLoginNewDeviceEmailDoesNotContainIpAddress(): void
    {
        // The new email must NOT expose any IP address (there is none to show).
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        $this->assertStringNotContainsString('IP-Adresse', $sentEmail->getHtmlBody());
    }

    public function testHandleSuccessfulLoginNewDeviceStoresTokenHash(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $this->mailer->method('send');
        $this->em->method('flush');

        $newToken = $this->service->handleSuccessfulLogin($user, null);

        $this->assertNotNull($newToken);
        $this->assertContains(hash('sha256', $newToken), $user->getKnownDeviceTokens());
    }

    public function testHandleSuccessfulLoginNewDeviceSetsLockTokenOnUser(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $this->mailer->method('send');
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, null);

        $this->assertNotNull($user->getAccountLockToken());
        $this->assertNotNull($user->getAccountLockTokenExpiresAt());
    }

    public function testHandleSuccessfulLoginNewDeviceFlushesAtLeastTwice(): void
    {
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'existing-device-token')]);

        $this->mailer->method('send');
        // issueLockToken flushes once; handleSuccessfulLogin itself flushes once more.
        $this->em->expects($this->atLeast(2))->method('flush');

        $this->service->handleSuccessfulLogin($user, null);
    }

    public function testHandleSuccessfulLoginUnknownCookieTokenTreatedAsNewDevice(): void
    {
        // Cookie present but hash not in known list → treat as new device.
        $user = $this->makeUser();
        $user->setKnownDeviceTokens([hash('sha256', 'other-existing-token')]);

        $this->mailer->expects($this->once())->method('send');
        $this->em->method('flush');

        $newToken = $this->service->handleSuccessfulLogin($user, 'untrusted-cookie-value');
        $this->assertNotNull($newToken);
    }

    public function testHandleSuccessfulLoginEvictsOldestTokenWhenCapacityFull(): void
    {
        $user = $this->makeUser();

        // Fill to exactly MAX_KNOWN_DEVICES (20)
        $existing = [];
        for ($i = 0; $i < 20; ++$i) {
            $existing[] = hash('sha256', "old_device_{$i}");
        }
        $user->setKnownDeviceTokens($existing);

        $this->mailer->method('send');
        $this->em->method('flush');

        $newToken = $this->service->handleSuccessfulLogin($user, null);

        $tokens = $user->getKnownDeviceTokens();
        $this->assertCount(20, $tokens);
        $this->assertNotContains(hash('sha256', 'old_device_0'), $tokens, 'Oldest device should be evicted');
        $this->assertNotNull($newToken);
        $this->assertContains(hash('sha256', $newToken), $tokens, 'New device token hash should be stored');
    }

    // ── lockAccountByToken() ─────────────────────────────────────────────────

    public function testLockAccountByTokenReturnsFalseForEmptyToken(): void
    {
        $this->assertFalse($this->service->lockAccountByToken(''));
    }

    public function testLockAccountByTokenReturnsFalseWhenTokenNotFound(): void
    {
        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($repo);

        $this->assertFalse($this->service->lockAccountByToken('unknown-token-xyz'));
    }

    public function testLockAccountByTokenReturnsFalseWhenTokenExpired(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('expiredtoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('-1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);

        $this->assertFalse($this->service->lockAccountByToken('expiredtoken'));
    }

    public function testLockAccountByTokenReturnsTrueForValidToken(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('validtoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->assertTrue($this->service->lockAccountByToken('validtoken'));
    }

    public function testLockAccountByTokenSetsLockedAtOnUser(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('validtoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->service->lockAccountByToken('validtoken');

        $this->assertNotNull($user->getLockedAt());
    }

    public function testLockAccountByTokenSetsLockReason(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('validtoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->service->lockAccountByToken('validtoken');

        $this->assertNotEmpty($user->getLockReason());
    }

    public function testLockAccountByTokenClearsTokenFields(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('clearmetoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->service->lockAccountByToken('clearmetoken');

        $this->assertNull($user->getAccountLockToken());
        $this->assertNull($user->getAccountLockTokenExpiresAt());
    }

    public function testLockAccountByTokenFlushesAfterLocking(): void
    {
        $user = $this->makeUser();
        $user->setAccountLockToken('flushtoken');
        $user->setAccountLockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->expects($this->once())->method('flush');

        $this->service->lockAccountByToken('flushtoken');
    }

    // ── requestUnlockEmail() ─────────────────────────────────────────────────

    public function testRequestUnlockEmailReturnsTrueForUnknownEmail(): void
    {
        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($repo);

        $this->mailer->expects($this->never())->method('send');

        $result = $this->service->requestUnlockEmail('nobody@example.com');

        $this->assertTrue($result, 'Must return true even when email is unknown (prevent enumeration)');
    }

    public function testRequestUnlockEmailReturnsTrueForUnlockedUser(): void
    {
        $user = $this->makeUser('active@example.com');
        // lockedAt is null → not locked

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);

        $this->mailer->expects($this->never())->method('send');

        $result = $this->service->requestUnlockEmail('active@example.com');

        $this->assertTrue($result, 'Must return true even when account is not locked');
    }

    public function testRequestUnlockEmailSendsEmailForLockedUser(): void
    {
        $user = $this->makeUser('locked@example.com');
        $user->setLockedAt(new DateTimeImmutable());

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $sentEmail = null;
        $this->mailer->expects($this->once())
            ->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });

        $result = $this->service->requestUnlockEmail('locked@example.com');

        $this->assertTrue($result);
        $this->assertNotNull($sentEmail);
        $this->assertSame('locked@example.com', $sentEmail->getTo()[0]->getAddress());
    }

    public function testRequestUnlockEmailSubjectContainsKontoEntsprerren(): void
    {
        $user = $this->makeUser('locked2@example.com');
        $user->setLockedAt(new DateTimeImmutable());

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });

        $this->service->requestUnlockEmail('locked2@example.com');

        $this->assertStringContainsStringIgnoringCase('entsperren', $sentEmail->getSubject());
    }

    public function testRequestUnlockEmailBodyContainsUnlockUrl(): void
    {
        $user = $this->makeUser('locked3@example.com');
        $user->setLockedAt(new DateTimeImmutable());

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });

        $this->service->requestUnlockEmail('locked3@example.com');

        $this->assertStringContainsString('/unlock-account?token=', $sentEmail->getHtmlBody());
    }

    public function testRequestUnlockEmailSetsUnlockTokenOnUser(): void
    {
        $user = $this->makeUser('locked4@example.com');
        $user->setLockedAt(new DateTimeImmutable());

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');
        $this->mailer->method('send');

        $this->service->requestUnlockEmail('locked4@example.com');

        $this->assertNotNull($user->getAccountUnlockToken());
        $this->assertNotNull($user->getAccountUnlockTokenExpiresAt());
    }

    // ── unlockAccountByToken() ───────────────────────────────────────────────

    public function testUnlockAccountByTokenReturnsFalseForEmptyToken(): void
    {
        $this->assertFalse($this->service->unlockAccountByToken(''));
    }

    public function testUnlockAccountByTokenReturnsFalseWhenTokenNotFound(): void
    {
        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($repo);

        $this->assertFalse($this->service->unlockAccountByToken('nonexistent-token'));
    }

    public function testUnlockAccountByTokenReturnsFalseWhenTokenExpired(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());
        $user->setAccountUnlockToken('expiredunlocktoken');
        $user->setAccountUnlockTokenExpiresAt(new DateTimeImmutable('-1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);

        $this->assertFalse($this->service->unlockAccountByToken('expiredunlocktoken'));
    }

    public function testUnlockAccountByTokenReturnsTrueForValidToken(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());
        $user->setAccountUnlockToken('validunlocktoken');
        $user->setAccountUnlockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->assertTrue($this->service->unlockAccountByToken('validunlocktoken'));
    }

    public function testUnlockAccountByTokenClearsLockedAt(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());
        $user->setAccountUnlockToken('clearlock');
        $user->setAccountUnlockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->service->unlockAccountByToken('clearlock');

        $this->assertNull($user->getLockedAt());
        $this->assertNull($user->getLockReason());
    }

    public function testUnlockAccountByTokenClearsUnlockTokenFields(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());
        $user->setAccountUnlockToken('cleartoken');
        $user->setAccountUnlockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $this->service->unlockAccountByToken('cleartoken');

        $this->assertNull($user->getAccountUnlockToken());
        $this->assertNull($user->getAccountUnlockTokenExpiresAt());
    }

    public function testUnlockAccountByTokenFlushesAfterUnlocking(): void
    {
        $user = $this->makeUser();
        $user->setLockedAt(new DateTimeImmutable());
        $user->setAccountUnlockToken('flushunlock');
        $user->setAccountUnlockTokenExpiresAt(new DateTimeImmutable('+1 hour'));

        /** @var EntityRepository<User>&MockObject $repo */
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($user);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->expects($this->once())->method('flush');

        $this->service->unlockAccountByToken('flushunlock');
    }
}
