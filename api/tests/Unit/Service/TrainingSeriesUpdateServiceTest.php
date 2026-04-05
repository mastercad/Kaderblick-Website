<?php

namespace App\Tests\Unit\Service;

use App\Dto\CalendarEventChangeSet;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Service\CalendarEventService;
use App\Service\TrainingSeriesUpdateService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Validator\ConstraintViolationList;

/**
 * Unit tests for TrainingSeriesUpdateService::update().
 *
 * Verifies scope filtering, per-event date/time preservation, duration carry-over,
 * end-date extension/shortening, and the returned TrainingSeriesUpdateResult.
 */
class TrainingSeriesUpdateServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private CalendarEventService&MockObject $calendarEventService;
    private TrainingSeriesUpdateService $service;
    private User&MockObject $user;

    protected function setUp(): void
    {
        $this->em                  = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventService = $this->createMock(CalendarEventService::class);
        $this->calendarEventService->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());
        $this->user = $this->createMock(User::class);

        $this->service = new TrainingSeriesUpdateService($this->em, $this->calendarEventService);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function makeSeriesEvent(string $datetime, string $seriesId = 'uuid-test'): CalendarEvent
    {
        $event = new CalendarEvent();
        $event->setTitle('Training');
        $event->setTrainingSeriesId($seriesId);
        $event->setStartDate(new DateTime($datetime));
        $event->setEndDate((new DateTime($datetime))->modify('+90 minutes'));

        return $event;
    }

    /**
     * Points the EM's getRepository to return a mock repo that yields $events for findBy.
     *
     * @param CalendarEvent[] $events
     */
    private function stubSeriesEvents(array $events, string $seriesId = 'uuid-test'): void
    {
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findBy')->with(['trainingSeriesId' => $seriesId])->willReturn($events);
        $this->em->method('getRepository')->willReturn($repo);
    }

    private function makePayload(array $overrides = []): array
    {
        return array_merge([
            'title'     => 'Training',
            'startDate' => '2026-04-07T18:00:00',
            'endDate'   => '2026-04-07T19:30:00',
        ], $overrides);
    }

    // ─── Scope: series ────────────────────────────────────────────────────────

    public function testSeriesScopeUpdatesAllEventsInSeries(): void
    {
        $e1 = $this->makeSeriesEvent('2026-04-07T18:00:00');
        $e2 = $this->makeSeriesEvent('2026-04-14T18:00:00');
        $e3 = $this->makeSeriesEvent('2026-04-21T18:00:00');
        $this->stubSeriesEvents([$e1, $e2, $e3]);

        $this->calendarEventService->expects($this->exactly(3))->method('updateEventFromData');

        $result = $this->service->update($e1, $this->makePayload(['trainingEditScope' => 'series']), 'series', $this->user);

        $this->assertSame(3, $result->updatedCount);
    }

    // ─── Scope: from_here ─────────────────────────────────────────────────────

    public function testFromHereScopeSkipsPastEvents(): void
    {
        $past    = $this->makeSeriesEvent('2026-04-01T18:00:00');
        $current = $this->makeSeriesEvent('2026-04-08T18:00:00');
        $future  = $this->makeSeriesEvent('2026-04-15T18:00:00');
        $this->stubSeriesEvents([$past, $current, $future]);

        $updatedEvents = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e) use (&$updatedEvents): ConstraintViolationList {
                $updatedEvents[] = $e;

                return new ConstraintViolationList();
            });

        $result = $this->service->update($current, $this->makePayload(['trainingEditScope' => 'from_here']), 'from_here', $this->user);

        $this->assertSame(2, $result->updatedCount);
        $this->assertNotContains($past, $updatedEvents);
        $this->assertContains($current, $updatedEvents);
        $this->assertContains($future, $updatedEvents);
    }

    // ─── Scope: same_weekday ──────────────────────────────────────────────────

    public function testSameWeekdayScopeSkipsOtherWeekdays(): void
    {
        $seriesId = 'uuid-wd';
        $tue1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId); // Tue (w=2)
        $tue2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId); // Tue
        $wed  = $this->makeSeriesEvent('2026-04-08T18:00:00', $seriesId); // Wed (w=3)
        $this->stubSeriesEvents([$tue1, $tue2, $wed], $seriesId);

        $updatedEvents = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e) use (&$updatedEvents): ConstraintViolationList {
                $updatedEvents[] = $e;

                return new ConstraintViolationList();
            });

        $payload = $this->makePayload(['startDate' => '2026-04-07T18:00:00', 'trainingEditScope' => 'same_weekday']);
        $result = $this->service->update($tue1, $payload, 'same_weekday', $this->user);

        $this->assertSame(2, $result->updatedCount);
        $this->assertNotContains($wed, $updatedEvents);
    }

    // ─── Per-event date/time preservation ────────────────────────────────────

    public function testEachEventKeepsItsOwnDateWithNewTime(): void
    {
        $seriesId = 'uuid-date';
        $e1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $e2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $this->stubSeriesEvents([$e1, $e2], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        $payload = $this->makePayload(['startDate' => '2026-04-07T17:00:00', 'endDate' => '2026-04-07T18:30:00', 'trainingEditScope' => 'series']);
        $this->service->update($e1, $payload, 'series', $this->user);

        $this->assertStringStartsWith('2026-04-07T17:00', $capturedData[0]['startDate']);
        $this->assertStringStartsWith('2026-04-14T17:00', $capturedData[1]['startDate']);
    }

    public function testDurationIsPreservedAcrossAllSeriesEvents(): void
    {
        $seriesId = 'uuid-dur';
        $e1 = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $e2 = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $this->stubSeriesEvents([$e1, $e2], $seriesId);

        $capturedData = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e, array $d) use (&$capturedData): ConstraintViolationList {
                $capturedData[] = $d;

                return new ConstraintViolationList();
            });

        // New: 17:00–18:00 = 60 min (was 18:00–19:30 = 90 min)
        $payload = $this->makePayload(['startDate' => '2026-04-07T17:00:00', 'endDate' => '2026-04-07T18:00:00', 'trainingEditScope' => 'series']);
        $this->service->update($e1, $payload, 'series', $this->user);

        $this->assertSame('2026-04-07T18:00:00', $capturedData[0]['endDate']);
        $this->assertSame('2026-04-14T18:00:00', $capturedData[1]['endDate']);
    }

    // ─── End-date shortening ──────────────────────────────────────────────────

    public function testShortenedEndDateDeletesEventsAfterCutoff(): void
    {
        $seriesId = 'uuid-shorten';
        $oldEnd   = '2026-06-04';
        $newEnd   = '2026-05-21';

        $e1 = $this->makeSeriesEvent('2026-05-07T18:00:00', $seriesId);
        $e1->setTrainingSeriesEndDate($oldEnd);
        $e2 = $this->makeSeriesEvent('2026-05-21T18:00:00', $seriesId);
        $e2->setTrainingSeriesEndDate($oldEnd);
        $eLate = $this->makeSeriesEvent('2026-05-28T18:00:00', $seriesId);
        $eLate->setTrainingSeriesEndDate($oldEnd);
        $this->stubSeriesEvents([$e1, $e2, $eLate], $seriesId);

        $deletedEvents = [];
        $this->calendarEventService->method('deleteCalendarEventWithDependencies')
            ->willReturnCallback(function (CalendarEvent $e) use (&$deletedEvents): void {
                $deletedEvents[] = $e;
            });

        $payload = $this->makePayload(['trainingEditScope' => 'series', 'trainingSeriesEndDate' => $newEnd]);
        $result = $this->service->update($e1, $payload, 'series', $this->user);

        $this->assertSame(2, $result->updatedCount);
        $this->assertContains($eLate, $deletedEvents);
        $this->assertNotContains($e1, $deletedEvents);
        $this->assertNotContains($e2, $deletedEvents);
    }

    // ─── End-date silent sync for out-of-scope events ──────────────────────

    public function testOutOfScopeEventGetsNewEndDateSilently(): void
    {
        $seriesId = 'uuid-sync';
        $oldEnd   = '2026-04-28';
        $newEnd   = '2026-06-30';

        $prior  = $this->makeSeriesEvent('2026-04-07T18:00:00', $seriesId);
        $prior->setTrainingSeriesEndDate($oldEnd);
        $pivot  = $this->makeSeriesEvent('2026-04-14T18:00:00', $seriesId);
        $pivot->setTrainingSeriesEndDate($oldEnd);
        $this->stubSeriesEvents([$prior, $pivot], $seriesId);

        $updatedEvents = [];
        $this->calendarEventService->method('updateEventFromData')
            ->willReturnCallback(function (CalendarEvent $e) use (&$updatedEvents): ConstraintViolationList {
                $updatedEvents[] = $e;

                return new ConstraintViolationList();
            });

        $payload = $this->makePayload([
            'startDate'             => '2026-04-14T18:00:00',
            'endDate'               => '2026-04-14T19:30:00',
            'trainingEditScope'     => 'from_here',
            'trainingSeriesEndDate' => $newEnd,
        ]);
        $this->service->update($pivot, $payload, 'from_here', $this->user);

        $this->assertNotContains($prior, $updatedEvents, 'Prior event must not be updated via updateEventFromData');
        $this->assertSame($newEnd, $prior->getTrainingSeriesEndDate(), 'Prior event must get new end date silently');
    }

    // ─── ChangeSet in result ──────────────────────────────────────────────────

    public function testResultChangeSetCapturesTimeChange(): void
    {
        $e1 = $this->makeSeriesEvent('2026-04-07T18:00:00');
        $this->stubSeriesEvents([$e1]);

        $payload = $this->makePayload([
            'startDate'          => '2026-04-07T17:00:00',
            'endDate'            => '2026-04-07T18:30:00',
            'trainingEditScope'  => 'series',
        ]);
        $result = $this->service->update($e1, $payload, 'series', $this->user);

        $this->assertInstanceOf(CalendarEventChangeSet::class, $result->changeSet);
        $this->assertTrue($result->changeSet->timeChanged());
        $this->assertSame('18:00', $result->changeSet->oldStartTime);
        $this->assertSame('17:00', $result->changeSet->newStartTime);
    }

    public function testResultContainsUpdatedCount(): void
    {
        $events = [
            $this->makeSeriesEvent('2026-04-07T18:00:00'),
            $this->makeSeriesEvent('2026-04-14T18:00:00'),
            $this->makeSeriesEvent('2026-04-21T18:00:00'),
        ];
        $this->stubSeriesEvents($events);

        $result = $this->service->update($events[0], $this->makePayload(['trainingEditScope' => 'series']), 'series', $this->user);

        $this->assertSame(3, $result->updatedCount);
    }
}
