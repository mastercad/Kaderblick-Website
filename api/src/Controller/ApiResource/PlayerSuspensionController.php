<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\Team;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\PlayerSuspensionRepository;
use App\Service\SuspensionService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Liefert Sperr- und Gefährdungsstatus für Spieler.
 * Wird im Formations-Editor verwendet um gesperrte/gefährdete Spieler zu markieren.
 */
#[Route('/api')]
class PlayerSuspensionController extends AbstractController
{
    public function __construct(
        private readonly PlayerSuspensionRepository $suspensionRepository,
        private readonly GameEventRepository $gameEventRepository,
        private readonly CompetitionCardRuleRepository $cardRuleRepository,
        private readonly SuspensionService $suspensionService,
    ) {
    }

    /**
     * Gibt Sperr- und Gefährdungsstatus eines Spielers zurück.
     *
     * Optionaler Query-Parameter: ?gameId=123
     * Wenn gameId angegeben, wird der Status bezogen auf den Wettbewerb dieses Spiels geliefert.
     */
    #[Route('/player/{id}/suspension-status', name: 'api_player_suspension_status', methods: ['GET'])]
    public function playerStatus(Player $player): JsonResponse
    {
        if (!$this->isGranted('IS_AUTHENTICATED_FULLY')) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $activeSuspensions = $this->suspensionRepository->findAllActiveSuspensionsForPlayer($player);

        return $this->json([
            'playerId' => $player->getId(),
            'isSuspended' => count($activeSuspensions) > 0,
            'activeSuspensions' => array_map(
                fn ($s) => $this->serializeSuspension($s),
                $activeSuspensions,
            ),
        ]);
    }

    /**
     * Gibt Sperr- und Gefährdungsstatus aller Spieler eines Teams zurück.
     * Nützlich für den Formations-Editor: einmalig laden statt je Spieler abfragen.
     *
     * Optionaler Query-Parameter: ?gameId=123
     * Wenn gameId angegeben, wird außerdem der Gelb-Karten-Stand im Wettbewerb des Spiels
     * mitgeliefert (inklusive Gefährdungs-Flag).
     */
    #[Route('/team/{id}/players/suspension-status', name: 'api_team_suspension_status', methods: ['GET'])]
    public function teamStatus(Team $team, ?Game $game = null): JsonResponse
    {
        if (!$this->isGranted('IS_AUTHENTICATED_FULLY')) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $result = [];

        foreach ($team->getPlayerTeamAssignments() as $assignment) {
            $player = $assignment->getPlayer();
            $activeSuspensions = $this->suspensionRepository->findAllActiveSuspensionsForPlayer($player);

            $entry = [
                'playerId' => $player->getId(),
                'playerName' => $player->getFullName(),
                'isSuspended' => count($activeSuspensions) > 0,
                'activeSuspensions' => array_map(
                    fn ($s) => $this->serializeSuspension($s),
                    $activeSuspensions,
                ),
            ];

            $result[] = $entry;
        }

        return $this->json($result);
    }

    /**
     * Gibt für ein konkretes Spiel den Sperr-/Gefährdungsstatus aller beteiligten Spieler zurück.
     * Ideal für den Formations-Editor eines Spiels.
     */
    #[Route('/game/{id}/players/suspension-status', name: 'api_game_suspension_status', methods: ['GET'])]
    public function gameStatus(Game $game): JsonResponse
    {
        if (!$this->isGranted('IS_AUTHENTICATED_FULLY')) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $competitionType = $this->suspensionService->resolveCompetitionType($game);
        $competitionId = $this->suspensionService->resolveCompetitionId($game, $competitionType);

        $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId);

        $teams = array_filter([$game->getHomeTeam(), $game->getAwayTeam()]);
        $result = [];

        foreach ($teams as $team) {
            foreach ($team->getPlayerTeamAssignments() as $assignment) {
                $player = $assignment->getPlayer();

                $isSuspended = $this->suspensionRepository->isSuspended(
                    $player,
                    $competitionType,
                    $competitionId,
                );

                $yellowCount = $this->gameEventRepository->countYellowCardsForPlayerInCompetition(
                    $player,
                    $competitionType,
                    $competitionId,
                );

                $isAtRisk = !$isSuspended
                    && null !== $rule
                    && $yellowCount >= $rule->getYellowWarningThreshold();

                $result[] = [
                    'playerId' => $player->getId(),
                    'playerName' => $player->getFullName(),
                    'teamId' => $team->getId(),
                    'isSuspended' => $isSuspended,
                    'isAtRisk' => $isAtRisk,
                    'yellowCardCount' => $yellowCount,
                    'warningThreshold' => $rule?->getYellowWarningThreshold(),
                    'suspensionThreshold' => $rule?->getYellowSuspensionThreshold(),
                ];
            }
        }

        return $this->json($result);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSuspension(\App\Entity\PlayerSuspension $suspension): array
    {
        return [
            'id' => $suspension->getId(),
            'competitionType' => $suspension->getCompetitionType(),
            'competitionId' => $suspension->getCompetitionId(),
            'reason' => $suspension->getReason(),
            'gamesSuspended' => $suspension->getGamesSuspended(),
            'gamesServed' => $suspension->getGamesServed(),
            'remainingGames' => $suspension->getRemainingGames(),
            'createdAt' => $suspension->getCreatedAt()->format('Y-m-d H:i:s'),
        ];
    }
}
