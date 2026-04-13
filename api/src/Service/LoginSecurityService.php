<?php

namespace App\Service;

use App\Entity\User;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Throwable;

/**
 * Handles login security checks:
 *
 *  - Rate-limiting: blocks IPs that exceeded the failure threshold (shares the
 *    same cache key as AdminAlertService so both systems stay in sync).
 *  - Unknown-device detection: on the first successful login from a new device
 *    the user receives a warning email with a one-click "Konto sperren" link.
 *    Device recognition is based on a long-lived HttpOnly cookie, not the IP
 *    address (IPs change constantly for mobile users).
 *  - Account locking: the user (or an admin) can lock an account via a
 *    short-lived token; locked accounts cannot log in.
 */
class LoginSecurityService
{
    /**
     * Maximum failed login attempts (per IP) within the brute-force window
     * before the IP is blocked.  Must be >= AdminAlertService::BRUTE_FORCE_THRESHOLD
     * so that the admin alert fires before the block kicks in.
     */
    private const BLOCK_THRESHOLD = 10;

    /** Cache window in seconds – kept in sync with AdminAlertService. */
    private const BRUTE_FORCE_WINDOW_SECONDS = 600; // 10 minutes

    /** How many distinct devices a user may accumulate before old entries are evicted. */
    private const MAX_KNOWN_DEVICES = 20;

    /** Name of the HttpOnly cookie that carries the device token. */
    public const DEVICE_COOKIE_NAME = 'device_token';

    /** How long the "lock my account" token is valid after it is issued. */
    private const LOCK_TOKEN_TTL_SECONDS = 86400; // 24 hours

    /** How long the "unlock my account" token is valid after it is issued. */
    private const UNLOCK_TOKEN_TTL_SECONDS = 86400; // 24 hours

    public function __construct(
        private readonly CacheInterface $cache,
        private readonly EntityManagerInterface $em,
        private readonly MailerInterface $mailer,
        private readonly string $mailerFrom,
        private readonly string $appBaseUrl,
    ) {
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    /**
     * Returns true when the IP has accumulated too many failed login attempts
     * within the brute-force window and should be temporarily blocked.
     */
    public function isRateLimited(string $ip): bool
    {
        $count = $this->getFailureCount($ip);

        return $count >= self::BLOCK_THRESHOLD;
    }

    /**
     * Read the current failure counter for an IP from the shared cache.
     * Returns 0 if no entry exists (or the window has expired).
     */
    private function getFailureCount(string $ip): int
    {
        $key = 'login_fail_count_' . md5($ip);

        // get() with a callback that creates a *read-only* item returning 0 –
        // we must NOT accidentally create a new counter entry here.
        $result = $this->cache->get($key, static function (ItemInterface $item): int {
            $item->expiresAfter(self::BRUTE_FORCE_WINDOW_SECONDS);

            return 0;
        });

        return (int) $result;
    }

    // ── Account-lock checks ───────────────────────────────────────────────────

    /**
     * Returns true when the account has been locked (e.g. after a suspicious
     * login was confirmed by the user clicking the lock link).
     */
    public function isAccountLocked(User $user): bool
    {
        return $user->isLocked();
    }

    // ── Successful-login handling ─────────────────────────────────────────────

    /**
     * Called after every fully successful login (password ✓ + 2FA ✓ if required).
     *
     * Reads the device token supplied by the caller (from the request cookie) and
     * checks whether this device is already known for the user.
     *
     * - Known device  → no email, returns null (caller keeps existing cookie as-is).
     * - Unknown/new device → sends warning email, stores the new token hash, returns
     *   the new plain token so the caller can set it as a long-lived cookie.
     *
     * @param string|null $deviceToken plain token read from the cookie (null = no cookie present)
     *
     * @return string|null new plain token to set as cookie, or null if device was known
     */
    public function handleSuccessfulLogin(User $user, ?string $deviceToken): ?string
    {
        if (null !== $deviceToken && '' !== $deviceToken) {
            $tokenHash = hash('sha256', $deviceToken);
            $knownTokens = $user->getKnownDeviceTokens();

            if (in_array($tokenHash, $knownTokens, true)) {
                // Known device – nothing to do.
                return null;
            }
        }

        // New or missing device token: generate a fresh one.
        $newToken = bin2hex(random_bytes(32));
        $newHash = hash('sha256', $newToken);
        $knownTokens = $user->getKnownDeviceTokens();

        // Warn the user only if they already have at least one known device
        // (on the very first login ever the list is empty → no point warning).
        if ([] !== $knownTokens) {
            try {
                $this->sendNewDeviceWarning($user);
            } catch (Throwable) {
                // Non-critical – a mailer failure must never block the login.
            }
        }

        // Record the new device hash (evict oldest entry when the list is full).
        $knownTokens[] = $newHash;
        if (count($knownTokens) > self::MAX_KNOWN_DEVICES) {
            array_shift($knownTokens);
        }
        $user->setKnownDeviceTokens($knownTokens);
        $this->em->flush();

        return $newToken;
    }

    // ── Lock-account token ────────────────────────────────────────────────────

    /**
     * Locks the account identified by the given token.
     * Returns true on success, false if the token is missing, unknown or expired.
     */
    public function lockAccountByToken(string $token): bool
    {
        if ('' === $token) {
            return false;
        }

        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['accountLockToken' => $token]);

        if (!$user) {
            return false;
        }

        $expires = $user->getAccountLockTokenExpiresAt();
        if (!$expires || $expires < new DateTimeImmutable()) {
            return false;
        }

        $user->setLockedAt(new DateTimeImmutable());
        $user->setLockReason('Konto auf Anfrage des Nutzers nach verdächtigem Login gesperrt.');
        $user->setAccountLockToken(null);
        $user->setAccountLockTokenExpiresAt(null);
        $this->em->flush();

        return true;
    }

