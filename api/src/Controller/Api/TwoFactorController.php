<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\TwoFactorService;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * All endpoints require an authenticated user (ROLE_USER) via JWT cookie.
 *
 * POST /api/2fa/setup          → generate secret + QR code SVG
 * POST /api/2fa/enable         → verify first code, activate, return backup codes
 * POST /api/2fa/disable        → disable TOTP 2FA (requires current TOTP code or backup code)
 * GET  /api/2fa/status         → whether 2FA is enabled + backup code count + email OTP status
 * POST /api/2fa/backup-codes   → regenerate backup codes (requires TOTP code)
 * POST /api/2fa/verify         → verify pending-token + code (during login flow, TOTP or Email OTP)
 * POST /api/2fa/email/send-code      → generate + send Email OTP (for setup verification)
 * POST /api/2fa/email/enable         → verify received code → enable Email OTP
 * POST /api/2fa/email/disable        → verify received code → disable Email OTP
 * POST /api/2fa/email/send-login-code → send Email OTP during login flow (PUBLIC)
 */
#[Route('/api/2fa', name: 'api_2fa_')]
class TwoFactorController extends AbstractController
{
    public function __construct(
        private TwoFactorService $twoFactorService,
    ) {
    }

    /**
     * Start setup: generate a new TOTP secret and return the QR code as SVG + raw URI.
     * The secret is stored but NOT yet activated until /enable is called.
     */
    #[Route('/setup', name: 'setup', methods: ['POST'])]
    public function setup(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        $uri = $this->twoFactorService->generateSecret($user);

        $qrSvg = null;
        if (class_exists(Writer::class)) {
            $renderer = new ImageRenderer(
                new RendererStyle(200),
                new SvgImageBackEnd()
            );
            $writer = new Writer($renderer);
            $qrSvg = $writer->writeString($uri);
        }

        return $this->json([
            'uri' => $uri,
            'qrSvg' => $qrSvg,
        ]);
    }

    /**
     * Confirm setup: verify the first TOTP code, enable 2FA, return one-time backup codes.
     */
    #[Route('/enable', name: 'enable', methods: ['POST'])]
    public function enable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        $data = json_decode($request->getContent(), true);
        $code = trim((string) ($data['code'] ?? ''));

        if ('' === $code) {
            return $this->json(['error' => 'Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.'], 400);
        }

        $backupCodes = $this->twoFactorService->verifyAndEnable($user, $code);

        if (false === $backupCodes) {
            return $this->json(['error' => 'Der eingegebene Code ist ungültig. Bitte prüfe die Uhrzeit deines Geräts und versuche es erneut.'], 400);
        }

