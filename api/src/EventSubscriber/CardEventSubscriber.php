<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Event\GameEventCreatedEvent;
use App\Message\CheckCardThresholdsMessage;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Reagiert auf neu angelegte GameEvents und löst bei Karten-Events
 * die asynchrone Schwellenwert-Prüfung über den Messenger aus.
 */
class CardEventSubscriber implements EventSubscriberInterface
{
    private const CARD_CODES = ['yellow_card', 'red_card', 'yellow_red_card'];

    public function __construct(
        private readonly MessageBusInterface $bus,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            GameEventCreatedEvent::class => 'onGameEventCreated',
        ];
    }

    public function onGameEventCreated(GameEventCreatedEvent $event): void
    {
        $gameEvent = $event->getGameEvent();
        $code = $gameEvent->getGameEventType()?->getCode();

        if (null === $code || !in_array($code, self::CARD_CODES, true)) {
            return;
        }

        $gameEventId = $gameEvent->getId();
        if (null === $gameEventId) {
            return;
        }

        $this->bus->dispatch(new CheckCardThresholdsMessage($gameEventId));
    }
}
