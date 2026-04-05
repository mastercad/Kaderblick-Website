<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventStatusController;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Repository\ParticipationRepository;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\EmailNotificationService;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class CalendarControllerCancelTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private NotificationService&MockObject $notificationService;
    private CalendarEventStatusController $controller;
    private User&MockObject $user;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private ParticipationRepository&MockObject $participationRepo;
    private TeamMembershipService&MockObject $teamMembershipService;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $emailService = $this->createMock(EmailNotificationService::class);
        $this->participationRepo = $this->createMock(ParticipationRepository::class);
        $calendarEventService = $this->createMock(CalendarEventService::class);
        $this->notificationService = $this->createMock(NotificationService::class);
        $this->teamMembershipService = $this->createMock(TeamMembershipService::class);

        // Default repository stub: findBy() → [], getResult() → [] to prevent
        // foreach-null PHP warnings when tests don't set up an explicit repo mock.
        // Individual tests may override via $this->entityManager->method('getRepository')->willReturn(...).
        $defaultQuery = $this->createMock(Query::class);
        $defaultQuery->method('getResult')->willReturn([]);
        $defaultQuery->method('getSingleScalarResult')->willReturn(0);
        $defaultQb = $this->createMock(QueryBuilder::class);
        $defaultQb->method('select')->willReturnSelf();
        $defaultQb->method('where')->willReturnSelf();
        $defaultQb->method('andWhere')->willReturnSelf();
        $defaultQb->method('setParameter')->willReturnSelf();
        $defaultQb->method('innerJoin')->willReturnSelf();
        $defaultQb->method('orderBy')->willReturnSelf();
        $defaultQb->method('getQuery')->willReturn($defaultQuery);
        $defaultRepo = $this->createMock(EntityRepository::class);
        $defaultRepo->method('findBy')->willReturn([]);
        $defaultRepo->method('findOneBy')->willReturn(null);
        $defaultRepo->method('createQueryBuilder')->willReturn($defaultQb);
        $this->entityManager->method('getRepository')->willReturn($defaultRepo);

        $this->controller = new CalendarEventStatusController(
            $this->entityManager,
            $this->notificationService,
            $this->teamMembershipService,
            $emailService,
            $calendarEventService,
        );

        // Set up authenticated user
        $this->user = $this->createMock(User::class);
        $this->user->method('getId')->willReturn(1);
        $this->user->method('getFullName')->willReturn('Max Mustermann');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }

    public function testCancelEventForbiddenReturns403(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')
            ->with(CalendarEventVoter::CANCEL, $event)
            ->willReturn(false);

        $request = new Request(content: json_encode(['reason' => 'Regen']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertArrayHasKey('error', $data);
        $this->assertStringContainsString('Forbidden', $data['error']);
    }

    public function testCancelEventAlreadyCancelledReturns400(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setCancelled(true);

        $this->authChecker->method('isGranted')->willReturn(true);

        $request = new Request(content: json_encode(['reason' => 'Regen']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertStringContainsString('bereits abgesagt', $data['error']);
    }

    public function testCancelEventWithoutReasonReturns400(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);

        $request = new Request(content: json_encode(['reason' => '']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertStringContainsString('Grund', $data['error']);
    }

    public function testCancelEventWithWhitespaceReasonReturns400(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);

        $request = new Request(content: json_encode(['reason' => '   ']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCancelEventWithMissingReasonKeyReturns400(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);

        $request = new Request(content: json_encode([]));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCancelEventSuccessUpdatesEntityAndReturnsSuccess(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $startDate = new DateTime('2025-06-15 18:00');
        $event->setStartDate($startDate);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->expects($this->once())->method('flush');

        // No permissions, no game — so no recipients
        $request = new Request(content: json_encode(['reason' => 'Platzsperrung']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(0, $data['recipientCount']);

        // Verify entity state changed
        $this->assertTrue($event->isCancelled());
        $this->assertSame('Platzsperrung', $event->getCancelReason());
        $this->assertSame($this->user, $event->getCancelledBy());
    }

    public function testCancelEventSendsNotificationsToRecipients(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Wichtiges Spiel');
        $startDate = new DateTime('2025-06-15 18:00');
        $event->setStartDate($startDate);

        // Add a user permission so there's at least one recipient
        $recipientUser = $this->createMock(User::class);
        $recipientUser->method('getId')->willReturn(42);

        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::USER);
        $permission->setUser($recipientUser);
        $event->addPermission($permission);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        // The controller delegates recipient resolution to TeamMembershipService
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$recipientUser]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->callback(function ($users) {
                    return 1 === count($users) && 42 === $users[0]->getId();
                }),
                'event_cancelled',
                $this->stringContains('Absage'),
                $this->stringContains('Platzsperrung'),
                $this->isArray(),
            );

        $request = new Request(content: json_encode(['reason' => 'Platzsperrung']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(1, $data['recipientCount']);
    }

    public function testCancelEventExcludesCancellerFromRecipients(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setStartDate(new DateTime('2025-06-15 18:00'));

        // Add the cancelling user (ID 1) as a permission recipient
        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::USER);
        $permission->setUser($this->user); // The canceller
        $event->addPermission($permission);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        // Notification should NOT be called because the only recipient is the canceller
        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $request = new Request(content: json_encode(['reason' => 'Grund']));

        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, $data['recipientCount']);
    }

    // =========================================================================
    // reactivateEvent tests
    // =========================================================================

    public function testReactivateEventForbiddenReturns403(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setCancelled(true);

        $this->authChecker->method('isGranted')
            ->with(CalendarEventVoter::CANCEL, $event)
            ->willReturn(false);

        $response = $this->controller->reactivateEvent($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertArrayHasKey('error', $data);
    }

    public function testReactivateEventNotCancelledReturns400(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        // NOT cancelled

        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->reactivateEvent($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertStringContainsString('nicht abgesagt', $data['error']);
    }

    public function testReactivateEventSuccessResetsEntityState(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setStartDate(new DateTime('2026-06-15 18:00'));
        $event->setCancelled(true);
        $event->setCancelReason('Regen');
        $event->setCancelledBy($this->user);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->expects($this->once())->method('flush');

        // No permissions, no TeamRides → 0 recipients
        $response = $this->controller->reactivateEvent($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(0, $data['recipientCount']);

        // Entity state must be reset
        $this->assertFalse($event->isCancelled());
        $this->assertNull($event->getCancelReason());
        $this->assertNull($event->getCancelledBy());
    }

    public function testReactivateEventSendsNotificationToRecipients(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Spiel');
        $event->setStartDate(new DateTime('2026-06-15 18:00'));
        $event->setCancelled(true);

        $recipientUser = $this->createMock(User::class);
        $recipientUser->method('getId')->willReturn(99);

        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::USER);
        $permission->setUser($recipientUser);
        $event->addPermission($permission);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        // The controller delegates recipient resolution to TeamMembershipService
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$recipientUser]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->callback(fn ($users) => 1 === count($users) && 99 === $users[0]->getId()),
                'event_reactivated',
                $this->stringContains('Reaktiviert'),
                $this->stringContains('findet'),
                $this->isArray(),
            );

        $response = $this->controller->reactivateEvent($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, $data['recipientCount']);
    }

    public function testReactivateEventExcludesCancellerFromRecipients(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setStartDate(new DateTime('2026-06-15 18:00'));
        $event->setCancelled(true);

        // Only the reactivating user has a permission
        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::USER);
        $permission->setUser($this->user);
        $event->addPermission($permission);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $response = $this->controller->reactivateEvent($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(0, $data['recipientCount']);
    }

    // =========================================================================
    // PUBLIC event: only participation-registered users notified
    // =========================================================================

    public function testCancelPublicEventOnlyNotifiesRegisteredParticipants(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Öffentliches Event');
        $event->setStartDate(new DateTime('2026-06-15 18:00'));

        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::PUBLIC);
        $event->addPermission($permission);

        // One registered participant
        $participantUser = $this->createMock(User::class);
        $participantUser->method('getId')->willReturn(77);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        // The controller delegates recipient resolution to TeamMembershipService
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$participantUser]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->callback(fn ($users) => 1 === count($users) && 77 === $users[0]->getId()),
                'event_cancelled',
                $this->anything(),
                $this->anything(),
                $this->anything(),
            );

        $request = new Request(content: json_encode(['reason' => 'Ausfall']));
        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, $data['recipientCount']);
    }

    public function testCancelPublicEventWithNoParticipantsSendsNoNotification(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Leeres öffentliches Event');
        $event->setStartDate(new DateTime('2026-06-15 18:00'));

        $permission = new \App\Entity\CalendarEventPermission();
        $permission->setPermissionType(\App\Enum\CalendarEventPermissionType::PUBLIC);
        $event->addPermission($permission);

        // No participants
        $qb = $this->createMock(QueryBuilder::class);
        $query = $this->createMock(Query::class);
        $qb->method('innerJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);
        $query->method('getResult')->willReturn([]);
        $this->participationRepo->method('createQueryBuilder')->willReturn($qb);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('flush');

        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $request = new Request(content: json_encode(['reason' => 'Ausfall']));
        $response = $this->controller->cancelEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, $data['recipientCount']);
    }
}
