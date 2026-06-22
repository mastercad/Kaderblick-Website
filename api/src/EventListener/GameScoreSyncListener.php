<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Repository\GameRepository;
use App\Service\GameScoreSyncService;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PreRemoveEventArgs;
use Doctrine\ORM\Events;

/**
 * Recalculates the persisted score after every ORM write to a game event.
 *
 * Work is deferred until postFlush so inserts, updates and deletes are already
 * visible to the score query. The score update itself uses DBAL and therefore
 * does not trigger a recursive ORM flush.
 */
#[AsDoctrineListener(Events::postPersist)]
#[AsDoctrineListener(Events::postUpdate)]
#[AsDoctrineListener(Events::preRemove)]
#[AsDoctrineListener(Events::postFlush)]
final class GameScoreSyncListener
{
    /** @var array<int, true> */
    private array $pendingGameIds = [];

    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly GameScoreSyncService $gameScoreSyncService,
    ) {
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if ($entity instanceof GameEvent) {
            $this->buffer($entity->getGame());
        }
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof GameEvent) {
            return;
        }

        $this->buffer($entity->getGame());

        $changeSet = $args->getObjectManager()->getUnitOfWork()->getEntityChangeSet($entity);
        $oldGame = $changeSet['game'][0] ?? null;
        if ($oldGame instanceof Game) {
            $this->buffer($oldGame);
        }
    }

    public function preRemove(PreRemoveEventArgs $args): void
    {
        $entity = $args->getObject();
        if ($entity instanceof GameEvent) {
            $this->buffer($entity->getGame());
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ([] === $this->pendingGameIds) {
            return;
        }

        $gameIds = array_keys($this->pendingGameIds);
        $this->pendingGameIds = [];

        foreach ($gameIds as $gameId) {
            $game = $this->gameRepository->find($gameId);
            if ($game instanceof Game) {
                $this->gameScoreSyncService->sync($game);
            }
        }
    }

    private function buffer(Game $game): void
    {
        $this->pendingGameIds[$game->getId()] = true;
    }
}
