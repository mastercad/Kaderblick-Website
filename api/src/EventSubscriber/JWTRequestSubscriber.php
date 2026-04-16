<?php

namespace App\EventSubscriber;

use App\Entity\RefreshToken;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Throwable;

#[AsEventListener(event: 'kernel.request', method: 'onKernelRequest', priority: 20)]
class JWTRequestSubscriber
{
    public function __construct(private EntityManagerInterface $entityManager, private JWTTokenManagerInterface $jwtTokenManager)
    {
    }

    // Subscriber to move JWT Token every RQ from cookie to auth header for JWT
    public function onKernelRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();
        $refreshTokenString = $request->cookies->get('jwt_refresh_token');

        if (!$refreshTokenString) {
            return;
        }

        try {
            $token = $this->entityManager->getRepository(RefreshToken::class)->findOneBy(['token' => $refreshTokenString]);

            if (!$token || $token->isExpired()) {
                return;
            }

            $user = $token->getUser();
            $jwt = $this->jwtTokenManager->create($user);

            $request->attributes->set('new_jwt_token', $jwt);
            $request->headers->set('Authorization', 'Bearer ' . $jwt);
        } catch (Throwable) {
            // Proxy files not yet generated or DB unavailable (e.g. during deployment).
            // Simply skip token injection — security layer will return 401/403 as expected.
        }
    }
}
