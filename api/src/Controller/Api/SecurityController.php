<?php

namespace App\Controller\Api;

use App\Service\LoginSecurityService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Handles account-security actions that do not require authentication.
 * Currently provides the "lock account" and "unlock account" endpoints.
 */
#[Route('/api/security', name: 'api_security_')]
class SecurityController extends AbstractController
{
    /**
     * Lock an account using the one-time token that was sent in the suspicious-
     * login warning email.
     *
     * GET /api/security/lock-account?token=<hex>
     */
    #[Route('/lock-account', name: 'lock_account', methods: ['GET'])]
    public function lockAccount(
        Request $request,
        LoginSecurityService $loginSecurityService,
    ): JsonResponse {
        $token = trim((string) $request->query->get('token', ''));

        if (!$loginSecurityService->lockAccountByToken($token)) {
            return $this->json([
                'error' => 'Ungültiger oder abgelaufener Link. Bitte wende dich direkt an den Support.',
            ], 400);
        }

        return $this->json([
            'success' => true,
            'message' => 'Dein Konto wurde gesperrt. Bitte kontaktiere den Support, um es wieder freischalten zu lassen.',
        ]);
    }

    /**
     * Request an unlock email for a locked account.
     * Always responds with success to prevent user enumeration.
     *
     * POST /api/security/request-unlock  body: { email: string }
     */
    #[Route('/request-unlock', name: 'request_unlock', methods: ['POST'])]
    public function requestUnlock(
        Request $request,
        LoginSecurityService $loginSecurityService,
    ): JsonResponse {
        $body = json_decode((string) $request->getContent(), true);
        $email = trim((string) ($body['email'] ?? ''));

        if ('' !== $email) {
            $loginSecurityService->requestUnlockEmail($email);
        }

        return $this->json([
            'success' => true,
            'message' => 'Falls ein gesperrtes Konto mit dieser E-Mail-Adresse existiert, wurde ein Entsperr-Link gesendet.',
        ]);
    }

    /**
     * Unlock an account using the one-time token sent in the unlock email.
     *
     * GET /api/security/unlock-account?token=<hex>
     */
    #[Route('/unlock-account', name: 'unlock_account', methods: ['GET'])]
    public function unlockAccount(
        Request $request,
        LoginSecurityService $loginSecurityService,
    ): JsonResponse {
        $token = trim((string) $request->query->get('token', ''));

        if (!$loginSecurityService->unlockAccountByToken($token)) {
            return $this->json([
                'error' => 'Ungültiger oder abgelaufener Link. Bitte fordere einen neuen Entsperr-Link an.',
            ], 400);
        }

        return $this->json([
            'success' => true,
            'message' => 'Dein Konto wurde erfolgreich entsperrt. Du kannst dich jetzt einloggen.',
        ]);
    }
}
