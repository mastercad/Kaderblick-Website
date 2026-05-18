<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Cup;
use App\Entity\Game;
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
        $season ??= $this->retrieveCurrentSeason();

        [$startYear, $endYear] = explode('/', $season);

        // Nur Ligen holen, die tatsächlich in Spielen der aktuellen Saison vorkommen
        // IDENTITY() verwenden, da SELECT l FROM Game g in DQL ungültig ist (Game ist Root, nicht League)
        $rows = $this->entityManager->createQueryBuilder()
            ->select('IDENTITY(g.league) as leagueId')
            ->from(Game::class, 'g')
            ->join('g.calendarEvent', 'ce')
            ->join('ce.calendarEventType', 'cet')
            ->where('g.league IS NOT NULL')
            ->andWhere('cet.name = :eventTypeName')
            ->andWhere('ce.startDate >= :startDate AND ce.startDate <= :endDate')
            ->setParameter('eventTypeName', 'Spiel')
            ->setParameter('startDate', sprintf('%d-07-01 00:00:00', (int) $startYear))
            ->setParameter('endDate', sprintf('%d-06-30 23:59:59', (int) $endYear))
            ->groupBy('g.league')
            ->getQuery()
            ->getScalarResult();
        $leagues = $this->entityManager->getRepository(League::class)->findBy(['id' => array_column($rows, 'leagueId')]);
        $awarded = [];

        // Alle bisherigen top_scorer/league-Titel dieser Saison deaktivieren –
        // auch Ligen, die in dieser Saison keine Spiele mehr haben, verlieren ihre alten Titel.
        $this->playerTitleRepository->deactivateAllTitlesForScopeAndSeason('top_scorer', 'league', $season);

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
            $this->playerTitleRepository->deactivateAllTitlesForCategoryAndScope('top_scorer', 'league', null, $season, $league->getId());

            // Titel vergeben
            $awarded = array_merge($awarded, $this->awardTitlesPerPlayerFromArray($playerGoals, 'top_scorer', 'league', null, $season, $league));
        }

        return $awarded;
    }

    /**
     * Vergibt Titel pro Player (nicht pro User) und behandelt Gleichstände korrekt, aus Array mit Player-Objekten.
     *
     * @return PlayerTitle[]
     */
    /**
     * Calculate and award top scorer titles per cup.
     *
     * @return array<string, mixed>
     */
    public function calculateCupTopScorers(Cup $cup, ?string $season = null): array
    {
        $season ??= $this->retrieveCurrentSeason();

        $gameEvents = $this->debugGoalsForSeason($season, null, null, $cup);
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

        $this->playerTitleRepository->deactivateAllTitlesForCategoryAndScope('top_scorer', 'cup', null, $season, null, $cup->getId());

        return $this->awardTitlesPerPlayerFromArray($playerGoals, 'top_scorer', 'cup', null, $season, null, $cup);
    }

    /**
     * Calculate and award top scorer titles for all cups.
     *
     * @return array<string, mixed>
     */
    public function calculateAllCupTopScorers(?string $season = null): array
    {
        $season ??= $this->retrieveCurrentSeason();

        [$startYear, $endYear] = explode('/', $season);

        // IDENTITY() verwenden, da SELECT c FROM Game g in DQL ungültig ist (Game ist Root, nicht Cup)
        $rows = $this->entityManager->createQueryBuilder()
            ->select('IDENTITY(g.cup) as cupId')
            ->from(Game::class, 'g')
            ->join('g.calendarEvent', 'ce')
            ->join('ce.calendarEventType', 'cet')
            ->where('g.cup IS NOT NULL')
            ->andWhere('cet.name = :eventTypeName')
            ->andWhere('ce.startDate >= :startDate AND ce.startDate <= :endDate')
            ->setParameter('eventTypeName', 'Spiel')
            ->setParameter('startDate', sprintf('%d-07-01 00:00:00', (int) $startYear))
            ->setParameter('endDate', sprintf('%d-06-30 23:59:59', (int) $endYear))
            ->groupBy('g.cup')
            ->getQuery()
            ->getScalarResult();
        $cups = $this->entityManager->getRepository(Cup::class)->findBy(['id' => array_column($rows, 'cupId')]);

        // Alle bisherigen top_scorer/cup-Titel dieser Saison deaktivieren –
        // auch Cups ohne Spiele in dieser Saison verlieren ihre alten Titel.
        $this->playerTitleRepository->deactivateAllTitlesForScopeAndSeason('top_scorer', 'cup', $season);

        $awarded = [];
        foreach ($cups as $cup) {
            $awarded = array_merge($awarded, $this->calculateCupTopScorers($cup, $season));
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
        ?Cup $cup = null,
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
                    $criteria['league'] = $league?->getId();
                }
                if ('cup' === $titleScope) {
                    $criteria['cup'] = $cup?->getId();
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
                    $title->setTeam(null);
                    $title->setLeague($league);
                    $title->setCup(null);
                } elseif ('cup' === $titleScope) {
                    $title->setTeam(null);
                    $title->setLeague(null);
                    $title->setCup($cup);
                } else {
                    $title->setTeam($team);
                    $title->setLeague(null);
                    $title->setCup(null);
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
    public function debugGoalsForSeason(?string $season = null, ?Team $team = null, ?League $league = null, ?Cup $cup = null): array
    {
        [$goalDql, $goalParams] = $this->goalCountingService->getScorerGoalDqlCondition('gt.code');

        $qb = $this->entityManager->getRepository('App\\Entity\\GameEvent')->createQueryBuilder('ge')
            ->select('ge', 'player', 'game', 'ce', 'cet', 'team', 'gt', 'l', 'c')
            ->leftJoin('ge.player', 'player')
            ->leftJoin('ge.game', 'game')
            ->leftJoin('game.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('ge.team', 'team')
            ->leftJoin('ge.gameEventType', 'gt')
            ->leftJoin('game.league', 'l')
            ->leftJoin('game.cup', 'c')
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
        if ($cup) {
            $qb->andWhere('c.id = :cupId')->setParameter('cupId', $cup->getId());
        }

        $qb->orderBy('ce.startDate', 'ASC');

        return $qb->getQuery()->getResult();
    }
}
