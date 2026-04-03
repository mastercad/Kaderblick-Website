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

/**
 * Handles login security checks:
 *
 *  - Rate-limiting: blocks IPs that exceeded the failure threshold (shares the
 *    same cache key as AdminAlertService so both systems stay in sync).
 *  - Unknown-IP detection: on the first successful login from a new IP the
 *    user receives a warning email with a one-click "Konto sperren" link.
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

    /** How many distinct IPs a user may accumulate before old entries are evicted. */
    private const MAX_KNOWN_IPS = 20;

    /** How long the "lock my account" token is valid after it is issued. */
    private const LOCK_TOKEN_TTL_SECONDS = 86400; // 24 hours

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
     * - Checks whether the IP is known for this user.
     * - If not: sends a warning email and adds the IP to the known list.
     * - Always persists the new known-IP list when changed.
     */
    public function handleSuccessfulLogin(User $user, string $ip): void
    {
        $ipHash = hash('sha256', $ip);
        $knownIps = $user->getKnownLoginIps();

        if (in_array($ipHash, $knownIps, true)) {
            // Known IP – nothing to do.
            return;
        }

        // First login from this IP: warn the user (but only if they already
        // have at least one known IP – on the very first login ever the list
        // is empty and there is no point in sending a warning).
        if ([] !== $knownIps) {
            $this->sendNewIpWarning($user, $ip);
        }

        // Record the IP (evict oldest entry when the list is full).
        $knownIps[] = $ipHash;
        if (count($knownIps) > self::MAX_KNOWN_IPS) {
            array_shift($knownIps);
        }
        $user->setKnownLoginIps($knownIps);
        $this->em->flush();
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

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Issues a short-lived one-time token, stores it on the user and sends
     * a warning email containing a "Konto sperren" link.
     */
    private function sendNewIpWarning(User $user, string $ip): void
    {
        $lockToken = $this->issueLockToken($user);

        $lockUrl = rtrim($this->appBaseUrl, '/') . '/api/security/lock-account?token=' . urlencode($lockToken);
        $name = htmlspecialchars($user->getFirstName() ?? $user->getEmail(), ENT_QUOTES, 'UTF-8');
        $ipSafe = htmlspecialchars($ip, ENT_QUOTES, 'UTF-8');
        $time = (new DateTime())->format('d.m.Y H:i:s');

        $html = <<<HTML
            <p>Hallo {$name},</p>
            <p>wir haben einen Login in dein Konto von einer <strong>bisher unbekannten IP-Adresse</strong> festgestellt:</p>
            <table style="border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:4px 12px 4px 0;color:#555;">IP-Adresse</td><td><strong>{$ipSafe}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#555;">Zeitpunkt</td><td><strong>{$time} UTC</strong></td></tr>
            </table>
            <p>Wenn <strong>du das warst</strong>, kannst du diese E-Mail ignorieren. Beim nächsten Login von dieser IP erscheint keine Warnung mehr.</p>
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
            ->subject('Sicherheitswarnung: Neuer Login von unbekannter IP erkannt')
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
}
