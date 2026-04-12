<?php

namespace App\Service;

use App\Entity\Game;
use App\Entity\Team;
use App\Entity\TournamentMatch;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Automatically advances tournament bracket winners to the next round.
 *
 * After a tournament match game is finished, determines the winner
 * and sets them as home/away team in the next match. If both teams
 * are set in the next match, creates a Game for it.
 */
class TournamentAdvancementService
{
    public function __construct(
        private EntityManagerInterface $em,
        private TournamentMatchGameService $matchGameService,
    ) {
    }

    /**
     * Check if the given tournament match has a winner and advance them.
     *
     * @return TournamentMatch|null The next match that was updated, or null
     */
    public function advanceWinner(TournamentMatch $match): ?TournamentMatch
    {
        $nextMatch = $match->getNextMatch();
        if (!$nextMatch) {
            // This is the final — no advancement needed
            return null;
        }

        $winner = $this->determineWinner($match);
        if (!$winner) {
            return null;
        }

        // Find all matches that feed into the same next match, ordered by slot
        $previousMatches = $this->em->getRepository(TournamentMatch::class)
            ->findBy(['nextMatch' => $nextMatch], ['slot' => 'ASC']);

        if (count($previousMatches) >= 2) {
            // Convention from TournamentPlanGenerator:
            // prevA (lower slot, index i*2) → winner becomes homeTeam of nextMatch
            // prevB (higher slot, index i*2+1) → winner becomes awayTeam of nextMatch
            if ($previousMatches[0]->getId() === $match->getId()) {
                $nextMatch->setHomeTeam($winner);
            } else {
                $nextMatch->setAwayTeam($winner);
            }
        } else {
            // Only one feeder match (unusual, e.g. bye) — fill homeTeam
            $nextMatch->setHomeTeam($winner);
        }

        // Mark the current match as finished
        $match->setStatus('finished');
        $this->em->persist($match);

        $this->em->persist($nextMatch);
        $this->em->flush();

        // If both teams are now set and no game exists yet, create one
        if ($nextMatch->getHomeTeam() && $nextMatch->getAwayTeam() && !$nextMatch->getGame()) {
            $this->matchGameService->createGameForMatch($nextMatch, $nextMatch->getScheduledAt());
        }

        return $nextMatch;
    }

    /**
     * Determine the winner of a finished tournament match by comparing scores.
     */
    public function determineWinner(TournamentMatch $match): ?Team
    {
        $game = $match->getGame();
        if (!$game || !$game->isFinished()) {
            return null;
        }

        $homeTeam = $game->getHomeTeam();
        $awayTeam = $game->getAwayTeam();
        if (!$homeTeam || !$awayTeam) {
            return null;
        }

        [$homeScore, $awayScore] = $this->calculateScores($game);

        if ($homeScore > $awayScore) {
            return $homeTeam;
        }

        if ($awayScore > $homeScore) {
            return $awayTeam;
        }

        // Tie — no clear winner in regulation. Cannot advance.
        return null;
    }

    /**
     * Calculate home and away scores from GameEvents.
     *
     * @return array{int, int} [homeScore, awayScore]
     */
    private function calculateScores(Game $game): array
    {
        // Codes that must NOT be counted even though they contain 'goal'
        $nonGoalCodes = ['offside_goal', 'var_goal_denied', 'own_goal_attempt'];

        $homeScore = 0;
        $awayScore = 0;

        foreach ($game->getGameEvents() as $event) {
            $eventType = $event->getGameEventType();
            if (null === $eventType) {
                continue;
            }

            $code = $eventType->getCode();
            $eventTeam = $event->getTeam();

            if ('own_goal' === $code) {
                if ($eventTeam === $game->getHomeTeam()) {
                    ++$awayScore;
                } elseif ($eventTeam === $game->getAwayTeam()) {
                    ++$homeScore;
                }
            } elseif (!in_array($code, $nonGoalCodes, true) && str_contains($code, 'goal')) {
                if ($eventTeam === $game->getHomeTeam()) {
                    ++$homeScore;
                } elseif ($eventTeam === $game->getAwayTeam()) {
                    ++$awayScore;
                }
            }
        }

        return [$homeScore, $awayScore];
    }
}
