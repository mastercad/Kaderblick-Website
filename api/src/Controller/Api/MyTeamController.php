<?php

namespace App\Controller\Api;

use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CalendarEventRepository;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Liefert eine Übersichtsseite "Mein Team" für alle Nutzer:
 * - Teams des Nutzers (über UserRelations)
 * - Spieler im Team (Kader)
 * - Nächste Termine des Teams
 * - Offene Aufgaben des Nutzers
 */
#[Route('/api/my-team', name: 'api_my_team_')]
class MyTeamController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('', name: 'overview', methods: ['GET'])]
    public function overview(CalendarEventRepository $calendarEventRepository): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        // Sammle alle Teams des Benutzers (über UserRelations → Player/Coach → TeamAssignments)
        $teams = [];
        $teamIds = [];
        $myPlayerIds = []; // nur self_player
        $myCoachIds = []; // nur self_coach
        /** @var array<int, array{identifier: string, name: string}> $playerRelations */
        $playerRelations = []; // playerId → Verknüpfungsart
        /** @var array<int, array{identifier: string, name: string}> $coachRelations */
        $coachRelations = []; // coachId  → Verknüpfungsart
        $today = new DateTime();

        foreach ($user->getUserRelations() as $relation) {
            $relationType = $relation->getRelationType();
            $relationTypeIdentifier = $relationType->getIdentifier();
            $relationData = [
                'identifier' => $relationTypeIdentifier,
                'name' => $relationType->getName(),
            ];

            // Über Spieler-Verknüpfungen
            if ($relation->getPlayer()) {
                $player = $relation->getPlayer();
                $playerId = $player->getId();

                if ('self_player' === $relationTypeIdentifier) {
                    $myPlayerIds[] = $playerId;
                }

                // Speichere die Verknüpfungsart (self_player hat Vorrang)
                if (!isset($playerRelations[$playerId]) || 'self_player' === $relationTypeIdentifier) {
                    $playerRelations[$playerId] = $relationData;
                }

                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    $team = $pta->getTeam();
                    if (!in_array($team->getId(), $teamIds, true)) {
                        $teamIds[] = $team->getId();
                        $teams[] = $team;
                    }
                }
            }
            // Über Trainer-Verknüpfungen
            if ($relation->getCoach()) {
                $coach = $relation->getCoach();
                $coachId = $coach->getId();

                if ('self_coach' === $relationTypeIdentifier) {
                    $myCoachIds[] = $coachId;
                }

                // Speichere die Verknüpfungsart (self_coach hat Vorrang)
                if (!isset($coachRelations[$coachId]) || 'self_coach' === $relationTypeIdentifier) {
                    $coachRelations[$coachId] = $relationData;
                }

                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    $team = $cta->getTeam();
                    if (!in_array($team->getId(), $teamIds, true)) {
                        $teamIds[] = $team->getId();
                        $teams[] = $team;
                    }
                }
            }
        }

        // Baue Teamdaten mit Spieler- und Trainerliste
        $teamsData = [];
        foreach ($teams as $team) {
            $players = $team->getCurrentPlayers();
            $playersData = [];
            foreach ($players as $player) {
                $shirtNumber = null;
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($pta->getTeam()->getId() === $team->getId()) {
                        $shirtNumber = $pta->getShirtNumber();
                        break;
                    }
                }
                $playersData[] = [
                    'id' => $player->getId(),
                    'firstName' => $player->getFirstName(),
                    'lastName' => $player->getLastName(),
                    'fullName' => $player->getFullName(),
                    'shirtNumber' => $shirtNumber,
                    'mainPosition' => $player->getMainPosition() ? [
                        'id' => $player->getMainPosition()->getId(),
                        'name' => $player->getMainPosition()->getName(),
                    ] : null,
                    'isMe' => in_array($player->getId(), $myPlayerIds, true),
                    'myRelation' => $playerRelations[$player->getId()] ?? null,
                ];
            }

            $coachesDataById = [];
            foreach ($team->getCoachTeamAssignments() as $cta) {
                if (
                    (null !== $cta->getStartDate() && $cta->getStartDate() > $today)
                    || (null !== $cta->getEndDate() && $cta->getEndDate() < $today)
                ) {
                    continue;
                }

                $coach = $cta->getCoach();
                $coachId = $coach->getId();
                if (null === $coachId || isset($coachesDataById[$coachId])) {
                    continue;
                }

                $assignmentType = $cta->getCoachTeamAssignmentType();

                $coachesDataById[$coachId] = [
                    'id' => $coachId,
                    'firstName' => $coach->getFirstName(),
                    'lastName' => $coach->getLastName(),
                    'fullName' => $coach->getFullName(),
                    'assignmentType' => $assignmentType ? [
                        'id' => $assignmentType->getId(),
                        'name' => $assignmentType->getName(),
                    ] : null,
                    'isMe' => in_array($coachId, $myCoachIds, true),
                    'myRelation' => $coachRelations[$coachId] ?? null,
                ];
            }

            $coachesData = array_values($coachesDataById);
            usort($coachesData, fn ($a, $b) => strcmp($a['fullName'], $b['fullName']));

            // Sortiere nach Trikotnummer
            usort($playersData, function ($a, $b) {
                if (null === $a['shirtNumber'] && null === $b['shirtNumber']) {
                    return 0;
                }
                if (null === $a['shirtNumber']) {
                    return 1;
                }
                if (null === $b['shirtNumber']) {
                    return -1;
                }

                return (int) $a['shirtNumber'] - (int) $b['shirtNumber'];
            });

            $teamsData[] = [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'ageGroup' => $team->getAgeGroup() ? [
                    'id' => $team->getAgeGroup()->getId(),
                    'name' => $team->getAgeGroup()->getName(),
                ] : null,
                'league' => $team->getLeague() ? [
                    'id' => $team->getLeague()->getId(),
                    'name' => $team->getLeague()->getName(),
                ] : null,
                'players' => $playersData,
                'coaches' => $coachesData,
                'playerCount' => count($playersData),
                'coachCount' => count($coachesData),
                'bannerImage' => $team->getBannerImage(),
                'canEditBanner' => $this->canEditBannerForTeam($user, $team),
            ];
        }

        // Nächste Termine (max. 5, ab jetzt)
        $now = new DateTime();
        $nextMonth = (clone $now)->modify('+30 days');
        $allEvents = $calendarEventRepository->findBetweenDates($now, $nextMonth);

        // Filtere auf Team-relevante Events (über CalendarEventPermissions, Spiele, Turniere)
        $upcomingEvents = [];
        foreach ($allEvents as $event) {
            // Prüfe ob Event einem der Teams des Nutzers zugeordnet ist
            $eventTeam = null;

            // 1. Über CalendarEventPermissions (z. B. Training)
            foreach ($event->getPermissions() as $permission) {
                $permTeam = $permission->getTeam();
                if (null !== $permTeam && in_array($permTeam->getId(), $teamIds, true)) {
                    $eventTeam = $permTeam;
                    break;
                }
            }

            // 2. Über verknüpftes Spiel (homeTeam / awayTeam)
            if (null === $eventTeam && null !== $event->getGame()) {
                $game = $event->getGame();
                $homeTeam = $game->getHomeTeam();
                $awayTeam = $game->getAwayTeam();
                if (null !== $homeTeam && in_array($homeTeam->getId(), $teamIds, true)) {
                    $eventTeam = $homeTeam;
                } elseif (null !== $awayTeam && in_array($awayTeam->getId(), $teamIds, true)) {
                    $eventTeam = $awayTeam;
                }
            }

            // 3. Über verknüpftes Turnier (TournamentTeam-Einträge)
            if (null === $eventTeam && null !== $event->getTournament()) {
                foreach ($event->getTournament()->getTeams() as $tournamentTeam) {
                    $team = $tournamentTeam->getTeam();
                    if (null !== $team && in_array($team->getId(), $teamIds, true)) {
                        $eventTeam = $team;
                        break;
                    }
                }
            }

            if (null !== $eventTeam) {
                $upcomingEvents[] = [
                    'id' => $event->getId(),
                    'title' => $event->getTitle(),
                    'startDate' => $event->getStartDate()?->format('c'),
                    'endDate' => $event->getEndDate()?->format('c'),
                    'location' => $event->getLocation()?->getName(),
                    'calendarEventType' => $event->getCalendarEventType() ? [
                        'name' => $event->getCalendarEventType()->getName(),
                        'color' => $event->getCalendarEventType()->getColor(),
                    ] : null,
                    'teamId' => $eventTeam->getId(),
                    'teamName' => $eventTeam->getName(),
                ];
            }

            if (count($upcomingEvents) >= 5) {
                break;
            }
        }

        // Offene Aufgaben des Nutzers
        $taskAssignmentRepo = $this->entityManager->getRepository(TaskAssignment::class);
        $openAssignments = $taskAssignmentRepo->findBy([
            'user' => $user,
            'status' => 'offen',
        ], ['assignedDate' => 'ASC']);

        $tasksData = [];
        foreach ($openAssignments as $assignment) {
            $task = $assignment->getTask();
            $tasksData[] = [
                'id' => $assignment->getId(),
                'taskId' => $task->getId(),
                'title' => $task->getTitle(),
                'description' => $task->getDescription(),
                'assignedDate' => $assignment->getAssignedDate()->format('c'),
                'status' => $assignment->getStatus(),
            ];
        }

        // Ermittle Rollen über UserRelations (wie ProfileController)
        $isCoach = false;
        $isPlayer = false;
        $userRelationRepo = $this->entityManager->getRepository(UserRelation::class);
        $userRelations = $userRelationRepo->findBy(['user' => $user]);
        foreach ($userRelations as $rel) {
            $relType = $rel->getRelationType();
            $category = $relType->getCategory();
            if ('coach' === $category) {
                $isCoach = true;
            }
            if ('player' === $category) {
                $isPlayer = true;
            }
        }

        return $this->json([
            'teams' => $teamsData,
            'upcomingEvents' => $upcomingEvents,
            'openTasks' => $tasksData,
            'isCoach' => $isCoach,
            'isPlayer' => $isPlayer,
        ]);
    }

    private function canEditBannerForTeam(User $user, \App\Entity\Team $team): bool
    {
        $roles = $user->getRoles();

        if (in_array('ROLE_SUPERADMIN', $roles, true) || in_array('ROLE_ADMIN', $roles, true)) {
            return true;
        }

        if (!in_array('ROLE_SUPPORTER', $roles, true)) {
            return false;
        }

        $teamId = $team->getId();
        foreach ($user->getUserRelations() as $relation) {
            $player = $relation->getPlayer();
            if (null !== $player) {
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($pta->getTeam()->getId() === $teamId) {
                        return true;
                    }
                }
            }

            $coach = $relation->getCoach();
            if (null !== $coach) {
                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    if ($cta->getTeam()->getId() === $teamId) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
