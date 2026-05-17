<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Entity\User;
use App\Event\DailyLoginEvent;
use DateTimeImmutable;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Awards daily login XP for every authenticated API request.
 *
 * The security firewall stops propagation on login/SSO responses, so those
 * paths are handled by JWTLoginSubscriber and GoogleAuthenticator respectively.
 * This subscriber covers all subsequent requests during the day where the user
 * already has a valid JWT cookie and never goes through a fresh login flow.
 *
 * A cache flag (TTL until midnight) prevents DB access on every single request:
 * only the first request of a new day triggers XP registration.
 */
class DailyLoginXpSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private TokenStorageInterface $tokenStorage,
        private EventDispatcherInterface $dispatcher,
        private CacheInterface $cache,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            // Priority 6: runs after the security firewall (priority 8) has set the
            // user in the token storage, but before the controller runs.
            KernelEvents::REQUEST => ['onKernelRequest', 6],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $token = $this->tokenStorage->getToken();
        if (null === $token) {
            return;
        }

        $user = $token->getUser();
        if (!$user instanceof User || null === $user->getId()) {
            return;
        }

        $date = (new DateTimeImmutable())->format('Ymd');
        $cacheKey = sprintf('daily_login_xp_%d_%s', $user->getId(), $date);

        $this->cache->get($cacheKey, function (ItemInterface $item) use ($user): bool {
            // Expire the flag at midnight so it resets each new day.
            $secondsUntilMidnight = strtotime('tomorrow') - time();
            $item->expiresAfter($secondsUntilMidnight);

            $this->dispatcher->dispatch(new DailyLoginEvent($user));

            return true;
        });
    }
}
