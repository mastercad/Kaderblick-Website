<?php

namespace App\Controller\Api;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Notification;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\TeamRide;
use App\Entity\User;
use App\Repository\MatchdayViewRepository;
use App\Repository\ParticipationRepository;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventSerializer;
use App\Service\UserTeamAccessService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/matchday', name: 'api_matchday_')]
class MatchdayController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventSerializer $serializer,
        private readonly ParticipationRepository $participationRepo,
        private readonly MatchdayViewRepository $matchdayViewRepo,
        private readonly UserTeamAccessService $teamAccessService,
    ) {
    }

    /**
     * Returns all aggregated matchday data for a single CalendarEvent.
     *
     * Sections returned:
     *  - event          Full serialized event (title, start, end, location, game context, …)
     *  - myParticipation  The requesting user's participation status
     *  - participationSummary  Counts by status {statusName: count}
     *  - participants   Full list (only coaches/admins receive the user names)
     *  - rides          All rides visible to the user
     *  - myRide         Whether the user is driver or passenger, and which ride
     *  - myTasks        TaskAssignments assigned to the current user for this event's date
     *  - allTasks       All open task assignments on the event date (coaches/admins only)
     *  - unreadNotifications  Unread notifications referencing this event
     *  - lastViewedAt   ISO timestamp of the user's previous visit, or null
     *  - role           'coach' | 'admin' | 'player' — derived from Symfony roles
     *  - completeness   {participation: bool, task: bool, ride: bool}
     */
    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        /** @var User $user */
        $user = $this->getUser();

        $tournamentEventType = $this->entityManager->getRepository(CalendarEventType::class)
            ->findOneBy(['name' => 'Turnier']);

        $eventData = $this->serializer->serialize($calendarEvent, $user, $tournamentEventType);

        // --- Role determination ---
        $isAdmin = in_array('ROLE_ADMIN', $user->getRoles()) || in_array('ROLE_SUPERADMIN', $user->getRoles());
        $isCoach = $isAdmin || $this->isCoachOfAnyEventTeam($user, $calendarEvent);
        $role = $isAdmin ? 'admin' : ($isCoach ? 'coach' : 'player');

        // --- Participation ---
        $myParticipation = $this->participationRepo->findByUserAndEvent($user, $calendarEvent);
        $myParticipationData = null;
        if ($myParticipation) {
            $myParticipationData = [
                'id' => $myParticipation->getId(),
                'status' => $myParticipation->getStatus()?->getName(),
                'statusId' => $myParticipation->getStatus()?->getId(),
            ];
        }

        $participationSummary = $this->participationRepo->getParticipationCountsByStatus($calendarEvent);

        // Coaches and admins see the full participant list (names + statuses)
        // All roles see the list of names who confirmed (attending)
        $participantsData = [];
        $attendingPlayers = [];
        $allParticipations = $this->participationRepo->findByEvent($calendarEvent);
        foreach ($allParticipations as $p) {
            if ('attending' === $p->getStatus()?->getCode()) {
                $attendingPlayers[] = $p->getUser()?->getFullName();
            }
            if ($isCoach) {
                $participantsData[] = [
                    'userId' => $p->getUser()?->getId(),
                    'name' => $p->getUser()?->getFullName(),
                    'status' => $p->getStatus()?->getName(),
                    'statusId' => $p->getStatus()?->getId(),
                    'statusCode' => $p->getStatus()?->getCode(),
                    'statusColor' => $p->getStatus()?->getColor(),
                ];
            }
        }
        sort($attendingPlayers);

        // --- Rides ---
        $rides = $this->entityManager->getRepository(TeamRide::class)
            ->findBy(['event' => $calendarEvent]);

        $ridesData = [];
        $myRideData = null;

        foreach ($rides as $ride) {
            $passengerIds = array_map(
                fn ($p) => $p->getUser()?->getId(),
                $ride->getPassengers()->toArray()
            );
            $isDriver = $ride->getDriver()?->getId() === $user->getId();
            $isPassenger = in_array($user->getId(), $passengerIds, true);

            $rideEntry = [
                'id' => $ride->getId(),
                'driverId' => $ride->getDriver()?->getId(),
                'driver' => $ride->getDriver()?->getFullName(),
                'seats' => $ride->getSeats(),
                'note' => $ride->getNote(),
                'availableSeats' => $ride->getSeats() - $ride->getPassengers()->count(),
                'isMyRide' => $isDriver || $isPassenger,
                'passengers' => array_map(fn ($p) => [
                    'id' => $p->getUser()?->getId(),
                    'name' => $p->getUser()?->getFullName(),
                ], $ride->getPassengers()->toArray()),
            ];
            $ridesData[] = $rideEntry;

            if ($isDriver) {
                $myRideData = ['type' => 'driver', 'rideId' => $ride->getId()];
            } elseif ($isPassenger && null === $myRideData) {
                $myRideData = ['type' => 'passenger', 'rideId' => $ride->getId()];
            }
        }

        // --- Tasks on event date ---
        $eventDate = $calendarEvent->getStartDate() ?? new DateTimeImmutable();
        $eventDateStart = DateTimeImmutable::createFromInterface($eventDate)->setTime(0, 0, 0);
        $eventDateEnd = DateTimeImmutable::createFromInterface($eventDate)->setTime(23, 59, 59);

        /** @var TaskAssignment[] $myTaskAssignments */
        $myTaskAssignments = $this->entityManager->getRepository(TaskAssignment::class)
            ->createQueryBuilder('ta')
            ->leftJoin('ta.task', 't')
            ->where('ta.user = :user')
            ->andWhere('ta.assignedDate >= :start')
            ->andWhere('ta.assignedDate <= :end')
            ->setParameter('user', $user)
            ->setParameter('start', $eventDateStart)
            ->setParameter('end', $eventDateEnd)
            ->getQuery()
            ->getResult();

        $myTasksData = array_map(fn (TaskAssignment $ta) => [
            'assignmentId' => $ta->getId(),
            'taskId' => $ta->getTask()?->getId(),
            'title' => $ta->getTask()?->getTitle(),
            'status' => $ta->getStatus(),
            'isDone' => 'erledigt' === $ta->getStatus(),
        ], $myTaskAssignments);

        // Coaches also see all assignments on the event date
        $allTasksData = [];
        if ($isCoach) {
            /** @var TaskAssignment[] $allAssignments */
            $allAssignments = $this->entityManager->getRepository(TaskAssignment::class)
                ->createQueryBuilder('ta')
                ->leftJoin('ta.task', 't')
                ->leftJoin('ta.user', 'u')
                ->where('ta.assignedDate >= :start')
                ->andWhere('ta.assignedDate <= :end')
                ->setParameter('start', $eventDateStart)
                ->setParameter('end', $eventDateEnd)
                ->getQuery()
                ->getResult();

            foreach ($allAssignments as $ta) {
                $allTasksData[] = [
                    'assignmentId' => $ta->getId(),
                    'taskId' => $ta->getTask()?->getId(),
                    'title' => $ta->getTask()?->getTitle(),
                    'status' => $ta->getStatus(),
                    'isDone' => 'erledigt' === $ta->getStatus(),
                    'assignedTo' => $ta->getUser()?->getFullName(),
                    'assignedUserId' => $ta->getUser()?->getId(),
                ];
            }
        }

        // --- Unread notifications related to this event ---
        $unreadNotifications = $this->entityManager->getRepository(Notification::class)
            ->createQueryBuilder('n')
            ->where('n.user = :user')
            ->andWhere('n.isRead = false')
            ->setParameter('user', $user)
            ->orderBy('n.createdAt', 'DESC')
            ->getQuery()
            ->getResult();

        $eventNotifications = array_values(array_filter(
            $unreadNotifications,
            fn (Notification $n) => ($n->getData()['eventId'] ?? null) === $calendarEvent->getId()
        ));

        $notificationsData = array_map(fn (Notification $n) => [
            'id' => $n->getId(),
            'type' => $n->getType(),
            'title' => $n->getTitle(),
            'message' => $n->getMessage(),
            'createdAt' => $n->getCreatedAt()->format('Y-m-d\TH:i:s'),
        ], $eventNotifications);

        // --- Last viewed at (previous visit) ---
        $existingView = $this->matchdayViewRepo->findByUserAndEvent($user, $calendarEvent);
        $lastViewedAt = $existingView?->getViewedAt()?->format('Y-m-d\TH:i:s');

        // --- Completeness indicator ---
        $completeness = [
            'participation' => null !== $myParticipationData,
            'task' => empty($myTasksData) || !in_array(false, array_column($myTasksData, 'isDone'), true),
        ];

        // --- Squad readiness ---
        // Sichtbar für ALLE User, aber jeweils nur die Teams, denen der User
        // aktuell aktiv zugeordnet ist (als Spieler ODER Trainer, via UserRelation).
        // Einzige Ausnahme: ROLE_SUPERADMIN sieht alle Teams des Spiels.
        $squadReadiness = null;

        // Alle am Event beteiligten Teams sammeln
        $allEventTeams = [];
        if ($calendarEvent->getGame()) {
            if ($calendarEvent->getGame()->getHomeTeam()) {
                $allEventTeams[] = $calendarEvent->getGame()->getHomeTeam();
            }
            if ($calendarEvent->getGame()->getAwayTeam()) {
                $allEventTeams[] = $calendarEvent->getGame()->getAwayTeam();
            }
        }
        foreach ($calendarEvent->getPermissions() as $permission) {
            if ($permission->getTeam()) {
                $allEventTeams[] = $permission->getTeam();
            }
        }
        $allEventTeams = array_unique($allEventTeams, SORT_REGULAR);

        // Matchplan vorab laden – wird für published-Prüfung UND Formation-Ansicht benötigt
        $gameMatchPlan = $calendarEvent->getGame()?->getMatchPlan();
        $matchPlanTeamId = isset($gameMatchPlan['selectedTeamId'])
            ? (int) $gameMatchPlan['selectedTeamId']
            : null;
        // published gilt ausschließlich für das eine Team, für das die Aufstellung erstellt wurde
        $publishedTeamId = (is_array($gameMatchPlan) && !empty($gameMatchPlan['published']) && null !== $matchPlanTeamId)
            ? $matchPlanTeamId
            : null;

        $eventDate = $calendarEvent->getStartDate();

        // Sichtbarkeitsregeln:
        //   SuperAdmin / Admin → alle Teams des Spiels
        //   Coach              → eigene aktive Coach-Teams am Ereignisdatum (immer)
        //   Spieler            → eigenes aktives Spieler-Team am Ereignisdatum,
        //                        NUR wenn der Matchplan für genau dieses Team published ist
        //   sonst              → kein Zugang (z. B. reine Freund-Relation)
        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles());
        $isAdmin = in_array('ROLE_ADMIN', $user->getRoles());

        if ($isSuperAdmin || $isAdmin) {
            $relevantTeams = $allEventTeams;
        } else {
            $myCoachTeams = $this->teamAccessService->getCoachTeamsForDate($user, $allEventTeams, $eventDate);
            $myPlayerTeams = $this->teamAccessService->getPlayerTeamsForDate($user, $allEventTeams, $eventDate);

            $coachTeamIds = array_map(fn ($t) => $t->getId(), $myCoachTeams);

            // Coach-Teams immer hinzufügen
            $relevantTeams = $myCoachTeams;
            // Spieler-Teams nur wenn published für genau dieses Team – niemals Gegner
            foreach ($myPlayerTeams as $pt) {
                if (
                    !in_array($pt->getId(), $coachTeamIds, true)
                    && $pt->getId() === $publishedTeamId
                ) {
                    $relevantTeams[] = $pt;
                }
            }
        }

        // Participation lookup: userId → status data (reuse already-fetched data)
        $participationByUser = [];
        foreach ($allParticipations as $p) {
            $uid = $p->getUser()?->getId();
            if (null !== $uid) {
                $participationByUser[$uid] = [
                    'statusId' => $p->getStatus()?->getId(),
                    'statusName' => $p->getStatus()?->getName(),
                    'statusCode' => $p->getStatus()?->getCode(),
                    'color' => $p->getStatus()?->getColor(),
                ];
            }
        }

        $squadByTeam = [];

        foreach ($relevantTeams as $team) {
            // Load squad: only players active on the event date.
            // A PlayerTeamAssignment is "active" when:
            //   startDate IS NULL  OR  startDate <= eventDate
            //   endDate   IS NULL  OR  endDate   >= eventDate
            /** @var PlayerTeamAssignment[] $assignments */
            $assignments = $this->entityManager->getRepository(PlayerTeamAssignment::class)
                ->createQueryBuilder('pta')
                ->select('pta', 'p', 'pos', 'altPos', 'ur', 'u')
                ->innerJoin('pta.player', 'p')
                ->leftJoin('p.mainPosition', 'pos')
                ->leftJoin('p.alternativePositions', 'altPos')
                ->leftJoin('p.userRelations', 'ur')
                ->leftJoin('ur.user', 'u')
                ->where('pta.team = :team')
                ->andWhere('pta.startDate IS NULL OR pta.startDate <= :eventDate')
                ->andWhere('pta.endDate IS NULL OR pta.endDate >= :eventDate')
                ->setParameter('team', $team)
                ->setParameter('eventDate', $eventDate)
                ->getQuery()
                ->getResult();

            // Build enriched player lookup: playerId → data
            $squadByPlayerId = [];
            foreach ($assignments as $pta) {
                $player = $pta->getPlayer();
                $linkedUserId = null;
                foreach ($player->getUserRelations() as $ur) {
                    $linkedUserId = $ur->getUser()->getId();
                    break;
                }

                $part = null !== $linkedUserId ? ($participationByUser[$linkedUserId] ?? null) : null;
                $statusCode = $part['statusCode'] ?? 'none';

                $altPositionStrings = [];
                foreach ($player->getAlternativePositions() as $altPos) {
                    $short = $altPos->getShortName();
                    $name = $altPos->getName();
                    if (null !== $short) {
                        $altPositionStrings[] = $short;
                    }
                    $altPositionStrings[] = $name;
                }

                $squadByPlayerId[$player->getId()] = [
                    'playerId' => $player->getId(),
                    'name' => $player->getFirstName() . ' ' . $player->getLastName(),
                    'mainPositionName' => $player->getMainPosition()->getName(),
                    'mainPositionShort' => $player->getMainPosition()->getShortName()
                        ?? $player->getMainPosition()->getName(),
                    'alternativePositionStrings' => array_unique($altPositionStrings),
                    'userId' => $linkedUserId,
                    'statusId' => $part['statusId'] ?? null,
                    'statusName' => $part['statusName'] ?? null,
                    'statusCode' => $statusCode,
                    'statusColor' => $part['color'] ?? null,
                ];
            }

            $attending = count(array_filter($squadByPlayerId, fn ($p) => 'attending' === $p['statusCode']));
            $total = count($squadByPlayerId);

            // Check if a matchPlan is available for this specific team
            $teamMatchPlan = ($matchPlanTeamId === $team->getId() && is_array($gameMatchPlan))
                ? $gameMatchPlan
                : null;

            // Only use the formation view when the plan actually has players placed.
            // An empty/initialised plan (phases exist but players array is empty)
            // must fall back to the position-based view so the full squad is visible.
            $startPhaseForCheck = null;
            if (null !== $teamMatchPlan && !empty($teamMatchPlan['phases'])) {
                foreach ($teamMatchPlan['phases'] as $phase) {
                    if (($phase['sourceType'] ?? '') === 'start') {
                        $startPhaseForCheck = $phase;
                        break;
                    }
                }
                $startPhaseForCheck ??= $teamMatchPlan['phases'][0] ?? null;
            }
            // Nur echte Spieler (isRealPlayer === true) zählen – Positions-Platzhalter
            // (isRealPlayer: false) gelten nicht als "Plan mit Spielern".
            $hasRealPlayersInPlan = false;
            if (null !== $startPhaseForCheck) {
                foreach (array_merge($startPhaseForCheck['players'] ?? [], $startPhaseForCheck['bench'] ?? []) as $pp) {
                    if (($pp['isRealPlayer'] ?? false) === true) {
                        $hasRealPlayersInPlan = true;
                        break;
                    }
                }
            }

            if (null !== $teamMatchPlan && !empty($teamMatchPlan['phases']) && $hasRealPlayersInPlan) {
                // ── Formation-based view ──────────────────────────────────────────
                // Locate the start phase (first phase with sourceType === 'start')
                $startPhase = null;
                foreach ($teamMatchPlan['phases'] as $phase) {
                    if (($phase['sourceType'] ?? '') === 'start') {
                        $startPhase = $phase;
                        break;
                    }
                }
                $startPhase ??= $teamMatchPlan['phases'][0] ?? null;

                // Collect ALL planned player IDs (starters + bench) up front
                // so suggestions can exclude already-committed players
                $allPlannedPlayerIds = [];
                foreach (array_merge($startPhase['players'] ?? [], $startPhase['bench'] ?? []) as $pp) {
                    $pid = isset($pp['playerId']) ? (int) $pp['playerId'] : null;
                    if (null !== $pid) {
                        $allPlannedPlayerIds[] = $pid;
                    }
                }

                // Build startingXI with status + suggestions for open slots.
                // Only treat a slot as "occupied" when isRealPlayer === true and
                // playerId is set — otherwise it is a position placeholder.
                $startingXI = [];
                $confirmedInXI = 0;
                $altCoveredInXI = 0;
                foreach ($startPhase['players'] ?? [] as $planPlayer) {
                    $isRealPlayer = ($planPlayer['isRealPlayer'] ?? false) === true;
                    $pid = ($isRealPlayer && isset($planPlayer['playerId']))
                        ? (int) $planPlayer['playerId']
                        : null;
                    $playerData = null !== $pid ? ($squadByPlayerId[$pid] ?? null) : null;
                    $statusCode = $playerData['statusCode'] ?? 'none';
                    $isConfirmed = 'attending' === $statusCode;

                    if ($isConfirmed) {
                        ++$confirmedInXI;
                    }

                    $slotPos = $planPlayer['position'] ?? '';
                    $suggestions = [];
                    if (!$isConfirmed) {
                        $suggestions = $this->findPositionAlternatives($slotPos, $squadByPlayerId, $allPlannedPlayerIds);
                        if (!empty($suggestions)) {
                            ++$altCoveredInXI;
                        }
                    }

                    $startingXI[] = [
                        // null playerName signals an open / placeholder slot on the frontend
                        'slot' => '' !== $slotPos ? $slotPos : null,
                        'playerName' => $isRealPlayer ? ($planPlayer['name'] ?? null) : null,
                        'playerId' => $pid,
                        'userId' => $playerData['userId'] ?? null,
                        'statusId' => $playerData['statusId'] ?? null,
                        'statusName' => $playerData['statusName'] ?? null,
                        'statusCode' => $statusCode,
                        'statusColor' => $playerData['statusColor'] ?? null,
                        'isConfirmed' => $isConfirmed,
                        'suggestions' => $suggestions,
                    ];
                }

                // Build bench entries
                $bench = [];
                foreach ($startPhase['bench'] ?? [] as $planPlayer) {
                    $pid = isset($planPlayer['playerId']) ? (int) $planPlayer['playerId'] : null;
                    $playerData = null !== $pid ? ($squadByPlayerId[$pid] ?? null) : null;
                    $statusCode = $playerData['statusCode'] ?? 'none';

                    $bench[] = [
                        'slot' => $planPlayer['position'] ?? null,
                        'playerName' => $planPlayer['name'] ?? null,
                        'playerId' => $pid,
                        'userId' => $playerData['userId'] ?? null,
                        'statusId' => $playerData['statusId'] ?? null,
                        'statusName' => $playerData['statusName'] ?? null,
                        'statusCode' => $statusCode,
                        'statusColor' => $playerData['statusColor'] ?? null,
                        'isConfirmed' => 'attending' === $statusCode,
                        'suggestions' => [],
                    ];
                }

                // Squad members present but not included in the matchPlan at all
                $unplanned = [];
                foreach ($squadByPlayerId as $pid => $pd) {
                    if (!in_array($pid, $allPlannedPlayerIds, true)) {
                        $unplanned[] = [
                            'playerId' => $pid,
                            'name' => $pd['name'],
                            'positionShort' => $pd['mainPositionShort'],
                            'alternativePositions' => array_values(array_unique($pd['alternativePositionStrings'])),
                            'statusCode' => $pd['statusCode'],
                            'statusColor' => $pd['statusColor'],
                            'statusName' => $pd['statusName'],
                        ];
                    }
                }

                $xiTotal = count($startingXI);
                $completionPercent = $xiTotal > 0
                    ? (int) round(($confirmedInXI + $altCoveredInXI) / $xiTotal * 100)
                    : 0;
                $trafficLight = $confirmedInXI >= 11 ? 'green' : ($confirmedInXI >= 7 ? 'yellow' : 'red');

                $squadByTeam[] = [
                    'teamId' => $team->getId(),
                    'teamName' => $team->getName(),
                    'attending' => $attending,
                    'total' => $total,
                    'trafficLight' => $trafficLight,
                    'completionPercent' => $completionPercent,
                    'hasMatchPlan' => true,
                    'startingXI' => $startingXI,
                    'bench' => $bench,
                    'unplanned' => $unplanned,
                    'playersByPosition' => null,
                ];
            } else {
                // ── Position-grouped fallback (no matchPlan) ─────────────────────
                $playersByPosition = [];
                foreach ($squadByPlayerId as $pid => $pd) {
                    $posName = $pd['mainPositionName'] ?? 'Unbekannt';
                    $playersByPosition[$posName][] = [
                        'playerId' => $pid,
                        'name' => $pd['name'],
                        'positionShort' => $pd['mainPositionShort'],
                        'alternativePositions' => array_values(array_unique($pd['alternativePositionStrings'])),
                        'userId' => $pd['userId'],
                        'statusId' => $pd['statusId'],
                        'statusName' => $pd['statusName'],
                        'statusCode' => $pd['statusCode'],
                        'statusColor' => $pd['statusColor'],
                    ];
                }

                $completionPercent = $total > 0 ? (int) round($attending / $total * 100) : 0;
                $trafficLight = $attending >= 11 ? 'green' : ($attending >= 7 ? 'yellow' : 'red');

                $squadByTeam[] = [
                    'teamId' => $team->getId(),
                    'teamName' => $team->getName(),
                    'attending' => $attending,
                    'total' => $total,
                    'trafficLight' => $trafficLight,
                    'completionPercent' => $completionPercent,
                    'hasMatchPlan' => false,
                    'startingXI' => null,
                    'bench' => null,
                    'unplanned' => null,
                    'playersByPosition' => $playersByPosition,
                ];
            }
        }

        if (!empty($relevantTeams)) {
            $squadReadiness = $squadByTeam;
        }

        return $this->json([
            'event' => $eventData,
            'role' => $role,
            'myParticipation' => $myParticipationData,
            'participationSummary' => $participationSummary,
            'participants' => $participantsData,
            'attendingPlayers' => $attendingPlayers,
            'rides' => $ridesData,
            'myRide' => $myRideData,
            'myTasks' => $myTasksData,
            'allTasks' => $allTasksData,
            'unreadNotifications' => $notificationsData,
            'lastViewedAt' => $lastViewedAt,
            'completeness' => $completeness,
            'squadReadiness' => $squadReadiness,
        ]);
    }

    /**
     * Marks the matchday as "viewed" by the current user.
     * Returns the viewedAt timestamp of the PREVIOUS view, so the frontend
     * can determine what content is "new since last visit".
     */
    #[Route('/{id}/view', name: 'mark_viewed', methods: ['POST'])]
    public function markViewed(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        /** @var User $user */
        $user = $this->getUser();

        $previousViewedAt = $this->matchdayViewRepo->markViewed($user, $calendarEvent);

        return $this->json([
            'previousViewedAt' => $previousViewedAt?->format('Y-m-d\TH:i:s'),
        ]);
    }

    /**
     * Finds squad players who can cover a given formation-slot position via
     * their main position or alternative positions.  Only confirmed (attending)
     * players not already committed to a planned slot are returned.
     *
     * @param array<int, array<string, mixed>> $squadByPlayerId
     * @param int[]                            $plannedPlayerIds
     *
     * @return array<int, array<string, mixed>>
     */
    private function findPositionAlternatives(string $positionStr, array $squadByPlayerId, array $plannedPlayerIds): array
    {
        if ('' === $positionStr) {
            return [];
        }

        $suggestions = [];
        foreach ($squadByPlayerId as $pid => $pd) {
            if (in_array($pid, $plannedPlayerIds, true)) {
                continue;
            }
            if ('attending' !== $pd['statusCode']) {
                continue;
            }

            $isMainPosition = $pd['mainPositionShort'] === $positionStr || $pd['mainPositionName'] === $positionStr;
            $isAltPosition = in_array($positionStr, $pd['alternativePositionStrings'], true);

            if ($isMainPosition || $isAltPosition) {
                $suggestions[] = [
                    'playerId' => $pid,
                    'name' => $pd['name'],
                    'positionShort' => $pd['mainPositionShort'],
                    'isMainPosition' => $isMainPosition,
                ];
            }
        }

        return $suggestions;
    }

    /**
     * Returns true if the user is an active self_coach of at least one team linked to the event.
     */
    private function isCoachOfAnyEventTeam(User $user, CalendarEvent $event): bool
    {
        $teams = [];

        if ($event->getGame()) {
            if ($event->getGame()->getHomeTeam()) {
                $teams[] = $event->getGame()->getHomeTeam();
            }
            if ($event->getGame()->getAwayTeam()) {
                $teams[] = $event->getGame()->getAwayTeam();
            }
        }

        foreach ($event->getPermissions() as $permission) {
            if ($permission->getTeam()) {
                $teams[] = $permission->getTeam();
            }
        }

        if (empty($teams)) {
            return false;
        }

        return !empty(
            $this->teamAccessService->getCoachTeamsForDate($user, $teams, $event->getStartDate())
        );
    }
}
