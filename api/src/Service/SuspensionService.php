<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\CompetitionCardRule;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\PlayerSuspensionRepository;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Verwaltet die Kartensperren-Logik:
 * - Auswertung von Kartenevents (Gelb / Rot / Gelb-Rot)
 * - Anlegen von Sperren in player_suspensions
 * - Benachrichtigung von Spieler und Trainern
 */
class SuspensionService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly GameEventRepository $gameEventRepository,
        private readonly PlayerSuspensionRepository $suspensionRepository,
        private readonly CompetitionCardRuleRepository $cardRuleRepository,
        private readonly NotificationService $notificationService,
    ) {
    }

    /**
     * Haupteinstieg: wird nach dem Persistieren eines GameEvents aufgerufen.
     * Prüft ob ein Karten-Schwellenwert erreicht wurde und handelt entsprechend.
     */
    public function handleCardEvent(GameEvent $gameEvent): void
    {
        $player = $gameEvent->getPlayer();
        if (null === $player) {
            return;
        }

        $code = $gameEvent->getGameEventType()?->getCode();
        if (null === $code) {
            return;
        }

        $isYellow = 'yellow_card' === $code;
        $isRed = 'red_card' === $code;
        $isYellowRed = 'yellow_red_card' === $code;

        if (!$isYellow && !$isRed && !$isYellowRed) {
            return;
        }

        $game = $gameEvent->getGame();
        $competitionType = $this->resolveCompetitionType($game);
        $competitionId = $this->resolveCompetitionId($game, $competitionType);
        $team = $gameEvent->getTeam();

        if ($isRed || $isYellowRed) {
            $this->handleDirectSuspension($player, $team, $game, $competitionType, $competitionId, $code);

            return;
        }

        // Gelbe Karte: Zähler prüfen
        $this->handleYellowCard($player, $team, $game, $competitionType, $competitionId);
    }

    /**
     * Gibt den Wettbewerbstyp eines Spiels zurück.
     *
     * @return string one of CompetitionCardRule::TYPE_*
     */
    public function resolveCompetitionType(Game $game): string
    {
        if (null !== $game->getLeague()) {
            return CompetitionCardRule::TYPE_LEAGUE;
        }

        if (null !== $game->getCup()) {
            return CompetitionCardRule::TYPE_CUP;
        }

        if (null !== $game->getTournamentMatch()) {
            return CompetitionCardRule::TYPE_TOURNAMENT;
        }

        return CompetitionCardRule::TYPE_FRIENDLY;
    }

    /**
     * Gibt die ID des Wettbewerbs zurück (league_id / cup_id / tournament_id).
     */
    public function resolveCompetitionId(Game $game, string $competitionType): ?int
    {
        return match ($competitionType) {
            CompetitionCardRule::TYPE_LEAGUE => $game->getLeague()?->getId(),
            CompetitionCardRule::TYPE_CUP => $game->getCup()?->getId(),
            CompetitionCardRule::TYPE_TOURNAMENT => $game->getTournamentMatch()?->getTournament()?->getId(),
            default => null,
        };
    }

    // ── Private Logik ─────────────────────────────────────────────────────────

    private function handleYellowCard(
        Player $player,
        Team $team,
        Game $game,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId);
        if (null === $rule) {
            // Keine Regel konfiguriert → keine Aktion
            return;
        }

        $yellowCount = $rule->isResetAfterSuspension()
            ? $this->countYellowCardsSinceLastReset($player, $competitionType, $competitionId)
            : $this->gameEventRepository->countYellowCardsForPlayerInCompetition($player, $competitionType, $competitionId);

        // Sperre auslösen (Schwellenwert erreicht)
        if ($yellowCount >= $rule->getYellowSuspensionThreshold()) {
            $this->createSuspension(
                $player,
                $competitionType,
                $competitionId,
                PlayerSuspension::REASON_YELLOW_CARDS,
                $rule->getSuspensionGames(),
                $game,
            );
            $this->notifySuspension($player, $team, $game, $yellowCount, $competitionType, $competitionId);

            return;
        }

        // Warnung (Annäherung an Schwellenwert)
        if ($yellowCount === $rule->getYellowWarningThreshold()) {
            $this->notifyWarning($player, $team, $game, $yellowCount, $rule, $competitionType, $competitionId);
        }
    }

    /**
     * Zählt Gelbe Karten seit der letzten Sperre (falls resetAfterSuspension aktiv).
     * Gibt die Gesamtanzahl aller Gelben zurück, wenn noch keine Sperre existiert
     * oder das auslösende Spiel kein CalendarEvent hat.
     */
    private function countYellowCardsSinceLastReset(
        Player $player,
        string $competitionType,
        ?int $competitionId,
    ): int {
        $lastSuspension = $this->suspensionRepository->findLastYellowCardsSuspension(
            $player,
            $competitionType,
            $competitionId,
        );

        if (null === $lastSuspension) {
            return $this->gameEventRepository->countYellowCardsForPlayerInCompetition(
                $player,
                $competitionType,
                $competitionId,
            );
        }

        $triggerGame = $lastSuspension->getTriggeredByGame();
        if (null === $triggerGame) {
            return $this->gameEventRepository->countYellowCardsForPlayerInCompetition(
                $player,
                $competitionType,
                $competitionId,
            );
        }

        $afterDate = $triggerGame->getCalendarEvent()?->getStartDate();
        if (null === $afterDate) {
            return $this->gameEventRepository->countYellowCardsForPlayerInCompetition(
                $player,
                $competitionType,
                $competitionId,
            );
        }

        return $this->gameEventRepository->countYellowCardsForPlayerInCompetitionAfterDate(
            $player,
            $competitionType,
            $competitionId,
            $afterDate,
        );
    }

    private function handleDirectSuspension(
        Player $player,
        Team $team,
        Game $game,
        string $competitionType,
        ?int $competitionId,
        string $reason,
    ): void {
        // Sperrdauer aus der konfigurierten Regel lesen; Fallback: 1 Spiel
        $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId);
        if (PlayerSuspension::REASON_RED_CARD === $reason) {
            $gamesSuspended = $rule?->getRedCardSuspensionGames() ?? 1;
        } else {
            $gamesSuspended = $rule?->getYellowRedCardSuspensionGames() ?? 1;
        }

        $this->createSuspension($player, $competitionType, $competitionId, $reason, $gamesSuspended, $game);
        $this->notifyDirectSuspension($player, $team, $game, $reason, $competitionType, $competitionId);
    }

    private function createSuspension(
        Player $player,
        string $competitionType,
        ?int $competitionId,
        string $reason,
        int $gamesSuspended,
        Game $game,
    ): PlayerSuspension {
        $suspension = new PlayerSuspension(
            player: $player,
            competitionType: $competitionType,
            competitionId: $competitionId,
            reason: $reason,
            gamesSuspended: $gamesSuspended,
            triggeredByGame: $game,
        );

        $this->em->persist($suspension);
        $this->em->flush();

        return $suspension;
    }

    // ── Benachrichtigungen ────────────────────────────────────────────────────

    private function notifyWarning(
        Player $player,
        Team $team,
        Game $game,
        int $yellowCount,
        CompetitionCardRule $rule,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);
        $remaining = $rule->getYellowSuspensionThreshold() - $yellowCount;

        // Spieler benachrichtigen
        foreach ($this->getUsersForPlayer($player) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Gelbe-Karten-Warnung',
                message: sprintf(
                    'Du hast %d Gelbe Karten in %s. Noch %d Gelbe Karte(n) bis zur Sperre.',
                    $yellowCount,
                    $competitionLabel,
                    $remaining,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }

        // Trainer benachrichtigen
        foreach ($this->getUsersForTeamCoaches($team) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Gelbe-Karten-Warnung: ' . $player->getFullName(),
                message: sprintf(
                    '%s hat %d Gelbe Karten in %s. Noch %d Gelbe Karte(n) bis zur Sperre.',
                    $player->getFullName(),
                    $yellowCount,
                    $competitionLabel,
                    $remaining,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    private function notifySuspension(
        Player $player,
        Team $team,
        Game $game,
        int $yellowCount,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);

        foreach ($this->getUsersForPlayer($player) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Sperre: Gelbe Karten',
                message: sprintf(
                    'Du hast die 5. Gelbe Karte (%d) in %s erhalten und bist für das nächste Spiel gesperrt.',
                    $yellowCount,
                    $competitionLabel,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }

        foreach ($this->getUsersForTeamCoaches($team) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Spielersperre: ' . $player->getFullName(),
                message: sprintf(
                    '%s ist nach %d Gelben Karten in %s für das nächste Spiel gesperrt.',
                    $player->getFullName(),
                    $yellowCount,
                    $competitionLabel,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    private function notifyDirectSuspension(
        Player $player,
        Team $team,
        Game $game,
        string $reason,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);
        $cardLabel = 'red_card' === $reason ? 'Roten Karte' : 'Gelb-Roten Karte';

        foreach ($this->getUsersForPlayer($player) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Sperre durch ' . $cardLabel,
                message: sprintf(
                    'Du bist wegen der %s in %s für das nächste Spiel gesperrt.',
                    $cardLabel,
                    $competitionLabel,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'reason' => $reason,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }

        foreach ($this->getUsersForTeamCoaches($team) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Spielersperre (' . $cardLabel . '): ' . $player->getFullName(),
                message: sprintf(
                    '%s ist wegen der %s in %s für das nächste Spiel gesperrt.',
                    $player->getFullName(),
                    $cardLabel,
                    $competitionLabel,
                ),
                data: [
                    'playerId' => $player->getId(),
                    'gameId' => $game->getId(),
                    'reason' => $reason,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * Liefert alle User-Accounts die direkt mit diesem Spieler verknüpft sind
     * (RelationType.category = 'player').
     *
     * @return User[]
     */
    private function getUsersForPlayer(Player $player): array
    {
        $users = [];
        foreach ($player->getUserRelations() as $relation) {
            if ('player' === $relation->getRelationType()->getCategory()) {
                $users[] = $relation->getUser();
            }
        }

        return $users;
    }

    /**
     * Liefert alle User-Accounts der aktiven Trainer eines Teams.
     *
     * @return User[]
     */
    private function getUsersForTeamCoaches(Team $team): array
    {
        $users = [];
        $today = new DateTime();

        foreach ($team->getCoachTeamAssignments() as $assignment) {
            $endDate = $assignment->getEndDate();
            if (null !== $endDate && $endDate < $today) {
                continue;
            }

            $coach = $assignment->getCoach();
            foreach ($coach->getUserRelations() as $relation) {
                if ('coach' === $relation->getRelationType()->getCategory()) {
                    $users[] = $relation->getUser();
                }
            }
        }

        return $users;
    }

    private function buildCompetitionLabel(Game $game, string $competitionType): string
    {
        return match ($competitionType) {
            CompetitionCardRule::TYPE_LEAGUE => $game->getLeague()?->getName() ?? 'der Liga',
            CompetitionCardRule::TYPE_CUP => $game->getCup()?->getName() ?? 'dem Pokal',
            CompetitionCardRule::TYPE_TOURNAMENT => 'dem Turnier',
            default => 'Freundschaftsspielen',
        };
    }
}
