<?php

namespace App\Service;

use App\Entity\Coach;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use DateTimeInterface;
use Throwable;

class CoachTeamPlayerService
{
    public function __construct(private readonly UserTeamAccessService $accessService)
    {
    }

    /**
     * Ermittelt alle Teams, die einem User als Coach zugeordnet sind.
     *
     * @return array<Team>
     */
    public function collectCoachTeams(User $user): array
    {
        return $this->accessService->getSelfCoachTeams($user);
    }

    /**
     * Ermittelt alle Spieler eines Teams, die aktuell aktiv sind.
     *
     * @return list<array{player: array{id: int|null, name: string}, shirtNumber: int|null, position?: string|null, alternativePositions?: string[]}>
     */
    public function collectTeamPlayers(Team $team): array
    {
        $players = [];

        foreach ($team->getPlayerTeamAssignments() as $assignment) {
            if ($this->isCurrentAssignment($assignment->getStartDate(), $assignment->getEndDate())) {
                $player = $assignment->getPlayer();
                $mainPos = null;
                $altPositions = [];
                try {
                    $mainPos = $player->getMainPosition()->getShortName()
                        ?? $player->getMainPosition()->getName();
                } catch (Throwable) {
                    $mainPos = null;
                }
                try {
                    foreach ($player->getAlternativePositions() as $pos) {
                        $altPositions[] = $pos->getShortName() ?? $pos->getName();
                    }
                } catch (Throwable) {
                    $altPositions = [];
                }
                $players[] = [
                    'player' => ['id' => $player->getId(), 'name' => $player->getFullName()],
                    'shirtNumber' => $assignment->getShirtNumber(),
                    'position' => $mainPos,
                    'alternativePositions' => $altPositions,
                ];
            }
        }

        return $players;
    }

    /**
     * Ermittelt alle Teams, denen ein User als Spieler aktuell zugeordnet ist.
     *
     * @return array<Team>
     */
    public function collectPlayerTeams(User $user): array
    {
        return $this->accessService->getSelfPlayerTeams($user);
    }

