<?php

namespace App\EventListener;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Message\AwardTitlesMessage;
use App\Service\GoalCountingService;
use DateTimeInterface;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PreRemoveEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Triggers an asynchronous recalculation of top-scorer titles whenever a
 * goal GameEvent is created, changed or deleted, or a Game's CalendarEvent
 * association changes (which shifts the season).
 *
 * Dispatching is deferred to postFlush so the INSERT into messenger_messages
 * happens outside the active ORM transaction.
 */
#[AsDoctrineListener(Events::postUpdate)]
#[AsDoctrineListener(Events::postPersist)]
#[AsDoctrineListener(Events::preRemove)]
#[AsDoctrineListener(Events::postFlush)]
final class TitleRecalcListener
{
    /** @var string[] Unique season strings to recalculate after the flush */
    private array $pendingSeasons = [];

    public function __construct(
        private MessageBusInterface $messageBus,
        private GoalCountingService $goalCountingService,
    ) {
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof GameEvent) {
            $changeSet = $args->getObjectManager()
                ->getUnitOfWork()
                ->getEntityChangeSet($entity);

            // Trigger if the event currently IS a goal, or if the event type
            // itself changed (might have changed away from a goal type).
            if ($this->isGoalEvent($entity) || array_key_exists('gameEventType', $changeSet)) {
                $season = $this->seasonFromGameEvent($entity);
                if (null !== $season) {
                    $this->buffer($season);
                }
            }

            return;
        }

        if ($entity instanceof Game) {
            $changeSet = $args->getObjectManager()
                ->getUnitOfWork()
                ->getEntityChangeSet($entity);

            if (array_key_exists('calendarEvent', $changeSet)) {
                [$oldCe, $newCe] = (array) $changeSet['calendarEvent'];

                if ($oldCe instanceof CalendarEvent && null !== $oldCe->getStartDate()) {
                    $this->buffer($this->seasonFromDate($oldCe->getStartDate()));
                }
                if ($newCe instanceof CalendarEvent && null !== $newCe->getStartDate()) {
                    $this->buffer($this->seasonFromDate($newCe->getStartDate()));
                }
            }
        }
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof GameEvent && $this->isGoalEvent($entity)) {
            $season = $this->seasonFromGameEvent($entity);
            if (null !== $season) {
                $this->buffer($season);
            }
        }
    }

    public function preRemove(PreRemoveEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof GameEvent && $this->isGoalEvent($entity)) {
            // Capture season now, before the relation is detached
            $season = $this->seasonFromGameEvent($entity);
            if (null !== $season) {
                $this->buffer($season);
            }
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ([] === $this->pendingSeasons) {
            return;
        }

        $seasons = $this->pendingSeasons;
        $this->pendingSeasons = [];

        foreach ($seasons as $season) {
            $this->messageBus->dispatch(new AwardTitlesMessage($season));
        }
    }

    private function buffer(string $season): void
    {
        if (!in_array($season, $this->pendingSeasons, true)) {
            $this->pendingSeasons[] = $season;
        }
    }

    private function isGoalEvent(GameEvent $event): bool
    {
        $type = $event->getGameEventType();
        if (null === $type) {
            return false;
        }

        return $this->goalCountingService->isGoalForScorer($type->getCode());
    }

    private function seasonFromGameEvent(GameEvent $event): ?string
    {
        $calendarEvent = $event->getGame()->getCalendarEvent();
        if (null === $calendarEvent || null === $calendarEvent->getStartDate()) {
            return null;
        }

        return $this->seasonFromDate($calendarEvent->getStartDate());
    }

    private function seasonFromDate(DateTimeInterface $date): string
    {
        $year = (int) $date->format('Y');
        $month = (int) $date->format('m');

        return $month >= 7
            ? sprintf('%d/%d', $year, $year + 1)
            : sprintf('%d/%d', $year - 1, $year);
    }
}
