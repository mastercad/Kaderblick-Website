<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventUpdateController;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\TrainingSeriesUpdateService;
use DateTime;
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
use Symfony\Component\Validator\ConstraintViolationList;

/**
 * Tests for CalendarController::updateCalendarEvent() covering:
 *  - access control (403)
 *  - single-event update (no series or scope=single)
 *  - bulk update: series, from_here, same_weekday scopes
 *  - time-of-day change + duration change during bulk update
 */
class CalendarControllerUpdateTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private CalendarEventService&MockObject $calendarEventService;
    private TokenStorageInterface&MockObject $tokenStorage;
    private User&MockObject $user;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    // ─── setUp ────────────────────────────────────────────────────────────────

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventService = $this->createMock(CalendarEventService::class);

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

    // ─── Controller factory ─────────────────────────────────────────────

    private function makeController(?EntityManagerInterface $em = null): CalendarEventUpdateController
    {
        $usedEm    = $em ?? $this->entityManager;
        $seriesSvc = new TrainingSeriesUpdateService($usedEm, $this->calendarEventService);
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

    // ─── Helpers ──────────────────────────────────────────────────────────────

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

    /** @param CalendarEvent[]|null $seriesEvents */
    private function buildMethodEM(?array $seriesEvents = null, string $seriesId = 'uuid-test'): EntityManagerInterface&MockObject
    {
        $em = $this->createMock(EntityManagerInterface::class);

        if (null !== $seriesEvents) {
            $calendarRepo = $this->createMock(EntityRepository::class);
            $calendarRepo->method('findBy')
                ->with(['trainingSeriesId' => $seriesId])
                ->willReturn($seriesEvents);
            $em->method('getRepository')->willReturn($calendarRepo);
        } else {
            $em->method('getRepository')->willReturn($this->buildDefaultRepo());
        }

        return $em;
    }

    /** Creates a CalendarEvent in a series at the given date/time. */
    private function makeSeriesEvent(string $datetime, string $seriesId = 'uuid-test'): CalendarEvent
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setTrainingSeriesId($seriesId);
        $event->setStartDate(new DateTime($datetime));
        $event->setEndDate((new DateTime($datetime))->modify('+90 minutes'));

        return $event;
    }

    /** @param mixed[] $data */
    private function putRequest(array $data): Request
    {
        return new Request(content: json_encode($data));
    }

    // ─── Access control ────────────────────────────────────────────────────────

    public function testUpdateForbiddenReturns403(): void
    {
        $event = new CalendarEvent();
        $this->authChecker->method('isGranted')
            ->with(CalendarEventVoter::EDIT, $event)
            ->willReturn(false);

        $response = $this->makeController($this->buildMethodEM())->updateCalendarEvent(
            $event,
            $this->putRequest(['title' => 'Test'])
        );

        $this->assertSame(403, $response->getStatusCode());
        $this->assertArrayHasKey('error', json_decode($response->getContent(), true));
    }

    public function testUpdateOwnershipViolationReturns403(): void
    {
        $event = new CalendarEvent();
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')
            ->willReturn('Keine Berechtigung für dieses Team.');

        $response = $this->makeController($this->buildMethodEM())->updateCalendarEvent(
            $event,
            $this->putRequest(['title' => 'Test'])
        );

        $data = json_decode($response->getContent(), true);
        $this->assertSame(403, $response->getStatusCode());
        $this->assertStringContainsString('Berechtigung', $data['error']);
    }

    // ─── Single event update ──────────────────────────────────────────────────

    public function testUpdateSingleEventWithNoScopeCallsServiceOnce(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Einzeltraining');
        // No trainingSeriesId → always single

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Geändertes Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
        ];

        $em = $this->buildMethodEM();
        $this->calendarEventService->expects($this->once())
            ->method('updateEventFromData')
            ->with($event, $payload);
        $em->expects($this->once())->method('flush');

        $response = $this->makeController($em)->updateCalendarEvent($event, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertArrayNotHasKey('updatedCount', $data);  // single → no updatedCount
    }

    public function testUpdateSingleEventExplicitScopeOnSeriesOnlyUpdatesOneEvent(): void
    {
        $event = $this->makeSeriesEvent('2026-04-07T18:00:00');

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Geändertes Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
            'trainingEditScope' => 'single',
        ];

        $em = $this->buildMethodEM();
        $this->calendarEventService->expects($this->once())
            ->method('updateEventFromData')
            ->with($event, $payload);
        $em->expects($this->once())->method('flush');

        $response = $this->makeController($em)->updateCalendarEvent($event, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
    }

    // ─── Bulk update: scope=series ────────────────────────────────────────────

    public function testUpdateSeriesScopeCallsServiceForAllSeriesEvents(): void
    {
        $seriesId = 'uuid-series-001';
        $event1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $event2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $event3 = $this->makeSeriesEvent('2026-04-21T18:00:00', $seriesId);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Samstags-Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM([$event1, $event2, $event3], $seriesId);

        $this->calendarEventService->expects($this->exactly(3))
            ->method('updateEventFromData');
        $em->expects($this->once())->method('flush');

        $response = $this->makeController($em)->updateCalendarEvent($event1, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(3, $data['updatedCount']);
    }

    public function testUpdateSeriesScopePreservesEachEventOwnDate(): void
    {
        $seriesId = 'uuid-series-date';
        $ref = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $second = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // User changes time from 18:00 to 17:00 — same series_id event must keep 2026-04-14 as date
        $payload = [
            'title' => 'Training',
            'startDate' => '2026-04-07T17:00:00',
            'endDate' => '2026-04-07T18:30:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM([$ref, $second], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        $this->makeController($em)->updateCalendarEvent($ref, $this->putRequest($payload));

        // First event: 2026-04-07 at 17:00
        $this->assertStringStartsWith('2026-04-07T17:00', $capturedData[0]['startDate']);
        // Second event: 2026-04-14 at 17:00 (date kept, time changed)
        $this->assertStringStartsWith('2026-04-14T17:00', $capturedData[1]['startDate']);
    }

    // ─── Bulk update: time AND duration change ────────────────────────────────

    /**
     * If the user changes start 18:00→17:00 and shortens the duration from 120 min to 60 min,
     * every event in the series must receive the new duration.
     *
     * Payload: startDate=17:00, endDate=18:00 (60 min gap)
     * All events' endDate must be 60 min after their own-date 17:00 start.
     */
    public function testBulkUpdatePreservesNewDurationForAllEvents(): void
    {
        $seriesId = 'uuid-series-dur';
        // Two events in the series: one week apart, both originally 18:00–20:00 (120 min)
        $event1 = $this->makeSeriesEvent('2026-10-07T18:00:00', $seriesId);
        $event1->setEndDate(new DateTime('2026-10-07T20:00:00'));
        $event2 = $this->makeSeriesEvent('2026-10-14T18:00:00', $seriesId);
        $event2->setEndDate(new DateTime('2026-10-14T20:00:00'));

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // User changes to 17:00–18:00 (60 min) — winter schedule
        $payload = [
            'title' => 'Wintertraining',
            'startDate' => '2026-10-07T17:00:00',
            'endDate' => '2026-10-07T18:00:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM([$event1, $event2], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        $this->makeController($em)->updateCalendarEvent($event1, $this->putRequest($payload));

        $this->assertCount(2, $capturedData);

        // Event 1: 2026-10-07T17:00 → end must be 2026-10-07T18:00
        $this->assertSame('2026-10-07T17:00:00', $capturedData[0]['startDate']);
        $this->assertSame('2026-10-07T18:00:00', $capturedData[0]['endDate']);

        // Event 2: 2026-10-14T17:00 → end must be 2026-10-14T18:00 (same 60-min duration)
        $this->assertSame('2026-10-14T17:00:00', $capturedData[1]['startDate']);
        $this->assertSame('2026-10-14T18:00:00', $capturedData[1]['endDate']);
    }

    /**
     * Duration change combined with same_weekday scope: only Tuesday events get the new time.
     * Wednesday events in the same series must NOT be touched.
     */
    public function testBulkUpdateSameWeekdayDurationChangedOnlyForMatchingWeekday(): void
    {
        $seriesId = 'uuid-mixed-weekdays';
        // Tuesday events
        $tue1 = $this->makeSeriesEvent('2026-10-06T18:00:00', $seriesId); // Tue
        $tue1->setEndDate(new DateTime('2026-10-06T20:00:00'));
        $tue2 = $this->makeSeriesEvent('2026-10-13T18:00:00', $seriesId); // Tue
        $tue2->setEndDate(new DateTime('2026-10-13T20:00:00'));
        // Wednesday event in same series
        $wed = $this->makeSeriesEvent('2026-10-07T18:00:00', $seriesId); // Wed
        $wed->setEndDate(new DateTime('2026-10-07T20:00:00'));

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // Payload based on the Tuesday reference event, new duration 60 min
        $payload = [
            'title' => 'Dienstags-Training Winter',
            'startDate' => '2026-10-06T17:00:00',
            'endDate' => '2026-10-06T18:00:00',
            'trainingEditScope' => 'same_weekday',
        ];

        $em = $this->buildMethodEM([$tue1, $tue2, $wed], $seriesId);

        $updatedTitles = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedTitles): ConstraintViolationList {
                $updatedTitles[] = $d['startDate'];

                return new ConstraintViolationList();
            });

        $response = $this->makeController($em)->updateCalendarEvent($tue1, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(2, $data['updatedCount']);
        // Tuesday events should have new time
        $this->assertContains('2026-10-06T17:00:00', $updatedTitles);
        $this->assertContains('2026-10-13T17:00:00', $updatedTitles);
        // Wednesday event must NOT appear
        $this->assertNotContains('2026-10-07T17:00:00', $updatedTitles);
    }

    // ─── Bulk update: scope=from_here ─────────────────────────────────────────

    public function testUpdateFromHereScopeUpdatesCurrentAndFutureOnly(): void
    {
        $seriesId = 'uuid-from-here';
        $past = $this->makeSeriesEvent('2026-04-01T18:00:00', $seriesId);
        $current = $this->makeSeriesEvent('2026-04-08T18:00:00', $seriesId);
        $future = $this->makeSeriesEvent('2026-04-15T18:00:00', $seriesId);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Training ab jetzt',
            'startDate' => '2026-04-08T19:00:00',
            'endDate' => '2026-04-08T20:30:00',
            'trainingEditScope' => 'from_here',
        ];

        $em = $this->buildMethodEM([$past, $current, $future], $seriesId);

        $updatedStartDates = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedStartDates): ConstraintViolationList {
                $updatedStartDates[] = $d['startDate'];

                return new ConstraintViolationList();
            });

        $response = $this->makeController($em)->updateCalendarEvent($current, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $data['updatedCount']);

        // current and future must have been updated
        $this->assertContains('2026-04-08T19:00:00', $updatedStartDates);
        $this->assertContains('2026-04-15T19:00:00', $updatedStartDates);
        // past must NOT have been updated
        $this->assertNotContains('2026-04-01T19:00:00', $updatedStartDates);
    }

    public function testUpdateFromHereScopePreservesNewDuration(): void
    {
        $seriesId = 'uuid-from-here-dur';
        $past = $this->makeSeriesEvent('2026-04-01T18:00:00', $seriesId);
        $current = $this->makeSeriesEvent('2026-04-08T18:00:00', $seriesId);
        $future = $this->makeSeriesEvent('2026-04-15T18:00:00', $seriesId);

        // All originally 90 min
        $past->setEndDate(new DateTime('2026-04-01T19:30:00'));
        $current->setEndDate(new DateTime('2026-04-08T19:30:00'));
        $future->setEndDate(new DateTime('2026-04-15T19:30:00'));

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // New: 17:00–18:00 = 60 min
        $payload = [
            'title' => 'Training',
            'startDate' => '2026-04-08T17:00:00',
            'endDate' => '2026-04-08T18:00:00',
            'trainingEditScope' => 'from_here',
        ];

        $em = $this->buildMethodEM([$past, $current, $future], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        $this->makeController($em)->updateCalendarEvent($current, $this->putRequest($payload));

        $this->assertCount(2, $capturedData);
        // current gets new 60-min duration
        $this->assertSame('2026-04-08T18:00:00', $capturedData[0]['endDate']);
        // future also gets 60-min duration
        $this->assertSame('2026-04-15T18:00:00', $capturedData[1]['endDate']);
    }

    // ─── Bulk update: no endDate in payload ───────────────────────────────────

    public function testBulkUpdateWithoutEndDateDoesNotSetEndDateInPerEventData(): void
    {
        $seriesId = 'uuid-no-end';
        $event1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $event2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        // No endDate in payload
        $payload = [
            'title' => 'Training ohne Endzeit',
            'startDate' => '2026-04-07T18:00:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM([$event1, $event2], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        $this->makeController($em)->updateCalendarEvent($event1, $this->putRequest($payload));

        // When no endDate, the 'endDate' key should be absent or unchanged from merged payload
        // (it was not in the original payload, so it remains absent after array_merge)
        $this->assertArrayNotHasKey('endDate', $capturedData[0]);
        $this->assertArrayNotHasKey('endDate', $capturedData[1]);
    }

    // ─── Response format ──────────────────────────────────────────────────────

    public function testBulkUpdateReturnsUpdatedCountInResponse(): void
    {
        $seriesId = 'uuid-count';
        $events = array_map(
            fn (string $dt) => $this->makeSeriesEvent($dt, $seriesId),
            ['2026-04-07T18:00:00', '2026-04-14T18:00:00', '2026-04-21T18:00:00', '2026-04-28T18:00:00']
        );

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM($events, $seriesId);

        $response = $this->makeController($em)->updateCalendarEvent($events[0], $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(4, $data['updatedCount']);
    }

    // ─── Edge case: series event without series ID with non-single scope ──────

    public function testBulkScopeOnNonSeriesEventFallsBackToSingleUpdate(): void
    {
        // Event has no trainingSeriesId → treated as single regardless of scope
        $event = new CalendarEvent();
        $event->setTitle('Einzeltraining');
        // no setTrainingSeriesId()

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Updated',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
            'trainingEditScope' => 'series',
        ];

        $em = $this->buildMethodEM();
        $this->calendarEventService->expects($this->once())
            ->method('updateEventFromData')
            ->with($event, $payload);
        $em->expects($this->once())->method('flush');

        $response = $this->makeController($em)->updateCalendarEvent($event, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        // Falls back to single → no updatedCount
        $this->assertArrayNotHasKey('updatedCount', $data);
    }

    // ─── Bulk update: scope=same_weekday_from_here ────────────────────────────

    /**
     * same_weekday_from_here must only touch events on the same weekday
     * that are >= the reference event's date.
     */
    public function testUpdateSameWeekdayFromHereScopeFiltersCorrectly(): void
    {
        $seriesId = 'uuid-swfh';
        // Reference: Thursday 2026-04-09
        $ref = $this->makeSeriesEvent('2026-04-09T18:00:00', $seriesId); // Thu (w=4)
        // Future Thursdays
        $thu2 = $this->makeSeriesEvent('2026-04-16T18:00:00', $seriesId); // Thu
        $thu3 = $this->makeSeriesEvent('2026-04-23T18:00:00', $seriesId); // Thu
        // Past Thursday
        $thuPast = $this->makeSeriesEvent('2026-04-02T18:00:00', $seriesId); // Thu (past)
        // A different weekday (Wednesday 2026-04-08) in the same series
        $wed = $this->makeSeriesEvent('2026-04-08T18:00:00', $seriesId); // Wed (w=3)

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Donnerstag-Training',
            'startDate' => '2026-04-09T17:00:00',
            'endDate' => '2026-04-09T18:30:00',
            'trainingEditScope' => 'same_weekday_from_here',
        ];

        $em = $this->buildMethodEM([$thuPast, $ref, $thu2, $thu3, $wed], $seriesId);

        $updatedStartDates = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedStartDates): ConstraintViolationList {
                $updatedStartDates[] = $d['startDate'];

                return new ConstraintViolationList();
            });

        $response = $this->makeController($em)->updateCalendarEvent($ref, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        // ref, thu2, thu3 — past Thursday and Wednesday must be excluded
        $this->assertSame(3, $data['updatedCount']);
        $this->assertContains('2026-04-09T17:00:00', $updatedStartDates);
        $this->assertContains('2026-04-16T17:00:00', $updatedStartDates);
        $this->assertContains('2026-04-23T17:00:00', $updatedStartDates);
        // Past Thursday must NOT be touched
        $this->assertNotContains('2026-04-02T17:00:00', $updatedStartDates);
        // Wednesday must NOT be touched
        $this->assertNotContains('2026-04-08T17:00:00', $updatedStartDates);
    }

    // ─── untilDate filtering ──────────────────────────────────────────────────

    /**
     * trainingEditUntilDate cuts off updates for events after that date.
     */
    public function testUpdateWithUntilDateFiltersOutEventsAfterDate(): void
    {
        $seriesId = 'uuid-until';
        $event1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $event2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $event3 = $this->makeSeriesEvent('2026-04-21T18:00:00', $seriesId); // after untilDate
        $event4 = $this->makeSeriesEvent('2026-04-28T18:00:00', $seriesId); // after untilDate

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate' => '2026-04-07T19:30:00',
            'trainingEditScope' => 'series',
            'trainingEditUntilDate' => '2026-04-14',  // inclusive: only event1 + event2
        ];

        $em = $this->buildMethodEM([$event1, $event2, $event3, $event4], $seriesId);

        $this->calendarEventService->expects($this->exactly(2))
            ->method('updateEventFromData');

        $response = $this->makeController($em)->updateCalendarEvent($event1, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $data['updatedCount']);
    }

    // ─── trainingSeriesEndDate sync (silent, no updatedCount inflation) ─────

    /**
     * from_here scope + changed end date:
     * - Events BEFORE the pivot must have trainingSeriesEndDate updated.
     * - updateEventFromData must NOT be called for them (nothing visible changed).
     * - updatedCount must only reflect the scoped (from_here) events.
     */
    public function testFromHereScopeWithChangedEndDateSyncsPriorEventsEndDateSilently(): void
    {
        $seriesId = 'uuid-enddate-sync';
        $oldEnd = '2026-04-21';
        $newEnd = '2026-05-19';

        // prior event — before the pivot, not in scope
        $priorEvent = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $priorEvent->setTrainingSeriesEndDate($oldEnd);

        // pivot + one future event — these ARE in scope
        $pivotEvent = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $pivotEvent->setTrainingSeriesEndDate($oldEnd);
        $afterEvent = $this->makeSeriesEvent('2026-04-21T18:00:00', $seriesId);
        $afterEvent->setTrainingSeriesEndDate($oldEnd);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $updatedEvents = [];
        $this->calendarEventService
            ->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedEvents): ConstraintViolationList {
                $updatedEvents[] = $e;

                return new ConstraintViolationList();
            });

        $payload = [
            'title'                  => 'Training',
            'startDate'              => '2026-04-14T18:00:00',
            'endDate'                => '2026-04-14T19:30:00',
            'trainingEditScope'      => 'from_here',
            'trainingSeriesEndDate'  => $newEnd,
        ];

        $em = $this->buildMethodEM([$priorEvent, $pivotEvent, $afterEvent], $seriesId);
        $response = $this->makeController($em)->updateCalendarEvent($pivotEvent, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        // Prior event must NOT be touched via updateEventFromData
        $this->assertNotContains(
            $priorEvent,
            $updatedEvents,
            'Prior event must not be passed to updateEventFromData'
        );

        // But its trainingSeriesEndDate must be silently synced
        $this->assertSame(
            $newEnd,
            $priorEvent->getTrainingSeriesEndDate(),
            'Prior event must carry the new trainingSeriesEndDate'
        );

        // updatedCount must only count the 2 scoped events
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $data['updatedCount']);
    }

    /**
     * same_weekday scope + changed end date:
     * Events of OTHER weekdays are not in scope but must still get the
     * new trainingSeriesEndDate silently — without counting them or calling
     * updateEventFromData on them.
     */
    public function testSameWeekdayScopeWithChangedEndDateSyncsOtherWeekdayEvents(): void
    {
        $seriesId = 'uuid-wd-enddate-sync';
        $oldEnd = '2026-04-28';
        $newEnd = '2026-06-30';

        // Two Tuesday events (in scope for same_weekday from a Tuesday reference)
        $tue1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId); // Tue
        $tue1->setTrainingSeriesEndDate($oldEnd);
        $tue2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId); // Tue
        $tue2->setTrainingSeriesEndDate($oldEnd);

        // A Thursday event in the same series — NOT in scope
        $thu = $this->makeSeriesEvent('2026-04-09T18:00:00', $seriesId); // Thu
        $thu->setTrainingSeriesEndDate($oldEnd);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $updatedEvents = [];
        $this->calendarEventService
            ->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedEvents): ConstraintViolationList {
                $updatedEvents[] = $e;

                return new ConstraintViolationList();
            });

        $payload = [
            'title'                  => 'Training',
            'startDate'              => '2026-04-07T18:00:00',
            'endDate'                => '2026-04-07T19:30:00',
            'trainingEditScope'      => 'same_weekday',
            'trainingSeriesEndDate'  => $newEnd,
        ];

        $em = $this->buildMethodEM([$tue1, $thu, $tue2], $seriesId);
        $response = $this->makeController($em)->updateCalendarEvent($tue1, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        // Thursday event must NOT appear in updateEventFromData calls
        $this->assertNotContains($thu, $updatedEvents);

        // Thursday event must have the new end date silently
        $this->assertSame($newEnd, $thu->getTrainingSeriesEndDate());

        // updatedCount = 2 (the two Tuesday events only)
        $this->assertSame(2, $data['updatedCount']);
    }

    /**
     * When the end date does NOT change, prior events must not be touched.
     */
    public function testFromHereScopeWithUnchangedEndDateDoesNotModifyPriorEvents(): void
    {
        $seriesId = 'uuid-no-enddate-change';
        $sameEnd = '2026-04-28';

        $priorEvent = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $priorEvent->setTrainingSeriesEndDate($sameEnd);

        $pivotEvent = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $pivotEvent->setTrainingSeriesEndDate($sameEnd);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);
        $this->calendarEventService->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());

        // End date NOT included in payload → falls back to $oldSeriesEndDateStr → no change
        $payload = [
            'title'             => 'Training',
            'startDate'         => '2026-04-14T17:00:00',
            'endDate'           => '2026-04-14T18:30:00',
            'trainingEditScope' => 'from_here',
            // intentionally omitting trainingSeriesEndDate
        ];

        $em = $this->buildMethodEM([$priorEvent, $pivotEvent], $seriesId);
        $this->makeController($em)->updateCalendarEvent($pivotEvent, $this->putRequest($payload));

        // Prior event's end date must remain unchanged
        $this->assertSame($sameEnd, $priorEvent->getTrainingSeriesEndDate());
    }

    /**
     * Combining same_weekday_from_here with untilDate: only same-weekday events
     * in [ref, untilDate] get updated.
     */
    public function testUpdateSameWeekdayFromHereWithUntilDate(): void
    {
        $seriesId = 'uuid-swfh-until';
        // Reference: Thursday 2026-04-09
        $ref = $this->makeSeriesEvent('2026-04-09T18:00:00', $seriesId); // Thu ← included
        $thu2 = $this->makeSeriesEvent('2026-04-16T18:00:00', $seriesId); // Thu ← included (≤ untilDate)
        $thu3 = $this->makeSeriesEvent('2026-04-23T18:00:00', $seriesId); // Thu ← excluded (> untilDate)
        $thuPast = $this->makeSeriesEvent('2026-04-02T18:00:00', $seriesId); // Thu past ← excluded
        $wed = $this->makeSeriesEvent('2026-04-15T18:00:00', $seriesId); // Wed ← excluded (wrong weekday)

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);

        $payload = [
            'title' => 'Donnerstag bis Mitte April',
            'startDate' => '2026-04-09T17:00:00',
            'endDate' => '2026-04-09T18:30:00',
            'trainingEditScope' => 'same_weekday_from_here',
            'trainingEditUntilDate' => '2026-04-20',
        ];

        $em = $this->buildMethodEM([$thuPast, $ref, $thu2, $wed, $thu3], $seriesId);

        $updatedStartDates = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$updatedStartDates): ConstraintViolationList {
                $updatedStartDates[] = $d['startDate'];

                return new ConstraintViolationList();
            });

        $response = $this->makeController($em)->updateCalendarEvent($ref, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $data['updatedCount']);
        $this->assertContains('2026-04-09T17:00:00', $updatedStartDates);
        $this->assertContains('2026-04-16T17:00:00', $updatedStartDates);
        // The rest must be untouched
        $this->assertNotContains('2026-04-02T17:00:00', $updatedStartDates);
        $this->assertNotContains('2026-04-15T17:00:00', $updatedStartDates);
        $this->assertNotContains('2026-04-23T17:00:00', $updatedStartDates);
    }

    // ─── End-date shortening: delete events past new end date ─────────────────

    /**
     * When the series end date is shortened, events whose start date is AFTER the new
     * end date must be deleted (not updated). Events before or on the new end date
     * must still be updated normally.
     *
     * Scenario: 5 weekly events (May 7, 14, 21, 28, June 4). End date shortened to May 21.
     * → Events on May 28 and June 4 must be deleted.
     * → Events May 7, 14, 21 must be updated (updatedCount = 3).
     */
    public function testSeriesShortenedEndDateDeletesEventsAfterNewEndDate(): void
    {
        $seriesId = 'uuid-shorten';
        $oldEnd = '2026-06-04';
        $newEnd = '2026-05-21';

        $e1 = $this->makeSeriesEvent('2026-05-07T18:00:00', $seriesId);
        $e1->setTrainingSeriesEndDate($oldEnd);
        $e2 = $this->makeSeriesEvent('2026-05-14T18:00:00', $seriesId);
        $e2->setTrainingSeriesEndDate($oldEnd);
        $e3 = $this->makeSeriesEvent('2026-05-21T18:00:00', $seriesId);
        $e3->setTrainingSeriesEndDate($oldEnd);
        $e4 = $this->makeSeriesEvent('2026-05-28T18:00:00', $seriesId); // past new end → delete
        $e4->setTrainingSeriesEndDate($oldEnd);
        $e5 = $this->makeSeriesEvent('2026-06-04T18:00:00', $seriesId); // past new end → delete
        $e5->setTrainingSeriesEndDate($oldEnd);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);
        $this->calendarEventService->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());

        $deletedEvents = [];
        $this->calendarEventService
            ->method('deleteCalendarEventWithDependencies')
            ->willReturnCallback(function (CalendarEvent $e) use (&$deletedEvents): void {
                $deletedEvents[] = $e;
            });

        $payload = [
            'title'                 => 'Training',
            'startDate'             => '2026-05-07T18:00:00',
            'endDate'               => '2026-05-07T19:30:00',
            'trainingEditScope'     => 'series',
            'trainingSeriesEndDate' => $newEnd,
        ];

        $em = $this->buildMethodEM([$e1, $e2, $e3, $e4, $e5], $seriesId);
        $response = $this->makeController($em)->updateCalendarEvent($e1, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        // Only the 3 events on/before the new end date are updated
        $this->assertSame(3, $data['updatedCount']);
        // Events past the new end date must have been deleted
        $this->assertContains($e4, $deletedEvents, 'Event on 2026-05-28 must be deleted');
        $this->assertContains($e5, $deletedEvents, 'Event on 2026-06-04 must be deleted');
        // Events before or on the new end date must NOT have been deleted
        $this->assertNotContains($e1, $deletedEvents);
        $this->assertNotContains($e2, $deletedEvents);
        $this->assertNotContains($e3, $deletedEvents);
    }

    /**
     * When end date is unchanged (same value sent), no deletion must occur.
     */
    public function testSeriesUnchangedEndDateDoesNotDeleteAnyEvents(): void
    {
        $seriesId = 'uuid-no-shorten';
        $sameEnd = '2026-06-04';

        $e1 = $this->makeSeriesEvent('2026-05-07T18:00:00', $seriesId);
        $e1->setTrainingSeriesEndDate($sameEnd);
        $e2 = $this->makeSeriesEvent('2026-05-14T18:00:00', $seriesId);
        $e2->setTrainingSeriesEndDate($sameEnd);

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);
        $this->calendarEventService->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());

        $this->calendarEventService->expects($this->never())
            ->method('deleteCalendarEventWithDependencies');

        $payload = [
            'title'                 => 'Training',
            'startDate'             => '2026-05-07T18:00:00',
            'endDate'               => '2026-05-07T19:30:00',
            'trainingEditScope'     => 'series',
            'trainingSeriesEndDate' => $sameEnd, // same → no shortening
        ];

        $em = $this->buildMethodEM([$e1, $e2], $seriesId);
        $response = $this->makeController($em)->updateCalendarEvent($e1, $this->putRequest($payload));

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── Extension gap fill ───────────────────────────────────────────────────

    /**
     * When trainingSeriesEndDate is ahead of the last actual event, extending the
     * end date must fill the gap: events for kept weekdays between the last actual
     * event and the old end date must also be created.
     *
     * Scenario:
     * - 1 Thu event on May 7. trainingSeriesEndDate stored as '2026-05-14' (no May 14 event).
     * - Extend to May 31.
     * - Expected: May 14, 21, 28 created (gap + extension) + May 7 updated = 4 total.
     * - Without fix: ext starts from May 15 → only May 21, 28 → 3 total.
     */
    public function testSeriesExtensionCreatesEventsInGapBeforeStoredEndDate(): void
    {
        $seriesId = 'uuid-ext-gap';

        $thuMay7 = $this->makeSeriesEvent('2026-05-07T18:00:00', $seriesId); // Thu
        $thuMay7->setTrainingSeriesEndDate('2026-05-14');
        $thuMay7->setTrainingWeekdays([4]); // Thu only

        $this->authChecker->method('isGranted')->willReturn(true);
        $this->calendarEventService->method('validateMatchTeamOwnership')->willReturn(null);
        $this->calendarEventService->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());

        $payload = [
            'title'                 => 'Training',
            'startDate'             => '2026-05-07T18:00:00',
            'endDate'               => '2026-05-07T19:30:00',
            'trainingEditScope'     => 'series',
            'trainingSeriesEndDate' => '2026-05-31',
            // trainingWeekdays omitted → $newWeekdays = $oldWeekdays = [4], so Thu is kept
        ];

        $em = $this->buildMethodEM([$thuMay7], $seriesId);
        $response = $this->makeController($em)->updateCalendarEvent($thuMay7, $this->putRequest($payload));
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        // 1 updated (May 7) + 3 new (May 14, 21, 28) = 4
        // Without the fix only May 21 + 28 would be created → 3 total.
        $this->assertSame(4, $data['updatedCount']);
    }
}
