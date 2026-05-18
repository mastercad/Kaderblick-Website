<?php

namespace App\Event;

use App\Entity\CalendarEvent;
use App\Entity\User;

/**
 * Fired when a user responds to a calendar event with a non-attending status
 * (not_attending, maybe, late). Used to reward the act of responding itself,
 * regardless of whether the user will attend.
 */
final class ParticipationRespondedEvent
{
    public function __construct(
        private User $user,
        private CalendarEvent $calendarEvent,
    ) {
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getCalendarEvent(): CalendarEvent
    {
        return $this->calendarEvent;
    }
}
