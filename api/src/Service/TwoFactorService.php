<?php

namespace App\Service;

use App\Entity\User;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use OTPHP\TOTP;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

/**
 * Handles TOTP-based Two-Factor Authentication.
 *
 * Flow:
 *  1. generateSecret()  → creates a new secret, returns provisioning URI for QR code
 *  2. verifyAndEnable() → confirms the first code is valid, persists secret + backup codes
 *  3. verify()          → validates a code during login
 *  4. verifyBackupCode()→ validates a backup code (single-use)
 *  5. disable()         → removes secret and disables 2FA for the user
 */
class TwoFactorService
{
    private const BACKUP_CODE_COUNT = 8;
    private const PENDING_TOKEN_TTL_SECONDS = 300; // 5 minutes

    private const EMAIL_OTP_TTL_MINUTES = 10;

    public function __construct(
        private EntityManagerInterface $em,
        private MailerInterface $mailer,
        private string $mailerFrom,
    ) {
    }

    /**
     * Generate a fresh TOTP secret for the user (not yet enabled).
     * Returns the provisioning URI (otpauth://…) to be rendered as a QR code.
     */
    public function generateSecret(User $user): string
    {
        $totp = TOTP::generate();
        $totp->setLabel($user->getEmail());
        $totp->setIssuer('Kaderblick');

        // Store temporarily — activation requires a valid first code
        $user->setTotpSecret($totp->getSecret());
        $this->em->flush();

        return $totp->getProvisioningUri();
    }

    /**
     * Verify a TOTP code against the user's current (pending) secret.
     * If valid, enable 2FA and return the one-time backup codes (plain text).
     *
     * @return array<int, string>|false Plain-text backup codes on success, false otherwise
     */
    public function verifyAndEnable(User $user, string $code): array|false
    {
        $secret = $user->getTotpSecret();
        if (!$secret) {
            return false;
        }

        $totp = TOTP::createFromSecret($secret);
        if (!$totp->verify($code, null, 1)) {
            return false;
        }

        $plainCodes = $this->generateBackupCodes();
        $hashed = array_map(
            static fn (string $c) => password_hash(strtoupper(str_replace('-', '', $c)), PASSWORD_BCRYPT),
            $plainCodes
        );

        $user->setTotpEnabled(true);
        $user->setTotpBackupCodes($hashed);
        $this->em->flush();

        return $plainCodes;
    }

    /**
     * Verify a TOTP code during login (user already has 2FA enabled).
     */
    public function verify(User $user, string $code): bool
    {
        $secret = $user->getTotpSecret();
        if (!$secret || !$user->isTotpEnabled()) {
            return false;
        }

        $totp = TOTP::createFromSecret($secret);

        return $totp->verify($code, null, 1);
    }

    /**
     * Verify a single-use backup code. If valid, remove it from the stored list.
     */
    public function verifyBackupCode(User $user, string $code): bool
    {
        $stored = $user->getTotpBackupCodes();
        $normalised = strtoupper(str_replace('-', '', trim($code)));

        foreach ($stored as $index => $hash) {
            if (password_verify($normalised, $hash)) {
                unset($stored[$index]);
                $user->setTotpBackupCodes(array_values($stored));
                $this->em->flush();

                return true;
            }
        }

        return false;
    }

    /**
     * Disable 2FA for a user and clear all related data.
     */
    public function disable(User $user): void
    {
        $user->setTotpEnabled(false);
        $user->setTotpSecret(null);
        $user->setTotpBackupCodes([]);
        $user->setTwoFactorPendingToken(null);
        $user->setTwoFactorPendingTokenExpiresAt(null);
        $this->em->flush();
    }

    /**
     * Issue a short-lived pending token after successful credential check when 2FA is required.
     * Returns the token string.
     */
    public function issuePendingToken(User $user): string
    {
        $token = bin2hex(random_bytes(32));
        $user->setTwoFactorPendingToken($token);
        $user->setTwoFactorPendingTokenExpiresAt(
            new DateTimeImmutable('+' . self::PENDING_TOKEN_TTL_SECONDS . ' seconds')
        );
        $this->em->flush();

        return $token;
    }

    /**
     * Validate a pending token for a user.
     */
    public function validatePendingToken(User $user, string $token): bool
    {
        $stored = $user->getTwoFactorPendingToken();
        $expires = $user->getTwoFactorPendingTokenExpiresAt();

        if (!$stored || !$expires) {
            return false;
        }

        if (!hash_equals($stored, $token)) {
            return false;
        }

        if ($expires < new DateTimeImmutable()) {
            return false;
        }

        return true;
    }

