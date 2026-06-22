<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Game;
use App\Repository\GameEventRepository;
use Doctrine\DBAL\Connection;

/**
 * Keeps the denormalized score columns on games in sync with game events.
 */
final class GameScoreSyncService
{
    public function __construct(
        private readonly GameEventRepository $gameEventRepository,
        private readonly GoalCountingService $goalCountingService,
        private readonly Connection $connection,
    ) {
    }

    /** @return array{home: int, away: int} */
    public function sync(Game $game): array
    {
        $scores = $this->goalCountingService->collectScores(
            $this->gameEventRepository->findAllGameEvents($game),
            $game,
        );

        $this->connection->update('games', [
            'home_score' => $scores['home'],
            'away_score' => $scores['away'],
        ], ['id' => $game->getId()]);

        return $scores;
    }
}
