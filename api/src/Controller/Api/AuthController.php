<?php

namespace App\Controller\Api;

use App\Entity\RefreshToken;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\AdminAlertService;
use App\Service\LoginSecurityService;
use App\Service\RefreshTokenService;
use App\Service\TwoFactorService;
use App\Service\UserTitleService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTManager;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/api', name: 'api_')]
class AuthController extends AbstractController
{
    #[Route(path: '/login', name: 'login')]
    public function login(
        Request $request,
        JWTTokenManagerInterface $JWTManager,
        EntityManagerInterface $entityManager,
        RefreshTokenService $refreshTokenService,
        AdminAlertService $adminAlertService,
        TwoFactorService $twoFactorService,
        LoginSecurityService $loginSecurityService,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);
        $email = (string) ($data['email'] ?? '');
        $clientIp = $request->getClientIp() ?? 'unbekannt';
        $deviceToken = $request->cookies->get(LoginSecurityService::DEVICE_COOKIE_NAME);

        // ── Rate limiting: block IPs that exceeded the failure threshold ──────
        if ($loginSecurityService->isRateLimited($clientIp)) {
            return new JsonResponse([
                'error' => 'Zu viele Fehlversuche. Bitte versuche es in 10 Minuten erneut.',
            ], 429);
        }

        $user = $entityManager->getRepository(User::class)
            ->findOneBy(['email' => $email]);

        if (!$user || !password_verify((string) ($data['password'] ?? ''), $user->getPassword())) {
            $adminAlertService->trackLoginFailure(
                email: $email,
                clientIp: $clientIp,
                reason: 'Ungültige Zugangsdaten (E-Mail oder Passwort falsch)'
            );

            return new JsonResponse(['error' => 'Invalid credentials'], 401);
        }

        if (!$user->isVerified()) {
            $adminAlertService->trackLoginFailure(
                email: $email,
                clientIp: $clientIp,
                reason: 'Konto nicht verifiziert'
            );

            return new JsonResponse(['error' => 'User not verified'], 401);
        }

        // ── Account-lock check ────────────────────────────────────────────────
        if ($loginSecurityService->isAccountLocked($user)) {
            return new JsonResponse([
                'error' => 'Dein Konto wurde gesperrt. Bitte kontaktiere den Support.',
            ], 403);
        }

        // ── Two-Factor Authentication check ──────────────────────────────
        if ($user->hasAnyTwoFactorEnabled()) {
            $pendingToken = $twoFactorService->issuePendingToken($user);
            $method = $user->isTotpEnabled() ? 'totp' : 'email';

            return new JsonResponse([
                'twoFactorRequired' => true,
                'pendingToken' => $pendingToken,
                'method' => $method,
            ], 200);
        }

        // ── Issue JWT (no 2FA) ────────────────────────────────────────────────
        $accessToken = $JWTManager->create($user);
        $refreshToken = $refreshTokenService->createRefreshToken($user);

        $ttl = $this->getParameter('lexik_jwt_authentication.token_ttl');
        $expireDate = (new DateTime())->modify("+{$ttl} seconds");
        $expireTimestamp = $expireDate->getTimestamp();

        // Unknown-device check: notify user and set long-lived device cookie if new device.
        $newDeviceToken = $loginSecurityService->handleSuccessfulLogin($user, $deviceToken);

        $response = new JsonResponse(['token' => $accessToken]);
        if (null !== $newDeviceToken) {
            $response->headers->setCookie(
                new Cookie(
                    LoginSecurityService::DEVICE_COOKIE_NAME,
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
            new Cookie(
                'jwt_token',
                $accessToken,
                $expireTimestamp,
                '/',
                null,
                true,
                true,
                false,
                'strict'
            ),
        );

        $response->headers->setCookie(
            new Cookie(
                'jwt_refresh_token',
                $refreshToken,
                new DateTime('+7 days'),
                '/',
                null,
                true,
                true,
                false,
                'strict'
            ),
        );

        return $response;
    }

    #[Route(path: '/logout', name: 'logout')]
    public function logoutAction(Request $request): JsonResponse
    {
        $response = new JsonResponse(['logged out' => true], 200);

        $request->attributes->remove('new_jwt_token');
        $response->headers->clearCookie('jwt_token', '/', '', true, true, 'lax');
        $response->headers->clearCookie('jwt_refresh_token', '/', '', true, true, 'lax');

        return $response;
    }

    #[Route(path: '/token/refresh', name: 'token_refresh')]
    public function refreshTokenAction(Request $request, EntityManagerInterface $em, JWTManager $jwtManager): JsonResponse
    {
        $refreshTokenString = $request->cookies->get('jwt_refresh_token');

        if (!$refreshTokenString) {
            return new JsonResponse(['error' => 'No refresh token'], 401);
        }

        $token = $em->getRepository(RefreshToken::class)->findOneBy(['token' => $refreshTokenString]);

        if (!$token || $token->isExpired()) {
            return new JsonResponse(['error' => 'Invalid or expired refresh token'], 401);
        }

        $user = $token->getUser();
        $jwt = $jwtManager->create($user);

        return new JsonResponse(['token' => $jwt]);
    }

    #[Route('/about/me', name: 'about_me')]
    public function me(UserTitleService $userTitleService): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $isCoach = false;
        $isPlayer = false;
        /** @var UserRelation $userRelation */
        foreach ($user->getUserRelations() as $userRelation) {
            if ('coach' === $userRelation->getRelationType()->getCategory()) {
                $isCoach = true;
            } elseif ('player' === $userRelation->getRelationType()->getCategory()) {
                $isPlayer = true;
            }
            if ($isCoach && $isPlayer) {
                break;
            }
        }

        $titleData = $userTitleService->retrieveTitleDataForUser($user);

        return $this->json([
            'id' => $user->getId(),
            'isCoach' => $isCoach,
            'isPlayer' => $isPlayer,
            'email' => $user->getUserIdentifier(),
            'title' => $titleData,
        ]);
    }
}
