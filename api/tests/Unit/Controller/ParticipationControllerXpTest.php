<?php

namespace App\Tests\Unit\Controller;

use App\Controller\ParticipationController;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\User;
use App\Event\CalendarEventParticipatedEvent;
use App\Event\MatchAttendedEvent;
use App\Event\TrainingAttendedEvent;
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
 * Tests that ParticipationController::respond() dispatches the correct XP event
 * based on the participation status and calendar event type.
 */
#[AllowMockObjectsWithoutExpectations]
class ParticipationControllerXpTest extends TestCase
{
    private ParticipationController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;
    private ParticipationRepository&MockObject $participationRepo;
    private ParticipationStatusRepository&MockObject $statusRepo;
    private TeamMembershipService&MockObject $membershipService;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $this->participationRepo = $this->createMock(ParticipationRepository::class);
        $this->statusRepo = $this->createMock(ParticipationStatusRepository::class);
        $notificationService = $this->createMock(NotificationService::class);
        $this->membershipService = $this->createMock(TeamMembershipService::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);

        $this->controller = new ParticipationController(
            $em,
            $this->participationRepo,
            $this->statusRepo,
            $notificationService,
            $this->membershipService,
            $this->dispatcher,
        );

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
    }

    // ─── TrainingAttendedEvent ────────────────────────────────────────────────

    public function testDispatchesTrainingAttendedWhenConfirmedAndTypeIsTraining(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('confirmed');
        $event = $this->makeCalendarEvent('Training');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(TrainingAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── MatchAttendedEvent ───────────────────────────────────────────────────

    public function testDispatchesMatchAttendedWhenConfirmedAndTypeIsSpiel(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('confirmed');
        $event = $this->makeCalendarEvent('Spiel');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(MatchAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testDispatchesMatchAttendedWhenConfirmedAndTypeIsTurnierMatch(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('confirmed');
        $event = $this->makeCalendarEvent('Turnier-Match');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(MatchAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── CalendarEventParticipatedEvent ──────────────────────────────────────

    public function testDispatchesCalendarEventParticipatedForOtherEventTypes(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('confirmed');
        $event = $this->makeCalendarEvent('Vereinstreffen');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(CalendarEventParticipatedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── No dispatch when status is not confirmed ─────────────────────────────

    public function testNoXpEventDispatchedWhenStatusIsDeclined(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('declined');
        $event = $this->makeCalendarEvent('Training');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(content: json_encode(['status_id' => 2, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testNoXpEventDispatchedWhenStatusIsPending(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('pending');
        $event = $this->makeCalendarEvent('Spiel');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(content: json_encode(['status_id' => 3, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function makeUser(): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('getFullName')->willReturn('Test User');

        return $user;
    }

    private function makeStatus(string $code): ParticipationStatus&MockObject
    {
        $status = $this->createMock(ParticipationStatus::class);
        $status->method('getId')->willReturn(1);
        $status->method('getCode')->willReturn($code);
        $status->method('getName')->willReturn($code);
        $status->method('getColor')->willReturn('#000');
        $status->method('getIcon')->willReturn('check');

        return $status;
    }

    private function makeCalendarEvent(string $typeName): CalendarEvent&MockObject
    {
        $type = $this->createMock(CalendarEventType::class);
        $type->method('getName')->willReturn($typeName);

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn($type);
        $event->method('getGame')->willReturn(null);

        return $event;
    }

    /**
     * Wires up all shared mock expectations for a successful respond() call.
     */
    private function wireScenario(
        User&MockObject $user,
        ParticipationStatus&MockObject $status,
        CalendarEvent&MockObject $event,
    ): void {
        // Wire user into the security container
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);

        // User is eligible to participate
        $this->membershipService
            ->method('canUserParticipateInEvent')
            ->willReturn(true);

        // Status lookup
        $this->statusRepo
            ->method('find')
            ->willReturn($status);

        // No existing participation → new Participation() is created in the method
        $this->participationRepo
            ->method('findOneBy')
            ->willReturn(null);

        // No other participants → no notifications sent
        $this->participationRepo
            ->method('findByEvent')
            ->willReturn([]);
    }
}
