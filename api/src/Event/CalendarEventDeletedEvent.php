<?php

namespace App\Event;

use App\Entity\CalendarEvent;
use App\Entity\User;

/**
 * Fired when a user deletes one or more CalendarEvents (single, series, from_here, …).
 *
 * Must be dispatched BEFORE the actual deletion so that subscriber code
 * can still read all entity fields (title, date, location, …).
 */
final class CalendarEventDeletedEvent
{
    public function __construct(
        private readonly User $user,
        private readonly CalendarEvent $calendarEvent,
        private readonly int $deletedCount = 1,
        private readonly string $deletionMode = 'single',
        private readonly ?string $firstDeletedDate = null,
        private readonly ?string $lastDeletedDate = null,
    ) {
    }

    public function getUser(): User
    {
        return $this->user;
    }

    /** Returns the primary (trigger) event – the one the user clicked "delete" on. */
    public function getCalendarEvent(): CalendarEvent
    {
        return $this->calendarEvent;
    }

    /** Number of events that will be deleted (≥ 1 for series deletes). */
    public function getDeletedCount(): int
    {
        return $this->deletedCount;
    }

    /** The deletion mode: single | from_here | series. */
    public function getDeletionMode(): string
    {
        return $this->deletionMode;
    }

    /** Earliest deleted event date, formatted d.m.Y. */
    public function getFirstDeletedDate(): ?string
    {
        return $this->firstDeletedDate;
    }

    /** Latest deleted event date, formatted d.m.Y. */
    public function getLastDeletedDate(): ?string
    {
        return $this->lastDeletedDate;
    }
}
