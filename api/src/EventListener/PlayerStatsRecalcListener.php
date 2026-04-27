<?php

namespace App\EventListener;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Message\RecalcPlayerStatsMessage;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PreRemoveEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Lauscht auf Änderungen an Game (matchPlan, Halbzeitdauer) und GameEvent (Auswechslungen)
 * und dispatched asynchron eine RecalcPlayerStatsMessage an den Messenger-Worker.
 *
 * Das Dispatching erfolgt in postFlush (nach Abschluss der ORM-Transaktion),
 * damit der INSERT in messenger_messages sicher außerhalb der laufenden
 * DB-Transaktion stattfindet.
 */
#[AsDoctrineListener(Events::postUpdate)]
#[AsDoctrineListener(Events::postPersist)]
#[AsDoctrineListener(Events::preRemove)]
#[AsDoctrineListener(Events::postFlush)]
final class PlayerStatsRecalcListener
{
    /** @var int[] Game-IDs, für die nach dem Flush eine Recalc-Message dispatched werden soll */
    private array $pendingGameIds = [];

    public function __construct(
        private MessageBusInterface $messageBus,
    ) {
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof Game) {
            $changeSet = $args->getObjectManager()
                ->getUnitOfWork()
                ->getEntityChangeSet($entity);

            $relevantFields = ['matchPlan', 'halfDuration', 'firstHalfExtraTime', 'secondHalfExtraTime', 'isFinished'];

            foreach ($relevantFields as $field) {
                if (array_key_exists($field, $changeSet)) {
                    $this->buffer((int) $entity->getId());
                    break;
                }
            }

            return;
        }

        if ($entity instanceof GameEvent && $this->isSubstitutionEvent($entity)) {
            $this->buffer((int) $entity->getGame()->getId());
        }
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof GameEvent && $this->isSubstitutionEvent($entity)) {
            $this->buffer((int) $entity->getGame()->getId());
        }
    }

    public function preRemove(PreRemoveEventArgs $args): void
    {
        $entity = $args->getObject();

        if ($entity instanceof GameEvent && $this->isSubstitutionEvent($entity)) {
            // gameId hier merken, bevor die Relation entfernt wird
            $this->buffer((int) $entity->getGame()->getId());
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if (empty($this->pendingGameIds)) {
            return;
        }

        // Buffer sofort leeren, bevor Messages dispatched werden
        $gameIds = array_unique($this->pendingGameIds);
        $this->pendingGameIds = [];

        foreach ($gameIds as $gameId) {
            $this->messageBus->dispatch(new RecalcPlayerStatsMessage($gameId));
        }
    }

    private function buffer(int $gameId): void
    {
        $this->pendingGameIds[] = $gameId;
    }

    private function isSubstitutionEvent(GameEvent $event): bool
    {
        return in_array(
            $event->getGameEventType()?->getCode(),
            ['substitution', 'substitution_in', 'substitution_out', 'substitution_injury'],
            true
        );
    }
}
