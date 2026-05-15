<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Coach;
use App\Entity\CoachSuspension;
use App\Entity\CompetitionCardRule;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Participation;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\CoachSuspensionRepository;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameRepository;
use App\Repository\ParticipationRepository;
use App\Repository\ParticipationStatusRepository;
use App\Repository\PlayerRepository;
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
        private readonly CoachSuspensionRepository $coachSuspensionRepository,
        private readonly CompetitionCardRuleRepository $cardRuleRepository,
        private readonly NotificationService $notificationService,
        private readonly GameRepository $gameRepository,
        private readonly ParticipationRepository $participationRepository,
        private readonly ParticipationStatusRepository $participationStatusRepository,
        private readonly PlayerRepository $playerRepository,
    ) {
    }

    /**
     * Haupteinstieg: wird nach dem Persistieren eines GameEvents aufgerufen.
     * Prüft ob ein Karten-Schwellenwert erreicht wurde und handelt entsprechend.
     */
    public function handleCardEvent(GameEvent $gameEvent): void
    {
        $coach = $gameEvent->getCoach();
        if (null !== $coach) {
            $this->handleCoachCardEvent($coach, $gameEvent);

            return;
        }

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
     * Behandelt Karten-Events für Trainer.
     */
    public function handleCoachCardEvent(Coach $coach, GameEvent $gameEvent): void
    {
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
            $this->handleCoachDirectSuspension($coach, $team, $game, $competitionType, $competitionId, $code);

            return;
        }

        $this->handleCoachYellowCard($coach, $team, $game, $competitionType, $competitionId);
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
                $team,
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

        $this->createSuspension($player, $team, $competitionType, $competitionId, $reason, $gamesSuspended, $game);
        $this->notifyDirectSuspension($player, $team, $game, $reason, $competitionType, $competitionId);
    }

    private function createSuspension(
        Player $player,
        Team $team,
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

        $this->setParticipationsForSuspendedGames($player, $team, $competitionType, $competitionId, $game, $gamesSuspended);
        $this->checkSquadReadiness($team, $game, $competitionType, $competitionId);

        return $suspension;
    }

    private function handleCoachYellowCard(
        Coach $coach,
        Team $team,
        Game $game,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId);
        if (null === $rule) {
            return;
        }

        $lastSuspension = $this->coachSuspensionRepository->findLastYellowCardsSuspension($coach, $competitionType, $competitionId);
        if (null !== $lastSuspension && null !== $lastSuspension->getTriggeredByGame()) {
            $afterDate = $lastSuspension->getTriggeredByGame()->getCalendarEvent()?->getStartDate();
            $yellowCount = null !== $afterDate
                ? $this->gameEventRepository->countYellowCardsForCoachInCompetitionAfterDate($coach, $competitionType, $competitionId, $afterDate)
                : $this->gameEventRepository->countYellowCardsForCoachInCompetition($coach, $competitionType, $competitionId);
        } else {
            $yellowCount = $this->gameEventRepository->countYellowCardsForCoachInCompetition($coach, $competitionType, $competitionId);
        }

        if ($yellowCount >= $rule->getYellowSuspensionThreshold()) {
            $this->createCoachSuspension($coach, $competitionType, $competitionId, CoachSuspension::REASON_YELLOW_CARDS, $rule->getSuspensionGames(), $game);
            $this->notifyCoachSuspension($coach, $team, $game, $yellowCount, $competitionType, $competitionId);

            return;
        }

        if ($yellowCount === $rule->getYellowWarningThreshold()) {
            $this->notifyCoachWarning($coach, $team, $game, $yellowCount, $rule, $competitionType, $competitionId);
        }
    }

    private function handleCoachDirectSuspension(
        Coach $coach,
        Team $team,
        Game $game,
        string $competitionType,
        ?int $competitionId,
        string $reason,
    ): void {
        $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId);
        if (CoachSuspension::REASON_RED_CARD === $reason) {
            $gamesSuspended = $rule?->getRedCardSuspensionGames() ?? 1;
        } else {
            $gamesSuspended = $rule?->getYellowRedCardSuspensionGames() ?? 1;
        }

        $this->createCoachSuspension($coach, $competitionType, $competitionId, $reason, $gamesSuspended, $game);
        $this->notifyCoachDirectSuspension($coach, $team, $game, $reason, $competitionType, $competitionId);
    }

    private function createCoachSuspension(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
        string $reason,
        int $gamesSuspended,
        Game $game,
    ): CoachSuspension {
        $suspension = new CoachSuspension(
            coach: $coach,
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

    /**
     * Liefert alle User-Accounts die direkt mit diesem Trainer verknüpft sind.
     *
     * @return User[]
     */
    private function getUsersForCoach(Coach $coach): array
    {
        $users = [];
        foreach ($coach->getUserRelations() as $relation) {
            if ('coach' === $relation->getRelationType()->getCategory()) {
                $users[] = $relation->getUser();
            }
        }

        return $users;
    }

    private function notifyCoachWarning(
        Coach $coach,
        Team $team,
        Game $game,
        int $yellowCount,
        CompetitionCardRule $rule,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);
        $remaining = $rule->getYellowSuspensionThreshold() - $yellowCount;

        foreach ($this->getUsersForCoach($coach) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Gelbe-Karten-Warnung (Trainer)',
                message: sprintf(
                    'Du hast %d Gelbe Karten in %s. Noch %d Gelbe Karte(n) bis zur Sperre.',
                    $yellowCount,
                    $competitionLabel,
                    $remaining,
                ),
                data: [
                    'coachId' => $coach->getId(),
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
                title: 'Gelbe-Karten-Warnung Trainer: ' . $coach->getFullName(),
                message: sprintf(
                    'Trainer %s hat %d Gelbe Karten in %s. Noch %d Gelbe Karte(n) bis zur Sperre.',
                    $coach->getFullName(),
                    $yellowCount,
                    $competitionLabel,
                    $remaining,
                ),
                data: [
                    'coachId' => $coach->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    private function notifyCoachSuspension(
        Coach $coach,
        Team $team,
        Game $game,
        int $yellowCount,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);

        foreach ($this->getUsersForCoach($coach) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Sperre: Gelbe Karten (Trainer)',
                message: sprintf(
                    'Du hast die Gelb-Karten-Grenze (%d) in %s erreicht und bist für das nächste Spiel gesperrt.',
                    $yellowCount,
                    $competitionLabel,
                ),
                data: [
                    'coachId' => $coach->getId(),
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
                title: 'Trainersperre: ' . $coach->getFullName(),
                message: sprintf(
                    'Trainer %s ist nach %d Gelben Karten in %s für das nächste Spiel gesperrt.',
                    $coach->getFullName(),
                    $yellowCount,
                    $competitionLabel,
                ),
                data: [
                    'coachId' => $coach->getId(),
                    'gameId' => $game->getId(),
                    'yellowCount' => $yellowCount,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    private function notifyCoachDirectSuspension(
        Coach $coach,
        Team $team,
        Game $game,
        string $reason,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $competitionLabel = $this->buildCompetitionLabel($game, $competitionType);
        $cardLabel = 'red_card' === $reason ? 'Roten Karte' : 'Gelb-Roten Karte';

        foreach ($this->getUsersForCoach($coach) as $user) {
            $this->notificationService->createNotification(
                user: $user,
                type: 'system',
                title: 'Sperre durch ' . $cardLabel . ' (Trainer)',
                message: sprintf(
                    'Du bist wegen der %s in %s für das nächste Spiel gesperrt.',
                    $cardLabel,
                    $competitionLabel,
                ),
                data: [
                    'coachId' => $coach->getId(),
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
                title: 'Trainersperre (' . $cardLabel . '): ' . $coach->getFullName(),
                message: sprintf(
                    'Trainer %s ist wegen der %s in %s für das nächste Spiel gesperrt.',
                    $coach->getFullName(),
                    $cardLabel,
                    $competitionLabel,
                ),
                data: [
                    'coachId' => $coach->getId(),
                    'gameId' => $game->getId(),
                    'reason' => $reason,
                    'competitionType' => $competitionType,
                    'competitionId' => $competitionId,
                ],
            );
        }
    }

    /**
     * Nachträgliches Setzen von Participation-Einträgen (Status: suspended) für eine Sperre.
     *
     * Wird verwendet wenn der User-Spieler-Link (UserRelation) erst NACH dem Anlegen
     * der Sperre erstellt wurde und somit setParticipationsForSuspendedGames() zum
     * Zeitpunkt der Sperre keine User gefunden hat.
     */
    public function syncParticipationsForSuspension(PlayerSuspension $suspension): void
    {
        $game = $suspension->getTriggeredByGame();
        if (null === $game) {
            return;
        }

        $player = $suspension->getPlayer();
        $team = $this->resolveTeamForPlayerInGame($player, $game);
        if (null === $team) {
            return;
        }

        $this->setParticipationsForSuspendedGames(
            $player,
            $team,
            $suspension->getCompetitionType(),
            $suspension->getCompetitionId(),
            $game,
            $suspension->getGamesSuspended(),
        );
    }

    /**
     * Ermittelt das Team eines Spielers in einem Spiel.
     *
     * Strategie 1: Suche nach einem GameEvent des Spielers in diesem Spiel (hat team_id).
     * Strategie 2: Abgleich der PlayerTeamAssignments mit home-/awayTeam des Spiels.
     */
    private function resolveTeamForPlayerInGame(Player $player, Game $game): ?Team
    {
        $gameEvent = $this->em->getRepository(GameEvent::class)->findOneBy([
            'game' => $game,
            'player' => $player,
        ]);

        if (null !== $gameEvent) {
            return $gameEvent->getTeam();
        }

        $homeTeam = $game->getHomeTeam();
        $awayTeam = $game->getAwayTeam();

        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            $assignedTeam = $assignment->getTeam();
            if (null === $assignedTeam) {
                continue;
            }

            if (null !== $homeTeam && $assignedTeam->getId() === $homeTeam->getId()) {
                return $homeTeam;
            }

            if (null !== $awayTeam && $assignedTeam->getId() === $awayTeam->getId()) {
                return $awayTeam;
            }
        }

        return null;
    }

    /**
     * Sets the participation status to "suspended" for the next $gamesSuspended games
     * of the given team in the given competition after the triggering game.
     */
    private function setParticipationsForSuspendedGames(
        Player $player,
        Team $team,
        string $competitionType,
        ?int $competitionId,
        Game $triggerGame,
        int $gamesSuspended,
    ): void {
        $suspendedStatus = $this->participationStatusRepository->findByCode('suspended');
        if (null === $suspendedStatus) {
            return;
        }

        $afterDate = $triggerGame->getCalendarEvent()?->getStartDate();
        if (null === $afterDate) {
            return;
        }

        $nextGames = $this->gameRepository->findNextGamesForTeamInCompetition(
            $team,
            $competitionType,
            $competitionId,
            $afterDate,
            $gamesSuspended,
        );

        $users = $this->getUsersForPlayer($player);

        foreach ($nextGames as $game) {
            $calendarEvent = $game->getCalendarEvent();
            if (null === $calendarEvent) {
                continue;
            }

            foreach ($users as $user) {
                $participation = $this->participationRepository->findByUserAndEvent($user, $calendarEvent);
                if (null === $participation) {
                    $participation = new Participation();
                    $participation->setUser($user);
                    $participation->setEvent($calendarEvent);
                    $this->em->persist($participation);
                }

                $participation->setStatus($suspendedStatus);
            }
        }

        $this->em->flush();
    }

    /**
     * Checks whether the team has fewer than 11 available players for the next competition game
     * after the triggering game. Notifies coaches if there is a squad shortage.
     */
    private function checkSquadReadiness(
        Team $team,
        Game $triggerGame,
        string $competitionType,
        ?int $competitionId,
    ): void {
        $afterDate = $triggerGame->getCalendarEvent()?->getStartDate();
        if (null === $afterDate) {
            return;
        }

        $nextGames = $this->gameRepository->findNextGamesForTeamInCompetition(
            $team,
            $competitionType,
            $competitionId,
            $afterDate,
            1,
        );

        if (empty($nextGames)) {
            return;
        }

        $nextGame = $nextGames[0];
        $calendarEvent = $nextGame->getCalendarEvent();
        if (null === $calendarEvent) {
            return;
        }

        $allPlayers = $this->playerRepository->findActiveByTeams([$team]);
        $participations = $this->participationRepository->findByEvent($calendarEvent);

        $unavailableUserIds = [];
        foreach ($participations as $participation) {
            $statusCode = $participation->getStatus()?->getCode();
            if (in_array($statusCode, ['suspended', 'no', 'sick'], true)) {
                $unavailableUserIds[] = $participation->getUser()->getId();
            }
        }

        $availableCount = 0;
        foreach ($allPlayers as $player) {
            foreach ($this->getUsersForPlayer($player) as $user) {
                if (!in_array($user->getId(), $unavailableUserIds, true)) {
                    ++$availableCount;
                }
            }
        }

        if ($availableCount < 11) {
            $competitionLabel = $this->buildCompetitionLabel($nextGame, $competitionType);
            foreach ($this->getUsersForTeamCoaches($team) as $user) {
                $this->notificationService->createNotification(
                    user: $user,
                    type: 'system',
                    title: 'Kadermangel: weniger als 11 Spieler verfügbar',
                    message: sprintf(
                        'Für das nächste Spiel in %s stehen voraussichtlich nur %d Spieler zur Verfügung. Bitte prüfe den Kader.',
                        $competitionLabel,
                        $availableCount,
                    ),
                    data: [
                        'gameId' => $nextGame->getId(),
                        'teamId' => $team->getId(),
                        'availableCount' => $availableCount,
                        'competitionType' => $competitionType,
                        'competitionId' => $competitionId,
                    ],
                );
            }
        }
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
