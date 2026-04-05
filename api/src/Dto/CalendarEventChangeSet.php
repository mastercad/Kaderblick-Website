<?php

namespace App\Dto;

/**
 * Carries the structured set of changes for a calendar-event update notification.
 * All fields are optional – only the ones that actually changed are populated.
 */
final class CalendarEventChangeSet
{
    public function __construct(
        public readonly ?string $oldStartTime    = null,  // 'H:i', e.g. '18:00'
        public readonly ?string $newStartTime    = null,
        public readonly ?string $oldEndTime      = null,
        public readonly ?string $newEndTime      = null,
        public readonly ?string $oldWeekday      = null,  // 'Mo', 'Di', …
        public readonly ?string $newWeekday      = null,
        public readonly ?string $oldLocationName = null,
        public readonly ?string $newLocationName = null,
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

    public function isEmpty(): bool
    {
        return !$this->timeChanged()
            && !$this->weekdayChanged()
            && !$this->locationChanged();
    }
}
