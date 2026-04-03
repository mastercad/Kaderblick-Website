<?php

namespace App\Controller\Api;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\SubstitutionReason;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\User;
use App\Repository\CameraRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameRepository;
use App\Repository\ParticipationRepository;
use App\Repository\PlayerRepository;
use App\Repository\SubstitutionReasonRepository;
use App\Repository\TeamRepository;
use App\Security\Voter\GameEventVoter;
use App\Security\Voter\GameVoter;
use App\Security\Voter\MatchPlanVoter;
use App\Security\Voter\VideoVoter;
use App\Service\CoachTeamPlayerService;
use App\Service\TournamentAdvancementService;
use App\Service\UserTitleService;
use App\Service\VideoTimelineService;
use DateTime;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/api/games', name: 'api_games_')]
class GamesController extends ApiController
{
    private EntityManagerInterface $entityManager;
    protected string $entityName = 'Game';
    protected string $entityNamePlural = 'Games';
    protected string $entityClass = Game::class;
    protected array $relations = [
        'homeTeam' => [
            'entityName' => 'Team',
            'fieldName' => 'homeTeam',
            'methodName' => 'homeTeam',
            'type' => 2
        ],
        'awayTeam' => [
            'entityName' => 'Team',
            'fieldName' => 'awayTeam',
            'methodName' => 'awayTeam',
            'type' => 2
        ],
        'location' => [
            'entityName' => 'Location',
            'type' => 2,
        ],
        'gameType' => [
            'entityName' => 'GameType',
            'type' => 2
        ],
        'gameEvents' => [
            'entityName' => 'GameEvent',
            'type' => 4,
            'label_fields' => ['gameEventType.name']
        ],
        'substitutions' => [
            'entityName' => 'Substitution',
            'type' => 4
        ],
        'calendarEvents' => [
            'entityName' => 'CalendarEvent',
            'type' => 1,
        ]
    ];
    protected array $relationEntries = [];
    protected string $urlPart = 'games';
    protected bool $createAndEditAllowed = false;

    public function __construct(
        EntityManagerInterface $entityManager,
        private readonly VideoTimelineService $videoTimelineService,
        private readonly TournamentAdvancementService $advancementService,
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
    ) {
        $this->entityManager = $entityManager;
    }

