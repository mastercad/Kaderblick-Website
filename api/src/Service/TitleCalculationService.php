<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\GameEvent;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\PlayerTitle;
use App\Entity\Team;
use App\Repository\PlayerTitleRepository;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

class TitleCalculationService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private PlayerTitleRepository $playerTitleRepository,
        private GoalCountingService $goalCountingService,
    ) {
    }

    /**
     * Calculate and award top scorer titles platform-wide.
     *
     * @return array<string, mixed>
     */
    public function calculatePlatformTopScorers(?string $season = null): array
    {
        $goals = $this->debugGoalsForSeason($season);
        $playerGoals = [];
        foreach ($goals as $goal) {
            $player = $goal->getPlayer();
            if (!$player) {
                continue;
            }
            $pid = $player->getId();
            if (!isset($playerGoals[$pid])) {
                $playerGoals[$pid] = [
                    'player' => $player,
                    'goal_count' => 0
                ];
            }
            ++$playerGoals[$pid]['goal_count'];
        }
        // Sort by goal_count DESC, then by player name ASC for tie-breaker
        usort($playerGoals, function ($a, $b) {
            if ($b['goal_count'] === $a['goal_count']) {
                return strcmp($a['player']->getLastName(), $b['player']->getLastName());
            }

            return $b['goal_count'] <=> $a['goal_count'];
        });

        // Vor Vergabe: alle alten Titel für diese Saison/Kategorie/Scope deaktivieren
        $this->playerTitleRepository->deactivateAllTitlesForCategoryAndScope('top_scorer', 'platform', null, $season);

        return $this->awardTitlesPerPlayerFromArray($playerGoals, 'top_scorer', 'platform', null, $season);
    }

    /**
     * Calculate and award top scorer titles per team.
     *
     * @return array<string, mixed>
     */
    public function calculateTeamTopScorers(Team $team, ?string $season = null): array
    {
        $goals = $this->debugGoalsForSeason($season, $team);
        $playerGoals = [];
        foreach ($goals as $goal) {
            $player = $goal->getPlayer();
            if (!$player) {
                continue;
            }
            $pid = $player->getId();
            if (!isset($playerGoals[$pid])) {
                $playerGoals[$pid] = [
                    'player' => $player,
                    'goal_count' => 0
                ];
            }
            ++$playerGoals[$pid]['goal_count'];
        }
        usort($playerGoals, function ($a, $b) {
            if ($b['goal_count'] === $a['goal_count']) {
                return strcmp($a['player']->getLastName(), $b['player']->getLastName());
            }

            return $b['goal_count'] <=> $a['goal_count'];
        });

        // Vor Vergabe: alle alten Titel für diese Saison/Kategorie/Scope/Team deaktivieren
        $this->playerTitleRepository->deactivateAllTitlesForCategoryAndScope('top_scorer', 'team', $team->getId(), $season);

        return $this->awardTitlesPerPlayerFromArray($playerGoals, 'top_scorer', 'team', $team, $season);
    }

    /**
     * Calculate and award top scorer titles per league (GameType).
     *
     * @return array<string, mixed>
     */
    public function calculateLeagueTopScorers(?string $season = null): array
    {
        // Alle relevanten Ligen (Leagues) holen
        $leagues = $this->entityManager->getRepository(League::class)->findAll();
        $awarded = [];

        foreach ($leagues as $league) {
            // Alle Tore für diese Liga und Saison holen
            $gameEvents = $this->debugGoalsForSeason($season, null, $league);
            $playerGoals = [];
            /** @var GameEvent $gameEvent */
            foreach ($gameEvents as $gameEvent) {
                $player = $gameEvent->getPlayer();
                if (!$player) {
                    continue;
                }
                $pid = $player->getId();
                if (!isset($playerGoals[$pid])) {
                    $playerGoals[$pid] = [
                        'player' => $player,
                        'goal_count' => 0
                    ];
                }
                ++$playerGoals[$pid]['goal_count'];
            }

            usort($playerGoals, function ($a, $b) {
                if ($b['goal_count'] === $a['goal_count']) {
                    return strcmp($a['player']->getLastName(), $b['player']->getLastName());
                }

                return $b['goal_count'] <=> $a['goal_count'];
            });

            // Vor Vergabe: alle alten Titel für diese Saison/Kategorie/Scope/Liga deaktivieren
            $this->playerTitleRepository->deactivateAllTitlesForCategoryAndScope('top_scorer', 'league', $league->getId(), $season);

            // Titel vergeben
            $awarded = array_merge($awarded, $this->awardTitlesPerPlayerFromArray($playerGoals, 'top_scorer', 'league', null, $season, $league));
        }

        return $awarded;
    }

    /**
     * Vergibt Titel pro Player (nicht pro User) und behandelt Gleichstände korrekt, aus Array mit Player-Objekten.
     *
     * @param array<int, array<string, mixed>> $playerGoals Array mit ['player' => Player, 'goal_count' => int]
     *
     * @return PlayerTitle[]
     */
    private function awardTitlesPerPlayerFromArray(
        array $playerGoals,
        string $titleCategory,
        string $titleScope,
        ?Team $team = null,
        ?string $season = null,
        ?League $league = null,
        bool $useOlympicRanking = false
    ): array {
        $ranks = ['gold', 'silver', 'bronze'];
        $awarded = [];

        // Group players by their goal count so that players with the same
        // number of goals receive the same rank.
        $groups = [];
        foreach ($playerGoals as $row) {
            $value = (int) ($row['goal_count'] ?? 0);
            if (0 === $value) {
                continue;
            }
            $groups[$value][] = $row['player'];
        }

        if (empty($groups)) {
            return $awarded;
        }

        // Sort groups by goal count descending (highest goals first)
        krsort($groups, SORT_NUMERIC);

        $rankIndex = 0;
        foreach ($groups as $goalCount => $players) {
            if ($rankIndex > 2) {
                break;
            }
            $rank = $ranks[$rankIndex];

            foreach ($players as $player) {
                // Eindeutigkeitsprüfung: league immer als Kriterium, wenn scope=league
                $criteria = [
                    'player' => $player,
                    'titleCategory' => $titleCategory,
                    'titleScope' => $titleScope,
                    'titleRank' => $rank,
                    'team' => $team,
                    'season' => $season,
                    'isActive' => true,
                ];
                if ('league' === $titleScope) {
                    $criteria['league'] = $league?->getId(); // auch wenn $league null ist, wird league explizit gesetzt
                }
                $existing = $this->entityManager->getRepository(PlayerTitle::class)->findOneBy($criteria);
                if ($existing) {
                    $awarded[] = $existing;
                    continue;
                }

                $title = new PlayerTitle();
                $title->setPlayer($player);
                $title->setTitleCategory($titleCategory);
                $title->setTitleScope($titleScope);
                $title->setTitleRank($rank);

                if ('league' === $titleScope) {
                    $title->setTeam(null); // team bleibt null
                    $title->setLeague($league); // league korrekt setzen (auch null möglich)
                } else {
                    $title->setTeam($team);
                    $title->setLeague(null);
                }

                $title->setValue($goalCount);
                $title->setIsActive(true);
                $title->setAwardedAt(new DateTimeImmutable());
                $title->setSeason($season);

                $this->entityManager->persist($title);
                $awarded[] = $title;
            }

            // Move to next rank for the next distinct goal count.
            // If Olympic ranking is requested, skip ranks according to the
            // number of players that shared the current rank (standard
            // competition / Olympic ranking). Otherwise use dense ranking
            // (next distinct group always moves to the next ordinal rank).
            if ($useOlympicRanking) {
                $rankIndex += count($players);
            } else {
                ++$rankIndex;
            }
        }
        $this->entityManager->flush();

        return $awarded;
    }

    /**
     * Calculate and award titles for all teams.
     *
     * @return array<string, mixed>
     */
    public function calculateAllTeamTopScorers(?string $season = null): array
    {
        $teams = $this->entityManager->getRepository(Team::class)->findAll();
        $awarded = [];

        foreach ($teams as $team) {
            $teamAwarded = $this->calculateTeamTopScorers($team, $season);
            $awarded = array_merge($awarded, $teamAwarded);
        }

        return $awarded;
    }

    /**
     * Get current season string (e.g., '2024/2025').
     */
    public function retrieveCurrentSeason(): string
    {
        $now = new DateTime();
        $year = (int) $now->format('Y');
        $month = (int) $now->format('m');

        // Season starts in July
        if ($month >= 7) {
            return sprintf('%d/%d', $year, $year + 1);
        }

        return sprintf('%d/%d', $year - 1, $year);
    }

    /**
     * Debug-Ausgabe: Zeigt alle gezählten Tore (GameEvents mit code 'goal') für Spiele (CalendarEvents mit Typ 'Spiel') in der Saison, optional für Team und Liga (GameType).
     *
     * @return GameEvent[]
     */
    public function debugGoalsForSeason(?string $season = null, ?Team $team = null, ?League $league = null): array
    {
        [$goalDql, $goalParams] = $this->goalCountingService->getScorerGoalDqlCondition('gt.code');

        $qb = $this->entityManager->getRepository('App\\Entity\\GameEvent')->createQueryBuilder('ge')
            ->select('ge', 'player', 'game', 'ce', 'cet', 'team', 'gt', 'l')
            ->leftJoin('ge.player', 'player')
            ->leftJoin('ge.game', 'game')
            ->leftJoin('game.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('ge.team', 'team')
            ->leftJoin('ge.gameEventType', 'gt')
            ->leftJoin('game.league', 'l')
            ->where($goalDql)
            ->andWhere('cet.name = :eventTypeName')
            ->setParameter('eventTypeName', 'Spiel');

        foreach ($goalParams as $key => $value) {
            $qb->setParameter($key, $value);
        }

        if ($season) {
            [$startYear, $endYear] = explode('/', $season);
            $startDate = sprintf('%d-07-01 00:00:00', (int) $startYear);
            $endDate = sprintf('%d-06-30 23:59:59', (int) $endYear);
            $qb->andWhere('ce.startDate >= :startDate AND ce.startDate <= :endDate')
                ->setParameter('startDate', $startDate)
                ->setParameter('endDate', $endDate);
        }
        if ($team) {
            $qb->andWhere('team.id = :teamId')->setParameter('teamId', $team->getId());
        }
        if ($league) {
            $qb->andWhere('l.id = :leagueId')->setParameter('leagueId', $league->getId());
        }

        $qb->orderBy('ce.startDate', 'ASC');

        return $qb->getQuery()->getResult();
    }
}