        return $this->json([
            'success' => true,
            'backupCodes' => $backupCodes,
            'message' => '2FA wurde erfolgreich aktiviert. Speichere deine Backup-Codes sicher ab!',
        ]);
    }

    /**
     * Disable 2FA. Requires a valid TOTP code or backup code for confirmation.
     */
    #[Route('/disable', name: 'disable', methods: ['POST'])]
    public function disable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        if (!$user->isTotpEnabled()) {
            return $this->json(['error' => '2FA ist nicht aktiviert.'], 400);
        }

        $data = json_decode($request->getContent(), true);
        $code = trim((string) ($data['code'] ?? ''));

        if ('' === $code) {
            return $this->json(['error' => 'Bitte gib den aktuellen Code aus deiner Authenticator-App oder einen Backup-Code ein.'], 400);
        }

        $valid = $this->twoFactorService->verify($user, $code)
            || $this->twoFactorService->verifyBackupCode($user, $code);

        if (!$valid) {
            return $this->json(['error' => 'Ungültiger Code. 2FA wurde nicht deaktiviert.'], 400);
        }

        $this->twoFactorService->disable($user);

        return $this->json([
            'success' => true,
            'message' => '2FA wurde deaktiviert.',
        ]);
    }

    /**
     * Return the current 2FA status for the logged-in user.
     */
    #[Route('/status', name: 'status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        return $this->json([
            'enabled' => $user->isTotpEnabled(),
            'emailOtpEnabled' => $user->isEmailOtpEnabled(),
            'backupCodesRemaining' => count($user->getTotpBackupCodes()),
        ]);
    }

    /**
     * Regenerate backup codes (the old ones are immediately invalidated).
     * Requires a valid TOTP code for confirmation.
     */
    #[Route('/backup-codes', name: 'backup_codes_regenerate', methods: ['POST'])]
    public function regenerateBackupCodes(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        if (!$user->isTotpEnabled()) {
            return $this->json(['error' => '2FA ist nicht aktiviert.'], 400);
        }

        $data = json_decode($request->getContent(), true);
        $code = trim((string) ($data['code'] ?? ''));

        if (!$this->twoFactorService->verify($user, $code)) {
            return $this->json(['error' => 'Ungültiger Bestätigungscode.'], 400);
        }

        $plainCodes = $this->twoFactorService->regenerateBackupCodes($user);

        return $this->json([
            'success' => true,
            'backupCodes' => $plainCodes,
            'message' => 'Neue Backup-Codes wurden generiert. Die alten Codes sind nicht mehr gültig.',
        ]);
    }

    /**
     * Verify a TOTP/backup code during the login 2FA step.
     *
     * Expects: { pendingToken: string, code: string }
     * Returns: { token: string } (JWT) on success.
     */
    #[Route('/verify', name: 'verify', methods: ['POST'])]
    public function verifyLoginStep(
        Request $request,
        \Doctrine\ORM\EntityManagerInterface $em,
        \Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface $jwtManager,
        \App\Service\RefreshTokenService $refreshTokenService,
        \App\Service\LoginSecurityService $loginSecurityService,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);
        $pendingToken = trim((string) ($data['pendingToken'] ?? ''));
        $code = trim((string) ($data['code'] ?? ''));

        if ('' === $pendingToken || '' === $code) {
            return $this->json(['error' => 'Fehlende Daten.'], 400);
        }

        // Find user by pending token
        /** @var User|null $user */
        $user = $em->getRepository(User::class)->findOneBy(['twoFactorPendingToken' => $pendingToken]);

        if (!$user) {
            return $this->json(['error' => 'Ungültiger oder abgelaufener Bestätigungslink. Bitte melde dich erneut an.'], 401);
        }

        if (!$this->twoFactorService->validatePendingToken($user, $pendingToken)) {
            return $this->json(['error' => 'Der Bestätigungslink ist abgelaufen. Bitte melde dich erneut an.'], 401);
        }

        // Try TOTP code first, then backup code, then Email OTP
        $valid = $this->twoFactorService->verify($user, $code)
            || $this->twoFactorService->verifyBackupCode($user, $code)
            || ($user->isEmailOtpEnabled() && $this->twoFactorService->verifyEmailOtpCode($user, $code));

        if (!$valid) {
            return $this->json(['error' => 'Ungültiger Code. Bitte prüfe deine Authenticator-App, deinen E-Mail-Code oder verwende einen Backup-Code.'], 400);
        }

        // Clear pending token
        $this->twoFactorService->clearPendingToken($user);

        // Unknown-device check: notify user and set long-lived device cookie if new device.
        $deviceToken = $request->cookies->get(\App\Service\LoginSecurityService::DEVICE_COOKIE_NAME);
        $newDeviceToken = $loginSecurityService->handleSuccessfulLogin($user, $deviceToken);

        // Issue JWT + refresh token (same as normal login)
        $accessToken = $jwtManager->create($user);
        $refreshToken = $refreshTokenService->createRefreshToken($user);

        $ttl = $this->getParameter('lexik_jwt_authentication.token_ttl');
        $expireDate = (new DateTime())->modify("+{$ttl} seconds");

        $response = new JsonResponse(['token' => $accessToken]);
        if (null !== $newDeviceToken) {
            $response->headers->setCookie(
                new \Symfony\Component\HttpFoundation\Cookie(
                    \App\Service\LoginSecurityService::DEVICE_COOKIE_NAME,
                    $newDeviceToken,
                    new DateTime('+180 days'),
                    '/',
                    null,
                    true,
                    true,
                    false,
                    'lax'
                )
            );
        }

        $response->headers->setCookie(
            new \Symfony\Component\HttpFoundation\Cookie(
                'jwt_token',
                $accessToken,
                $expireDate->getTimestamp(),
                '/',
                null,
                true,
                true,
                false,
                'strict'
            )
        );
        $response->headers->setCookie(
            new \Symfony\Component\HttpFoundation\Cookie(
                'jwt_refresh_token',
                $refreshToken,
                new DateTime('+7 days'),
                '/',
                null,
                true,
                true,
                false,
                'strict'
            )
        );

        return $response;
    }

    // ── Email OTP endpoints ─────────────────────────────────────────────

    /**
     * Generate and send an Email OTP code to the logged-in user.
     * Used during the 2FA setup wizard to verify the email address works.
     */
    #[Route('/email/send-code', name: 'email_send_code', methods: ['POST'])]
    public function emailSendCode(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        $plain = $this->twoFactorService->generateEmailOtpCode($user);
        $this->twoFactorService->sendEmailOtpCode($user, $plain);

        return $this->json([
            'success' => true,
            'message' => 'Ein Bestätigungs-Code wurde an deine E-Mail-Adresse gesendet.',
        ]);
    }

    /**
     * Enable Email OTP: verify the code received by email during setup.
     */
    #[Route('/email/enable', name: 'email_enable', methods: ['POST'])]
    public function emailEnable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        $data = json_decode($request->getContent(), true);
        $code = trim((string) ($data['code'] ?? ''));

        if ('' === $code) {
            return $this->json(['error' => 'Bitte gib den Code aus deiner E-Mail ein.'], 400);
        }

        if (!$this->twoFactorService->verifyEmailOtpCode($user, $code)) {
            return $this->json(['error' => 'Ungültiger oder abgelaufener Code. Bitte fordere einen neuen Code an.'], 400);
        }

        $this->twoFactorService->enableEmailOtp($user);

        return $this->json([
            'success' => true,
            'message' => 'E-Mail-Einmalcode als 2FA wurde erfolgreich aktiviert.',
        ]);
    }

    /**
     * Disable Email OTP: requires a valid Email OTP code for confirmation.
     */
    #[Route('/email/disable', name: 'email_disable', methods: ['POST'])]
    public function emailDisable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht angemeldet'], 401);
        }

        if (!$user->isEmailOtpEnabled()) {
            return $this->json(['error' => 'E-Mail-2FA ist nicht aktiviert.'], 400);
        }

        $data = json_decode($request->getContent(), true);
        $code = trim((string) ($data['code'] ?? ''));

        if ('' === $code) {
            return $this->json(['error' => 'Bitte gib den Bestätigungs-Code aus deiner E-Mail ein.'], 400);
        }

        if (!$this->twoFactorService->verifyEmailOtpCode($user, $code)) {
            return $this->json(['error' => 'Ungültiger oder abgelaufener Code.'], 400);
        }

        $this->twoFactorService->disableEmailOtp($user);

        return $this->json([
            'success' => true,
            'message' => 'E-Mail-2FA wurde deaktiviert.',
        ]);
    }

    /**
     * PUBLIC endpoint: used during login to send the Email OTP code.
     * Accepts a pending token, finds the user, and sends the code.
     *
     * Expects: { pendingToken: string }
     */
    #[Route('/email/send-login-code', name: 'email_send_login_code', methods: ['POST'])]
    public function emailSendLoginCode(
        Request $request,
        \Doctrine\ORM\EntityManagerInterface $em,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);
        $pendingToken = trim((string) ($data['pendingToken'] ?? ''));

        if ('' === $pendingToken) {
            return $this->json(['error' => 'Fehlender Token.'], 400);
        }

        /** @var User|null $user */
        $user = $em->getRepository(User::class)->findOneBy(['twoFactorPendingToken' => $pendingToken]);

        if (!$user || !$this->twoFactorService->validatePendingToken($user, $pendingToken)) {
            return $this->json(['error' => 'Ungültiger oder abgelaufener Token.'], 401);
        }

        if (!$user->isEmailOtpEnabled()) {
            return $this->json(['error' => 'E-Mail-2FA ist für dieses Konto nicht aktiv.'], 400);
        }

        $plain = $this->twoFactorService->generateEmailOtpCode($user);
        $this->twoFactorService->sendEmailOtpCode($user, $plain);

        return $this->json([
            'success' => true,
            'message' => 'Ein Bestätigungs-Code wurde an deine E-Mail-Adresse gesendet.',
        ]);
    }
}
