<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventSubscriber;

use App\Entity\User;
use App\Event\DailyLoginEvent;
use App\EventSubscriber\DailyLoginXpSubscriber;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

#[AllowMockObjectsWithoutExpectations]
class DailyLoginXpSubscriberTest extends TestCase
{
    private TokenStorageInterface & MockObject $tokenStorage;
    private EventDispatcherInterface & MockObject $dispatcher;
    private CacheInterface & MockObject $cache;
    private HttpKernelInterface & MockObject $kernel;
    private DailyLoginXpSubscriber $subscriber;

    protected function setUp(): void
    {
        $this->tokenStorage = $this->createMock(TokenStorageInterface::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->cache = $this->createMock(CacheInterface::class);
        $this->kernel = $this->createMock(HttpKernelInterface::class);

        $this->subscriber = new DailyLoginXpSubscriber(
            $this->tokenStorage,
            $this->dispatcher,
            $this->cache,
        );
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private function makeEvent(bool $mainRequest = true): RequestEvent
    {
        $type = $mainRequest ? HttpKernelInterface::MAIN_REQUEST : HttpKernelInterface::SUB_REQUEST;

        return new RequestEvent($this->kernel, Request::create('/api/news'), $type);
    }

    private function makeUserWithId(int $id): User
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setRoles(['ROLE_USER']);

        $reflection = new ReflectionClass($user);
        $prop = $reflection->getProperty('id');
        $prop->setAccessible(true);
        $prop->setValue($user, $id);

        return $user;
    }

    // ── getSubscribedEvents() ─────────────────────────────────────────────

    public function testSubscribesToKernelRequest(): void
    {
        $events = DailyLoginXpSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(KernelEvents::REQUEST, $events);
    }

    // ── Sub-requests are ignored ──────────────────────────────────────────

    public function testSubRequestIsIgnored(): void
    {
        $this->tokenStorage->expects($this->never())->method('getToken');
        $this->cache->expects($this->never())->method('get');

        $this->subscriber->onKernelRequest($this->makeEvent(mainRequest: false));
    }

    // ── Unauthenticated requests are ignored ──────────────────────────────

    public function testNoTokenMeansNoDispatch(): void
    {
        $this->tokenStorage->method('getToken')->willReturn(null);
        $this->dispatcher->expects($this->never())->method('dispatch');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    public function testNonUserPrincipalMeansNoDispatch(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $this->tokenStorage->method('getToken')->willReturn($token);
        $this->dispatcher->expects($this->never())->method('dispatch');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    public function testUserWithNullIdMeansNoDispatch(): void
    {
        $user = new User(); // id is null
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $this->tokenStorage->method('getToken')->willReturn($token);
        $this->dispatcher->expects($this->never())->method('dispatch');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Cache miss: DailyLoginEvent is dispatched ─────────────────────────

    public function testDispatchesEventOnCacheMiss(): void
    {
        $user = $this->makeUserWithId(42);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $item = $this->createMock(ItemInterface::class);
        $item->method('expiresAfter')->willReturnSelf();

        // Simulate cache miss: invoke the callback immediately
        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback) use ($item) {
                return $callback($item);
            });

        $this->dispatcher->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(DailyLoginEvent::class));

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Cache hit: DailyLoginEvent is NOT dispatched ──────────────────────

    public function testNoDispatchOnCacheHit(): void
    {
        $user = $this->makeUserWithId(42);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        // Cache hit: callback is NOT invoked, cached value returned directly
        $this->cache->method('get')->willReturn(true);

        $this->dispatcher->expects($this->never())->method('dispatch');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Cache key contains user ID and today's date ───────────────────────

    public function testCacheKeyContainsUserIdAndDate(): void
    {
        $user = $this->makeUserWithId(99);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $expectedDate = (new DateTimeImmutable())->format('Ymd');

        $this->cache->expects($this->once())
            ->method('get')
            ->with($this->stringContains('99'))
            ->willReturn(true);

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    public function testCacheTtlIsSetUntilMidnight(): void
    {
        $user = $this->makeUserWithId(7);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $item = $this->createMock(ItemInterface::class);
        $item->expects($this->once())
            ->method('expiresAfter')
            ->with($this->greaterThan(0));

        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback) use ($item) {
                return $callback($item);
            });

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Priority: listener runs after security firewall (priority 8) ──────

    public function testListenerPriorityIsLowerThanSecurityFirewall(): void
    {
        $events = DailyLoginXpSubscriber::getSubscribedEvents();
        $definition = $events[KernelEvents::REQUEST];

        // Can be ['method', priority] or just 'method'
        $priority = is_array($definition) ? ($definition[1] ?? 0) : 0;

        // Must fire after the security firewall (priority 8) so the token is set
        $this->assertLessThan(8, $priority);
    }

    // ── Cache key contains today's date ───────────────────────────────────

    public function testCacheKeyContainsTodaysDate(): void
    {
        $user = $this->makeUserWithId(1);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $today = (new DateTimeImmutable())->format('Ymd');

        $this->cache->expects($this->once())
            ->method('get')
            ->with($this->stringContains($today))
            ->willReturn(true);

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Different users produce different cache keys ───────────────────────

    public function testDifferentUsersProduceDifferentCacheKeys(): void
    {
        $capturedKeys = [];

        foreach ([1, 2] as $id) {
            $user = $this->makeUserWithId($id);
            $token = $this->createMock(TokenInterface::class);
            $token->method('getUser')->willReturn($user);

            $tokenStorage = $this->createMock(TokenStorageInterface::class);
            $tokenStorage->method('getToken')->willReturn($token);

            $cache = $this->createMock(CacheInterface::class);
            $cache->method('get')
                ->willReturnCallback(function (string $key) use (&$capturedKeys): bool {
                    $capturedKeys[] = $key;

                    return true;
                });

            $subscriber = new DailyLoginXpSubscriber($tokenStorage, $this->dispatcher, $cache);
            $subscriber->onKernelRequest($this->makeEvent());
        }

        $this->assertCount(2, $capturedKeys);
        $this->assertNotSame($capturedKeys[0], $capturedKeys[1]);
    }

    // ── Dispatched event carries the correct user ─────────────────────────

    public function testDispatchedEventCarriesCorrectUser(): void
    {
        $user = $this->makeUserWithId(55);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $item = $this->createMock(ItemInterface::class);
        $item->method('expiresAfter')->willReturnSelf();

        $this->cache->method('get')
            ->willReturnCallback(fn (string $key, callable $cb) => $cb($item));

        $this->dispatcher->expects($this->once())
            ->method('dispatch')
            ->with($this->callback(function (DailyLoginEvent $event) use ($user): bool {
                return $event->getUser() === $user;
            }));

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    // ── Cache is never accessed for unauthenticated / invalid requests ────

    public function testCacheIsNeverAccessedWhenNoToken(): void
    {
        $this->tokenStorage->method('getToken')->willReturn(null);
        $this->cache->expects($this->never())->method('get');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }

    public function testCacheIsNeverAccessedForSubRequest(): void
    {
        $this->cache->expects($this->never())->method('get');

        $this->subscriber->onKernelRequest($this->makeEvent(mainRequest: false));
    }

    public function testCacheIsNeverAccessedWhenUserHasNoId(): void
    {
        $user = new User();
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $this->cache->expects($this->never())->method('get');

        $this->subscriber->onKernelRequest($this->makeEvent());
    }
}
