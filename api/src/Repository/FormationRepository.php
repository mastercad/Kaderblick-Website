<?php

namespace App\Repository;

use App\Entity\Formation;
use App\Entity\User;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Formation>
 */
class FormationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Formation::class);
    }

    /**
     * Gibt alle Formationen zurück, die für den Benutzer sichtbar sind.
     *
     * Sichtbar sind Formationen von Trainern, die aktuell einem Team zugeordnet sind,
     * dem der Benutzer selbst ebenfalls angehört — entweder als Trainer oder als Spieler.
     *
     * Pfade zur Team-Ermittlung:
     *   Benutzer → UserRelation (self_coach) → Coach → CoachTeamAssignment → Team
     *   Benutzer → UserRelation (self_player) → Player → PlayerTeamAssignment → Team
     *
     * @return Formation[]
     */
    public function findVisibleFormationsForUser(User $user): array
    {
        $teamIds = $this->resolveAccessibleTeamIds($user);

        if (empty($teamIds)) {
            return [];
        }

        $today = new DateTimeImmutable();

        // Formationen von Trainern laden, die in denselben Teams aktiv sind
        return $this->createQueryBuilder('f')
            ->distinct()
            ->join('f.user', 'fu')
            ->join('fu.userRelations', 'fur')
            ->join('fur.relationType', 'furt')
            ->join('fur.coach', 'fc')
            ->join('fc.coachTeamAssignments', 'fcta')
            ->where('furt.identifier = :selfCoach')
            ->andWhere('fcta.team IN (:teamIds)')
            ->andWhere('(fcta.startDate IS NULL OR fcta.startDate <= :today)')
            ->andWhere('(fcta.endDate IS NULL OR fcta.endDate >= :today)')
            ->setParameter('selfCoach', 'self_coach')
            ->setParameter('teamIds', $teamIds)
            ->setParameter('today', $today)
            ->getQuery()
            ->getResult();
    }

    /**
     * Gibt alle Formationen zurück, die von aktiven Trainern eines bestimmten Teams angelegt wurden.
     * Wird ausschließlich für SUPERADMIN/ADMIN genutzt — kein zusätzlicher Zugriffscheck nötig,
     * da der Aufrufer dies sicherstellen muss.
     *
     * @return Formation[]
     */
    public function findByTeam(int $teamId): array
    {
        $today = new DateTimeImmutable();

        return $this->createQueryBuilder('f')
            ->distinct()
            ->join('f.user', 'fu')
            ->join('fu.userRelations', 'fur')
            ->join('fur.relationType', 'furt')
            ->join('fur.coach', 'fc')
            ->join('fc.coachTeamAssignments', 'fcta')
            ->where('furt.identifier = :selfCoach')
            ->andWhere('IDENTITY(fcta.team) = :teamId')
            ->andWhere('(fcta.startDate IS NULL OR fcta.startDate <= :today)')
            ->andWhere('(fcta.endDate IS NULL OR fcta.endDate >= :today)')
            ->setParameter('selfCoach', 'self_coach')
            ->setParameter('teamId', $teamId)
            ->setParameter('today', $today)
            ->getQuery()
            ->getResult();
    }

    /**
     * Sammelt alle Team-IDs, zu denen der Benutzer aktuell Zugang hat
     * (als aktiver Trainer oder aktiver Spieler).
     *
     * @return int[]
     */
    private function resolveAccessibleTeamIds(User $user): array
    {
        $now = new DateTimeImmutable();
        $teamIds = [];

        foreach ($user->getUserRelations() as $relation) {
            $identifier = $relation->getRelationType()->getIdentifier();

            if (($coach = $relation->getCoach()) && 'self_coach' === $identifier) {
                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    if ($this->isActiveOnDate($cta->getStartDate(), $cta->getEndDate(), $now)) {
                        $teamIds[] = $cta->getTeam()->getId();
                    }
                }
            }

            if (($player = $relation->getPlayer()) && 'self_player' === $identifier) {
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($this->isActiveOnDate($pta->getStartDate(), $pta->getEndDate(), $now)) {
                        $teamIds[] = $pta->getTeam()->getId();
                    }
                }
            }
        }

        return array_unique($teamIds);
    }

    private function isActiveOnDate(
        ?DateTimeInterface $startDate,
        ?DateTimeInterface $endDate,
        DateTimeImmutable $checkDate
    ): bool {
        if (null !== $endDate && $endDate < $checkDate) {
            return false;
        }

        return null === $startDate || $startDate <= $checkDate;
    }
}
