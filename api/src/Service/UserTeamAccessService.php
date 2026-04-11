<?php

namespace App\Service;

use App\Entity\CoachTeamAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Canonical service for determining which teams a user belongs to
 * in their own capacity as player (self_player) or coach (self_coach).
 *
 * Rules enforced:
 *  1. Only UserRelations with RelationType identifier "self_player" or "self_coach" grant access.
 *  2. The assignment (PlayerTeamAssignment / CoachTeamAssignment) must be active
 *     on the given reference date:
 *       (startDate IS NULL OR startDate <= referenceDate)
 *       AND (endDate IS NULL OR endDate >= referenceDate).
 *
 * Use this service for:
 *  - Squad-readiness visibility in MatchdayController
 *  - Team membership checks in ICalController
 *  - PDF generation in TournamentController
 *  - All places in CoachTeamPlayerService that collect "own" teams
 *
 * Do NOT use this service for admin overviews, where all players/coaches must
 * be shown regardless of relation type or assignment dates.
 */
class UserTeamAccessService
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /**
     * Returns those teams from $candidateTeams where the user has an active
     * self_coach relation to a coach whose CoachTeamAssignment covers $referenceDate.
     *
     * @param Team[] $candidateTeams
     *
     * @return Team[]
     */
    public function getCoachTeamsForDate(
        User $user,
        array $candidateTeams,
        ?DateTimeInterface $referenceDate = null,
    ): array {
        if (empty($candidateTeams)) {
            return [];
        }

        $date = $referenceDate ?? new DateTimeImmutable();
        $result = [];

        foreach ($candidateTeams as $team) {
            $hit = $this->em->getRepository(CoachTeamAssignment::class)
                ->createQueryBuilder('cta')
                ->innerJoin('cta.coach', 'c')
                ->innerJoin('c.userRelations', 'ur')
                ->innerJoin('ur.relationType', 'rt')
                ->where('ur.user = :user')
                ->andWhere('cta.team = :team')
                ->andWhere('rt.identifier = :type')
                ->andWhere('cta.startDate IS NULL OR cta.startDate <= :date')
                ->andWhere('cta.endDate IS NULL OR cta.endDate >= :date')
                ->setParameter('user', $user)
                ->setParameter('team', $team)
                ->setParameter('type', 'self_coach')
                ->setParameter('date', $date)
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();

            if (null !== $hit) {
                $result[] = $team;
            }
        }

        return $result;
    }

    /**
     * Returns those teams from $candidateTeams where the user has an active
     * self_player relation to a player whose PlayerTeamAssignment covers $referenceDate.
     *
     * @param Team[] $candidateTeams
     *
     * @return Team[]
     */
    public function getPlayerTeamsForDate(
        User $user,
        array $candidateTeams,
        ?DateTimeInterface $referenceDate = null,
    ): array {
        if (empty($candidateTeams)) {
            return [];
        }

        $date = $referenceDate ?? new DateTimeImmutable();
        $result = [];

        foreach ($candidateTeams as $team) {
            $hit = $this->em->getRepository(PlayerTeamAssignment::class)
                ->createQueryBuilder('pta')
                ->innerJoin('pta.player', 'p')
                ->innerJoin('p.userRelations', 'ur')
                ->innerJoin('ur.relationType', 'rt')
                ->where('ur.user = :user')
                ->andWhere('pta.team = :team')
                ->andWhere('rt.identifier = :type')
                ->andWhere('pta.startDate IS NULL OR pta.startDate <= :date')
                ->andWhere('pta.endDate IS NULL OR pta.endDate >= :date')
                ->setParameter('user', $user)
                ->setParameter('team', $team)
                ->setParameter('type', 'self_player')
                ->setParameter('date', $date)
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();

            if (null !== $hit) {
                $result[] = $team;
            }
        }

        return $result;
    }

    /**
     * Returns all teams where the user is an active self_coach on $referenceDate.
     * Uses in-memory entity iteration (relies on already-loaded collections).
     *
     * @return array<int, Team> keyed by team ID
     */
    public function getSelfCoachTeams(User $user, ?DateTimeInterface $referenceDate = null): array
    {
        $date = $referenceDate ?? new DateTimeImmutable();
        $teams = [];

        foreach ($user->getUserRelations() as $relation) {
            $coach = $relation->getCoach();
            if (!$coach || 'self_coach' !== $relation->getRelationType()->getIdentifier()) {
                continue;
            }
            foreach ($coach->getCoachTeamAssignments() as $cta) {
                if ($this->isActiveOnDate($cta->getStartDate(), $cta->getEndDate(), $date)) {
                    $team = $cta->getTeam();
                    $teams[$team->getId()] = $team;
                }
            }
        }

        return $teams;
    }

    /**
     * Returns all teams where the user is an active self_player on $referenceDate.
     * Uses in-memory entity iteration (relies on already-loaded collections).
     *
     * @return array<int, Team> keyed by team ID
     */
    public function getSelfPlayerTeams(User $user, ?DateTimeInterface $referenceDate = null): array
    {
        $date = $referenceDate ?? new DateTimeImmutable();
        $teams = [];

        foreach ($user->getUserRelations() as $relation) {
            $player = $relation->getPlayer();
            if (!$player || 'self_player' !== $relation->getRelationType()->getIdentifier()) {
                continue;
            }
            foreach ($player->getPlayerTeamAssignments() as $pta) {
                if ($this->isActiveOnDate($pta->getStartDate(), $pta->getEndDate(), $date)) {
                    $team = $pta->getTeam();
                    $teams[$team->getId()] = $team;
                }
            }
        }

        return $teams;
    }

    /**
     * Returns true when the assignment is active on $checkDate:
     *   (startDate IS NULL OR startDate <= checkDate)
     *   AND (endDate IS NULL OR endDate >= checkDate)
     */
    private function isActiveOnDate(
        ?DateTimeInterface $startDate,
        ?DateTimeInterface $endDate,
        DateTimeInterface $checkDate,
    ): bool {
        if (null !== $endDate && $endDate < $checkDate) {
            return false;
        }

        if (null === $startDate) {
            return true;
        }

        return $startDate <= $checkDate;
    }
}
