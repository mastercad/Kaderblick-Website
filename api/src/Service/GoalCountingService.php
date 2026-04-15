<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Game;
use App\Entity\GameEvent;

/**
 * Central service for goal-counting logic shared across controllers and the
 * title-calculation pipeline.
 *
 * Single source of truth for which event codes count as goals, own goals or
 * are explicitly excluded from scoring (offside goals, VAR-denied goals, etc.).
 */
class GoalCountingService
{
    /**
     * Codes that superficially contain the word "goal" but must NOT be counted
     * as a valid goal for either team.
     */
    public const EXCLUDED_GOAL_CODES = ['offside_goal', 'var_goal_denied', 'own_goal_attempt'];

    /**
     * The code for an own goal (credits the opponent, not the player who touched the ball last).
     */
    public const OWN_GOAL_CODE = 'own_goal';

    /**
     * Returns true if the given event type code counts as a goal scored BY the
     * player (i.e. should be credited to the scorer in top-scorer calculations).
     *
     * Own goals are explicitly excluded – the player did not intentionally score.
     */
    public function isGoalForScorer(string $code): bool
    {
        if (self::OWN_GOAL_CODE === $code) {
            return false;
        }

        if (in_array($code, self::EXCLUDED_GOAL_CODES, true)) {
            return false;
        }

        return str_contains($code, 'goal');
    }

    /**
     * Returns true if the code represents an own goal (credits the opponent team).
     */
    public function isOwnGoal(string $code): bool
    {
        return self::OWN_GOAL_CODE === $code;
    }

    /**
     * Calculates home and away scores from a set of game events.
     *
     * Replaces the previously duplicated private collectScores() method that
     * existed in both GamesController classes.
     *
     * @param array<int, GameEvent> $gameEvents
     *
     * @return array{home: int, away: int}
     */
    public function collectScores(array $gameEvents, Game $game): array
    {
        $homeScore = 0;
        $awayScore = 0;

        foreach ($gameEvents as $gameEvent) {
            $eventType = $gameEvent->getGameEventType();
            if (null === $eventType) {
                continue;
            }

            $code = $eventType->getCode();

            if ($this->isOwnGoal($code)) {
                // Own goal counts for the opponent
                if ($gameEvent->getTeam() === $game->getHomeTeam()) {
                    ++$awayScore;
                } elseif ($gameEvent->getTeam() === $game->getAwayTeam()) {
                    ++$homeScore;
                }
            } elseif ($this->isGoalForScorer($code)) {
                // All other goal variants count for the scoring team
                if ($gameEvent->getTeam() === $game->getHomeTeam()) {
                    ++$homeScore;
                } elseif ($gameEvent->getTeam() === $game->getAwayTeam()) {
                    ++$awayScore;
                }
            }
        }

        return ['home' => $homeScore, 'away' => $awayScore];
    }

    /**
     * Returns a DQL WHERE condition string and its bound parameters for querying
     * GameEvent records that count as a goal FOR the scoring player.
     *
     * The condition excludes own goals and all non-counting goal variants
     * (offside goals, VAR-denied goals, own-goal attempts).
     *
     * Usage:
     *   [$dql, $params] = $this->goalCountingService->getScorerGoalDqlCondition('gt.code');
     *   $qb->andWhere($dql);
     *   foreach ($params as $key => $value) { $qb->setParameter($key, $value); }
     *
     * @return array{0: string, 1: array<string, mixed>}
     */
    public function getScorerGoalDqlCondition(string $codeAlias = 'gt.code'): array
    {
        $excluded = array_merge(self::EXCLUDED_GOAL_CODES, [self::OWN_GOAL_CODE]);

        $dql = sprintf(
            "(%s LIKE '%%goal%%' AND %s NOT IN (:excludedGoalCodes))",
            $codeAlias,
            $codeAlias
        );

        return [$dql, ['excludedGoalCodes' => $excluded]];
    }
}
