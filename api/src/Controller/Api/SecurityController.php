<?php

namespace App\Controller\Api;

use App\Service\LoginSecurityService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Handles account-security actions that do not require authentication.
 * Currently provides the "lock account" endpoint used in the suspicious-login
 * warning email.
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
}
