<?php

namespace App\Tests\Unit\Entity;

use App\Entity\CalendarEvent;
use App\Entity\User;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class CalendarEventTest extends TestCase
{
    public function testCancelledDefaultsToFalse(): void
    {
        $event = new CalendarEvent();

        $this->assertFalse($event->isCancelled());
    }

    public function testSetCancelled(): void
    {
        $event = new CalendarEvent();
        $result = $event->setCancelled(true);

        $this->assertTrue($event->isCancelled());
        $this->assertSame($event, $result, 'setCancelled should return self for fluent API');
    }

    public function testSetCancelledToFalse(): void
    {
        $event = new CalendarEvent();
        $event->setCancelled(true);
        $event->setCancelled(false);

        $this->assertFalse($event->isCancelled());
    }

    public function testCancelReasonDefaultsToNull(): void
    {
        $event = new CalendarEvent();

        $this->assertNull($event->getCancelReason());
    }

    public function testSetCancelReason(): void
    {
        $event = new CalendarEvent();
        $result = $event->setCancelReason('Wetter zu schlecht');

        $this->assertSame('Wetter zu schlecht', $event->getCancelReason());
        $this->assertSame($event, $result);
    }

    public function testSetCancelReasonToNull(): void
    {
        $event = new CalendarEvent();
        $event->setCancelReason('Grund');
        $event->setCancelReason(null);

        $this->assertNull($event->getCancelReason());
    }

    public function testCancelledByDefaultsToNull(): void
    {
        $event = new CalendarEvent();

        $this->assertNull($event->getCancelledBy());
    }

    public function testSetCancelledBy(): void
    {
        $event = new CalendarEvent();
        $user = $this->createMock(User::class);

        $result = $event->setCancelledBy($user);

        $this->assertSame($user, $event->getCancelledBy());
        $this->assertSame($event, $result);
    }

    public function testSetCancelledByToNull(): void
    {
        $event = new CalendarEvent();
        $user = $this->createMock(User::class);
        $event->setCancelledBy($user);
        $event->setCancelledBy(null);

        $this->assertNull($event->getCancelledBy());
    }

    public function testFullCancellationWorkflow(): void
    {
        $event = new CalendarEvent();
        $user = $this->createMock(User::class);

        $event->setCancelled(true);
        $event->setCancelReason('Platzsperrung');
        $event->setCancelledBy($user);

        $this->assertTrue($event->isCancelled());
        $this->assertSame('Platzsperrung', $event->getCancelReason());
        $this->assertSame($user, $event->getCancelledBy());
    }

    public function testPermissionsCollectionInitialized(): void
    {
        $event = new CalendarEvent();

        $this->assertCount(0, $event->getPermissions());
    }

    // -------------------------------------------------------------------------
    // Training series fields (added this session)
    // -------------------------------------------------------------------------

    public function testTrainingWeekdaysDefaultsToNull(): void
    {
        $event = new CalendarEvent();

        $this->assertNull($event->getTrainingWeekdays());
    }

    public function testSetTrainingWeekdays(): void
    {
        $event = new CalendarEvent();
        $result = $event->setTrainingWeekdays([1, 3, 5]);

        $this->assertSame([1, 3, 5], $event->getTrainingWeekdays());
        $this->assertSame($event, $result);
    }

    public function testSetTrainingWeekdaysToNull(): void
    {
        $event = new CalendarEvent();
        $event->setTrainingWeekdays([1, 2]);
        $event->setTrainingWeekdays(null);

        $this->assertNull($event->getTrainingWeekdays());
    }

    public function testTrainingSeriesEndDateDefaultsToNull(): void
    {
        $event = new CalendarEvent();

        $this->assertNull($event->getTrainingSeriesEndDate());
    }

    public function testSetTrainingSeriesEndDate(): void
    {
        $event = new CalendarEvent();
        $result = $event->setTrainingSeriesEndDate('2026-06-30');

        $this->assertSame('2026-06-30', $event->getTrainingSeriesEndDate());
        $this->assertSame($event, $result);
    }

    public function testSetTrainingSeriesEndDateToNull(): void
    {
        $event = new CalendarEvent();
        $event->setTrainingSeriesEndDate('2026-06-30');
        $event->setTrainingSeriesEndDate(null);

        $this->assertNull($event->getTrainingSeriesEndDate());
    }

    public function testTrainingSeriesIdDefaultsToNull(): void
    {
        $event = new CalendarEvent();

        $this->assertNull($event->getTrainingSeriesId());
    }

    public function testSetTrainingSeriesId(): void
    {
        $event = new CalendarEvent();
        $uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        $result = $event->setTrainingSeriesId($uuid);

        $this->assertSame($uuid, $event->getTrainingSeriesId());
        $this->assertSame($event, $result);
    }

    public function testSetTrainingSeriesIdToNull(): void
    {
        $event = new CalendarEvent();
        $event->setTrainingSeriesId('some-uuid');
        $event->setTrainingSeriesId(null);

        $this->assertNull($event->getTrainingSeriesId());
    }

    public function testTrainingSeriesFieldsSetTogether(): void
    {
        $event = new CalendarEvent();
        $event->setTrainingWeekdays([1, 3, 5]);
        $event->setTrainingSeriesEndDate('2026-12-31');
        $event->setTrainingSeriesId('abc-123');

        $this->assertSame([1, 3, 5], $event->getTrainingWeekdays());
        $this->assertSame('2026-12-31', $event->getTrainingSeriesEndDate());
        $this->assertSame('abc-123', $event->getTrainingSeriesId());
    }
}
