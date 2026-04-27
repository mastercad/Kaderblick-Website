<?php

namespace App\Message;

/**
 * Triggers the asynchronous recalculation of top-scorer titles for a specific season.
 *
 * Dispatched by TitleRecalcListener whenever a goal GameEvent is created,
 * updated or deleted, or a Game's calendarEvent association changes (season shift).
 */
final readonly class AwardTitlesMessage
{
    public function __construct(
        public string $season,
    ) {
    }
}
