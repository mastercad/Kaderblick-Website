<?php

namespace App\Controller\Api;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\Watchlist;
use App\Repository\CoachRepository;
use App\Repository\PlayerRepository;
use App\Repository\WatchlistRepository;
use App\Service\CoachSerializerService;
use App\Service\PlayerSerializerService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route(path: '/api/watchlist', name: 'api_watchlist_')]
#[IsGranted('IS_AUTHENTICATED')]
class WatchlistController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private WatchlistRepository $watchlistRepository,
        private PlayerRepository $playerRepository,
        private CoachRepository $coachRepository,
        private PlayerSerializerService $playerSerializer,
        private CoachSerializerService $coachSerializer
    ) {
    }

    /**
     * GET /api/watchlist
     * Returns all watchlist entries for the current user, including full player/coach data.
     */
    #[Route('', name: 'index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        $entries = $this->watchlistRepository->findForUser($user);

        $result = array_map(function (Watchlist $entry) {
            $data = [
                'id' => $entry->getId(),
                'isAnonymous' => $entry->isAnonymous(),
                'createdAt' => $entry->getCreatedAt()->format(DateTimeInterface::ATOM),
            ];

            if (null !== $entry->getWatchedPlayer()) {
                $data['type'] = 'player';
                $data['player'] = $this->playerSerializer->serializeForCurrentUser($entry->getWatchedPlayer());
            } else {
                $data['type'] = 'coach';
                $data['coach'] = $this->coachSerializer->serializeForCurrentUser($entry->getWatchedCoach());
            }

            return $data;
        }, $entries);

        return $this->json(['watchlist' => $result]);
    }

    /**
     * GET /api/watchlist/search?q=...&type=player|coach
     * Global search across all players/coaches (no club restriction).
     * Returns minimal data: id, name, current club.
     */
    #[Route('/search', name: 'search', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query->get('q', ''));
        $type = $request->query->get('type', 'player');

        if (strlen($q) < 2) {
            return $this->json(['results' => []]);
        }

        /** @var \App\Entity\User $user */
        $user = $this->getUser();

        if ('coach' === $type) {
            $coaches = $this->coachRepository->searchGlobal($q, 20);
            $watchedIds = array_map(
                fn (Watchlist $e) => $e->getWatchedCoach()?->getId(),
                array_filter(
                    $this->watchlistRepository->findForUser($user),
                    fn (Watchlist $e) => null !== $e->getWatchedCoach()
                )
            );
            $results = array_map(function (Coach $coach) use ($watchedIds) {
                $currentClub = null;
                foreach ($coach->getCoachClubAssignments() as $a) {
                    if (null === $a->getEndDate() || $a->getEndDate() >= new DateTimeImmutable('today')) {
                        $currentClub = $a->getClub()->getName();
                        break;
                    }
                }

                return [
                    'id' => $coach->getId(),
                    'name' => $coach->getFirstName() . ' ' . $coach->getLastName(),
                    'currentClub' => $currentClub,
                    'isWatched' => in_array($coach->getId(), $watchedIds, true),
                ];
            }, $coaches);
        } else {
            $players = $this->playerRepository->searchGlobal($q, 20);
            $watchedIds = array_map(
                fn (Watchlist $e) => $e->getWatchedPlayer()?->getId(),
                array_filter(
                    $this->watchlistRepository->findForUser($user),
                    fn (Watchlist $e) => null !== $e->getWatchedPlayer()
                )
            );
            $results = array_map(function (Player $player) use ($watchedIds) {
                $currentClub = null;
                foreach ($player->getPlayerClubAssignments() as $a) {
                    if (null === $a->getEndDate() || $a->getEndDate() >= new DateTimeImmutable('today')) {
                        $currentClub = $a->getClub()->getName();
                        break;
                    }
                }

                return [
                    'id' => $player->getId(),
                    'name' => $player->getFirstName() . ' ' . $player->getLastName(),
                    'currentClub' => $currentClub,
                    'isWatched' => in_array($player->getId(), $watchedIds, true),
                ];
            }, $players);
        }

        return $this->json(['results' => $results]);
    }

    /**
     * Body: { type: 'player'|'coach', targetId: int, isAnonymous?: bool }.
     */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();

        $body = json_decode($request->getContent(), true);
        $type = $body['type'] ?? null;
        $targetId = isset($body['targetId']) ? (int) $body['targetId'] : null;
        $isAnonymous = isset($body['isAnonymous']) ? (bool) $body['isAnonymous'] : true;

        if (!in_array($type, ['player', 'coach'], true) || null === $targetId) {
            return $this->json(['error' => 'Ungültige Anfrage. Erwartet: type (player|coach) und targetId.'], Response::HTTP_BAD_REQUEST);
        }

        $entry = new Watchlist();
        $entry->setWatcher($user);
        $entry->setIsAnonymous($isAnonymous);

        if ('player' === $type) {
            $player = $this->playerRepository->find($targetId);
            if (null === $player) {
                return $this->json(['error' => 'Spieler nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            if (null !== $this->watchlistRepository->findByWatcherAndPlayer($user, $player)) {
                return $this->json(['error' => 'Spieler wird bereits beobachtet.'], Response::HTTP_CONFLICT);
            }
            $entry->setWatchedPlayer($player);
        } else {
            $coach = $this->coachRepository->find($targetId);
            if (null === $coach) {
                return $this->json(['error' => 'Trainer nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            if (null !== $this->watchlistRepository->findByWatcherAndCoach($user, $coach)) {
                return $this->json(['error' => 'Trainer wird bereits beobachtet.'], Response::HTTP_CONFLICT);
            }
            $entry->setWatchedCoach($coach);
        }

        $this->entityManager->persist($entry);
        $this->entityManager->flush();

        return $this->json(['id' => $entry->getId()], Response::HTTP_CREATED);
    }

    /**
     * PATCH /api/watchlist/{id}
     * Body: { isAnonymous: bool }.
     */
    #[Route('/{id}', name: 'update', methods: ['PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $entry = $this->getOwnEntryOr404($id);
        if ($entry instanceof JsonResponse) {
            return $entry;
        }

        $body = json_decode($request->getContent(), true);
        if (isset($body['isAnonymous'])) {
            $entry->setIsAnonymous((bool) $body['isAnonymous']);
            $this->entityManager->flush();
        }

        return $this->json(['success' => true]);
    }

    /**
     * DELETE /api/watchlist/{id}.
     */
    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $entry = $this->getOwnEntryOr404($id);
        if ($entry instanceof JsonResponse) {
            return $entry;
        }

        $this->entityManager->remove($entry);
        $this->entityManager->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Loads a watchlist entry owned by the current user or returns a 404/403 response.
     */
    private function getOwnEntryOr404(int $id): Watchlist|JsonResponse
    {
        $entry = $this->watchlistRepository->find($id);
        if (null === $entry) {
            return $this->json(['error' => 'Eintrag nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        if ($entry->getWatcher()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        return $entry;
    }
}
