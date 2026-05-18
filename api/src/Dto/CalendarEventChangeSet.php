<?php

namespace App\Dto;

/**
 * Carries the structured set of changes for a calendar-event update notification.
 * All fields are optional – only the ones that actually changed are populated.
 */
final class CalendarEventChangeSet
{
    public function __construct(
        public readonly ?string $oldStartTime = null,  // 'H:i', e.g. '18:00'
        public readonly ?string $newStartTime = null,
        public readonly ?string $oldEndTime = null,
        public readonly ?string $newEndTime = null,
        public readonly ?string $oldWeekday = null,  // 'Mo', 'Di', …
        public readonly ?string $newWeekday = null,
        public readonly ?string $oldLocationName = null,
        public readonly ?string $newLocationName = null,
        public readonly ?string $oldDate = null,              // 'Y-m-d'
        public readonly ?string $newDate = null,              // 'Y-m-d'
        public readonly ?string $oldMeetingPoint = null,      // free-text meeting point description
        public readonly ?string $newMeetingPoint = null,
        public readonly ?string $oldMeetingLocationName = null,
        public readonly ?string $newMeetingLocationName = null,
        public readonly ?string $oldMeetingTime = null,       // 'H:i'
        public readonly ?string $newMeetingTime = null,
    ) {
    }

    public function timeChanged(): bool
    {
        return $this->oldStartTime !== $this->newStartTime
            || $this->oldEndTime !== $this->newEndTime;
    }

    public function weekdayChanged(): bool
    {
        return null !== $this->oldWeekday
            && null !== $this->newWeekday
            && $this->oldWeekday !== $this->newWeekday;
    }

    public function locationChanged(): bool
    {
        return $this->oldLocationName !== $this->newLocationName;
    }

    /** Returns true when the calendar date (Y-m-d) of the event changed. */
    public function dateChanged(): bool
    {
        return null !== $this->oldDate
            && null !== $this->newDate
            && $this->oldDate !== $this->newDate;
    }

    /** Returns true when the free-text meeting-point description changed. */
    public function meetingPointChanged(): bool
    {
        return $this->oldMeetingPoint !== $this->newMeetingPoint;
    }

    /** Returns true when the structured meeting-point location changed. */
    public function meetingLocationChanged(): bool
    {
        return $this->oldMeetingLocationName !== $this->newMeetingLocationName;
    }

    /** Returns true when the meeting time (H:i) changed. */
    public function meetingTimeChanged(): bool
    {
        return $this->oldMeetingTime !== $this->newMeetingTime;
    }

    public function isEmpty(): bool
    {
        return !$this->timeChanged()
            && !$this->weekdayChanged()
            && !$this->locationChanged()
            && !$this->dateChanged()
            && !$this->meetingPointChanged()
            && !$this->meetingLocationChanged()
            && !$this->meetingTimeChanged();
    }
}
