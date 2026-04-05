<?php

namespace Tests\Unit\Service;

use App\Dto\CalendarEventChangeSet;
use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\Location;
use App\Entity\Team;
use App\Event\CalendarEventDeletedEvent;
use App\Event\CalendarEventUpdatedEvent;
use App\Service\CalendarNotificationMessageBuilder;
use DateTime;
use PHPUnit\Framework\MockObject\Stub;
use PHPUnit\Framework\TestCase;

/**
 * Tests that CalendarNotificationMessageBuilder produces correct titles and bodies
 * for all branches of the three message types.
 */
class CalendarNotificationMessageBuilderTest extends TestCase
{
    private CalendarNotificationMessageBuilder $builder;

    protected function setUp(): void
    {
        $this->builder = new CalendarNotificationMessageBuilder();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forCreated — training series
    // ══════════════════════════════════════════════════════════════════════════

    public function testCreatedTrainingSeriesTitleContainsPrefix(): void
    {
        $event = $this->makeEvent('Donnerstags-Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getTrainingSeriesEndDate')->willReturn('2026-06-30');

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Neue Trainings:', $result['title']);
        $this->assertStringContainsString('Donnerstags-Training', $result['title']);
    }

    public function testCreatedTrainingSeriesBodyContainsDateRangeAndTime(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getTrainingSeriesEndDate')->willReturn('2026-06-30');
        $event->method('getStartDate')->willReturn(new DateTime('2026-05-01 18:00:00'));
        $event->method('getEndDate')->willReturn(new DateTime('2026-05-01 19:30:00'));

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('01.05.2026', $result['body']);
        $this->assertStringContainsString('30.06.2026', $result['body']);
        $this->assertStringContainsString('18:00', $result['body']);
        $this->assertStringContainsString('19:30', $result['body']);
    }

    public function testCreatedTrainingSeriesBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Training', 'Sportplatz West');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getTrainingSeriesEndDate')->willReturn('2026-06-30');

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Sportplatz West', $result['body']);
    }

    public function testCreatedTrainingSeriesBodyWithoutLocation(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getTrainingSeriesEndDate')->willReturn('2026-06-30');

        $result = $this->builder->forCreated($event);

        $this->assertStringNotContainsString('Ort:', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forCreated — game event
    // ══════════════════════════════════════════════════════════════════════════

    public function testCreatedGameTitleContainsNeuesSpiel(): void
    {
        $event = $this->makeEventWithGame('Stadtderby', 'FC Heimat', 'SV Gast');

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Neues Spiel:', $result['title']);
        $this->assertStringContainsString('Stadtderby', $result['title']);
    }

    public function testCreatedGameBodyContainsTeamNames(): void
    {
        $event = $this->makeEventWithGame('Spiel', 'FC Heimat', 'SV Gast');

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('FC Heimat', $result['body']);
        $this->assertStringContainsString('SV Gast', $result['body']);
    }

    public function testCreatedGameBodyContainsDateAndTime(): void
    {
        $event = $this->makeEventWithGame('Spiel', 'A', 'B');
        $event->method('getStartDate')->willReturn(new DateTime('2026-09-14 15:00:00'));
        $event->method('getEndDate')->willReturn(new DateTime('2026-09-14 17:00:00'));

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('14.09.2026', $result['body']);
        $this->assertStringContainsString('15:00', $result['body']);
        $this->assertStringContainsString('17:00', $result['body']);
    }

    public function testCreatedGameBodyWithoutGameTeamsFallsBackToQuestionMark(): void
    {
        $game = $this->createStub(Game::class);
        $game->method('getHomeTeam')->willReturn(null);
        $game->method('getAwayTeam')->willReturn(null);

        $event = $this->makeEvent('Spiel');
        $event->method('getGame')->willReturn($game);

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('?', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forCreated — single training / single Termin
    // ══════════════════════════════════════════════════════════════════════════

    public function testCreatedSingleTrainingTitleContainsNeuesTraining(): void
    {
        $event = $this->makeEvent('Dienstags-Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-x');
        // No series end date → not a series → single training path

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Neues Training:', $result['title']);
        $this->assertStringContainsString('Dienstags-Training', $result['title']);
    }

    public function testCreatedSingleTerminTitleContainsNeuerTermin(): void
    {
        $event = $this->makeEvent('Vereinsversammlung');
        // No trainingSeriesId → "Termin"

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Neuer Termin:', $result['title']);
        $this->assertStringContainsString('Vereinsversammlung', $result['title']);
    }

    public function testCreatedSingleBodyContainsDateAndTime(): void
    {
        $event = $this->makeEvent('Event');
        $event->method('getStartDate')->willReturn(new DateTime('2026-10-01 18:00:00'));
        $event->method('getEndDate')->willReturn(new DateTime('2026-10-01 19:30:00'));

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('01.10.2026', $result['body']);
        $this->assertStringContainsString('18:00', $result['body']);
        $this->assertStringContainsString('19:30', $result['body']);
    }

    public function testCreatedSingleBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Event', 'Sportplatz Nord');

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('Sportplatz Nord', $result['body']);
    }

    public function testCreatedSingleBodyWithoutStartDateIsEmpty(): void
    {
        $event = $this->makeEvent('Event');

        $result = $this->builder->forCreated($event);

        $this->assertSame('', $result['body']);
    }

    public function testCreatedSingleBodyEndTimeOmittedWhenNoEndDate(): void
    {
        $event = $this->makeEvent('Event');
        $event->method('getStartDate')->willReturn(new DateTime('2026-10-01 18:00:00'));
        // no endDate

        $result = $this->builder->forCreated($event);

        $this->assertStringContainsString('18:00 Uhr', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forUpdated — single event
    // ══════════════════════════════════════════════════════════════════════════

    public function testUpdatedSingleTrainingTitleUsesSingular(): void
    {
        $event = $this->makeEvent('Training-A');
        $event->method('getTrainingSeriesId')->willReturn('uuid-x');
        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Training geändert:', $result['title']);
        $this->assertStringContainsString('Training-A', $result['title']);
        $this->assertStringNotContainsString('Trainings', $result['title']);
    }

    public function testUpdatedSingleTerminTitleUsesSingular(): void
    {
        $event = $this->makeEvent('Vereinsversammlung');
        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Termin geändert:', $result['title']);
        $this->assertStringNotContainsString('Termine geändert', $result['title']);
    }

    public function testUpdatedSingleBodyContainsDate(): void
    {
        $event = $this->makeEvent('Event');
        $event->method('getStartDate')->willReturn(new DateTime('2026-05-07 18:00:00'));
        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('07.05.2026', $result['body']);
    }

    public function testUpdatedSingleBodyContainsChangeSummary(): void
    {
        $event = $this->makeEvent('Event');
        $changeSet = new CalendarEventChangeSet(
            oldWeekday: 'Do', newWeekday: 'Fr',
            oldStartTime: '18:00', newStartTime: '19:00',
            oldEndTime: '19:30', newEndTime: '20:45',
        );
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 1, 'single', $changeSet
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Do 18:00–19:30 Uhr → Fr 19:00–20:45 Uhr', $result['body']);
    }

    public function testUpdatedSingleBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Event', 'Sportplatz Süd');
        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Sportplatz Süd', $result['body']);
    }

    public function testUpdatedSingleBodyWithoutChangeSummaryAndNoLocation(): void
    {
        $event = $this->makeEvent('Event');
        $event->method('getStartDate')->willReturn(new DateTime('2026-05-07'));
        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringNotContainsString('Zeit:', $result['body']);
        $this->assertStringNotContainsString('Ort:', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forUpdated — series: end-date extension
    // ══════════════════════════════════════════════════════════════════════════

    public function testUpdatedSeriesEndDateExtendedTitleContainsGeaendert(): void
    {
        $event = $this->makeEvent('Donnerstags-Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 15, 'series', null, '2026-05-17', '2026-05-30'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('geändert', $result['title']);
        $this->assertStringContainsString('Donnerstags-Training', $result['title']);
        $this->assertStringNotContainsString('verlängert', $result['title']);
    }

    public function testUpdatedSeriesEndDateExtendedTitleUsesPlural(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 5, 'series', null, '2026-05-17', '2026-06-30'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Trainings geändert', $result['title']);
    }

    public function testUpdatedSeriesEndDateExtendedBodyContainsNewDate(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 10, 'series', null, '2026-05-17', '2026-05-30'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('30.05.2026', $result['body']);
        $this->assertStringContainsString('Neue Trainings', $result['body']);
        $this->assertStringNotContainsString('Serienende', $result['body']);
    }

    public function testUpdatedSeriesEndDateExtendedBodyDoesNotContainGenericAktualisiert(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getStartDate')->willReturn(new DateTime('2026-04-09'));
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 15, 'series', null, '2026-05-17', '2026-05-30'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringNotContainsString('aktualisiert', $result['body']);
    }

    public function testUpdatedSeriesEndDateExtendedWithChangeSummaryContainsBoth(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $changeSet = new CalendarEventChangeSet(
            oldWeekday: 'Do', newWeekday: 'Do',
            oldStartTime: '18:00', newStartTime: '19:00',
            oldEndTime: '19:00', newEndTime: '20:00',
        );
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 10, 'series', $changeSet,
            '2026-05-17', '2026-05-30'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('30.05.2026', $result['body']);
        $this->assertStringContainsString('18:00', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forUpdated — series: end-date shortening
    // ══════════════════════════════════════════════════════════════════════════

    public function testUpdatedSeriesEndDateShortenedTitleContainsGeaendert(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        // newEnd < oldEnd → shortened
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 11, 'series', null, '2026-05-30', '2026-05-17'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('geändert', $result['title']);
        $this->assertStringNotContainsString('verkürzt', $result['title']);
    }

    public function testUpdatedSeriesEndDateShortenedBodyContainsDeletedRange(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 11, 'series', null, '2026-05-30', '2026-05-17'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        // Deleted from newEnd+1day (18.05.) to oldEnd (30.05.)
        $this->assertStringContainsString('18.05.2026', $result['body']);
        $this->assertStringContainsString('30.05.2026', $result['body']);
        $this->assertStringContainsString('abgesagt', $result['body']);
    }

    public function testUpdatedSeriesEndDateShortenedBodyDoesNotContainNewEndItself(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        // newEnd = 2026-05-17 → body shows "18.05.2026" (day after), not "17.05.2026"
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 11, 'series', null, '2026-05-30', '2026-05-17'
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringNotContainsString('17.05.2026', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forUpdated — series: changeSummary without end-date change
    // ══════════════════════════════════════════════════════════════════════════

    public function testUpdatedSeriesChangeSummaryBodyContainsTimeAndOptionalDate(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getStartDate')->willReturn(new DateTime('2026-06-01'));
        $changeSet = new CalendarEventChangeSet(
            oldWeekday: 'Mo', newWeekday: 'Mo',
            oldStartTime: '17:00', newStartTime: '18:00',
            oldEndTime: '18:30', newEndTime: '19:30',
        );
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 4, 'from_here', $changeSet,
            null, null
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('01.06.2026', $result['body']);
        $this->assertStringContainsString('Mo 17:00', $result['body']);
    }

    public function testUpdatedSeriesChangeSummaryBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Training', 'Sportplatz Ost');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $changeSet = new CalendarEventChangeSet(oldStartTime: '18:00', newStartTime: '19:00');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 3, 'series', $changeSet, null, null
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('Sportplatz Ost', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forUpdated — series: generic fallback (no changeSummary, no end-date change)
    // ══════════════════════════════════════════════════════════════════════════

    public function testUpdatedSeriesFallbackWithDateContainsAktualisiertAndDate(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getStartDate')->willReturn(new DateTime('2026-06-01'));
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 8, 'series', null, '2026-06-30', null
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('aktualisiert', $result['body']);
        $this->assertStringContainsString('01.06.2026', $result['body']);
    }

    public function testUpdatedSeriesFallbackWithoutDateContainsGenericAktualisiert(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 3, 'series', null, null, null
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringContainsString('aktualisiert', $result['body']);
        $this->assertStringNotContainsString('ab ', $result['body']);
    }

    public function testUpdatedSeriesFallbackDoesNotContainSerienende(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getStartDate')->willReturn(new DateTime('2026-06-01'));
        // Same old and new end date → no end-date change branch
        $updatedEvent = new CalendarEventUpdatedEvent(
            $this->makeUser(), $event, 8, 'series', null, '2026-06-30', null
        );

        $result = $this->builder->forUpdated($updatedEvent);

        $this->assertStringNotContainsString('Serienende', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forDeleted — single event
    // ══════════════════════════════════════════════════════════════════════════

    public function testDeletedSingleTrainingTitleUsesSingular(): void
    {
        $event = $this->makeEvent('Freitagstraining');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Training abgesagt:', $result['title']);
        $this->assertStringContainsString('Freitagstraining', $result['title']);
    }

    public function testDeletedSingleTerminTitleUsesSingular(): void
    {
        $event = $this->makeEvent('Vereinsfeier');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Termin abgesagt:', $result['title']);
    }

    public function testDeletedSingleBodyContainsDateTimeAndEntfaellt(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $event->method('getStartDate')->willReturn(new DateTime('2026-05-07 18:00:00'));
        $event->method('getEndDate')->willReturn(new DateTime('2026-05-07 19:30:00'));
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('07.05.2026', $result['body']);
        $this->assertStringContainsString('18:00', $result['body']);
        $this->assertStringContainsString('19:30', $result['body']);
        $this->assertStringContainsString('entfällt', $result['body']);
    }

    public function testDeletedSingleBodyTrainingUsesGenderCorrectEntfaellt(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-x');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Dieses Training', $result['body']);
    }

    public function testDeletedSingleBodyTerminUsesGenderCorrectEntfaellt(): void
    {
        $event = $this->makeEvent('Meeting');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Dieser Termin', $result['body']);
    }

    public function testDeletedSingleBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Training', 'Sportplatz');
        $event->method('getTrainingSeriesId')->willReturn('uuid-x');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 1, 'single');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Sportplatz', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // forDeleted — multiple events
    // ══════════════════════════════════════════════════════════════════════════

    public function testDeletedMultipleTrainingTitleUsesPlural(): void
    {
        $event = $this->makeEvent('Trainings Serie');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 5, 'series', '01.04.2026', '30.06.2026');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Trainings abgesagt:', $result['title']);
    }

    public function testDeletedMultipleTerminTitleUsesPlural(): void
    {
        $event = $this->makeEvent('Veranstaltung');
        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $event, 3, 'series', '01.04.2026', '30.06.2026');

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Termine abgesagt:', $result['title']);
    }

    public function testDeletedMultipleBodyWithFullRangeContainsBothDates(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $deletedEvent = new CalendarEventDeletedEvent(
            $this->makeUser(), $event, 12, 'series', '07.05.2026', '30.06.2026'
        );

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('07.05.2026', $result['body']);
        $this->assertStringContainsString('30.06.2026', $result['body']);
        $this->assertStringContainsString('abgesagt', $result['body']);
    }

    public function testDeletedMultipleBodyWithSingleFirstDateUsesAbPrefix(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        // firstDeletedDate == lastDeletedDate → "ab" prefix path
        $deletedEvent = new CalendarEventDeletedEvent(
            $this->makeUser(), $event, 3, 'from_here', '07.05.2026', '07.05.2026'
        );

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('ab 07.05.2026', $result['body']);
        $this->assertStringContainsString('abgesagt', $result['body']);
    }

    public function testDeletedMultipleBodyWithNoDatesShowsGenericLine(): void
    {
        $event = $this->makeEvent('Training');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $deletedEvent = new CalendarEventDeletedEvent(
            $this->makeUser(), $event, 2, 'series', null, null
        );

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('abgesagt', $result['body']);
        $this->assertStringNotContainsString('vom ', $result['body']);
        $this->assertStringNotContainsString('ab ', $result['body']);
    }

    public function testDeletedMultipleBodyContainsLocation(): void
    {
        $event = $this->makeEventWithLocation('Training', 'Platz 2');
        $event->method('getTrainingSeriesId')->willReturn('uuid-1');
        $deletedEvent = new CalendarEventDeletedEvent(
            $this->makeUser(), $event, 2, 'series', '01.05.2026', '15.05.2026'
        );

        $result = $this->builder->forDeleted($deletedEvent);

        $this->assertStringContainsString('Platz 2', $result['body']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // helpers
    // ══════════════════════════════════════════════════════════════════════════

    private function makeUser(): \App\Entity\User&Stub
    {
        $user = $this->createStub(\App\Entity\User::class);
        $user->method('getFullName')->willReturn('Test User');
        $user->method('getId')->willReturn(1);

        return $user;
    }

    private function makeEvent(string $title = 'Test Event'): CalendarEvent&Stub
    {
        $event = $this->createStub(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn($title);

        return $event;
    }

    private function makeEventWithLocation(string $title, string $locationName): CalendarEvent&Stub
    {
        $location = $this->createStub(Location::class);
        $location->method('getName')->willReturn($locationName);

        $event = $this->makeEvent($title);
        $event->method('getLocation')->willReturn($location);

        return $event;
    }

    private function makeEventWithGame(string $title, string $homeTeamName, string $awayTeamName): CalendarEvent&Stub
    {
        $homeTeam = $this->createStub(Team::class);
        $homeTeam->method('getName')->willReturn($homeTeamName);

        $awayTeam = $this->createStub(Team::class);
        $awayTeam->method('getName')->willReturn($awayTeamName);

        $game = $this->createStub(Game::class);
        $game->method('getHomeTeam')->willReturn($homeTeam);
        $game->method('getAwayTeam')->willReturn($awayTeam);

        $event = $this->makeEvent($title);
        $event->method('getGame')->willReturn($game);

        return $event;
    }
}
