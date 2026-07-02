<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use App\Entity\GameEvent;
use App\Entity\User;
use App\Repository\GameEventRepository;
use App\Repository\PlayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Endpunkte für Spielereignisse ohne Spieler-Zuweisung.
 *
 * GET   /api/admin/unknown-game-events              Liste (gefiltert nach Rolle)
 * GET   /api/admin/unknown-game-events/{id}/players Spieler beider Teams des Spiels
 * PATCH /api/admin/unknown-game-events/{id}/assign  Spieler zuweisen
 */
class UnknownGameEventsController extends AbstractController
{
    public function __construct(
        private readonly GameEventRepository $gameEventRepository,
        private readonly PlayerRepository $playerRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    // ── GET /api/admin/unknown-game-events ────────────────────────────────────

    #[Route('/api/admin/unknown-game-events', name: 'api_admin_unknown_game_events_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        /** @var User $user */
        $user = $this->getUser();

        if (!$this->hasRequiredAccess($user)) {
            throw $this->createAccessDeniedException();
        }

        $events = $this->gameEventRepository->findUnknownPlayerEvents($user);

        $data = array_map(fn (GameEvent $event) => $this->serializeEvent($event), $events);

        return $this->json($data);
    }

    // ── GET /api/admin/unknown-game-events/{id}/players ───────────────────────

    #[Route('/api/admin/unknown-game-events/{id}/players', name: 'api_admin_unknown_game_events_players', methods: ['GET'])]
    public function playersForEvent(GameEvent $event): JsonResponse
    {
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        /** @var User $user */
        $user = $this->getUser();

        if (!$this->hasRequiredAccess($user) || !$this->gameEventRepository->userCanAccessGameEvent($event, $user)) {
            throw $this->createAccessDeniedException();
        }

        $game = $event->getGame();
        $teams = array_filter([
            $game->getHomeTeam(),
            $game->getAwayTeam(),
        ]);

        $players = $this->playerRepository->findActiveByTeams($teams);

        $data = array_map(fn ($player) => [
            'id' => $player->getId(),
            'fullName' => $player->getFullName(),
        ], $players);

        usort($data, fn ($a, $b) => strcmp($a['fullName'], $b['fullName']));

        return $this->json($data);
    }

    // ── PATCH /api/admin/unknown-game-events/{id}/assign ─────────────────────

    #[Route('/api/admin/unknown-game-events/{id}/assign', name: 'api_admin_unknown_game_events_assign', methods: ['PATCH'])]
    public function assignPlayer(GameEvent $event, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        /** @var User $user */
        $user = $this->getUser();

        if (!$this->hasRequiredAccess($user) || !$this->gameEventRepository->userCanAccessGameEvent($event, $user)) {
            throw $this->createAccessDeniedException();
        }

        $body = json_decode((string) $request->getContent(), true);
        $playerId = $body['playerId'] ?? null;

        if (!is_int($playerId) && !is_string($playerId)) {
            return $this->json(['error' => 'playerId fehlt'], Response::HTTP_BAD_REQUEST);
        }

        $player = $this->playerRepository->find((int) $playerId);

        if (null === $player) {
            return $this->json(['error' => 'Spieler nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        // Sicherheitsprüfung: Spieler muss zu einem der Spielteams gehören
        $game = $event->getGame();
        $teams = array_filter([
            $game->getHomeTeam(),
            $game->getAwayTeam(),
        ]);

        $playersForGame = $this->playerRepository->findActiveByTeams($teams);
        $playerIds = array_map(fn ($p) => $p->getId(), $playersForGame);

        if (!in_array($player->getId(), $playerIds, true)) {
            return $this->json(['error' => 'Spieler gehört nicht zu einem der beteiligten Teams'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $event->setPlayer($player);
        $this->em->flush();

        return $this->json($this->serializeEvent($event));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function hasRequiredAccess(User $user): bool
    {
        $roles = $user->getRoles();

        if (in_array('ROLE_SUPERADMIN', $roles, true)) {
            return true;
        }

        // Trainer-Zugang: User hat mindestens eine Coach-Relation
        foreach ($user->getUserRelations() as $userRelation) {
            if (null !== $userRelation->getCoach()) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEvent(GameEvent $event): array
    {
        $game = $event->getGame();
        $calEvent = $game->getCalendarEvent();
        $startDate = $calEvent?->getStartDate();
        $team = $event->getTeam();

        $minute = null;
        if (null !== $startDate) {
            $diffSeconds = $event->getTimestamp()->getTimestamp() - $startDate->getTimestamp();
            $minute = (int) max(1, ceil($diffSeconds / 60));
        }

        return [
            'id' => $event->getId(),
            'eventType' => $event->getGameEventType()?->getName(),
            'eventTypeCode' => $event->getGameEventType()?->getCode(),
            'minute' => $minute,
            'timestamp' => $event->getTimestamp()->format('Y-m-d H:i:s'),
            'description' => $event->getDescription(),
            'team' => $team ? [
                'id' => $team->getId(),
                'name' => $team->getName(),
            ] : null,
            'game' => [
                'id' => $game->getId(),
                'homeTeam' => $game->getHomeTeam()?->getName(),
                'awayTeam' => $game->getAwayTeam()?->getName(),
                'date' => $startDate?->format('Y-m-d'),
            ],
        ];
    }
}
