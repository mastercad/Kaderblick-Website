<?php

namespace App\Controller;

use App\Entity\Coach;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Player;
use App\Event\GameEventCreatedEvent;
use App\Event\GameEventUpdatedEvent;
use App\Repository\CoachRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameEventTypeRepository;
use App\Repository\PlayerRepository;
use App\Repository\SubstitutionReasonRepository;
use App\Security\Voter\GameEventVoter;
use App\Security\Voter\GameVoter;
use App\Service\FussballDeCrawlerService;
use App\Service\GameDetailsSyncService;
use DateTime;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class GameEventsController extends AbstractController
{
    #[Route('/game/{id}/events', name: 'game_event_public', methods: ['GET'])]
    public function form(
        Game $game,
        GameEventTypeRepository $eventTypeRepo,
        PlayerRepository $playerRepo,
        GameEventRepository $eventRepo,
        SubstitutionReasonRepository $substitutionReasonRepo
    ): Response {
        if (!$this->isGranted(GameVoter::VIEW, $game)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $eventTypes = $eventTypeRepo->findAll();
        $teams = array_filter([$game->getHomeTeam(), $game->getAwayTeam()]);
        $players = $playerRepo->findActiveByTeams($teams);
        $events = $eventRepo->findBy(['game' => $game], ['timestamp' => 'ASC']);
        $substitutionReasons = $substitutionReasonRepo->fetchFullList();

        return $this->render('game_event/public_form.html.twig', [
            'game' => $game,
            'gameStartDate' => $game->getCalendarEvent()->getStartDate(),
            'eventTypes' => $eventTypes,
            'players' => $players,
            'events' => $events,
            'teams' => $teams,
            'substitutionReasons' => $substitutionReasons
        ]);
    }

    #[Route('/api/game/{id}/event', name: 'api_game_event_add', methods: ['POST'])]
    public function addEvent(
        Game $game,
        Request $request,
        EntityManagerInterface $em,
        PlayerRepository $playerRepo,
        CoachRepository $coachRepo,
        GameEventTypeRepository $eventTypeRepo,
        SubstitutionReasonRepository $substitutionReasonRepo,
        EventDispatcherInterface $dispatcher,
    ): JsonResponse {
        // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER oder Trainer dürfen Spielereignisse anlegen
        $this->denyAccessUnlessGranted(GameEventVoter::CREATE, $game);

        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['error' => 'Invalid data'], 400);
        }
        $event = new GameEvent();
        $event->setGame($game);
        $eventType = $eventTypeRepo->find($data['eventType'] ?? null);
        $event->setGameEventType($eventType);

        $coach = !empty($data['coach']) ? $coachRepo->find($data['coach']) : null;
        $player = null === $coach ? $playerRepo->find($data['player'] ?? null) : null;
        $event->setCoach($coach);
        $event->setPlayer($player);

        $isSubstitution = false;
        if ($eventType) {
            $name = mb_strtolower($eventType->getName());
            $code = mb_strtolower($eventType->getCode());
            $isSubstitution = str_contains($name, 'wechsel') || str_contains($code, 'sub');
        }
        if ($isSubstitution && !empty($data['relatedPlayer'])) {
            $event->setRelatedPlayer($playerRepo->find($data['relatedPlayer']));
        } else {
            $event->setRelatedPlayer(null);
        }

        $team = null;
        if ($player) {
            $assignments = $player->getPlayerTeamAssignments();
            $currentDate = new DateTime();
            foreach ($assignments as $pta) {
                $ptaTeam = $pta->getTeam();
                $ptaEnd = $pta->getEndDate();
                $isActive = (null === $ptaEnd) || ($ptaEnd >= $currentDate);
                if ($isActive && ($ptaTeam === $game->getHomeTeam() || $ptaTeam === $game->getAwayTeam())) {
                    $team = $ptaTeam;
                    break;
                }
            }
        } elseif ($coach) {
            $currentDate = new DateTime();
            foreach ($coach->getCoachTeamAssignments() as $cta) {
                $ctaTeam = $cta->getTeam();
                $ctaEnd = $cta->getEndDate();
                $isActive = (null === $ctaEnd) || ($ctaEnd >= $currentDate);
                if ($isActive && ($ctaTeam === $game->getHomeTeam() || $ctaTeam === $game->getAwayTeam())) {
                    $team = $ctaTeam;
                    break;
                }
            }
        }
        // Fallback: team from request data
        if (null === $team && !empty($data['team'])) {
            $team = $em->find(\App\Entity\Team::class, (int) $data['team']);
        }
        $event->setTeam($team);

        /** @var DateTime $startDate */
        $startDate = $event->getGame()->getCalendarEvent()->getStartDate();
        $seconds = $this->convertUserInputToSeconds($data['minute'] ?? 1, $startDate);
        $event->setTimestamp($startDate->modify('+' . $seconds . ' seconds'));

        if ($isSubstitution && !empty($data['reason'])) {
            $reasonEntity = $substitutionReasonRepo->find($data['reason']);
            $event->setDescription($reasonEntity ? $reasonEntity->getName() : $data['reason']);
        } else {
            $event->setDescription($data['description'] ?? null);
        }
        $em->persist($event);
        $em->flush();

        /** @var \App\Entity\User $currentUser */
        $currentUser = $this->getUser();
        if (null !== $currentUser) {
            $dispatcher->dispatch(new GameEventCreatedEvent($currentUser, $event));
        }

        return $this->json(['success' => true]);
    }

    #[Route('/api/game/{id}/events', name: 'api_game_event_list', methods: ['GET'])]
    public function listEvents(Game $game, GameEventRepository $eventRepo): JsonResponse
    {
        $events = $eventRepo->findBy(['game' => $game], ['timestamp' => 'ASC']);
        $result = [];
        foreach ($events as $event) {
            $result[] = [
                'id' => $event->getId(),
                'type' => $event->getGameEventType()?->getName(),
                'typeId' => $event->getGameEventType()?->getId(),
                'typeIcon' => $event->getGameEventType()?->getIcon(),
                'typeColor' => $event->getGameEventType()?->getColor(),
                'minute' => $this->calculateDateDiffInSeconds($event->getGame()->getCalendarEvent()->getStartDate(), $event->getTimestamp()),
                'player' => $event->getPlayer()?->getFullName(),
                'playerId' => $event->getPlayer()?->getId(),
                'playerAvatarUrl' => $this->retrievePlayerAvatarUrl($event->getPlayer()),
                'relatedPlayer' => $event->getRelatedPlayer()?->getFullName(),
                'relatedPlayerId' => $event->getRelatedPlayer()?->getId(),
                'coach' => $event->getCoach()?->getFullName(),
                'coachId' => $event->getCoach()?->getId(),
                'teamId' => $event->getTeam()->getId(),
                'description' => $event->getDescription(),
            ];
        }

        return $this->json($result);
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

    #[Route('/api/game/{gameId}/event/{eventId}', name: 'api_game_event_update', methods: ['PUT', 'PATCH'])]
    public function updateEvent(
        int $gameId,
        int $eventId,
        Request $request,
        EntityManagerInterface $em,
        GameEventRepository $eventRepo,
        PlayerRepository $playerRepo,
        CoachRepository $coachRepo,
        GameEventTypeRepository $eventTypeRepo,
        SubstitutionReasonRepository $substitutionReasonRepo,
        EventDispatcherInterface $dispatcher,
    ): JsonResponse {
        $event = $eventRepo->find($eventId);
        if (!$event || $event->getGame()->getId() !== $gameId) {
            return $this->json(['error' => 'Event not found'], 404);
        }

        // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER oder Trainer dürfen Spielereignisse bearbeiten
        $this->denyAccessUnlessGranted(GameEventVoter::EDIT, $event);

        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['error' => 'Invalid data'], 400);
        }
        if (isset($data['eventType'])) {
            $eventType = $eventTypeRepo->find($data['eventType']);
            $event->setGameEventType($eventType);
        }
        if (isset($data['player'])) {
            $event->setPlayer($playerRepo->find($data['player']));
            $event->setCoach(null); // player takes precedence
        }
        if (array_key_exists('coach', $data)) {
            if (null !== $data['coach']) {
                $event->setCoach($coachRepo->find($data['coach']));
                $event->setPlayer(null); // coach takes precedence
            } else {
                $event->setCoach(null);
            }
        }
        if (isset($data['relatedPlayer'])) {
            $event->setRelatedPlayer($playerRepo->find($data['relatedPlayer']));
        } elseif (array_key_exists('relatedPlayer', $data)) {
            $event->setRelatedPlayer(null);
        }
        if (isset($data['minute'])) {
            /** @var DateTime $startDate */
            $startDate = $event->getGame()->getCalendarEvent()->getStartDate();
            $seconds = $this->convertUserInputToSeconds($data['minute'] ?? '00:00:01', $startDate);
            $event->setTimestamp($startDate->modify('+' . $seconds . ' seconds'));
        }
        if (isset($data['description'])) {
            $event->setDescription($data['description']);
        }
        if (isset($data['reason'])) {
            $reasonEntity = $substitutionReasonRepo->find($data['reason']);
            $event->setDescription($reasonEntity ? $reasonEntity->getName() : $data['reason']);
        }
        $em->flush();

        /** @var \App\Entity\User $currentUser */
        $currentUser = $this->getUser();
        if (null !== $currentUser) {
            $dispatcher->dispatch(new GameEventUpdatedEvent($currentUser, $event));
        }

        return $this->json(['success' => true]);
    }

    #[Route('/api/game/{gameId}/event/{eventId}', name: 'api_game_event_delete', methods: ['DELETE'])]
    public function deleteEvent(
        int $gameId,
        int $eventId,
        EntityManagerInterface $em,
        GameEventRepository $eventRepo
    ): JsonResponse {
        $event = $eventRepo->find($eventId);
        if (!$event || $event->getGame()->getId() !== $gameId) {
            return $this->json(['error' => 'Event not found'], 404);
        }

        // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER oder Trainer dürfen Spielereignisse löschen
        $this->denyAccessUnlessGranted(GameEventVoter::DELETE, $event);

        $em->remove($event);
        $em->flush();

        return $this->json(['success' => true]);
    }

    private function calculateDateDiffInSeconds(DateTimeInterface $dateStart, DateTimeInterface $dateCurrent): int
    {
        $diff = $dateCurrent->diff($dateStart);

        return ($diff->days * 24 * 60 * 60) + ($diff->h * 60 * 60) + ($diff->i * 60) + $diff->s;
    }

    #[Route('/api/game/{id}/sync-fussballde', name: 'api_game_event_sync_fussballde', methods: ['POST'])]
    public function syncFussballDe(
        Game $game,
        FussballDeCrawlerService $crawlerService,
        GameDetailsSyncService $syncService
    ): JsonResponse {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');
        $url = $game->getFussballDeUrl();
        if (!$url) {
            return $this->json(['error' => 'Keine fussball.de-URL für dieses Spiel hinterlegt.'], 400);
        }
        $details = $crawlerService->parseGameDetailsHtmlFromUrl($url);
        if (empty($details)) {
            return $this->json(['error' => 'Konnte Spieldetails nicht abrufen.'], 400);
        }
        $syncService->syncGameDetails($details);

        return $this->json(['success' => true]);
    }

    private function convertUserInputToSeconds(string $time, DateTime $gameStartDate): int
    {
        $timeParts = explode(':', $time);

        if (3 === count($timeParts)) {
            $hours = (int) $timeParts[0];

            if ($hours >= 2) {
                $diff = $gameStartDate->diff(new DateTimeImmutable($time));

                return ($diff->h * 3600) + ($diff->i * 60) + $diff->s;
            }

            $minutes = (int) $timeParts[1];
            $seconds = (int) $timeParts[2];

            return ($hours * 3600) + ($minutes * 60) + $seconds;
        }

        if (2 === count($timeParts)) {
            $minutes = (int) $timeParts[0];
            $seconds = (int) $timeParts[1];

            return ($minutes * 60) + $seconds;
        }

        return (int) $timeParts[0];
    }
}