    /**
     * Mark a game as finished. If the game belongs to a tournament match,
     * automatically advance the winner to the next round.
     */
    #[Route('/{id}/finish', name: 'finish', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function finish(Game $game): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        if ($game->isFinished()) {
            return $this->json(['error' => 'Spiel ist bereits beendet.'], 400);
        }

        $game->setIsFinished(true);
        $this->entityManager->persist($game);
        $this->entityManager->flush();

        $advanced = null;
        $tournamentMatch = $game->getTournamentMatch();
        if ($tournamentMatch) {
            $tournamentMatch->setStatus('finished');
            $this->entityManager->persist($tournamentMatch);
            $this->entityManager->flush();

            $nextMatch = $this->advancementService->advanceWinner($tournamentMatch);
            if ($nextMatch) {
                $advanced = [
                    'nextMatchId' => $nextMatch->getId(),
                    'round' => $nextMatch->getRound(),
                    'slot' => $nextMatch->getSlot(),
                    'homeTeam' => $nextMatch->getHomeTeam()?->getName(),
                    'awayTeam' => $nextMatch->getAwayTeam()?->getName(),
                    'gameCreated' => null !== $nextMatch->getGame(),
                ];
            }
        }

        return $this->json([
            'success' => true,
            'isFinished' => true,
            'advanced' => $advanced,
        ]);
    }

    /**
     * Update timing fields for a game (halfDuration, halftimeBreakDuration, firstHalfExtraTime, secondHalfExtraTime).
     */
    #[Route('/{id}/timing', name: 'timing', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    public function timing(Game $game, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['halfDuration'])) {
            $half = (int) $data['halfDuration'];
            if ($half < 1 || $half > 90) {
                return $this->json(['error' => 'halfDuration muss zwischen 1 und 90 Minuten liegen.'], 400);
            }
            $game->setHalfDuration($half);
        }

        if (array_key_exists('halftimeBreakDuration', $data)) {
            $break = (int) $data['halftimeBreakDuration'];
            if ($break < 0 || $break > 60) {
                return $this->json(['error' => 'halftimeBreakDuration muss zwischen 0 und 60 Minuten liegen.'], 400);
            }
            $game->setHalftimeBreakDuration($break);
        }

        if (array_key_exists('firstHalfExtraTime', $data)) {
            $extra = null !== $data['firstHalfExtraTime'] ? (int) $data['firstHalfExtraTime'] : null;
            $game->setFirstHalfExtraTime($extra);
        }

        if (array_key_exists('secondHalfExtraTime', $data)) {
            $extra = null !== $data['secondHalfExtraTime'] ? (int) $data['secondHalfExtraTime'] : null;
            $game->setSecondHalfExtraTime($extra);
        }

        $this->entityManager->persist($game);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'halfDuration' => $game->getHalfDuration(),
            'halftimeBreakDuration' => $game->getHalftimeBreakDuration(),
            'firstHalfExtraTime' => $game->getFirstHalfExtraTime(),
            'secondHalfExtraTime' => $game->getSecondHalfExtraTime(),
        ]);
    }

    #[Route('/{id}/match-plan', name: 'match_plan_save', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    public function saveMatchPlan(Game $game, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted(MatchPlanVoter::MANAGE, $game);

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Matchplan-Daten.'], 400);
        }

        $game->setMatchPlan($data);
        $this->entityManager->persist($game);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'matchPlan' => $game->getMatchPlan(),
        ]);
    }

    #[Route('/{id}/match-plan/confirm-substitution', name: 'match_plan_confirm_substitution', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function confirmPlannedSubstitution(
        Game $game,
        Request $request,
        PlayerRepository $playerRepository,
        SubstitutionReasonRepository $substitutionReasonRepository,
        GameEventRepository $gameEventRepository,
    ): JsonResponse {
        $this->denyAccessUnlessGranted(MatchPlanVoter::MANAGE, $game);

        $payload = json_decode($request->getContent(), true) ?? [];
        $phaseId = isset($payload['phaseId']) ? (string) $payload['phaseId'] : '';
        if ('' === $phaseId) {
            return $this->json(['error' => 'phaseId fehlt.'], 400);
        }

        $matchPlan = $game->getMatchPlan();
        if (!is_array($matchPlan) || !isset($matchPlan['phases']) || !is_array($matchPlan['phases'])) {
            return $this->json(['error' => 'Für dieses Spiel ist kein Matchplan vorhanden.'], 400);
        }

        $phaseIndex = null;
        $phase = null;
        foreach ($matchPlan['phases'] as $index => $candidate) {
            if (is_array($candidate) && (string) ($candidate['id'] ?? '') === $phaseId) {
                $phaseIndex = $index;
                $phase = $candidate;
                break;
            }
        }

        if (null === $phaseIndex || !is_array($phase)) {
            return $this->json(['error' => 'Geplante Phase wurde nicht gefunden.'], 404);
        }

        if (($phase['sourceType'] ?? null) !== 'substitution') {
            return $this->json(['error' => 'Nur Wechsel-Phasen können bestätigt werden.'], 400);
        }

        if (!empty($phase['confirmedEventId'])) {
            $existingEvent = $gameEventRepository->find((int) $phase['confirmedEventId']);

            return $this->json([
                'success' => true,
                'eventId' => $existingEvent?->getId(),
                'matchPlan' => $matchPlan,
            ]);
        }

        $substitution = is_array($phase['substitution'] ?? null) ? $phase['substitution'] : null;
        if (!is_array($substitution)) {
            return $this->json(['error' => 'Der geplante Wechsel enthält keine Wechseldaten.'], 400);
        }

        $playerOutId = isset($substitution['playerOutId']) ? (int) $substitution['playerOutId'] : 0;
        $playerInId = isset($substitution['playerInId']) ? (int) $substitution['playerInId'] : 0;
        $minute = isset($phase['minute']) ? (int) $phase['minute'] : 0;

        if ($playerOutId <= 0 || $playerInId <= 0 || $minute < 0) {
            return $this->json(['error' => 'Der geplante Wechsel ist unvollständig.'], 400);
        }

        $playerOut = $playerRepository->find($playerOutId);
        $playerIn = $playerRepository->find($playerInId);
        if (!$playerOut instanceof Player || !$playerIn instanceof Player) {
            return $this->json(['error' => 'Spieler für den Wechsel konnten nicht geladen werden.'], 400);
        }

        $eventType = $this->entityManager->getRepository(GameEventType::class)->findOneBy(['code' => 'substitution']);
        if (!$eventType instanceof GameEventType) {
            return $this->json(['error' => 'Spielereignistyp substitution fehlt.'], 500);
        }

        $reason = null;
        if (!empty($substitution['reasonId'])) {
            $reason = $substitutionReasonRepository->find((int) $substitution['reasonId']);
        }

        $event = new GameEvent();
        $event
            ->setGame($game)
            ->setGameEventType($eventType)
            ->setPlayer($playerOut)
            ->setRelatedPlayer($playerIn)
            ->setSubstitutionReason($reason instanceof SubstitutionReason ? $reason : null)
            ->setDescription($this->buildSubstitutionDescription($substitution, $reason));

        $team = $this->resolvePlayerTeamForGame($playerOut, $game);
        if (!$team instanceof Team) {
            return $this->json(['error' => 'Das Team des auszuwechselnden Spielers konnte nicht bestimmt werden.'], 400);
        }

        $startDate = $game->getCalendarEvent()?->getStartDate();
        if (!$startDate instanceof DateTimeInterface) {
            return $this->json(['error' => 'Dem Spiel fehlt ein Kalenderstart.'], 400);
        }

        $event->setTeam($team);
        $eventTimestamp = (new DateTimeImmutable($startDate->format(DATE_ATOM)))->modify('+' . $minute . ' seconds');
        $event->setTimestamp($eventTimestamp);

        $this->entityManager->persist($event);
        $this->entityManager->flush();

        $matchPlan['phases'][$phaseIndex]['confirmedEventId'] = $event->getId();
        $matchPlan['phases'][$phaseIndex]['confirmedAt'] = (new DateTimeImmutable())->format(DATE_ATOM);
        $game->setMatchPlan($matchPlan);
        $this->entityManager->persist($game);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'eventId' => $event->getId(),
            'matchPlan' => $game->getMatchPlan(),
        ]);
    }

    #[Route('/{id}/details', name: 'details', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function details(
        Game $game,
        GameEventRepository $gameEventRepository,
        CameraRepository $cameraRepository,
        UserTitleService $userTitleService
    ): JsonResponse {
        if (!$this->isGranted(GameVoter::VIEW, $game)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $calendarEvent = $game->getCalendarEvent();
        $gameEvents = $gameEventRepository->findAllGameEvents($game);

        $cameras = [];
        foreach ($cameraRepository->findAll() as $camera) {
            $cameras[$camera->getId()] = $camera;
        }
        ksort($cameras);

        $scores = $this->collectScores($gameEvents, $game);
        $location = $game->getCalendarEvent()->getLocation();
        /** @var User|null $currentUser */
        $currentUser = $this->getUser();
        $matchPlan = $game->getMatchPlan();
        $canManageMatchPlan = $this->isGranted(MatchPlanVoter::MANAGE, $game);
        $canViewMatchPlan = $this->isGranted(MatchPlanVoter::VIEW, $game);
        $userTeamIds = [];
        if ($currentUser instanceof User) {
            foreach ($this->coachTeamPlayerService->collectPlayerTeams($currentUser) as $team) {
                $userTeamIds[$team->getId()] = $team->getId();
            }
            foreach ($this->coachTeamPlayerService->collectCoachTeams($currentUser) as $team) {
                $userTeamIds[$team->getId()] = $team->getId();
            }
        }

        $serializeGame = function ($game) use ($calendarEvent, $location, $matchPlan, $canManageMatchPlan, $canViewMatchPlan, $userTeamIds) {
            return [
                'id' => $game->getId(),
                'homeTeam' => $game->getHomeTeam() ? [
                    'id' => $game->getHomeTeam()->getId(),
                    'name' => $game->getHomeTeam()->getName(),
                ] : null,
                'awayTeam' => $game->getAwayTeam() ? [
                    'id' => $game->getAwayTeam()->getId(),
                    'name' => $game->getAwayTeam()->getName(),
                ] : null,
                'userTeamIds' => array_values($userTeamIds),
                'location' => $location ? [
                    'id' => $location->getId(),
                    'name' => $location->getName(),
                    'latitude' => $location->getLatitude(),
                    'longitude' => $location->getLongitude(),
                    'address' => $location->getAddress() . ', ' . $location->getCity()
                ] : null,
                'calendarEvent' => $calendarEvent ? [
                    'id' => $calendarEvent->getId(),
                    'startDate' => $calendarEvent->getStartDate()?->format('c'),
                    'endDate' => $calendarEvent->getEndDate()?->format('c'),
                    'weatherData' => $calendarEvent->getWeatherData() ? [
                        'dailyWeatherData' => $calendarEvent->getWeatherData()->getDailyWeatherData(),
                        'hourlyWeatherData' => $calendarEvent->getWeatherData()->getHourlyWeatherData(),
                    ] : [],
                ] : null,
                'fussballDeUrl' => method_exists($game, 'getFussballDeUrl') ? $game->getFussballDeUrl() : null,
                'isFinished' => $game->isFinished(),
                'tournamentId' => $game->getTournamentMatch()?->getTournament()?->getId(),
                'halfDuration' => $game->getHalfDuration(),
                'halftimeBreakDuration' => $game->getHalftimeBreakDuration(),
                'firstHalfExtraTime' => $game->getFirstHalfExtraTime(),
                'secondHalfExtraTime' => $game->getSecondHalfExtraTime(),
                'matchPlan' => $canViewMatchPlan ? $matchPlan : null,
                'permissions' => [
                    'can_create_videos' => $this->isGranted(VideoVoter::CREATE, $game->getHomeTeam()) || $this->isGranted(VideoVoter::CREATE, $game->getAwayTeam()),
                    'can_edit_videos' => $this->isGranted(VideoVoter::EDIT, $game->getHomeTeam()) || $this->isGranted(VideoVoter::EDIT, $game->getAwayTeam()),
                    'can_delete_videos' => $this->isGranted(VideoVoter::DELETE, $game->getHomeTeam()) || $this->isGranted(VideoVoter::DELETE, $game->getAwayTeam()),
                    'can_create_game_events' => $this->isGranted(GameEventVoter::CREATE, $game),
                    'can_finish_game' => $this->isGranted('ROLE_ADMIN'),
                    'can_edit_timing' => $this->isGranted('ROLE_ADMIN'),
                    'can_manage_match_plan' => $canManageMatchPlan,
                    'can_publish_match_plan' => $this->isGranted(MatchPlanVoter::PUBLISH, $game),
                    'can_view_match_plan' => $canViewMatchPlan,
                ]
            ];
        };

        $gameEvents = $gameEventRepository->findAllGameEvents($game);
        $scores = $this->collectScores($gameEvents, $game);

        // Events serialisieren (nur relevante Felder)
        $serializeEvent = function ($event) use ($userTitleService) {
            $user = $this->retrieveUserForPlayer($event->getPlayer());
            $relatedUser = null;
            $relatedUserTitleData = [];
            $titleData = [];

            if ($event->getRelatedPlayer() instanceof Player) {
                $relatedUser = $this->retrieveUserForPlayer($event->getRelatedPlayer());
                $relatedUserTitleData = $userTitleService->retrieveTitleDataForPlayer($event->getRelatedPlayer());
            }

            if ($event->getPlayer() instanceof Player) {
                $titleData = $userTitleService->retrieveTitleDataForPlayer($event->getPlayer());
            }

            return [
                'id' => $event->getId(),
                'gameEventType' => $event->getGameEventType() ? [
                    'id' => $event->getGameEventType()->getId(),
                    'name' => $event->getGameEventType()->getName(),
                    'code' => $event->getGameEventType()->getCode(),
                    'icon' => $event->getGameEventType()->getIcon(),
                    'color' => $event->getGameEventType()->getColor()
                ] : null,
                'player' => $event->getPlayer() ? [
                    'id' => $event->getPlayer()->getId(),
                    'firstName' => $event->getPlayer()->getFirstName(),
                    'lastName' => $event->getPlayer()->getLastName(),
                    'playerAvatarUrl' => $this->retrievePlayerAvatarUrl($event->getPlayer()),
                    'titleData' => $titleData,
                    'level' => $user && $user->getUserLevel() ? $user->getUserLevel()->getLevel() : null,
                ] : null,
                'relatedPlayer' => $event->getRelatedPlayer() ? [
                    'id' => $event->getRelatedPlayer()->getId(),
                    'firstName' => $event->getRelatedPlayer()->getFirstName(),
                    'lastName' => $event->getRelatedPlayer()->getLastName(),
                    'playerAvatarUrl' => $this->retrievePlayerAvatarUrl($event->getRelatedPlayer()),
                    'titleData' => $relatedUserTitleData,
                    'level' => $relatedUser && $relatedUser->getUserLevel() ? $relatedUser->getUserLevel()->getLevel() : null,
                ] : null,
                'team' => $event->getTeam() ? [
                    'id' => $event->getTeam()->getId(),
                    'name' => $event->getTeam()->getName(),
                ] : null,
                'timestamp' => $event->getTimestamp()?->format('c'),
                'description' => $event->getDescription(),
            ];
        };
        $gameEventsArr = array_map($serializeEvent, $gameEvents);

        return $this->json([
            'game' => $serializeGame($game),
            'gameEvents' => $gameEventsArr,
            'homeScore' => $scores['home'],
            'awayScore' => $scores['away'],
            'videos' => $this->videoTimelineService->prepareYoutubeLinks($game, $gameEvents),
        ]);
    }

    private function retrievePlayerAvatarUrl(?Player $player): ?string
    {
        if (null === $player) {
            return null;
        }

        foreach ($player->getUserRelations() as $userRelation) {
            if (
                'player' === $userRelation->getRelationType()->getCategory()
                && 'self_player' === $userRelation->getRelationType()->getIdentifier()
            ) {
                $user = $userRelation->getUser();
                if ($user->getAvatarFilename()) {
                    return $user->getAvatarFilename();
                }
            }
        }

        return null;
    }

    private function retrieveUserForPlayer(?Player $player): ?User
    {
        if (null === $player) {
            return null;
        }

        foreach ($player->getUserRelations() as $userRelation) {
            if (
                'player' === $userRelation->getRelationType()->getCategory()
                && 'self_player' === $userRelation->getRelationType()->getIdentifier()
            ) {
                return $userRelation->getUser();
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $substitution
     */
    private function buildSubstitutionDescription(array $substitution, ?SubstitutionReason $reason): ?string
    {
        $parts = [];

        if ($reason instanceof SubstitutionReason) {
            $parts[] = $reason->getName();
        }

        $note = trim((string) ($substitution['note'] ?? ''));
        if ('' !== $note) {
            $parts[] = $note;
        }

        if ([] === $parts) {
            return null;
        }

        return implode(' · ', $parts);
    }

    private function resolvePlayerTeamForGame(Player $player, Game $game): ?Team
    {
        $currentDate = new DateTime();
        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            $team = $assignment->getTeam();
            $endDate = $assignment->getEndDate();
            $isActive = (null === $endDate) || ($endDate >= $currentDate);
            if (!$isActive) {
                continue;
            }

            if ($team === $game->getHomeTeam() || $team === $game->getAwayTeam()) {
                return $team;
            }
        }

        return null;
    }

    #[Route('/overview', name: 'overview', methods: ['GET'])]
    public function overview(Request $request, GameRepository $gameRepository, GameEventRepository $gameEventRepository, TeamRepository $teamRepository): JsonResponse
    {
        $now = new DateTimeImmutable();

        // ---- Resolve team filter ----
        /** @var User|null $currentUser */
        $currentUser = $this->getUser();
        $userDefaultTeamId = null;
        if ($currentUser instanceof User) {
            $userDefaultTeamId = $this->coachTeamPlayerService->resolveDefaultTeamId($currentUser);
        }

        $noTeamAssignment = (null === $userDefaultTeamId);

        $teamIdParam = $request->query->get('teamId');
        if ('all' === $teamIdParam) {
            $filterTeamId = null;
        } elseif (null !== $teamIdParam && '' !== $teamIdParam) {
            $filterTeamId = (int) $teamIdParam;
        } else {
            // No explicit param: use user's default team, or -1 (no results) if unlinked
            $filterTeamId = $userDefaultTeamId ?? -1;
        }

        // ---- Season filter ----
        // German football season N/N+1 runs from ~Aug N to ~Jun N+1.
        // ?season=2025 means the 2025/26 season. Defaults to current season.
        $seasonParam = $request->query->get('season');
        $currentMonth = (int) $now->format('n');
        $currentYear = (int) $now->format('Y');
        $defaultSeasonYear = $currentMonth >= 7 ? $currentYear : ($currentYear - 1);
        $seasonYear = (null !== $seasonParam && ctype_digit($seasonParam)) ? (int) $seasonParam : $defaultSeasonYear;
        $seasonStart = new DateTimeImmutable("{$seasonYear}-07-01");
        $seasonEnd = new DateTimeImmutable(($seasonYear + 1) . '-06-30 23:59:59');
        // Available seasons: 2021/22 – current (capped at current)
        $availableSeasons = [];
        for ($y = 2021; $y <= $defaultSeasonYear; ++$y) {
            $availableSeasons[] = $y;
        }

        $upcomingGamesQb = $gameRepository->createQueryBuilder('g')
            ->addSelect('ce', 'cet', 'ht', 'at', 'l', 'wd')
            ->leftJoin('g.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at')
            ->leftJoin('g.location', 'l')
            ->leftJoin('ce.weatherData', 'wd')
            ->where('cet.name = :spiel')
            ->andWhere('ce.startDate > :now')
            ->andWhere('ce.endDate > :now OR ce.endDate IS NULL')
            ->andWhere('ce.startDate >= :seasonStart AND ce.startDate <= :seasonEnd')
            ->setParameter('spiel', 'Spiel')
            ->setParameter('now', $now)
            ->setParameter('seasonStart', $seasonStart)
            ->setParameter('seasonEnd', $seasonEnd)
            ->orderBy('ce.startDate', 'ASC');

        if (null !== $filterTeamId) {
            $upcomingGamesQb
                ->andWhere('ht.id = :filterTeamId OR at.id = :filterTeamId')
                ->setParameter('filterTeamId', $filterTeamId);
        }

        $upcomingGames = $upcomingGamesQb->getQuery()->getResult();

        $otherGamesQb = $gameRepository->createQueryBuilder('g')
            ->addSelect('ce', 'cet', 'ht', 'at', 'l', 'wd')
            ->leftJoin('g.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at')
            ->leftJoin('g.location', 'l')
            ->leftJoin('ce.weatherData', 'wd')
            ->where('cet.name = :spiel')
            ->andWhere('ce.startDate <= :now')
            ->andWhere('ce.startDate >= :seasonStart AND ce.startDate <= :seasonEnd')
            ->setParameter('spiel', 'Spiel')
            ->setParameter('now', $now)
            ->setParameter('seasonStart', $seasonStart)
            ->setParameter('seasonEnd', $seasonEnd)
            ->orderBy('ce.startDate', 'DESC');

        if (null !== $filterTeamId) {
            $otherGamesQb
                ->andWhere('ht.id = :filterTeamId OR at.id = :filterTeamId')
                ->setParameter('filterTeamId', $filterTeamId);
        }

        $otherGames = $otherGamesQb->getQuery()->getResult();

        $running = [];
        $finished = [];

        $serializeGame = function ($game) {
            $calendarEvent = $game->getCalendarEvent();
            $location = $calendarEvent->getLocation();

            return [
                'id' => $game->getId(),
                'homeTeam' => $game->getHomeTeam() ? [
                    'id' => $game->getHomeTeam()->getId(),
                    'name' => $game->getHomeTeam()->getName(),
                ] : null,
                'awayTeam' => $game->getAwayTeam() ? [
                    'id' => $game->getAwayTeam()->getId(),
                    'name' => $game->getAwayTeam()->getName(),
                ] : null,
                'location' => $location ? [
                    'id' => $location->getId(),
                    'name' => $location->getName(),
                    'latitude' => $location->getLatitude(),
                    'longitude' => $location->getLongitude(),
                    'address' => $location->getAddress() . ', ' . $location->getCity()
                ] : null,
                'calendarEvent' => $calendarEvent ? [
                    'id' => $calendarEvent->getId(),
                    'startDate' => $calendarEvent->getStartDate()?->format('c'),
                    'endDate' => $calendarEvent->getEndDate()?->format('c'),
                    'weatherData' => $calendarEvent->getWeatherData() ? [
                        'weatherCode' => $calendarEvent->getWeatherData()->getDailyWeatherData()['weathercode'] ?? [],
                    ] : [],
                ] : null,
            ];
        };

        foreach ($otherGames as $game) {
            $ce = $game->getCalendarEvent();
            if (!$ce) {
                continue;
            }
            $start = $ce->getStartDate();
            $end = $ce->getEndDate();
            if ($start && $end && $now >= $start && $now <= $end) {
                $running[] = $serializeGame($game);
            } else {
                $gameEvents = [];
                foreach ($game->getGameEvents() as $gameEvent) {
                    $gameEvents[] = $gameEvent;
                }
                $scores = $this->collectScores($gameEvents, $game);
                $finished[] = [
                    'game' => $serializeGame($game),
                    'homeScore' => $scores['home'],
                    'awayScore' => $scores['away']
                ];
            }
        }

        $upcomingGamesArr = array_map($serializeGame, $upcomingGames);

        // ---- Tournaments ----
        $tournamentRepo = $this->entityManager->getRepository(Tournament::class);
        $tournaments = $tournamentRepo->createQueryBuilder('t')
            ->addSelect('ce', 'cet', 'loc', 'wd', 'tm')
            ->leftJoin('t.calendarEvent', 'ce')
            ->leftJoin('ce.calendarEventType', 'cet')
            ->leftJoin('ce.location', 'loc')
            ->leftJoin('ce.weatherData', 'wd')
            ->leftJoin('t.matches', 'tm')
            ->orderBy('ce.startDate', 'DESC')
            ->getQuery()
            ->getResult();

        $serializeTournament = function (Tournament $tournament) use ($now) {
            $ce = $tournament->getCalendarEvent();
            $location = $ce?->getLocation();

            $status = 'upcoming';
            if ($ce) {
                $start = $ce->getStartDate();
                $end = $ce->getEndDate();
                if ($start && $end && $now >= $start && $now <= $end) {
                    $status = 'running';
                } elseif ($start && $start <= $now) {
                    $status = 'finished';
                }
            }

            // Collect team IDs involved in this tournament
            $teamIds = [];
            foreach ($tournament->getMatches() as $match) {
                $ht = $match->getHomeTeam();
                $at = $match->getAwayTeam();
                if ($ht) {
                    $teamIds[$ht->getId()] = true;
                }
                if ($at) {
                    $teamIds[$at->getId()] = true;
                }
            }

            return [
                'id' => $tournament->getId(),
                'name' => $tournament->getName(),
                'type' => $tournament->getType(),
                'status' => $status,
                'matchCount' => $tournament->getMatches()->count(),
                'teamIds' => array_keys($teamIds),
                'calendarEvent' => $ce ? [
                    'id' => $ce->getId(),
                    'startDate' => $ce->getStartDate()?->format('c'),
                    'endDate' => $ce->getEndDate()?->format('c'),
                    'weatherData' => $ce->getWeatherData() ? [
                        'weatherCode' => $ce->getWeatherData()->getDailyWeatherData()['weathercode'] ?? [],
                    ] : [],
                ] : null,
                'location' => $location ? [
                    'id' => $location->getId(),
                    'name' => $location->getName(),
                    'latitude' => $location->getLatitude(),
                    'longitude' => $location->getLongitude(),
                    'address' => $location->getAddress() . ', ' . $location->getCity()
                ] : null,
            ];
        };

        $tournamentsArr = array_values(array_filter(
            array_map($serializeTournament, $tournaments),
            function (array $t) use ($filterTeamId): bool {
                if (null === $filterTeamId) {
                    return true;
                }

                return in_array($filterTeamId, $t['teamIds'], true);
            }
        ));

        // ---- Resolve user team IDs (only currently active assignments) ----
        $userTeamIds = [];
        if ($currentUser instanceof User) {
            foreach ($this->coachTeamPlayerService->collectPlayerTeams($currentUser) as $team) {
                $userTeamIds[$team->getId()] = $team->getId();
            }
            foreach ($this->coachTeamPlayerService->collectCoachTeams($currentUser) as $team) {
                $userTeamIds[$team->getId()] = $team->getId();
            }
        }

        // ---- All teams for dropdown (independent of game filter) ----
        $allTeams = $teamRepository->createQueryBuilder('t')
            ->select('t.id', 't.name')
            ->orderBy('t.name', 'ASC')
            ->getQuery()
            ->getResult();

        return $this->json([
            'running_games' => $running,
            'upcoming_games' => $upcomingGamesArr,
            'finished_games' => $finished,
            'tournaments' => $tournamentsArr,
            'userTeamIds' => array_values($userTeamIds),
            'userDefaultTeamId' => $userDefaultTeamId,
            'noTeamAssignment' => $noTeamAssignment,
            'availableTeams' => $allTeams,
            'availableSeasons' => $availableSeasons,
            'selectedSeason' => $seasonYear,
        ]);
    }

    /**
     * Returns confirmed squad players and all active team players for a game.
     *
     * squad      – players with attending/late participation (self_player relation only)
     * allPlayers – all players with an active assignment to the game's teams
     *
     * Parents, siblings etc. are excluded from squad via the relationType identifier.
     */
    #[Route('/{id}/squad', name: 'squad', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function squad(
        Game $game,
        ParticipationRepository $participationRepo,
    ): JsonResponse {
        if (!$this->isGranted(GameVoter::VIEW, $game)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $calendarEvent = $game->getCalendarEvent();
        if (!$calendarEvent) {
            return $this->json(['squad' => [], 'allPlayers' => [], 'hasParticipationData' => false]);
        }

        $teamIds = [];
        if ($game->getHomeTeam()) {
            $teamIds[] = $game->getHomeTeam()->getId();
        }
        if ($game->getAwayTeam()) {
            $teamIds[] = $game->getAwayTeam()->getId();
        }

        if (empty($teamIds)) {
            return $this->json(['squad' => [], 'allPlayers' => [], 'hasParticipationData' => false]);
        }

        // ── All active team players ────────────────────────────────────────────
        $allPlayersRows = $this->entityManager->createQuery(
            'SELECT p.id, p.firstName, p.lastName, pta.shirtNumber, IDENTITY(pta.team) as teamId
            FROM App\Entity\Player p
            INNER JOIN p.playerTeamAssignments pta
            WHERE IDENTITY(pta.team) IN (:teamIds)
              AND (pta.endDate IS NULL OR pta.endDate >= :today)
            ORDER BY pta.shirtNumber ASC'
        )
            ->setParameter('teamIds', $teamIds)
            ->setParameter('today', new DateTime('today'))
            ->getArrayResult();

        $seenAll = [];
        $allPlayers = [];
        foreach ($allPlayersRows as $row) {
            $key = $row['id'] . '_' . $row['teamId'];
            if (isset($seenAll[$key])) {
                continue;
            }
            $seenAll[$key] = true;
            $allPlayers[] = [
                'id' => $row['id'],
                'fullName' => $row['firstName'] . ' ' . $row['lastName'],
                'shirtNumber' => $row['shirtNumber'],
                'teamId' => (int) $row['teamId'],
            ];
        }

        $playerSortFn = static function (array $a, array $b): int {
            if ($a['shirtNumber'] === $b['shirtNumber']) {
                return strcmp((string) $a['fullName'], (string) $b['fullName']);
            }
            if (null === $a['shirtNumber']) {
                return 1;
            }
            if (null === $b['shirtNumber']) {
                return -1;
            }

            return (int) $a['shirtNumber'] <=> (int) $b['shirtNumber'];
        };

        usort($allPlayers, $playerSortFn);

        // ── Confirmed squad (attending / late) ────────────────────────────────
        $participations = $participationRepo->findByEvent($calendarEvent);
        $hasParticipationData = count($participations) > 0;

        $confirmedUserIds = [];
        foreach ($participations as $participation) {
            $code = $participation->getStatus()->getCode();
            if (in_array($code, ['attending', 'late'], true)) {
                $confirmedUserIds[] = $participation->getUser()->getId();
            }
        }

        $squad = [];
        if (!empty($confirmedUserIds)) {
            // Query players linked via self_player UserRelation to the confirmed users,
            // restricted to active assignments in the game's home/away teams.
            // Parents/guardians are excluded because they have a different relationType identifier.
            $rows = $this->entityManager->createQuery(
                'SELECT p.id, p.firstName, p.lastName, pta.shirtNumber, IDENTITY(pta.team) as teamId
                FROM App\Entity\Player p
                INNER JOIN p.userRelations ur
                INNER JOIN ur.relationType rt
                INNER JOIN p.playerTeamAssignments pta
                WHERE IDENTITY(ur.user) IN (:userIds)
                  AND rt.identifier = :relationType
                  AND IDENTITY(pta.team) IN (:teamIds)
                  AND (pta.endDate IS NULL OR pta.endDate >= :today)
                ORDER BY pta.shirtNumber ASC'
            )
                ->setParameter('userIds', $confirmedUserIds)
                ->setParameter('relationType', 'self_player')
                ->setParameter('teamIds', $teamIds)
                ->setParameter('today', new DateTime('today'))
                ->getArrayResult();

            $seen = [];
            foreach ($rows as $row) {
                $key = $row['id'] . '_' . $row['teamId'];
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $squad[] = [
                    'id' => $row['id'],
                    'fullName' => $row['firstName'] . ' ' . $row['lastName'],
                    'shirtNumber' => $row['shirtNumber'],
                    'teamId' => (int) $row['teamId'],
                ];
            }

            usort($squad, $playerSortFn);
        }

        return $this->json([
            'squad' => $squad,
            'allPlayers' => $allPlayers,
            'hasParticipationData' => $hasParticipationData,
        ]);
    }

    /**
     * @param array<int, GameEvent> $gameEvents
     *
     * @return array<string, int>
     */
    private function collectScores(array $gameEvents, Game $game): array
    {
        $gameEventGoal = $this->entityManager->getRepository(GameEventType::class)->findOneBy(['code' => 'goal']);
        $gameEventOwnGoal = $this->entityManager->getRepository(GameEventType::class)->findOneBy(['code' => 'own_goal']);

        $homeScore = 0;
        $awayScore = 0;

        foreach ($gameEvents as $gameEvent) {
            if ($gameEvent->getGameEventType() === $gameEventGoal) {
                if ($gameEvent->getTeam() === $game->getHomeTeam()) {
                    ++$homeScore;
                } elseif ($gameEvent->getTeam() === $game->getAwayTeam()) {
                    ++$awayScore;
                }
            } elseif ($gameEvent->getGameEventType() === $gameEventOwnGoal) {
                if ($gameEvent->getTeam() === $game->getHomeTeam()) {
                    ++$awayScore;
                } elseif ($gameEvent->getTeam() === $game->getAwayTeam()) {
                    ++$homeScore;
                }
            }
        }

        return [
            'home' => $homeScore,
            'away' => $awayScore
        ];
    }
}
