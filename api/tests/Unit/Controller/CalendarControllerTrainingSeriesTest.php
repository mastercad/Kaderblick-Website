<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventWriteController;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Team;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit tests for CalendarController::createTrainingSeries().
 *
 * Covers input validation, permission checks, and event creation logic.
 */
#[AllowMockObjectsWithoutExpectations]
class CalendarControllerTrainingSeriesTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private CalendarEventWriteController $controller;
    private User&MockObject $user;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);

        // Default repository stub (no queries in createTrainingSeries except getReference)
        $defaultQuery = $this->createMock(Query::class);
        $defaultQuery->method('getResult')->willReturn([]);
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

        // getReference returns an object stub per class
        $this->entityManager->method('getReference')->willReturnCallback(
            function (string $class, int $id) {
                return match ($class) {
                    CalendarEventType::class => $this->createMock(CalendarEventType::class),
                    Team::class => $this->createMock(Team::class),
                    default => $this->createMock(stdClass::class),
                };
            }
        );

        $this->controller = new CalendarEventWriteController(
            $this->entityManager,
            $this->createMock(CalendarEventService::class),
            $this->createMock(\Symfony\Component\EventDispatcher\EventDispatcherInterface::class),
        );

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

    // ─── Validation — 400 ────────────────────────────────────────────────────

    public function testCreateTrainingSeriesMissingTitleReturns400(): void
    {
        $request = new Request(content: json_encode([
            'title' => '',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-06-30',
            'weekdays' => [1],
            'eventTypeId' => 5,
        ]));

        $response = $this->controller->createTrainingSeries($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertFalse($data['success']);
        $this->assertStringContainsString('Pflichtfelder', $data['error']);
    }

    public function testCreateTrainingSeriesMissingWeekdaysReturns400(): void
    {
        $request = new Request(content: json_encode([
            'title' => 'Training',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-06-30',
            'weekdays' => [],
            'eventTypeId' => 5,
        ]));

        $response = $this->controller->createTrainingSeries($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertFalse($data['success']);
    }

    public function testCreateTrainingSeriesMissingStartDateReturns400(): void
    {
        $request = new Request(content: json_encode([
            'title' => 'Training',
            'startDate' => null,
            'seriesEndDate' => '2026-06-30',
            'weekdays' => [1],
            'eventTypeId' => 5,
        ]));

        $response = $this->controller->createTrainingSeries($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(400, $response->getStatusCode());
        $this->assertFalse($data['success']);
    }

    // ─── Permission check — 403 ───────────────────────────────────────────────

    public function testCreateTrainingSeriesTeamPermissionDeniedReturns403(): void
    {
        // isGranted for team → false
        $this->authChecker->method('isGranted')
            ->willReturnCallback(function (string $attribute): bool {
                if (CalendarEventVoter::CREATE === $attribute) {
                    // Deny when checking team permission
                    return false;
                }

                return true;
            });

        $request = new Request(content: json_encode([
            'title' => 'Teamtraining',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-06-30',
            'weekdays' => [1],
            'eventTypeId' => 5,
            'teamId' => 3,
        ]));

        $response = $this->controller->createTrainingSeries($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertFalse($data['success']);
        $this->assertStringContainsString('Berechtigung', $data['error']);
    }

    // ─── Event creation ───────────────────────────────────────────────────────

    /**
     * Verify the controller only persists events on the requested weekday.
     *
     * Date range: Mo 2026-04-06 → So 2026-04-19 (two weeks).
     * Weekdays: [1] = Monday → should create exactly 2 events (Apr 6 and Apr 13).
     */
    public function testCreateTrainingSeriesCreatesEventsOnlyOnMatchingWeekdays(): void
    {
        // Allow all CREATE checks
        $this->authChecker->method('isGranted')->willReturn(true);

        $persistedEvents = [];
        $this->entityManager->method('persist')->willReturnCallback(
            function (object $object) use (&$persistedEvents): void {
                if ($object instanceof \App\Entity\CalendarEvent) {
                    $persistedEvents[] = $object;
                }
            }
        );
        $this->entityManager->method('flush');

        $request = new Request(content: json_encode([
            'title' => 'Montags-Training',
            'startDate' => '2026-04-06',   // Monday
            'seriesEndDate' => '2026-04-19',   // Sunday — 2 Mondays in range
            'weekdays' => [1],             // 1 = Monday (PHP date('w'))
            'eventTypeId' => 5,
            'time' => '18:00',
            'duration' => 90,
        ]));

        $response = $this->controller->createTrainingSeries($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(2, $data['createdCount']);
        $this->assertCount(2, $persistedEvents);
    }

    /**
     * All created events in a series must share the same trainingSeriesId UUID.
     */
    public function testCreateTrainingSeriesAllEventsShareSameSeriesId(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);

        $persistedEvents = [];
        $this->entityManager->method('persist')->willReturnCallback(
            function (object $object) use (&$persistedEvents): void {
                if ($object instanceof \App\Entity\CalendarEvent) {
                    $persistedEvents[] = $object;
                }
            }
        );
        $this->entityManager->method('flush');

        // Mon + Wed for one week -> 2 events
        $request = new Request(content: json_encode([
            'title' => 'Mo/Mi Training',
            'startDate' => '2026-04-06',   // Monday
            'seriesEndDate' => '2026-04-12',   // Sunday
            'weekdays' => [1, 3],          // Monday + Wednesday
            'eventTypeId' => 5,
            'time' => '18:00',
        ]));

        $this->controller->createTrainingSeries($request);

        $this->assertCount(2, $persistedEvents);

        $seriesIds = array_unique(array_map(
            fn (\App\Entity\CalendarEvent $e) => $e->getTrainingSeriesId(),
            $persistedEvents,
        ));

        // All events must share exactly one series ID
        $this->assertCount(1, $seriesIds);
        $this->assertNotNull($seriesIds[0]);
    }

    /**
     * Each event in the series must have trainingWeekdays and trainingSeriesEndDate set.
     */
    public function testCreateTrainingSeriesEventsHaveCorrectSeriesMetadata(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);

        $persistedEvents = [];
        $this->entityManager->method('persist')->willReturnCallback(
            function (object $object) use (&$persistedEvents): void {
                if ($object instanceof \App\Entity\CalendarEvent) {
                    $persistedEvents[] = $object;
                }
            }
        );
        $this->entityManager->method('flush');

        $request = new Request(content: json_encode([
            'title' => 'Dienstags-Training',
            'startDate' => '2026-04-07',   // Tuesday
            'seriesEndDate' => '2026-04-13',   // Monday before next Tuesday → only one Tuesday in range
            'weekdays' => [2],             // Tuesday
            'eventTypeId' => 5,
            'time' => '19:00',
        ]));

        $this->controller->createTrainingSeries($request);

        $this->assertCount(1, $persistedEvents);
        /** @var \App\Entity\CalendarEvent $event */
        $event = $persistedEvents[0];

        $this->assertSame([2], $event->getTrainingWeekdays());
        $this->assertSame('2026-04-13', $event->getTrainingSeriesEndDate());
        $this->assertSame('2026-04-07 19:00:00', $event->getStartDate()->format('Y-m-d H:i:s'));
    }

    /**
     * With explicit endTime, the end date of each event should follow it.
     */
    public function testCreateTrainingSeriesUsesExplicitEndTime(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);

        $persistedEvents = [];
        $this->entityManager->method('persist')->willReturnCallback(
            function (object $object) use (&$persistedEvents): void {
                if ($object instanceof \App\Entity\CalendarEvent) {
                    $persistedEvents[] = $object;
                }
            }
        );
        $this->entityManager->method('flush');

        $request = new Request(content: json_encode([
            'title' => 'Training mit Endzeit',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-04-07',
            'weekdays' => [2],   // Tuesday
            'eventTypeId' => 5,
            'time' => '18:00',
            'endTime' => '19:30',
        ]));

        $this->controller->createTrainingSeries($request);

        $this->assertCount(1, $persistedEvents);
        /** @var \App\Entity\CalendarEvent $event */
        $event = $persistedEvents[0];
        $this->assertSame('2026-04-07 19:30:00', $event->getEndDate()->format('Y-m-d H:i:s'));
    }

    /**
     * Without explicit endTime but with duration, end date is calculated.
     */
    public function testCreateTrainingSeriesCalculatesEndDateFromDuration(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);

        $persistedEvents = [];
        $this->entityManager->method('persist')->willReturnCallback(
            function (object $object) use (&$persistedEvents): void {
                if ($object instanceof \App\Entity\CalendarEvent) {
                    $persistedEvents[] = $object;
                }
            }
        );
        $this->entityManager->method('flush');

        $request = new Request(content: json_encode([
            'title' => 'Training mit Duration',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-04-07',
            'weekdays' => [2],
            'eventTypeId' => 5,
            'time' => '18:00',
            'duration' => 90,   // 1.5 hours
        ]));

        $this->controller->createTrainingSeries($request);

        $this->assertCount(1, $persistedEvents);
        /** @var \App\Entity\CalendarEvent $event */
        $event = $persistedEvents[0];
        $this->assertSame('2026-04-07 19:30:00', $event->getEndDate()->format('Y-m-d H:i:s'));
    }

    // ─── Permission bidirectional link (bug fix) ──────────────────────────────

    /**
     * When a training series event is created WITHOUT a team (public), the
     * CalendarEventPermission is added to the event's in-memory collection
     * BEFORE the CalendarEventCreatedEvent is dispatched.
     *
     * This is the root-cause fix: resolveEventRecipients() reads
     * $event->getPermissions() — if the collection is empty, only admins
     * receive the notification.
     */
    public function testCreatedSeriesEventPublicPermissionIsInCollectionAtDispatch(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('persist');
        $this->entityManager->method('flush');

        /** @var \App\Entity\CalendarEvent|null $capturedEvent */
        $capturedEvent = null;
        $dispatcher = $this->createMock(\Symfony\Component\EventDispatcher\EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnCallback(
            function (object $event) use (&$capturedEvent) {
                if ($event instanceof \App\Event\CalendarEventCreatedEvent) {
                    $capturedEvent = $event->getCalendarEvent();
                }

                return $event;
            }
        );

        $controller = $this->buildController($dispatcher);

        $request = new Request(content: json_encode([
            'title' => 'Öffentliches Training',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-04-07',
            'weekdays' => [2],
            'eventTypeId' => 5,
            'time' => '18:00',
            // No teamId → PUBLIC permission
        ]));

        $controller->createTrainingSeries($request);

        $this->assertNotNull($capturedEvent, 'CalendarEventCreatedEvent was not dispatched');
        $this->assertGreaterThan(
            0,
            $capturedEvent->getPermissions()->count(),
            'Permissions collection must not be empty at dispatch time — resolveEventRecipients would find no recipients'
        );

        $permission = $capturedEvent->getPermissions()->first();
        $this->assertSame(
            CalendarEventPermissionType::PUBLIC,
            $permission->getPermissionType()
        );
    }

    public function testCreatedSeriesEventTeamPermissionIsInCollectionAtDispatch(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->entityManager->method('persist');
        $this->entityManager->method('flush');

        /** @var \App\Entity\CalendarEvent|null $capturedEvent */
        $capturedEvent = null;
        $dispatcher = $this->createMock(\Symfony\Component\EventDispatcher\EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnCallback(
            function (object $event) use (&$capturedEvent) {
                if ($event instanceof \App\Event\CalendarEventCreatedEvent) {
                    $capturedEvent = $event->getCalendarEvent();
                }

                return $event;
            }
        );

        $controller = $this->buildController($dispatcher);

        $request = new Request(content: json_encode([
            'title' => 'Teamtraining',
            'startDate' => '2026-04-07',
            'seriesEndDate' => '2026-04-07',
            'weekdays' => [2],
            'eventTypeId' => 5,
            'time' => '18:00',
            'teamId' => 3,
        ]));

        $controller->createTrainingSeries($request);

        $this->assertNotNull($capturedEvent);
        $this->assertGreaterThan(0, $capturedEvent->getPermissions()->count());

        $permission = $capturedEvent->getPermissions()->first();
        $this->assertSame(
            CalendarEventPermissionType::TEAM,
            $permission->getPermissionType()
        );
    }

    // ─── Helper: build a controller with a custom dispatcher ─────────────────

    private function buildController(
        \Symfony\Component\EventDispatcher\EventDispatcherInterface $dispatcher,
    ): CalendarEventWriteController {
        $controller = new CalendarEventWriteController(
            $this->entityManager,
            $this->createMock(CalendarEventService::class),
            $dispatcher,
        );

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->user);
        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $controller->setContainer($container);

        return $controller;
    }
}
