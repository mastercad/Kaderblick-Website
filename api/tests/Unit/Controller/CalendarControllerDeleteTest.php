<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventDeleteController;
use App\Controller\Api\Calendar\CalendarEventUpdateController;
use App\Entity\CalendarEvent;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\TrainingSeriesUpdateService;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit tests for CalendarController::deleteEvent() and
 * CalendarController::updateCalendarEvent() — training-series aspects.
 */
class CalendarControllerDeleteTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private CalendarEventService&MockObject $calendarEventService;
    private User&MockObject $user;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private TokenStorageInterface&MockObject $tokenStorage;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventService = $this->createMock(CalendarEventService::class);

        // Default repository stub
        $defaultRepo = $this->buildDefaultRepo();
        $this->entityManager->method('getRepository')->willReturn($defaultRepo);

        $this->user = $this->createMock(User::class);
        $this->user->method('getId')->willReturn(1);

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->user);
        $this->tokenStorage = $this->createMock(TokenStorageInterface::class);
        $this->tokenStorage->method('getToken')->willReturn($token);

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
    }

    // ─── Controller factories ──────────────────────────────────────────────────

    private function makeDeleteController(?EntityManagerInterface $em = null): CalendarEventDeleteController
    {
        $controller = new CalendarEventDeleteController(
            $em ?? $this->entityManager,
            $this->calendarEventService,
            $this->createMock(EventDispatcherInterface::class),
        );
        $container = new ContainerBuilder();
        $container->set('security.token_storage', $this->tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $controller->setContainer($container);

        return $controller;
    }

    private function makeUpdateController(?EntityManagerInterface $em = null): CalendarEventUpdateController
    {
        $usedEm     = $em ?? $this->entityManager;
        $seriesSvc  = new TrainingSeriesUpdateService($usedEm, $this->calendarEventService);
        $controller = new CalendarEventUpdateController(
            $usedEm,
            $this->calendarEventService,
            $seriesSvc,
            $this->createMock(EventDispatcherInterface::class),
        );
        $container = new ContainerBuilder();
        $container->set('security.token_storage', $this->tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $controller->setContainer($container);

        return $controller;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** @return EntityRepository<object>&MockObject */
    private function buildDefaultRepo(): EntityRepository&MockObject
    {
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
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findBy')->willReturn([]);
        $repo->method('findOneBy')->willReturn(null);
        $repo->method('createQueryBuilder')->willReturn($defaultQb);

        return $repo;
    }

    /**
     * Builds a fresh EntityManagerInterface mock that can be passed as the
     * method-injected $entityManager parameter of deleteEvent/updateCalendarEvent.
     *
     * Each test can further configure the returned mock.
     */
    private function buildMethodEM(): EntityManagerInterface&MockObject
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $defaultRepo = $this->buildDefaultRepo();
        $em->method('getRepository')->willReturn($defaultRepo);

        return $em;
    }

    private function deleteRequest(string $mode = 'single'): Request
    {
        return new Request(content: json_encode(['deletionMode' => $mode]));
    }

    // ─── deleteEvent — access control ────────────────────────────────────────

    public function testDeleteEventForbiddenReturns403(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')
            ->with(CalendarEventVoter::DELETE, $event)
            ->willReturn(false);

        $response = $this->makeDeleteController($this->buildMethodEM())->deleteEvent($event, $this->deleteRequest());
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertArrayHasKey('error', $data);
    }

    // ─── deleteEvent — single mode ────────────────────────────────────────────

    public function testDeleteSingleModeCallsDeleteWithDependenciesOnce(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);

        $this->calendarEventService->expects($this->once())
            ->method('deleteCalendarEventWithDependencies')
            ->with($event);

        $em = $this->buildMethodEM();
        $response = $this->makeDeleteController($em)->deleteEvent($event, $this->deleteRequest('single'));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
    }

    // ─── deleteEvent — series mode (training) ────────────────────────────────

    public function testDeleteSeriesModeDeletesAllEventsWithSameSeriesId(): void
    {
        $seriesId = 'uuid-abc-123';

        $event1 = new CalendarEvent();
        $event1->setTitle('Training 1');
        $event1->setTrainingSeriesId($seriesId);

        $event2 = new CalendarEvent();
        $event2->setTitle('Training 2');
        $event2->setTrainingSeriesId($seriesId);

        $event3 = new CalendarEvent();
        $event3->setTitle('Training 3');
        $event3->setTrainingSeriesId($seriesId);

        $this->authChecker->method('isGranted')->willReturn(true);

        // Repository setup: TaskAssignment returns null (no task), CalendarEvent returns series
        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('findOneBy')->willReturn(null);

        $calendarRepo = $this->createMock(EntityRepository::class);
        $calendarRepo->method('findBy')
            ->with(['trainingSeriesId' => $seriesId])
            ->willReturn([$event1, $event2, $event3]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnMap([
            [TaskAssignment::class, $taskRepo],
            [CalendarEvent::class, $calendarRepo],
        ]);

        $this->calendarEventService->expects($this->exactly(3))
            ->method('deleteCalendarEventWithDependencies');

        $response = $this->makeDeleteController($em)->deleteEvent($event1, $this->deleteRequest('series'));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
    }

    public function testDeleteSeriesModeWithoutSeriesIdFallsBackToSingleDelete(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Einzeltraining');
        // No trainingSeriesId set

        $this->authChecker->method('isGranted')->willReturn(true);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('findOneBy')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($taskRepo);

        $this->calendarEventService->expects($this->once())
            ->method('deleteCalendarEventWithDependencies')
            ->with($event);

        $response = $this->makeDeleteController($em)->deleteEvent($event, $this->deleteRequest('series'));

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── deleteEvent — from_here mode ────────────────────────────────────────

    public function testDeleteFromHereModeDeletesOnlyFutureSeriesEvents(): void
    {
        $seriesId = 'uuid-xyz-456';

        $past = new CalendarEvent();
        $past->setTitle('Training vergangen');
        $past->setTrainingSeriesId($seriesId);
        $past->setStartDate(new DateTime('2026-04-01 18:00'));

        $current = new CalendarEvent();
        $current->setTitle('Training heute');
        $current->setTrainingSeriesId($seriesId);
        $current->setStartDate(new DateTime('2026-04-15 18:00'));

        $future = new CalendarEvent();
        $future->setTitle('Training zukünftig');
        $future->setTrainingSeriesId($seriesId);
        $future->setStartDate(new DateTime('2026-04-29 18:00'));

        $this->authChecker->method('isGranted')->willReturn(true);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('findOneBy')->willReturn(null);

        $calendarRepo = $this->createMock(EntityRepository::class);
        $calendarRepo->method('findBy')
            ->with(['trainingSeriesId' => $seriesId])
            ->willReturn([$past, $current, $future]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnMap([
            [TaskAssignment::class, $taskRepo],
            [CalendarEvent::class, $calendarRepo],
        ]);

        // Only $current (refDate) and $future should be deleted
        $deletedEvents = [];
        $this->calendarEventService->method('deleteCalendarEventWithDependencies')
            ->willReturnCallback(function (CalendarEvent $e) use (&$deletedEvents): void {
                $deletedEvents[] = $e->getTitle();
            });

        $this->makeDeleteController($em)->deleteEvent($current, $this->deleteRequest('from_here'));

        $this->assertCount(2, $deletedEvents);
        $this->assertContains('Training heute', $deletedEvents);
        $this->assertContains('Training zukünftig', $deletedEvents);
        $this->assertNotContains('Training vergangen', $deletedEvents);
    }

    public function testDeleteFromHereModeWithoutSeriesIdFallsBackToSingleDelete(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Einzeltraining');
        // No trainingSeriesId

        $this->authChecker->method('isGranted')->willReturn(true);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('findOneBy')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($taskRepo);

        $this->calendarEventService->expects($this->once())
            ->method('deleteCalendarEventWithDependencies')
            ->with($event);

        $response = $this->makeDeleteController($em)->deleteEvent($event, $this->deleteRequest('from_here'));

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── deleteEvent — series mode with Task ─────────────────────────────────

    public function testDeleteSeriesModeForTaskDeletesAllAssignmentsAndTask(): void
    {
        $event1 = new CalendarEvent();
        $event1->setTitle('Aufgabe 1');

        $event2 = new CalendarEvent();
        $event2->setTitle('Aufgabe 2');

        $task = $this->createMock(Task::class);
        $task->method('getRotationUsers')->willReturn(new ArrayCollection());

        $assignment1 = $this->createMock(TaskAssignment::class);
        $assignment1->method('getCalendarEvent')->willReturn($event1);
        $assignment1->method('getTask')->willReturn($task);

        $assignment2 = $this->createMock(TaskAssignment::class);
        $assignment2->method('getCalendarEvent')->willReturn($event2);
        $assignment2->method('getTask')->willReturn($task);

        $this->authChecker->method('isGranted')->willReturn(true);

        $taskRepo = $this->createMock(EntityRepository::class);
        // First call: findOneBy(['calendarEvent' => $event1]) → $assignment1  (detects task)
        // Second call: findBy(['task' => $task]) → [$assignment1, $assignment2]
        $taskRepo->method('findOneBy')->willReturn($assignment1);
        $taskRepo->method('findBy')->willReturn([$assignment1, $assignment2]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($taskRepo);
        $em->expects($this->once())->method('flush');

        // Both calendar events should be deleted via service
        $this->calendarEventService->expects($this->exactly(2))
            ->method('deleteCalendarEventWithDependencies');

        // Task and its assignments should be removed from EM
        $em->expects($this->atLeastOnce())->method('remove');

        $response = $this->makeDeleteController($em)->deleteEvent($event1, $this->deleteRequest('series'));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
    }

    // ─── updateCalendarEvent ─────────────────────────────────────────────────

    public function testUpdateCalendarEventForbiddenReturns403(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')
            ->with(CalendarEventVoter::EDIT, $event)
            ->willReturn(false);

        $request = new Request(content: json_encode(['title' => 'Neuer Titel']));
        $em = $this->buildMethodEM();

        $response = $this->makeUpdateController($em)->updateCalendarEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateCalendarEventOwnershipViolationReturns403(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);

        $this->calendarEventService->method('validateMatchTeamOwnership')
            ->willReturn('Keine Berechtigung für dieses Team.');

        $request = new Request(content: json_encode(['title' => 'Update']));
        $em = $this->buildMethodEM();

        $response = $this->makeUpdateController($em)->updateCalendarEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertStringContainsString('Berechtigung', $data['error']);
    }

    public function testUpdateCalendarEventCallsServiceAndFlushesOnSuccess(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Montags-Training',
            'trainingWeekdays' => [1],
            'trainingSeriesEndDate' => '2026-12-31',
        ];
        $request = new Request(content: json_encode($payload));
        $em = $this->buildMethodEM();

        $this->calendarEventService->expects($this->once())
            ->method('updateEventFromData')
            ->with($event, $payload);

        $em->expects($this->once())->method('flush');

        $response = $this->makeUpdateController($em)->updateCalendarEvent($event, $request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
    }

    public function testUpdateCalendarEventClearingTrainingSeriesIdInPayloadIsPassedThrough(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setTrainingSeriesId('existing-uuid');

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // Payload clears series (user unchecked "wiederkehrend")
        $payload = [
            'title' => 'Einzeltraining',
            'trainingWeekdays' => null,
            'trainingSeriesEndDate' => null,
            'trainingSeriesId' => null,
        ];
        $request = new Request(content: json_encode($payload));
        $em = $this->buildMethodEM();

        $this->calendarEventService->expects($this->once())
            ->method('updateEventFromData')
            ->with($event, $payload);

        $this->makeUpdateController($em)->updateCalendarEvent($event, $request);
    }
}