    // ── Unlock-account token ──────────────────────────────────────────────────

    /**
     * Sends an unlock email to the given address if a locked account with that
     * address exists.  Always returns true (even when no matching account is
     * found) to prevent user enumeration.
     */
    public function requestUnlockEmail(string $email): bool
    {
        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);

        // No user found or account is not locked → return silently.
        if (!$user || !$user->isLocked()) {
            return true;
        }

        $this->sendUnlockEmail($user);

        return true;
    }

    /**
     * Unlocks the account identified by the given token.
     * Returns true on success, false if the token is missing, unknown or expired.
     */
    public function unlockAccountByToken(string $token): bool
    {
        if ('' === $token) {
            return false;
        }

        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['accountUnlockToken' => $token]);

        if (!$user) {
            return false;
        }

        $expires = $user->getAccountUnlockTokenExpiresAt();
        if (!$expires || $expires < new DateTimeImmutable()) {
            return false;
        }

        $user->setLockedAt(null);
        $user->setLockReason(null);
        $user->setAccountUnlockToken(null);
        $user->setAccountUnlockTokenExpiresAt(null);
        $this->em->flush();

        return true;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Issues a short-lived one-time token, stores it on the user and sends
     * a warning email containing a "Konto sperren" link.
     */
    private function sendNewDeviceWarning(User $user): void
    {
        $lockToken = $this->issueLockToken($user);

        $lockUrl = rtrim($this->appBaseUrl, '/') . '/api/security/lock-account?token=' . urlencode($lockToken);
        $name = htmlspecialchars($user->getFirstName() ?? $user->getEmail(), ENT_QUOTES, 'UTF-8');
        $time = (new DateTime())->format('d.m.Y H:i:s');

        $html = <<<HTML
            <p>Hallo {$name},</p>
            <p>wir haben einen Login in dein Konto von einem <strong>bisher unbekannten Gerät oder Browser</strong> festgestellt:</p>
            <table style="border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:4px 12px 4px 0;color:#555;">Zeitpunkt</td><td><strong>{$time} UTC</strong></td></tr>
            </table>
            <p>Wenn <strong>du das warst</strong> (z.&thinsp;B. neuer Browser, neues Gerät oder gelöschte Cookies),
            kannst du diese E-Mail ignorieren. Beim nächsten Login von diesem Gerät erscheint keine Warnung mehr.</p>
            <p>Wenn <strong>du das nicht warst</strong>, klicke bitte sofort auf den folgenden Link, um dein Konto zu sperren:</p>
            <p style="margin:24px 0;">
                <a href="{$lockUrl}" style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">
                    Konto jetzt sperren
                </a>
            </p>
            <p style="color:#888;font-size:0.85em;">Dieser Link ist 24 Stunden gültig. Danach wende dich bitte direkt an den Support.</p>
            HTML;

        $email = (new Email())
            ->from($this->mailerFrom)
            ->to($user->getEmail())
            ->subject('Sicherheitshinweis: Neuer Login von unbekanntem Gerät')
            ->html($html);

        $this->mailer->send($email);
    }

    /**
     * Generates and persists a new account-lock token on the user entity.
     */
    private function issueLockToken(User $user): string
    {
        $token = bin2hex(random_bytes(32));
        $user->setAccountLockToken($token);
        $user->setAccountLockTokenExpiresAt(
            new DateTimeImmutable('+' . self::LOCK_TOKEN_TTL_SECONDS . ' seconds')
        );
        $this->em->flush();

        return $token;
    }

    /**
     * Generates and persists a new account-unlock token on the user entity.
     */
    private function issueUnlockToken(User $user): string
    {
        $token = bin2hex(random_bytes(32));
        $user->setAccountUnlockToken($token);
        $user->setAccountUnlockTokenExpiresAt(
            new DateTimeImmutable('+' . self::UNLOCK_TOKEN_TTL_SECONDS . ' seconds')
        );
        $this->em->flush();

        return $token;
    }

    /**
     * Sends an email containing a one-time unlock link to the user.
     */
    private function sendUnlockEmail(User $user): void
    {
        $unlockToken = $this->issueUnlockToken($user);

        $unlockUrl = rtrim($this->appBaseUrl, '/') . '/unlock-account?token=' . urlencode($unlockToken);
        $name = htmlspecialchars($user->getFirstName() ?? $user->getEmail(), ENT_QUOTES, 'UTF-8');

        $html = <<<HTML
            <p>Hallo {$name},</p>
            <p>du hast angefragt, dein gesperrtes Konto wieder freizuschalten.</p>
            <p>Klicke auf den folgenden Link, um dein Konto zu entsperren:</p>
            <p style="margin:24px 0;">
                <a href="{$unlockUrl}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">
                    Konto jetzt entsperren
                </a>
            </p>
            <p style="color:#888;font-size:0.85em;">Dieser Link ist 24 Stunden gültig. Falls du diese E-Mail nicht angefragt hast, kannst du sie ignorieren.</p>
            HTML;

        $email = (new Email())
            ->from($this->mailerFrom)
            ->to($user->getEmail())
            ->subject('Konto entsperren: Dein Entsperr-Link')
            ->html($html);

        $this->mailer->send($email);
    }
}