    /**
     * Clear the pending token after it has been consumed.
     */
    public function clearPendingToken(User $user): void
    {
        $user->setTwoFactorPendingToken(null);
        $user->setTwoFactorPendingTokenExpiresAt(null);
        $this->em->flush();
    }

    /**
     * Regenerate backup codes for a user who already has 2FA enabled.
     *
     * @return array<int, string> Plain-text backup codes
     */
    public function regenerateBackupCodes(User $user): array
    {
        if (!$user->isTotpEnabled()) {
            throw new LogicException('Cannot regenerate backup codes: 2FA is not enabled.');
        }

        $plainCodes = $this->generateBackupCodes();
        $hashed = array_map(
            static fn (string $c) => password_hash(strtoupper(str_replace('-', '', $c)), PASSWORD_BCRYPT),
            $plainCodes
        );
        $user->setTotpBackupCodes($hashed);
        $this->em->flush();

        return $plainCodes;
    }

    // ── Email OTP methods ─────────────────────────────────────────────────

    /**
     * Generate a 6-digit Email OTP, store hashed version with expiry, return plain code.
     */
    public function generateEmailOtpCode(User $user): string
    {
        $plain = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $user->setEmailOtpCode(password_hash($plain, PASSWORD_BCRYPT));
        $user->setEmailOtpExpiresAt(new DateTimeImmutable('+' . self::EMAIL_OTP_TTL_MINUTES . ' minutes'));
        $this->em->flush();

        return $plain;
    }

    /**
     * Send the Email OTP code to the user's registered email address.
     */
    public function sendEmailOtpCode(User $user, string $plainCode): void
    {
        $email = (new Email())
            ->from($this->mailerFrom)
            ->to($user->getEmail())
            ->subject('Dein Bestätigungs-Code')
            ->html(
                '<p>Hallo ' . htmlspecialchars($user->getFirstName() ?? $user->getEmail(), ENT_QUOTES, 'UTF-8') . ',</p>' .
                '<p>Dein Einmal-Code für die Zwei-Faktor-Authentifizierung lautet:</p>' .
                '<p style="font-size:2rem;font-weight:bold;letter-spacing:0.2em;">' . htmlspecialchars($plainCode, ENT_QUOTES, 'UTF-8') . '</p>' .
                '<p>Der Code ist ' . self::EMAIL_OTP_TTL_MINUTES . ' Minuten gültig.</p>' .
                '<p>Falls du diese Anfrage nicht selbst gestellt hast, ignoriere diese E-Mail.</p>'
            );

        $this->mailer->send($email);
    }

    /**
     * Verify an Email OTP code. Returns true on success and clears the stored code.
     */
    public function verifyEmailOtpCode(User $user, string $code): bool
    {
        $hash = $user->getEmailOtpCode();
        $expiry = $user->getEmailOtpExpiresAt();

        if (!$hash || !$expiry || $expiry < new DateTimeImmutable()) {
            return false;
        }

        if (!password_verify(trim($code), $hash)) {
            return false;
        }

        $user->setEmailOtpCode(null);
        $user->setEmailOtpExpiresAt(null);
        $this->em->flush();

        return true;
    }

    /**
     * Enable Email OTP (call after verifyEmailOtpCode succeeds during setup).
     */
    public function enableEmailOtp(User $user): void
    {
        $user->setEmailOtpEnabled(true);
        $user->setEmailOtpCode(null);
        $user->setEmailOtpExpiresAt(null);
        $this->em->flush();
    }

    /**
     * Disable Email OTP and clear all related data.
     */
    public function disableEmailOtp(User $user): void
    {
        $user->setEmailOtpEnabled(false);
        $user->setEmailOtpCode(null);
        $user->setEmailOtpExpiresAt(null);
        $this->em->flush();
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * @return array<int, string>
     */
    private function generateBackupCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < self::BACKUP_CODE_COUNT; ++$i) {
            // Format: XXXX-XXXX (uppercase alphanumeric, easy to read)
            $raw = strtoupper(bin2hex(random_bytes(4)));
            $codes[] = substr($raw, 0, 4) . '-' . substr($raw, 4, 4);
        }

        return $codes;
    }
}
