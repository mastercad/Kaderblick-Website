<?php

declare(strict_types=1);

namespace App\Message;

/**
 * Löst die asynchrone Auswertung von Karten-Schwellenwerten aus.
 *
 * Wird vom CardEventSubscriber nach dem Anlegen eines Karten-GameEvents dispatched.
 * Der CheckCardThresholdsHandler verarbeitet die Nachricht und delegiert an den SuspensionService.
 */
final readonly class CheckCardThresholdsMessage
{
    public function __construct(
        public int $gameEventId,
    ) {
    }
}
