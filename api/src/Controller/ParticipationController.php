<?php

namespace App\Controller;

use App\Entity\CalendarEvent;
use App\Entity\Participation;
use App\Entity\User;
use App\Event\CalendarEventParticipatedEvent;
use App\Event\MatchAttendedEvent;
use App\Event\TrainingAttendedEvent;
use App\Repository\ParticipationRepository;
use App\Repository\ParticipationStatusRepository;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/participation', name: 'api_participation_')]
class ParticipationController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private ParticipationRepository $participationRepository,
        private ParticipationStatusRepository $participationStatusRepository,
        private NotificationService $notificationService,
        private TeamMembershipService $teamMembershipService,
        private EventDispatcherInterface $dispatcher
    ) {
    }

    #[Route('/event/{id}', name: 'status', methods: ['GET'])]
    public function getEventParticipations(CalendarEvent $event): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if ($user instanceof User && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            if (!$this->teamMembershipService->canUserParticipateInEvent($user, $event)) {
                return $this->json(['error' => 'Keine Berechtigung für dieses Event'], 403);
            }
        }

        $participations = $this->participationRepository->findBy(['event' => $event]);

        $participationData = [];
        $currentUser = $this->getUser();
        $myParticipation = null;

        // Nur Benutzer mit tatsächlichen Teilnahmen anzeigen
        foreach ($participations as $participation) {
            $participationUser = $participation->getUser();
            $participationData[] = [
                'user_id' => $participationUser->getId(),
                'user_name' => $participationUser->getFirstName() . ' ' . $participationUser->getLastName(),
                'status' => [
                    'id' => $participation->getStatus()->getId(),
                    'name' => $participation->getStatus()->getName(),
                    'code' => $participation->getStatus()->getCode(),
                    'color' => $participation->getStatus()->getColor(),
                    'icon' => $participation->getStatus()->getIcon()
                ],
                'note' => $participation->getNote(),
                'is_team_player' => $this->isTeamPlayer($participationUser, $event)
            ];

            // Eigene Teilnahme für den aktuellen Benutzer merken
            if ($currentUser instanceof User && $participationUser->getId() === $currentUser->getId()) {
                $myParticipation = [
                    'status_id' => $participation->getStatus()->getId(),
                    'status_name' => $participation->getStatus()->getName(),
                    'status_code' => $participation->getStatus()->getCode(),
                    'status_color' => $participation->getStatus()->getColor(),
                    'status_icon' => $participation->getStatus()->getIcon(),
                    'note' => $participation->getNote(),
                ];
            }
        }

        return $this->json([
            'event' => [
                'id' => $event->getId(),
                'title' => $event->getTitle(),
                'type' => $event->getCalendarEventType()?->getName() ?? 'Unbekannt',
                'is_game' => null !== $event->getGame()
            ],
            'participations' => $participationData,
            'available_statuses' => $this->getAvailableStatuses($event),
            'my_participation' => $myParticipation,
        ]);
    }

    #[Route('/event/{id}/respond', name: 'respond', methods: ['POST'])]
    public function respond(Request $request, CalendarEvent $event): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user) {
            return $this->json(['error' => 'Benutzer nicht authentifiziert'], 401);
        }

        // Prüfen ob der Benutzer berechtigt ist an diesem Event teilzunehmen
        if (!$this->canUserParticipate($user, $event)) {
            return $this->json(['error' => 'Sie sind nicht berechtigt an diesem Event teilzunehmen'], 403);
        }

        $requestData = json_decode($request->getContent(), true);
        $statusId = $requestData['status_id'] ?? null;
        $note = $requestData['note'] ?? '';

        $status = $this->participationStatusRepository->find($statusId);
        if (!$status) {
            return $this->json(['error' => 'Ungültiger Status'], 400);
        }

        // Bestehende Teilnahme suchen oder neue erstellen
        $participation = $this->participationRepository->findOneBy([
            'event' => $event,
            'user' => $user
        ]) ?? new Participation();

        // Track if this is a status change for notification
        $isStatusChange = false;
        $oldStatus = null;
        if ($participation->getId()) {
            $oldStatus = $participation->getStatus();
            $isStatusChange = $oldStatus && $oldStatus->getId() !== $status->getId();
        }

        $participation->setUser($user)
            ->setEvent($event)
            ->setStatus($status)
            ->setNote($note);

        $this->em->persist($participation);
        $this->em->flush();

        // Dispatch XP event based on participation status and event type
        if ('attending' === $status->getCode()) {
            $eventTypeName = $event->getCalendarEventType()?->getName() ?? '';
            if ('Training' === $eventTypeName) {
                $this->dispatcher->dispatch(new TrainingAttendedEvent($user, $event));
            } elseif (in_array($eventTypeName, ['Spiel', 'Turnier-Match'], true)) {
                $this->dispatcher->dispatch(new MatchAttendedEvent($user, $event));
            } else {
                $this->dispatcher->dispatch(new CalendarEventParticipatedEvent($user, $event));
            }
        }

        // Create notifications for other participants when a user changed
        // their participation status (the actor does not need a notification).
        if ($isStatusChange || !$participation->getId()) {
            $actorName = $user->getFullName() ?? 'Ein Teilnehmer';

            // Get all participations for this event and notify all users
            // except the actor.
            $allParticipations = $this->participationRepository->findByEvent($event);

            foreach ($allParticipations as $p) {
                $recipient = $p->getUser();
                if (!$recipient || $recipient->getId() === $user->getId()) {
                    continue;
                }

                $statusText = match ($status->getCode()) {
                    'attending' => 'zugesagt',
                    'not_attending' => 'abgesagt',
                    'maybe' => 'vielleicht',
                    default => $status->getCode()
                };

                $eventDate = $event->getStartDate()?->format('d.m.Y H:i') ?? '';
                $location = $event->getLocation();

                $title = sprintf('%s: %s – %s', $event->getTitle(), $actorName, $statusText);
                $lines = [];
                if ('' !== $eventDate) {
                    $lines[] = '📅 ' . $eventDate;
                }
                if ($location) {
                    $lines[] = '📍 ' . $location->getName();
                }
                $lines[] = sprintf('%s hat seine Teilnahme auf „%s" gesetzt.', $actorName, $statusText);
                $message = implode("\n", $lines);

                $this->notificationService->createNotification(
                    $recipient,
                    'participation',
                    $title,
                    $message,
                    [
                        'participationId' => $participation->getId(),
                        'actorId' => $user->getId(),
                        'url' => '/calendar?eventId=' . $event->getId(),
                    ]
                );
            }
        }

        return $this->json([
            'message' => 'Teilnahmestatus erfolgreich aktualisiert',
            'my_participation' => [
                'status_id' => $status->getId(),
                'status_name' => $status->getName(),
                'status_code' => $status->getCode(),
                'status_color' => $status->getColor(),
                'status_icon' => $status->getIcon(),
                'note' => $participation->getNote(),
            ],
        ]);
    }

    /**
     * Returns all event teams with all their members and each member's participation status.
     * Used for the "who has/hasn't responded" overview in the frontend.
     */
    #[Route('/event/{id}/overview', name: 'overview', methods: ['GET'])]
    public function getEventOverview(CalendarEvent $event): JsonResponse
    {
        /** @var User|null $currentUser */
        $currentUser = $this->getUser();

        if ($currentUser instanceof User && !in_array('ROLE_SUPERADMIN', $currentUser->getRoles())) {
            if (!$this->teamMembershipService->canUserParticipateInEvent($currentUser, $event)) {
                return $this->json(['error' => 'Keine Berechtigung für dieses Event'], 403);
            }
        }

        // Build a map of userId → participation for fast lookup
        $participationMap = [];
        foreach ($this->participationRepository->findBy(['event' => $event]) as $participation) {
            $participationMap[$participation->getUser()->getId()] = $participation;
        }

        // Get all teams involved in this event
        $teams = $this->teamMembershipService->getEventTeams($event);

        // Determine which team(s) the current user belongs to
        $myTeamId = null;
        if ($currentUser instanceof User) {
            foreach ($teams as $team) {
                if ($this->teamMembershipService->isUserInTeam($currentUser, $team)) {
                    $myTeamId = $team->getId();
                    break;
                }
            }
        }

        $teamsData = [];
        foreach ($teams as $team) {
            $members = $this->teamMembershipService->resolveTeamMembers($team);
            $membersData = [];
            foreach ($members as $member) {
                $participation = $participationMap[$member->getId()] ?? null;
                $membersData[] = [
                    'user_id' => $member->getId(),
                    'user_name' => $member->getFirstName() . ' ' . $member->getLastName(),
                    'participation' => $participation ? [
                        'status_id' => $participation->getStatus()->getId(),
                        'status_name' => $participation->getStatus()->getName(),
                        'status_code' => $participation->getStatus()->getCode(),
                        'status_color' => $participation->getStatus()->getColor(),
                        'note' => $participation->getNote(),
                    ] : null,
                ];
            }
            // Sort: responded first (by status name), then unresponded alphabetically
            usort($membersData, static function (array $a, array $b): int {
                $aHas = null !== $a['participation'];
                $bHas = null !== $b['participation'];
                if ($aHas !== $bHas) {
                    return $aHas ? -1 : 1;
                }

                return strcmp($a['user_name'], $b['user_name']);
            });
            $teamsData[] = [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'members' => $membersData,
            ];
        }

        return $this->json([
            'teams' => $teamsData,
            'my_team_id' => $myTeamId,
        ]);
    }

    #[Route('/statuses', name: 'statuses', methods: ['GET'])]
    public function getParticipationStatuses(): JsonResponse
    {
        $statuses = $this->participationStatusRepository->findBy([], ['sortOrder' => 'ASC']);

        return $this->json([
            'statuses' => array_map(fn ($status) => [
                'id' => $status->getId(),
                'name' => $status->getName(),
                'code' => $status->getCode(),
                'color' => $status->getColor(),
                'icon' => $status->getIcon(),
                'sort_order' => $status->getSortOrder()
            ], $statuses)
        ]);
    }

    /**
     * Ermittelt die verfügbaren Status für ein Event.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getAvailableStatuses(CalendarEvent $event): array
    {
        // Alle Status sind erstmal verfügbar - könnte später je nach Event-Typ gefiltert werden
        $statuses = $this->participationStatusRepository->findBy([], ['sortOrder' => 'ASC']);

        return array_map(fn ($status) => [
            'id' => $status->getId(),
            'name' => $status->getName(),
            'code' => $status->getCode(),
            'color' => $status->getColor(),
            'icon' => $status->getIcon(),
            'sort_order' => $status->getSortOrder()
        ], $statuses);
    }

    /**
     * Prüft ob ein Benutzer Spieler in einem der beteiligten Teams ist.
     */
    private function isTeamPlayer(User $user, CalendarEvent $event): bool
    {
        $game = $event->getGame();
        if (!$game) {
            return false;
        }

        // Finde die Player-Relation des Users
        $playerRelation = null;
        foreach ($user->getUserRelations() as $relation) {
            if (
                $relation->getPlayer()
                && 'player' === $relation->getRelationType()->getCategory()
                && 'self_player' === $relation->getRelationType()->getIdentifier()
            ) {
                $playerRelation = $relation;
                break;
            }
        }

        if (!$playerRelation || !$playerRelation->getPlayer()) {
            return false;
        }

        $player = $playerRelation->getPlayer();

        // Prüfen ob Spieler in einem der Teams spielt
        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            $team = $assignment->getTeam();
            if ($team === $game->getHomeTeam() || $team === $game->getAwayTeam()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Prüft ob ein Benutzer an einem Event teilnehmen kann.
     * Nur Teammitglieder dürfen zu- oder absagen.
     */
    private function canUserParticipate(User $user, CalendarEvent $event): bool
    {
        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return true;
        }

        return $this->teamMembershipService->canUserParticipateInEvent($user, $event);
    }
}
