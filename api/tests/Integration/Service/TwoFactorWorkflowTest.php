<?php

declare(strict_types=1);

namespace Tests\Integration\Service;

use App\Entity\User;
use App\Service\TwoFactorService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use OTPHP\TOTP;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Integration tests covering the complete 2FA workflows end-to-end.
 *
 * Every test runs inside a transaction that is rolled back in tearDown,
 * so the database stays clean between tests without needing fixtures.
 *
 * Workflows covered:
 *  A. TOTP setup → enable → verify during login → disable
 *  B. Backup-code consumption and regeneration
 *  C. Pending-token (login 2FA step) lifecycle
 *  D. Email OTP setup → enable → verify → disable
 *  E. Regression: totp_secret column length (SQLSTATE[22001])
 */
class TwoFactorWorkflowTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private TwoFactorService $service;
    private int $userCounter = 0;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->em = $container->get(EntityManagerInterface::class);
        $this->service = $container->get(TwoFactorService::class);

        $this->em->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }

        parent::tearDown();
        restore_exception_handler();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function createUser(): User
    {
        $user = new User();
        $user->setEmail('2fa_test_' . (++$this->userCounter) . '_' . uniqid() . '@test.local');
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('$2y$13$dummyhash');
        $user->setIsVerified(true);
        $user->setIsEnabled(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  E. Regression: totp_secret column length (SQLSTATE[22001])
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Regression: TOTP::generate() produces a ~104-char Base32 secret.
     * The DB column must be 255. Previously length=64 caused
     * SQLSTATE[22001] "Data too long for column 'totp_secret'".
     */
    public function testSetupFlushesSecretToDatabaseWithoutColumnOverflow(): void
    {
        $user = $this->createUser();

        // Must not throw SQLSTATE[22001]
        $this->service->generateSecret($user);

        $secret = $user->getTotpSecret();
        $this->assertNotNull($secret);
        $this->assertLessThanOrEqual(
            255,
            strlen($secret),
            'TOTP secret exceeds DB column length of 255.'
        );

        // Verify it was actually written to the DB
        $this->em->clear();
        $reloaded = $this->em->find(User::class, $user->getId());
        $this->assertNotNull($reloaded);
        $this->assertNotEmpty($reloaded->getTotpSecret());
        $this->assertSame($secret, $reloaded->getTotpSecret());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  A. TOTP full workflow
    // ═══════════════════════════════════════════════════════════════════════

    public function testTotpSetupReturnsOtpauthUri(): void
    {
        $user = $this->createUser();
        $uri = $this->service->generateSecret($user);

        $this->assertStringStartsWith('otpauth://totp/', $uri);
        $this->assertStringContainsString('kaderblick', strtolower($uri));
    }

    public function testTotpEnableWithValidCodeActivatesAndReturnsEightBackupCodes(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);

        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $result = $this->service->verifyAndEnable($user, $totp->now());

        $this->assertIsArray($result);
        $this->assertCount(8, $result);
        $this->assertTrue($user->isTotpEnabled());

        // Backup codes must be stored as hashes, not plaintext
        foreach ($result as $plainCode) {
            $found = false;
            foreach ($user->getTotpBackupCodes() as $hash) {
                $normalised = strtoupper(str_replace('-', '', trim($plainCode)));
                if (password_verify($normalised, $hash)) {
                    $found = true;
                    break;
                }
            }
            $this->assertTrue($found, "Plain backup code '{$plainCode}' has no matching hash stored.");
        }
    }

    public function testTotpEnableWithWrongCodeDoesNotActivate(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);

        $result = $this->service->verifyAndEnable($user, '000000');

        $this->assertFalse($result);
        $this->assertFalse($user->isTotpEnabled());
    }

    public function testTotpEnableWithoutSecretReturnsFalse(): void
    {
        $user = $this->createUser();
        // No generateSecret() call — no secret set

        $result = $this->service->verifyAndEnable($user, '123456');

        $this->assertFalse($result);
        $this->assertFalse($user->isTotpEnabled());
    }

    public function testTotpVerifyAfterEnableSucceeds(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);

        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $this->service->verifyAndEnable($user, $totp->now());

        // Now verify again (e.g. during login)
        $this->assertTrue($this->service->verify($user, $totp->now()));
    }

    public function testTotpVerifyFailsBeforeEnable(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);

        $totp = TOTP::createFromSecret($user->getTotpSecret());
        // Not enabled yet
        $this->assertFalse($this->service->verify($user, $totp->now()));
    }

    public function testTotpDisableWithCurrentCodeClearsAllData(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $this->service->verifyAndEnable($user, $totp->now());

        $this->assertTrue($user->isTotpEnabled());

        $this->service->disable($user);

        $this->assertFalse($user->isTotpEnabled());
        $this->assertNull($user->getTotpSecret());
        $this->assertSame([], $user->getTotpBackupCodes());
        $this->assertNull($user->getTwoFactorPendingToken());
        $this->assertNull($user->getTwoFactorPendingTokenExpiresAt());
    }

    public function testFullTotpSetupEnableVerifyDisableWorkflow(): void
    {
        $user = $this->createUser();

        // 1. Setup
        $uri = $this->service->generateSecret($user);
        $this->assertStringStartsWith('otpauth://totp/', $uri);
        $this->assertNotNull($user->getTotpSecret());
        $this->assertFalse($user->isTotpEnabled());

        // 2. Enable
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $backupCodes = $this->service->verifyAndEnable($user, $totp->now());
        $this->assertIsArray($backupCodes);
        $this->assertCount(8, $backupCodes);
        $this->assertTrue($user->isTotpEnabled());

        // 3. Verify (as in the login 2FA step)
        $this->assertTrue($this->service->verify($user, $totp->now()));

        // 4. Disable
        $this->service->disable($user);
        $this->assertFalse($user->isTotpEnabled());
        $this->assertNull($user->getTotpSecret());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  B. Backup-code workflow
    // ═══════════════════════════════════════════════════════════════════════

    public function testBackupCodeIsConsumedOnSuccessfulVerify(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $backupCodes = $this->service->verifyAndEnable($user, $totp->now());

        $this->assertIsArray($backupCodes);
        $codeToUse = $backupCodes[0];

        $this->assertTrue($this->service->verifyBackupCode($user, $codeToUse));
        $this->assertCount(7, $user->getTotpBackupCodes()); // one consumed

        // Same code cannot be used again
        $this->assertFalse($this->service->verifyBackupCode($user, $codeToUse));
    }

    public function testRegenerateBackupCodesInvalidatesOldCodes(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $oldBackupCodes = $this->service->verifyAndEnable($user, $totp->now());

        $this->assertIsArray($oldBackupCodes);

        // Regenerate requires a valid TOTP code
        $newBackupCodes = $this->service->regenerateBackupCodes($user);
        $this->assertCount(8, $newBackupCodes);

        // Old codes must be invalid
        foreach ($oldBackupCodes as $old) {
            $this->assertFalse(
                $this->service->verifyBackupCode($user, $old),
                "Old backup code '{$old}' should no longer be valid after regeneration."
            );
        }
    }

    public function testRegenerateBackupCodesNewCodesAreValid(): void
    {
        $user = $this->createUser();
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $this->service->verifyAndEnable($user, $totp->now());

        $newCodes = $this->service->regenerateBackupCodes($user);

        $this->assertTrue(
            $this->service->verifyBackupCode($user, $newCodes[0])
        );
    }

    public function testFullBackupCodeWorkflow(): void
    {
        $user = $this->createUser();

        // 1. Setup + enable
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $backupCodes = $this->service->verifyAndEnable($user, $totp->now());
        $this->assertIsArray($backupCodes);
        $this->assertCount(8, $backupCodes);

        // 2. Use all backup codes one by one
        foreach ($backupCodes as $code) {
            $this->assertTrue($this->service->verifyBackupCode($user, $code));
        }
        $this->assertCount(0, $user->getTotpBackupCodes());

        // 3. Regenerate
        $fresh = $this->service->regenerateBackupCodes($user);
        $this->assertCount(8, $fresh);
        $this->assertTrue($this->service->verifyBackupCode($user, $fresh[0]));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  C. Pending-token (login 2FA) workflow
    // ═══════════════════════════════════════════════════════════════════════

    public function testPendingTokenIsIssuedAndValidated(): void
    {
        $user = $this->createUser();
        $token = $this->service->issuePendingToken($user);

        $this->assertNotEmpty($token);
        $this->assertSame($token, $user->getTwoFactorPendingToken());
        $this->assertTrue($this->service->validatePendingToken($user, $token));
    }

    public function testPendingTokenIsPersistedToDatabase(): void
    {
        $user = $this->createUser();
        $token = $this->service->issuePendingToken($user);

        $this->em->clear();
        $reloaded = $this->em->find(User::class, $user->getId());

        $this->assertNotNull($reloaded);
        $this->assertSame($token, $reloaded->getTwoFactorPendingToken());
        $this->assertGreaterThan(new DateTimeImmutable(), $reloaded->getTwoFactorPendingTokenExpiresAt());
    }

    public function testExpiredPendingTokenIsRejected(): void
    {
        $user = $this->createUser();
        $user->setTwoFactorPendingToken('expired-token');
        $user->setTwoFactorPendingTokenExpiresAt(new DateTimeImmutable('-1 second'));
        $this->em->flush();

        $this->assertFalse($this->service->validatePendingToken($user, 'expired-token'));
    }

    public function testWrongPendingTokenIsRejected(): void
    {
        $user = $this->createUser();
        $this->service->issuePendingToken($user);

        $this->assertFalse($this->service->validatePendingToken($user, 'wrong-token'));
    }

    public function testClearPendingTokenRemovesItFromDatabase(): void
    {
        $user = $this->createUser();
        $this->service->issuePendingToken($user);

        $this->service->clearPendingToken($user);

        $this->em->clear();
        $reloaded = $this->em->find(User::class, $user->getId());
        $this->assertNotNull($reloaded);
        $this->assertNull($reloaded->getTwoFactorPendingToken());
        $this->assertNull($reloaded->getTwoFactorPendingTokenExpiresAt());
    }

    public function testFullLoginTotpWorkflow(): void
    {
        $user = $this->createUser();

        // 1. User passes credential check → issue pending token
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $this->service->verifyAndEnable($user, $totp->now());
        $pendingToken = $this->service->issuePendingToken($user);

        // 2. Token is valid
        $this->assertTrue($this->service->validatePendingToken($user, $pendingToken));

        // 3. User submits correct TOTP code
        $this->assertTrue($this->service->verify($user, $totp->now()));

        // 4. Clear pending token after successful auth
        $this->service->clearPendingToken($user);

        // 5. Pending token is gone — second attempt fails
        $this->assertFalse($this->service->validatePendingToken($user, $pendingToken));
    }

    public function testFullLoginWithBackupCodeWorkflow(): void
    {
        $user = $this->createUser();

        // Setup + enable
        $this->service->generateSecret($user);
        $totp = TOTP::createFromSecret($user->getTotpSecret());
        $backupCodes = $this->service->verifyAndEnable($user, $totp->now());
        $this->assertIsArray($backupCodes);

        // Issue pending token
        $pendingToken = $this->service->issuePendingToken($user);
        $this->assertTrue($this->service->validatePendingToken($user, $pendingToken));

        // Verify with backup code
        $this->assertTrue($this->service->verifyBackupCode($user, $backupCodes[0]));
        $this->assertCount(7, $user->getTotpBackupCodes());

        // Clear pending token
        $this->service->clearPendingToken($user);
        $this->assertFalse($this->service->validatePendingToken($user, $pendingToken));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  D. Email OTP workflow
    // ═══════════════════════════════════════════════════════════════════════

    public function testEmailOtpCodeIsGeneratedAndStoredAsHash(): void
    {
        $user = $this->createUser();
        $plain = $this->service->generateEmailOtpCode($user);

        $this->assertMatchesRegularExpression('/^\d{6}$/', $plain);
        $this->assertNotEmpty($user->getEmailOtpCode());
        $this->assertNotSame($plain, $user->getEmailOtpCode());
        $this->assertTrue(password_verify($plain, $user->getEmailOtpCode()));
    }

    public function testEmailOtpCodeIsPersistedToDatabase(): void
    {
        $user = $this->createUser();
        $plain = $this->service->generateEmailOtpCode($user);

        $this->em->clear();
        $reloaded = $this->em->find(User::class, $user->getId());
        $this->assertNotNull($reloaded);
        $this->assertTrue(password_verify($plain, $reloaded->getEmailOtpCode()));
        $this->assertGreaterThan(new DateTimeImmutable(), $reloaded->getEmailOtpExpiresAt());
    }

    public function testEmailOtpVerifyReturnsTrueAndClearsCode(): void
    {
        $user = $this->createUser();
        $plain = $this->service->generateEmailOtpCode($user);

        $this->assertTrue($this->service->verifyEmailOtpCode($user, $plain));
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());
    }

    public function testEmailOtpExpiredCodeIsRejected(): void
    {
        $user = $this->createUser();
        $user->setEmailOtpCode(password_hash('123456', PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('-1 second'));
        $this->em->flush();

        $this->assertFalse($this->service->verifyEmailOtpCode($user, '123456'));
    }

    public function testEmailOtpWrongCodeIsRejected(): void
    {
        $user = $this->createUser();
        $this->service->generateEmailOtpCode($user);

        $this->assertFalse($this->service->verifyEmailOtpCode($user, '000000'));
    }

    public function testEmailOtpEnableWorkflow(): void
    {
        $user = $this->createUser();

        // 1. Generate OTP (sent by email)
        $plain = $this->service->generateEmailOtpCode($user);

        // 2. User submits code → verify
        $this->assertTrue($this->service->verifyEmailOtpCode($user, $plain));

        // 3. Enable
        $this->service->enableEmailOtp($user);

        $this->assertTrue($user->isEmailOtpEnabled());
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());

        // 4. Persisted
        $this->em->clear();
        $reloaded = $this->em->find(User::class, $user->getId());
        $this->assertNotNull($reloaded);
        $this->assertTrue($reloaded->isEmailOtpEnabled());
    }

    public function testEmailOtpDisableWorkflow(): void
    {
        $user = $this->createUser();

        // Setup: enable Email OTP
        $plain = $this->service->generateEmailOtpCode($user);
        $this->service->verifyEmailOtpCode($user, $plain);
        $this->service->enableEmailOtp($user);
        $this->assertTrue($user->isEmailOtpEnabled());

        // Disable: generate a new code, verify it, then disable
        $plain2 = $this->service->generateEmailOtpCode($user);
        $this->service->verifyEmailOtpCode($user, $plain2);
        $this->service->disableEmailOtp($user);

        $this->assertFalse($user->isEmailOtpEnabled());
        $this->assertNull($user->getEmailOtpCode());
        $this->assertNull($user->getEmailOtpExpiresAt());
    }

    public function testFullEmailOtpLoginWorkflow(): void
    {
        $user = $this->createUser();

        // 1. Setup + enable Email OTP
        $setupCode = $this->service->generateEmailOtpCode($user);
        $this->service->verifyEmailOtpCode($user, $setupCode);
        $this->service->enableEmailOtp($user);

        // 2. Login: user passes credentials → pending token issued
        $pendingToken = $this->service->issuePendingToken($user);
        $this->assertTrue($this->service->validatePendingToken($user, $pendingToken));

        // 3. Send login code via email (just generate, skip actual send in test)
        $loginCode = $this->service->generateEmailOtpCode($user);

        // 4. User submits code
        $this->assertTrue($this->service->verifyEmailOtpCode($user, $loginCode));

        // 5. Clear pending token → access granted
        $this->service->clearPendingToken($user);
        $this->assertFalse($this->service->validatePendingToken($user, $pendingToken));
    }

    public function testFullEmailOtpSetupEnableVerifyDisableWorkflow(): void
    {
        $user = $this->createUser();
        $this->assertFalse($user->isEmailOtpEnabled());

        // 1. Generate + verify + enable
        $code = $this->service->generateEmailOtpCode($user);
        $this->assertTrue($this->service->verifyEmailOtpCode($user, $code));
        $this->service->enableEmailOtp($user);
        $this->assertTrue($user->isEmailOtpEnabled());

        // 2. Generate + verify + disable
        $code2 = $this->service->generateEmailOtpCode($user);
        $this->assertTrue($this->service->verifyEmailOtpCode($user, $code2));
        $this->service->disableEmailOtp($user);
        $this->assertFalse($user->isEmailOtpEnabled());
    }
}
