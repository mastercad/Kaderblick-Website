<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Service\TwoFactorService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use OTPHP\TOTP;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

class TwoFactorServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private MailerInterface&MockObject $mailer;
    private TwoFactorService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->mailer = $this->createMock(MailerInterface::class);
        $this->service = new TwoFactorService(
            $this->em,
            $this->mailer,
            'noreply@kaderblick.de',
        );
    }

    private function makeUser(string $email = 'test@example.com'): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Test');

        return $user;
    }

    // ── generateSecret() ─────────────────────────────────────────────────

    public function testGenerateSecretReturnsOtpauthUri(): void
    {
        $user = $this->makeUser();
        $this->em->expects($this->once())->method('flush');

        $uri = $this->service->generateSecret($user);

        $this->assertStringStartsWith('otpauth://totp/', $uri);
    }

    public function testGenerateSecretStoresSecretOnUser(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $this->assertNotEmpty($user->getTotpSecret());
    }

    /**
     * Regression test: TOTP::generate() produces a 64-byte Base32-encoded secret
     * (~104 chars). The DB column must be large enough — previously length=64 caused
     * SQLSTATE[22001] "Data too long for column 'totp_secret'".
     */
    public function testGenerateSecretFitsColumnConstraint(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $secret = $user->getTotpSecret();
        $this->assertNotNull($secret);
        $this->assertLessThanOrEqual(
            255,
            strlen($secret),
            'TOTP secret exceeds DB column length of 255 — increase ORM column length.'
        );
    }

    public function testGenerateSecretIsValidBase32(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $this->assertMatchesRegularExpression(
            '/^[A-Z2-7]+=*$/',
            $user->getTotpSecret(),
            'TOTP secret must be valid Base32.'
        );
    }

    // ── verifyAndEnable() ────────────────────────────────────────────────

    public function testVerifyAndEnableReturnsFalseWhenNoSecret(): void
    {
        $user = $this->makeUser();

        $this->assertFalse($this->service->verifyAndEnable($user, '123456'));
    }

    public function testVerifyAndEnableReturnsFalseForWrongCode(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $this->assertFalse($this->service->verifyAndEnable($user, '000000'));
    }

    public function testVerifyAndEnableEnablesAndReturnsEightBackupCodes(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $code = $totp->now();

        $this->em->expects($this->atLeastOnce())->method('flush');

        $result = $this->service->verifyAndEnable($user, $code);

        $this->assertIsArray($result);
        $this->assertCount(8, $result);
        $this->assertTrue($user->isTotpEnabled());
    }

    public function testVerifyAndEnableBackupCodesMatchExpectedFormat(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);

        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $result = $this->service->verifyAndEnable($user, $totp->now());

        $this->assertIsArray($result);
        foreach ($result as $code) {
            $this->assertMatchesRegularExpression('/^[A-F0-9]{4}-[A-F0-9]{4}$/', $code);
        }
    }

    // ── verify() ─────────────────────────────────────────────────────────

    public function testVerifyReturnsFalseWhenNoSecret(): void
    {
        $user = $this->makeUser();

        $this->assertFalse($this->service->verify($user, '123456'));
    }

    public function testVerifyReturnsFalseWhenTotpNotEnabled(): void
    {
        $user = $this->makeUser();
        $user->setTotpSecret('JBSWY3DPEHPK3PXP');
        // totpEnabled defaults to false

        $this->assertFalse($this->service->verify($user, '123456'));
    }

    public function testVerifyReturnsTrueForCurrentCode(): void
    {
        $user = $this->makeUser();
        $this->service->generateSecret($user);
        $user->setTotpEnabled(true);

        $totp = TOTP::createFromSecret($user->getTotpSecret());

        $this->assertTrue($this->service->verify($user, $totp->now()));
    }

    // ── verifyBackupCode() ───────────────────────────────────────────────

    public function testVerifyBackupCodeReturnsFalseWhenNoCodes(): void
    {
        $user = $this->makeUser();
        $user->setTotpBackupCodes([]);

        $this->assertFalse($this->service->verifyBackupCode($user, 'ABCD-1234'));
    }

    public function testVerifyBackupCodeReturnsTrueAndRemovesCode(): void
    {
        $user = $this->makeUser();
        // Service normalises by stripping '-' and uppercasing before password_verify
        $user->setTotpBackupCodes([password_hash('ABCD1234', PASSWORD_BCRYPT)]);

        $this->em->expects($this->once())->method('flush');

        $this->assertTrue($this->service->verifyBackupCode($user, 'ABCD-1234'));
        $this->assertEmpty($user->getTotpBackupCodes());
    }

    public function testVerifyBackupCodeIsCaseInsensitive(): void
    {
        $user = $this->makeUser();
        $user->setTotpBackupCodes([password_hash('ABCD1234', PASSWORD_BCRYPT)]);

        $this->assertTrue($this->service->verifyBackupCode($user, 'abcd-1234'));
    }

    public function testVerifyBackupCodeReturnsFalseForWrongCode(): void
    {
        $user = $this->makeUser();
        $user->setTotpBackupCodes([password_hash('ABCD1234', PASSWORD_BCRYPT)]);

        $this->assertFalse($this->service->verifyBackupCode($user, 'XXXX-YYYY'));
    }

    // ── disable() ────────────────────────────────────────────────────────

    public function testDisableClearsAllTotpData(): void
    {
        $user = $this->makeUser();
        $user->setTotpEnabled(true);
        $user->setTotpSecret('JBSWY3DPEHPK3PXP');
        $user->setTotpBackupCodes(['hash1', 'hash2']);
        $user->setTwoFactorPendingToken('some-token');
        $user->setTwoFactorPendingTokenExpiresAt(new DateTimeImmutable('+5 minutes'));

        $this->em->expects($this->once())->method('flush');

        $this->service->disable($user);

        $this->assertFalse($user->isTotpEnabled());
        $this->assertNull($user->getTotpSecret());
        $this->assertSame([], $user->getTotpBackupCodes());
        $this->assertNull($user->getTwoFactorPendingToken());
        $this->assertNull($user->getTwoFactorPendingTokenExpiresAt());
    }

    // ── issuePendingToken() ───────────────────────────────────────────────

    public function testIssuePendingTokenReturnsNonEmptyToken(): void
    {
        $user = $this->makeUser();
        $this->em->expects($this->once())->method('flush');

        $token = $this->service->issuePendingToken($user);

        $this->assertNotEmpty($token);
        $this->assertSame($token, $user->getTwoFactorPendingToken());
        $this->assertInstanceOf(DateTimeImmutable::class, $user->getTwoFactorPendingTokenExpiresAt());
    }

    public function testIssuePendingTokenExpiryIsInFuture(): void
    {
        $user = $this->makeUser();
        $this->service->issuePendingToken($user);

        $this->assertGreaterThan(new DateTimeImmutable(), $user->getTwoFactorPendingTokenExpiresAt());
    }

    // ── validatePendingToken() ────────────────────────────────────────────

    public function testValidatePendingTokenReturnsTrueForValidToken(): void
    {
        $user = $this->makeUser();
        $token = $this->service->issuePendingToken($user);

        $this->assertTrue($this->service->validatePendingToken($user, $token));
    }

    public function testValidatePendingTokenReturnsFalseForWrongToken(): void
    {
        $user = $this->makeUser();
        $this->service->issuePendingToken($user);

        $this->assertFalse($this->service->validatePendingToken($user, 'wrong-token'));
    }

    public function testValidatePendingTokenReturnsFalseWhenExpired(): void
    {
        $user = $this->makeUser();
        $user->setTwoFactorPendingToken('some-token');
        $user->setTwoFactorPendingTokenExpiresAt(new DateTimeImmutable('-1 second'));

        $this->assertFalse($this->service->validatePendingToken($user, 'some-token'));
    }

    public function testValidatePendingTokenReturnsFalseWhenNoToken(): void
    {
        $user = $this->makeUser();

        $this->assertFalse($this->service->validatePendingToken($user, 'any-token'));
    }

    // ── clearPendingToken() ───────────────────────────────────────────────

    public function testClearPendingTokenNullifiesFieldsAndFlushes(): void
    {
        $user = $this->makeUser();
        $user->setTwoFactorPendingToken('token');
        $user->setTwoFactorPendingTokenExpiresAt(new DateTimeImmutable('+5 minutes'));

        $this->em->expects($this->once())->method('flush');

        $this->service->clearPendingToken($user);

        $this->assertNull($user->getTwoFactorPendingToken());
        $this->assertNull($user->getTwoFactorPendingTokenExpiresAt());
    }

    // ── regenerateBackupCodes() ───────────────────────────────────────────

    public function testRegenerateBackupCodesThrowsWhenTotpNotEnabled(): void
    {
        $user = $this->makeUser();
        $user->setTotpEnabled(false);

        $this->expectException(LogicException::class);

        $this->service->regenerateBackupCodes($user);
    }

    public function testRegenerateBackupCodesReturnsEightCodes(): void
    {
        $user = $this->makeUser();
        $user->setTotpEnabled(true);
        $user->setTotpBackupCodes(['old-hash']);

        $this->em->expects($this->once())->method('flush');

        $codes = $this->service->regenerateBackupCodes($user);

        $this->assertCount(8, $codes);
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[A-F0-9]{4}-[A-F0-9]{4}$/', $code);
        }
    }

    public function testRegenerateBackupCodesReplacesOldCodes(): void
    {
        $user = $this->makeUser();
        $user->setTotpEnabled(true);
        $oldHash = 'old-hash';
        $user->setTotpBackupCodes([$oldHash]);

        $this->service->regenerateBackupCodes($user);

        $this->assertNotContains($oldHash, $user->getTotpBackupCodes());
    }

    // ── generateEmailOtpCode() ────────────────────────────────────────────

    public function testGenerateEmailOtpCodeReturnsSixDigits(): void
    {
        $user = $this->makeUser();
        $this->em->expects($this->once())->method('flush');

        $code = $this->service->generateEmailOtpCode($user);

        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
    }

    public function testGenerateEmailOtpCodeStoresHashNotPlaintext(): void
    {
        $user = $this->makeUser();

        $code = $this->service->generateEmailOtpCode($user);

        $this->assertNotSame($code, $user->getEmailOtpCode());
        $this->assertTrue(password_verify($code, $user->getEmailOtpCode()));
    }

    public function testGenerateEmailOtpCodeExpiryIsInFuture(): void
    {
        $user = $this->makeUser();
        $this->service->generateEmailOtpCode($user);

        $this->assertGreaterThan(new DateTimeImmutable(), $user->getEmailOtpExpiresAt());
    }

    // ── sendEmailOtpCode() ────────────────────────────────────────────────

    public function testSendEmailOtpCodeSendsEmailToUserAddress(): void
    {
        $user = $this->makeUser('recipient@example.com');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (Email $email) {
                return 'recipient@example.com' === $email->getTo()[0]->getAddress()
                    && 'noreply@kaderblick.de' === $email->getFrom()[0]->getAddress();
            }));

        $this->service->sendEmailOtpCode($user, '123456');
    }

    public function testSendEmailOtpCodeContainsCodeInHtmlBody(): void
    {
        $user = $this->makeUser();
        $capturedHtml = '';

        $this->mailer
            ->method('send')
            ->willReturnCallback(function (Email $email) use (&$capturedHtml): void {
                $capturedHtml = (string) $email->getHtmlBody();
            });

        $this->service->sendEmailOtpCode($user, '987654');

        $this->assertStringContainsString('987654', $capturedHtml);
    }

    // ── verifyEmailOtpCode() ──────────────────────────────────────────────

    public function testVerifyEmailOtpCodeReturnsFalseWhenNoCodeStored(): void
    {
        $user = $this->makeUser();

        $this->assertFalse($this->service->verifyEmailOtpCode($user, '123456'));
    }

    public function testVerifyEmailOtpCodeReturnsFalseWhenExpired(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('-1 second'));

        $this->assertFalse($this->service->verifyEmailOtpCode($user, '123456'));
    }

    public function testVerifyEmailOtpCodeReturnsFalseForWrongCode(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+10 minutes'));

        $this->assertFalse($this->service->verifyEmailOtpCode($user, '999999'));
    }

    public function testVerifyEmailOtpCodeReturnsTrueAndClearsOnSuccess(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+10 minutes'));

        $this->em->expects($this->once())->method('flush');

        $result = $this->service->verifyEmailOtpCode($user, '123456');

        $this->assertTrue($result);
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());
    }

    public function testVerifyEmailOtpCodeTrimsWhitespace(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+10 minutes'));

        $this->assertTrue($this->service->verifyEmailOtpCode($user, ' 123456 '));
    }

    // ── enableEmailOtp() ─────────────────────────────────────────────────

    public function testEnableEmailOtpSetsEnabledAndClearsCode(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+10 minutes'));

        $this->em->expects($this->once())->method('flush');

        $this->service->enableEmailOtp($user);

        $this->assertTrue($user->isEmailOtpEnabled());
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());
    }

    // ── disableEmailOtp() ─────────────────────────────────────────────────

    public function testDisableEmailOtpClearsAllData(): void
    {
        $user = $this->makeUser();
        $user->setEmailOtpEnabled(true);
        $user->setEmailOtpCode('some-hash');
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+5 minutes'));

        $this->em->expects($this->once())->method('flush');

        $this->service->disableEmailOtp($user);

        $this->assertFalse($user->isEmailOtpEnabled());
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());
    }
}
