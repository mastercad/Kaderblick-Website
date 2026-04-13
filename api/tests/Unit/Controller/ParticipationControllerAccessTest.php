<?php

namespace App\Tests\Unit\Controller;

use App\Controller\ParticipationController;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Repository\ParticipationRepository;
use App\Repository\ParticipationStatusRepository;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit tests for the access-control gate added to ParticipationController.
 *
 * Ensures:
 *  - Non-eligible users receive 403 from GET /api/participation/event/{id}
 *  - Eligible users pass through (200)
 *  - SUPERADMIN bypasses the membership check
 *  - respond() returns 403 for non-eligible users
 */
#[AllowMockObjectsWithoutExpectations]
class ParticipationControllerAccessTest extends TestCase
{
    private ParticipationController $controller;
    private TeamMembershipService&MockObject $membershipService;
    private ParticipationRepository&MockObject $participationRepo;
    private ParticipationStatusRepository&MockObject $participationStatusRepo;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $this->participationRepo = $this->createMock(ParticipationRepository::class);
        $this->participationStatusRepo = $this->createMock(ParticipationStatusRepository::class);
        $notificationService = $this->createMock(NotificationService::class);
        $this->membershipService = $this->createMock(TeamMembershipService::class);

        $this->controller = new ParticipationController(
            $em,
            $this->participationRepo,
            $this->participationStatusRepo,
            $notificationService,
            $this->membershipService,
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
    }

    // ─── getEventParticipations ───────────────────────────────────────────────

    public function testGetParticipationsReturns403WhenUserNotEligible(): void
    {
        $user = $this->makeUser(['ROLE_USER']);
        $event = $this->makeCalendarEvent();
        $this->wireUser($user);

        $this->membershipService
            ->expects($this->once())
            ->method('canUserParticipateInEvent')
            ->with($user, $event)
            ->willReturn(false);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(403, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testGetParticipationsReturns200WhenUserIsEligible(): void
    {
        $user = $this->makeUser(['ROLE_USER']);
        $event = $this->makeCalendarEvent();
        $this->wireUser($user);

        $this->membershipService
            ->expects($this->once())
            ->method('canUserParticipateInEvent')
            ->willReturn(true);

        // No participations, no statuses — just verifying the gate passes
        $this->participationRepo->method('findBy')->willReturn([]);
        $this->participationStatusRepo->method('findBy')->willReturn([]);

        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('participations', $data);
        $this->assertArrayHasKey('available_statuses', $data);
    }

    public function testGetParticipationsSuperadminBypassesMembershipCheck(): void
    {
        $superadmin = $this->makeUser(['ROLE_SUPERADMIN']);
        $event = $this->makeCalendarEvent();
        $this->wireUser($superadmin);

        $this->membershipService->expects($this->never())->method('canUserParticipateInEvent');

        $this->participationRepo->method('findBy')->willReturn([]);
        $this->participationStatusRepo->method('findBy')->willReturn([]);
        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetParticipationsNoCheckWhenAnonymous(): void
    {
        // When getUser() returns null the membership check is skipped
        $this->wireUser(null);

        $event = $this->makeCalendarEvent();

        $this->membershipService->expects($this->never())->method('canUserParticipateInEvent');

        $this->participationRepo->method('findBy')->willReturn([]);
        $this->participationStatusRepo->method('findBy')->willReturn([]);
        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── respond ─────────────────────────────────────────────────────────────

    public function testRespondReturns403WhenUserNotEligible(): void
    {
        $user = $this->makeUser(['ROLE_USER']);
        $event = $this->makeCalendarEvent();
        $this->wireUser($user);

        $this->membershipService
            ->expects($this->once())
            ->method('canUserParticipateInEvent')
            ->with($user, $event)
            ->willReturn(false);

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));

        $response = $this->controller->respond($request, $event);

        $this->assertSame(403, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertStringContainsString('nicht berechtigt', $data['error']);
    }

    public function testRespondReturns401WhenAnonymous(): void
    {
        $this->wireUser(null);

        $event = $this->makeCalendarEvent();
        $request = new Request(content: json_encode(['status_id' => 1]));

        $response = $this->controller->respond($request, $event);

        $this->assertSame(401, $response->getStatusCode());
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * @param string[] $roles
     */
    private function makeUser(array $roles): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    private function makeCalendarEvent(): CalendarEvent&MockObject
    {
        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn(null);
        $event->method('getGame')->willReturn(null);

        return $event;
    }

    private function wireUser(?User $user): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }
}