    /**
     * Ermittelt das Standard-Team des Users anhand der ältesten aktiven Zuordnung
     * (Spieler- oder Trainer-Zuordnung). Gibt null zurück wenn keine aktive Zuordnung vorhanden.
     */
    public function resolveDefaultTeamId(User $user): ?int
    {
        $defaultTeamId = null;
        $oldestStart = null;

        foreach ($user->getUserRelations() as $relation) {
            $identifier = $relation->getRelationType()->getIdentifier();

            if ($player = $relation->getPlayer()) {
                if ('self_player' !== $identifier) {
                    continue;
                }
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($this->isCurrentAssignment($pta->getStartDate(), $pta->getEndDate())) {
                        $start = $pta->getStartDate();
                        if ($start && (null === $oldestStart || $start < $oldestStart)) {
                            $oldestStart = $start;
                            $defaultTeamId = $pta->getTeam()->getId();
                        }
                    }
                }
            }

            if ($coach = $relation->getCoach()) {
                if ('self_coach' !== $identifier) {
                    continue;
                }
                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    if ($this->isCurrentAssignment($cta->getStartDate(), $cta->getEndDate())) {
                        $start = $cta->getStartDate();
                        if ($start && (null === $oldestStart || $start < $oldestStart)) {
                            $oldestStart = $start;
                            $defaultTeamId = $cta->getTeam()->getId();
                        }
                    }
                }
            }
        }

        return $defaultTeamId;
    }

    /**
     * Ermittelt alle verfügbaren Spieler für einen User basierend auf seinen Coach-Beziehungen.
     * Wenn der User nur ein Team hat, werden direkt die Spieler zurückgegeben.
     * Wenn mehrere Teams vorhanden sind, wird ein Array mit Teams als Keys und Spielern als Values zurückgegeben.
     *
     * @return array<mixed>
     */
    public function resolveAvailablePlayersForCoach(User $user): array
    {
        $teams = $this->collectCoachTeams($user);

        if (0 === count($teams)) {
            return [
                'singleTeam' => true,
                'teams' => [],
                'players' => []
            ];
        }

        if (1 === count($teams)) {
            // Nur ein Team - direkt die Spieler zurückgeben
            $team = reset($teams);

            return [
                'singleTeam' => true,
                'teams' => array_map(fn (Team $team) => [
                    'id' => $team->getId(),
                    'name' => $team->getName()
                ], $teams),
                'players' => $this->collectTeamPlayers($team)
            ];
        }

        // Mehrere Teams - gruppierte Struktur zurückgeben
        $teamPlayers = [];
        foreach ($teams as $team) {
            $teamPlayers[] = [
                'team' => ['id' => $team->getId(), 'name' => $team->getName()],
                'players' => $this->collectTeamPlayers($team)
            ];
        }

        return [
            'singleTeam' => false,
            'teams' => array_map(
                fn (Team $team) => [
                    'id' => $team->getId(),
                    'name' => $team->getName()
                ],
                $teams
            ),
            'players' => $teamPlayers
        ];
    }

    /**
     * Prüft ob eine Zuordnung aktuell aktiv ist.
     */
    private function isCurrentAssignment(?DateTimeInterface $startDate, ?DateTimeInterface $endDate): bool
    {
        $now = new DateTime();

        // Enddatum prüfen: wenn gesetzt und in der Vergangenheit → immer inaktiv
        if ($endDate && $endDate < $now) {
            return false;
        }

        // Kein Startdatum gesetzt → aktiv solange Enddatum nicht abgelaufen (bereits geprüft)
        if (!$startDate) {
            return true;
        }

        // Startdatum muss <= heute sein
        return $startDate <= $now;
    }

    /**
     * Liefert alle mit dem User verknüpften Spieler und Teams für die Wizard-Vorauswahl.
     *
     * linkedPlayers: alle Spieler aus beliebigen UserRelations (z.B. self_player, Freund, Elternteil).
     *               isSelf=true, wenn der RelationType-Identifier "self_player" ist.
     *               Sortiert: self_player zuerst.
     * linkedTeams:  alle Teams aus aktiven self_player- und self_coach-Relations, dedupliziert.
     *
     * @return array{linkedPlayers: list<array{id: int, fullName: string, teamName: string|null, isSelf: bool}>, linkedTeams: list<array{id: int, name: string}>}
     */
    public function resolveLinkedContext(User $user): array
    {
        $linkedPlayers = [];
        $addedPlayerIds = [];
        $linkedTeams = [];
        $addedTeamIds = [];

        foreach ($user->getUserRelations() as $relation) {
            $identifier = $relation->getRelationType()->getIdentifier();

            if ($player = $relation->getPlayer()) {
                $isSelf = 'self_player' === $identifier;
                $playerId = $player->getId();

                if (null !== $playerId && !isset($addedPlayerIds[$playerId])) {
                    $addedPlayerIds[$playerId] = true;

                    $teamName = null;
                    foreach ($player->getPlayerTeamAssignments() as $pta) {
                        if ($this->isCurrentAssignment($pta->getStartDate(), $pta->getEndDate())) {
                            $teamName = $pta->getTeam()->getName();
                            break;
                        }
                    }

                    $linkedPlayers[] = [
                        'id' => $playerId,
                        'fullName' => $player->getFullName(),
                        'teamName' => $teamName,
                        'isSelf' => $isSelf,
                    ];
                }

                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($this->isCurrentAssignment($pta->getStartDate(), $pta->getEndDate())) {
                        $teamId = $pta->getTeam()->getId();
                        if (null !== $teamId && !isset($addedTeamIds[$teamId])) {
                            $addedTeamIds[$teamId] = true;
                            $linkedTeams[] = ['id' => $teamId, 'name' => $pta->getTeam()->getName()];
                        }
                    }
                }
            }

            if ($coach = $relation->getCoach()) {
                if ('self_coach' === $identifier) {
                    $coachId = $coach->getId();
                    $coachTeamName = null;
                    foreach ($coach->getCoachTeamAssignments() as $cta) {
                        if ($this->isCurrentAssignment($cta->getStartDate(), $cta->getEndDate())) {
                            $teamId = $cta->getTeam()->getId();
                            if (null !== $teamId && !isset($addedTeamIds[$teamId])) {
                                $addedTeamIds[$teamId] = true;
                                $linkedTeams[] = ['id' => $teamId, 'name' => $cta->getTeam()->getName()];
                            }
                            if (null === $coachTeamName) {
                                $coachTeamName = $cta->getTeam()->getName();
                            }
                        }
                    }

                    if (null !== $coachId && !isset($addedPlayerIds['coach_' . $coachId])) {
                        $addedPlayerIds['coach_' . $coachId] = true;
                        $linkedPlayers[] = [
                            'id' => $coachId,
                            'fullName' => $coach->getFullName(),
                            'teamName' => $coachTeamName,
                            'isSelf' => true,
                            'type' => 'coach',
                        ];
                    }
                }
            }
        }

        usort($linkedPlayers, fn ($a, $b) => (int) $b['isSelf'] <=> (int) $a['isSelf']);

        return [
            'linkedPlayers' => $linkedPlayers,
            'linkedTeams' => $linkedTeams,
        ];
    }

    /**
     * Ermittelt die Coach-Entität eines Users, falls vorhanden.
     */
    public function resolveUserCoach(User $user): ?Coach
    {
        foreach ($user->getUserRelations() as $relation) {
            if (
                $relation->getCoach()
                && 'coach' === $relation->getRelationType()->getCategory()
                && 'self_coach' === $relation->getRelationType()->getIdentifier()
            ) {
                return $relation->getCoach();
            }
        }

        return null;
    }
}
