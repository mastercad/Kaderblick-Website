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

    // ── handleSuccessfulLogin() – known IP ───────────────────────────────────

    public function testHandleSuccessfulLoginKnownIpDoesNotSendEmail(): void
    {
        $ip = '127.0.0.1';
        $user = $this->makeUser();
        $user->setKnownLoginIps([hash('sha256', $ip)]);

        $this->mailer->expects($this->never())->method('send');
        $this->em->expects($this->never())->method('flush');

        $this->service->handleSuccessfulLogin($user, $ip);
    }

    // ── handleSuccessfulLogin() – unknown IP ─────────────────────────────────

    public function testHandleSuccessfulLoginUnknownIpSendsWarningEmail(): void
    {
        $user = $this->makeUser('target@example.com');
        $user->setKnownLoginIps([]);

        $sentEmail = null;
        $this->mailer->expects($this->once())
            ->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, '8.8.8.8');

        $this->assertNotNull($sentEmail);
        $this->assertSame('target@example.com', $sentEmail->getTo()[0]->getAddress());
    }

    public function testHandleSuccessfulLoginUnknownIpEmailHasSecuritySubject(): void
    {
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, '8.8.8.8');

        $this->assertStringContainsString('Sicherheitswarnung', $sentEmail->getSubject());
    }

    public function testHandleSuccessfulLoginUnknownIpEmailContainsLockUrl(): void
    {
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, '10.0.0.1');

        $this->assertStringContainsString('/api/security/lock-account?token=', $sentEmail->getHtmlBody());
    }

    public function testHandleSuccessfulLoginUnknownIpEmailContainsIpAddress(): void
    {
        $ip = '203.0.113.42';
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $sentEmail = null;
        $this->mailer->method('send')
            ->willReturnCallback(static function (Email $email) use (&$sentEmail): void {
                $sentEmail = $email;
            });
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, $ip);

        $this->assertStringContainsString($ip, $sentEmail->getHtmlBody());
    }

    public function testHandleSuccessfulLoginUnknownIpStoresIpHash(): void
    {
        $ip = '10.0.0.1';
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $this->mailer->method('send');
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, $ip);

        $this->assertContains(hash('sha256', $ip), $user->getKnownLoginIps());
    }

    public function testHandleSuccessfulLoginUnknownIpSetsLockTokenOnUser(): void
    {
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $this->mailer->method('send');
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, '10.0.0.1');

        $this->assertNotNull($user->getAccountLockToken());
        $this->assertNotNull($user->getAccountLockTokenExpiresAt());
    }

    public function testHandleSuccessfulLoginFlushesAtLeastTwiceForUnknownIp(): void
    {
        $user = $this->makeUser();
        $user->setKnownLoginIps([]);

        $this->mailer->method('send');
        // issueLockToken flushes once; handleSuccessfulLogin itself flushes once more
        $this->em->expects($this->atLeast(2))->method('flush');

        $this->service->handleSuccessfulLogin($user, '5.6.7.8');
    }

    public function testHandleSuccessfulLoginEvictsOldestIpWhenCapacityFull(): void
    {
        $newIp = '192.168.100.1';
        $user = $this->makeUser();

        // Fill to exactly MAX_KNOWN_IPS (20)
        $existing = [];
        for ($i = 0; $i < 20; ++$i) {
            $existing[] = hash('sha256', "old_ip_{$i}");
        }
        $user->setKnownLoginIps($existing);

        $this->mailer->method('send');
        $this->em->method('flush');

        $this->service->handleSuccessfulLogin($user, $newIp);

        $ips = $user->getKnownLoginIps();
        $this->assertCount(20, $ips);
        $this->assertNotContains(hash('sha256', 'old_ip_0'), $ips, 'Oldest IP should be evicted');
        $this->assertContains(hash('sha256', $newIp), $ips, 'New IP hash should be stored');
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
}
