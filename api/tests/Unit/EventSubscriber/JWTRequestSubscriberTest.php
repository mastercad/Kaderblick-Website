<?php

namespace App\Tests\Unit\EventSubscriber;

use App\Entity\RefreshToken;
use App\EventSubscriber\JWTRequestSubscriber;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Error;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[AllowMockObjectsWithoutExpectations]
class JWTRequestSubscriberTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private JWTTokenManagerInterface&MockObject $jwtTokenManager;
    private HttpKernelInterface&MockObject $kernel;
    private JWTRequestSubscriber $subscriber;

    /** @var EntityRepository<RefreshToken>&MockObject */
    private EntityRepository&MockObject $repository;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->jwtTokenManager = $this->createMock(JWTTokenManagerInterface::class);
        $this->kernel = $this->createMock(HttpKernelInterface::class);
        $this->repository = $this->createMock(EntityRepository::class);

        $this->entityManager
            ->method('getRepository')
            ->with(RefreshToken::class)
            ->willReturn($this->repository);

        $this->subscriber = new JWTRequestSubscriber(
            $this->entityManager,
            $this->jwtTokenManager,
        );
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private function makeEvent(?string $cookieValue = null): RequestEvent
    {
        $request = Request::create('/api/messages/unread-count');
        if (null !== $cookieValue) {
            $request->cookies->set('jwt_refresh_token', $cookieValue);
        }

        return new RequestEvent($this->kernel, $request, HttpKernelInterface::MAIN_REQUEST);
    }

    private function makeToken(bool $expired): RefreshToken&MockObject
    {
        $token = $this->createMock(RefreshToken::class);
        $token->method('isExpired')->willReturn($expired);

        return $token;
    }

    // ── Keine Cookie – kein DB-Lookup ──────────────────────────────────────

    public function testDoesNothingWhenNoCookiePresent(): void
    {
        $this->repository->expects($this->never())->method('findOneBy');
        $this->jwtTokenManager->expects($this->never())->method('create');

        $event = $this->makeEvent(null);
        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }

    // ── Cookie vorhanden, aber kein DB-Treffer ─────────────────────────────

    public function testDoesNothingWhenTokenNotFound(): void
    {
        $this->repository->method('findOneBy')->willReturn(null);
        $this->jwtTokenManager->expects($this->never())->method('create');

        $event = $this->makeEvent('unknown-token');
        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }

    // ── Token abgelaufen ──────────────────────────────────────────────────

    public function testDoesNothingWhenTokenIsExpired(): void
    {
        $this->repository->method('findOneBy')->willReturn($this->makeToken(expired: true));
        $this->jwtTokenManager->expects($this->never())->method('create');

        $event = $this->makeEvent('expired-token');
        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }

    // ── Gültiger Token – JWT wird gesetzt ────────────────────────────────

    public function testSetsAuthorizationHeaderForValidToken(): void
    {
        $user = $this->createMock(UserInterface::class);
        $token = $this->makeToken(expired: false);
        $token->method('getUser')->willReturn($user);

        $this->repository->method('findOneBy')->willReturn($token);
        $this->jwtTokenManager->method('create')->with($user)->willReturn('generated.jwt.token');

        $event = $this->makeEvent('valid-token');
        $this->subscriber->onKernelRequest($event);

        $request = $event->getRequest();
        $this->assertSame('Bearer generated.jwt.token', $request->headers->get('Authorization'));
        $this->assertSame('generated.jwt.token', $request->attributes->get('new_jwt_token'));
    }

    // ── Fehlende Doctrine-Proxies (Deployment-Szenario) ──────────────────

    public function testDoesNotThrowWhenDoctrineProxyIsMissing(): void
    {
        $this->repository
            ->method('findOneBy')
            ->willThrowException(new Error('Failed opening required \'/var/www/symfony/var/cache/prod/doctrine/orm/Proxies/__CG__AppEntityUser.php\''));

        $event = $this->makeEvent('some-token');

        // darf keinen Exception werfen; stattdessen still weiterlaufen
        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }

    // ── Nicht-initialisierte User-Property (RefreshToken::$user) ─────────

    public function testDoesNotThrowWhenUserPropertyIsUninitialized(): void
    {
        $token = $this->makeToken(expired: false);
        $token->method('getUser')->willThrowException(
            new Error('Typed property App\Entity\RefreshToken::$user must not be accessed before initialization'),
        );

        $this->repository->method('findOneBy')->willReturn($token);

        $event = $this->makeEvent('broken-token');

        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }

    // ── DB nicht erreichbar ───────────────────────────────────────────────

    public function testDoesNotThrowWhenDatabaseIsUnavailable(): void
    {
        $this->repository
            ->method('findOneBy')
            ->willThrowException(new RuntimeException('Connection refused'));

        $event = $this->makeEvent('some-token');

        $this->subscriber->onKernelRequest($event);

        $this->assertNull($event->getRequest()->headers->get('Authorization'));
    }
}
