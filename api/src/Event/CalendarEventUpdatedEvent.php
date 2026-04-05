<?php

namespace App\Event;

use App\Dto\CalendarEventChangeSet;
use App\Entity\CalendarEvent;
use App\Entity\User;

/**
 * Fired when a user updates one or more CalendarEvents (single, series, from_here, …).
 */
final class CalendarEventUpdatedEvent
{
    public function __construct(
        private readonly User $user,
        private readonly CalendarEvent $calendarEvent,
        private readonly int $updatedCount = 1,
        private readonly string $scope = 'single',
        private readonly ?CalendarEventChangeSet $changeSet = null,
        /** Series end date BEFORE this edit (YYYY-MM-DD), null for single events. */
        private readonly ?string $oldSeriesEndDate = null,
        /** Series end date AFTER this edit (YYYY-MM-DD), null when unchanged. */
        private readonly ?string $newSeriesEndDate = null,
    ) {
    }

    public function getUser(): User
    {
        return $this->user;
    }

    /** Returns the primary (trigger) event – the one the editor opened. */
    public function getCalendarEvent(): CalendarEvent
    {
        return $this->calendarEvent;
    }

    /** Number of events that were actually modified (≥ 1 for series edits). */
    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }

    /** The edit scope: single | from_here | same_weekday | same_weekday_from_here | series. */
    public function getScope(): string
    {
        return $this->scope;
    }

    /** Structured set of changes for building the push notification message. */
    public function getChangeSet(): ?CalendarEventChangeSet
    {
        return $this->changeSet;
    }

    /** Series end date before the edit (YYYY-MM-DD), or null for single-event updates. */
    public function getOldSeriesEndDate(): ?string
    {
        return $this->oldSeriesEndDate;
    }

    /** Series end date after the edit (YYYY-MM-DD), or null when the end date was not changed. */
    public function getNewSeriesEndDate(): ?string
    {
        return $this->newSeriesEndDate;
    }
}
