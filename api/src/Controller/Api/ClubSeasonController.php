<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Team;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use App\Service\GoalCountingService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Provides a club-wide season overview:
 *  - All teams of the user's club with form streak and season stats
 *  - Top-scorer list across all club teams for the selected season
 *
 * GET /api/club/season-overview?season=YYYY&clubId=X
 */
#[Route('/api/club', name: 'api_club_')]
class ClubSeasonController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
        private readonly GoalCountingService $goalCountingService,
    ) {
    }

    #[Route('/season-overview', name: 'season_overview', methods: ['GET'])]
    public function seasonOverview(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if (null === $user) {
            return $this->json(['error' => 'Nicht authentifiziert.'], 401);
        }

        // Resolve requested season year (e.g. 2025 → 2025-07-01 to 2026-06-30)
        $seasonYear = $this->resolveSeasonYear($request);
        [$seasonStart, $seasonEnd] = $this->seasonBounds($seasonYear);
        $seasonLabel = sprintf('%d/%d', $seasonYear, $seasonYear + 1);

        // Determine available seasons (last 5 years + current)
        $availableSeasons = $this->buildAvailableSeasons();

        // Resolve the club: either via explicit clubId param or inferred from user's teams
        $club = $this->resolveClub($request, $user);

        if (null === $club) {
            return $this->json([
                'club' => null,
                'season' => $seasonLabel,
                'seasonYear' => $seasonYear,
                'availableSeasons' => $availableSeasons,
                'teams' => [],
                'topScorers' => [],
            ]);
        }

        // Collect all teams belonging to the club
        $teams = $club->getTeams()->toArray();

        // Build per-team stats and form
        $teamsData = [];
        foreach ($teams as $team) {
            $teamsData[] = $this->buildTeamData($team, $seasonStart, $seasonEnd);
        }

        // Sort teams by name for consistent ordering
        usort($teamsData, fn ($a, $b) => strcmp((string) $a['name'], (string) $b['name']));

        // Top scorers across all club teams in the season
        $topScorers = $this->buildTopScorers($teams, $seasonStart, $seasonEnd);

        return $this->json([
            'club' => [
                'id' => $club->getId(),
                'name' => $club->getName(),
                'shortName' => $club->getShortName(),
                'logoUrl' => $club->getLogoUrl(),
            ],
            'season' => $seasonLabel,
            'seasonYear' => $seasonYear,
            'availableSeasons' => $availableSeasons,
            'teams' => $teamsData,
            'topScorers' => $topScorers,
        ]);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function resolveSeasonYear(Request $request): int
    {
        $param = $request->query->get('season');
        if (null !== $param && ctype_digit((string) $param)) {
            return (int) $param;
        }

        $now = new DateTime();
        $month = (int) $now->format('m');
        $year = (int) $now->format('Y');

        return $month >= 7 ? $year : $year - 1;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function seasonBounds(int $year): array
    {
        return [
            sprintf('%d-07-01 00:00:00', $year),
            sprintf('%d-06-30 23:59:59', $year + 1),
        ];
    }

    /**
     * @return int[]
     */
    private function buildAvailableSeasons(): array
    {
        $now = new DateTime();
        $currentYear = (int) $now->format('m') >= 7
            ? (int) $now->format('Y')
            : (int) $now->format('Y') - 1;

        $seasons = [];
        for ($i = 0; $i < 5; ++$i) {
            $seasons[] = $currentYear - $i;
        }

        return $seasons;
    }

    private function resolveClub(Request $request, User $user): ?Club
    {
        // Explicit clubId takes priority (e.g. for admins browsing other clubs)
        $clubIdParam = $request->query->get('clubId');
        if (null !== $clubIdParam && ctype_digit((string) $clubIdParam)) {
            return $this->entityManager->getRepository(Club::class)->find((int) $clubIdParam);
        }

        // Infer from user's team memberships
        $userTeams = array_merge(
            $this->coachTeamPlayerService->collectPlayerTeams($user),
            $this->coachTeamPlayerService->collectCoachTeams($user),
        );

        foreach ($userTeams as $team) {
            $clubs = $team->getClubs();
            if (!$clubs->isEmpty()) {
                return $clubs->first();
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildTeamData(Team $team, string $seasonStart, string $seasonEnd): array
    {
        // Load all finished games for this team in the season.
        // Eagerly join homeTeam/awayTeam so that identity-map === comparisons work.
        $qb = $this->entityManager->getRepository(Game::class)->createQueryBuilder('g')
            ->leftJoin('g.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at')
            ->addSelect('ce', 'cet', 'ht', 'at')
            ->where('(g.homeTeam = :team OR g.awayTeam = :team)')
            ->andWhere('g.isFinished = :finished')
            ->andWhere('cet.name = :eventType')
            ->andWhere('ce.startDate >= :start AND ce.startDate <= :end')
            ->setParameter('team', $team)
            ->setParameter('finished', true)
            ->setParameter('eventType', 'Spiel')
            ->setParameter('start', $seasonStart)
            ->setParameter('end', $seasonEnd)
            ->orderBy('ce.startDate', 'ASC');

        /** @var Game[] $finishedGames */
        $finishedGames = $qb->getQuery()->getResult();

        if ([] === $finishedGames) {
            $finishedGameIds = [];
            $eventsByGame = [];
        } else {
            $finishedGameIds = array_map(fn (Game $g) => $g->getId(), $finishedGames);

            // Fetch all events for these games in one query, eagerly loading teams and types.
            // Using a direct query rather than the in-memory collection avoids stale
            // ArrayCollection instances that may exist when entities were persisted in the
            // same request cycle (e.g. in feature tests or bulk-import scenarios).
            /** @var GameEvent[] $allEvents */
            $allEvents = $this->entityManager->getRepository(GameEvent::class)
                ->createQueryBuilder('ge')
                ->leftJoin('ge.gameEventType', 'get')
                ->leftJoin('ge.team', 'geteam')
                ->addSelect('get', 'geteam')
                ->where('ge.game IN (:gameIds)')
                ->setParameter('gameIds', $finishedGameIds)
                ->getQuery()
                ->getResult();

            $eventsByGame = [];
            foreach ($allEvents as $event) {
                $eventsByGame[$event->getGame()->getId()][] = $event;
            }
        }

        $won = 0;
        $drawn = 0;
        $lost = 0;
        $goalsFor = 0;
        $goalsAgainst = 0;
        $formEntries = [];

        foreach ($finishedGames as $game) {
            $gameEvents = $eventsByGame[$game->getId()] ?? [];
            $scores = $this->goalCountingService->collectScores($gameEvents, $game);

            $isHome = $game->getHomeTeam() === $team;
            $scored = $isHome ? $scores['home'] : $scores['away'];
            $conceded = $isHome ? $scores['away'] : $scores['home'];

            $goalsFor += $scored;
            $goalsAgainst += $conceded;

            if ($scored > $conceded) {
                ++$won;
                $formEntries[] = 'W';
            } elseif ($scored === $conceded) {
                ++$drawn;
                $formEntries[] = 'D';
            } else {
                ++$lost;
                $formEntries[] = 'L';
            }
        }

        $played = $won + $drawn + $lost;
        $form = array_slice(array_reverse($formEntries), 0, 5);

        // Next upcoming game for this team
        $nextGame = $this->findNextGame($team);

        return [
            'id' => $team->getId(),
            'name' => $team->getName(),
            'ageGroup' => [
                'id' => $team->getAgeGroup()->getId(),
                'name' => $team->getAgeGroup()->getName(),
            ],
            'league' => $team->getLeague() ? [
                'id' => $team->getLeague()->getId(),
                'name' => $team->getLeague()->getName(),
            ] : null,
            'stats' => [
                'played' => $played,
                'won' => $won,
                'drawn' => $drawn,
                'lost' => $lost,
                'goalsFor' => $goalsFor,
                'goalsAgainst' => $goalsAgainst,
                'goalDifference' => $goalsFor - $goalsAgainst,
                'points' => ($won * 3) + $drawn,
            ],
            'form' => $form,
            'nextGame' => $nextGame,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findNextGame(Team $team): ?array
    {
        $now = new DateTime();

        $qb = $this->entityManager->getRepository(Game::class)->createQueryBuilder('g')
            ->leftJoin('g.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at')
            ->addSelect('ce', 'cet', 'ht', 'at')
            ->where('(g.homeTeam = :team OR g.awayTeam = :team)')
            ->andWhere('g.isFinished = :finished')
            ->andWhere('cet.name = :eventType')
            ->andWhere('ce.startDate > :now')
            ->setParameter('team', $team)
            ->setParameter('finished', false)
            ->setParameter('eventType', 'Spiel')
            ->setParameter('now', $now)
            ->orderBy('ce.startDate', 'ASC')
            ->setMaxResults(1);

        /** @var Game|null $game */
        $game = $qb->getQuery()->getOneOrNullResult();

        if (null === $game) {
            return null;
        }

        $ce = $game->getCalendarEvent();

        return [
            'id' => $game->getId(),
            'date' => $ce?->getStartDate()?->format('c'),
            'homeTeam' => $game->getHomeTeam() ? [
                'id' => $game->getHomeTeam()->getId(),
                'name' => $game->getHomeTeam()->getName(),
            ] : null,
            'awayTeam' => $game->getAwayTeam() ? [
                'id' => $game->getAwayTeam()->getId(),
                'name' => $game->getAwayTeam()->getName(),
            ] : null,
            'location' => $ce?->getLocation() ? [
                'id' => $ce->getLocation()->getId(),
                'name' => $ce->getLocation()->getName(),
                'address' => $ce->getLocation()->getAddress(),
            ] : null,
        ];
    }

    /**
     * @param Team[] $teams
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildTopScorers(array $teams, string $seasonStart, string $seasonEnd): array
    {
        if ([] === $teams) {
            return [];
        }

        $teamIds = array_filter(array_map(fn (Team $t) => $t->getId(), $teams));
        if ([] === $teamIds) {
            return [];
        }

        [$goalDql, $goalParams] = $this->goalCountingService->getScorerGoalDqlCondition('gt.code');

        $qb = $this->entityManager->getRepository('App\\Entity\\GameEvent')->createQueryBuilder('ge')
            ->select('p.id AS playerId', 'p.firstName', 'p.lastName', 'COUNT(ge.id) AS goals', 'team.id AS teamId', 'team.name AS teamName')
            ->leftJoin('ge.player', 'p')
            ->leftJoin('ge.game', 'game')
            ->leftJoin('game.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('ge.team', 'team')
            ->leftJoin('ge.gameEventType', 'gt')
            ->where($goalDql)
            ->andWhere('cet.name = :eventTypeName')
            ->andWhere('team.id IN (:teamIds)')
            ->andWhere('ce.startDate >= :start AND ce.startDate <= :end')
            ->setParameter('eventTypeName', 'Spiel')
            ->setParameter('teamIds', $teamIds)
            ->setParameter('start', $seasonStart)
            ->setParameter('end', $seasonEnd)
            ->groupBy('p.id', 'team.id')
            ->orderBy('goals', 'DESC')
            ->setMaxResults(10);

        foreach ($goalParams as $key => $value) {
            $qb->setParameter($key, $value);
        }

        $rows = $qb->getQuery()->getResult();

        $result = [];
        foreach ($rows as $row) {
            $result[] = [
                'playerId' => $row['playerId'],
                'firstName' => $row['firstName'],
                'lastName' => $row['lastName'],
                'goals' => (int) $row['goals'],
                'teamId' => $row['teamId'],
                'teamName' => $row['teamName'],
            ];
        }

        return $result;
    }
}
