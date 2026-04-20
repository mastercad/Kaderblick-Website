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
     * Gibt alle Formationen zurück, die für den Benutzer sichtbar sind:
     * eigene Formationen sowie Formationen von Trainern in denselben Teams.
     *
     * Pfad zur Team-Ermittlung:
     *   Benutzer → UserRelation (self_coach) → Coach → CoachTeamAssignment → Team
     *
     * @return Formation[]
     */
    public function findVisibleFormationsForUser(User $user): array
    {
        $teamIds = $this->resolveAccessibleTeamIds($user);
        $today = new DateTimeImmutable();

        $qb = $this->createQueryBuilder('f')
            ->distinct()
            ->leftJoin('f.user', 'fu')
            ->leftJoin('fu.userRelations', 'fur')
            ->leftJoin('fur.relationType', 'furt')
            ->leftJoin('fur.coach', 'fc')
            ->leftJoin('fc.coachTeamAssignments', 'fcta')
            ->where('f.user = :currentUser')
            ->setParameter('currentUser', $user);

        if (!empty($teamIds)) {
            $qb->orWhere(
                'furt.identifier = :selfCoach'
                . ' AND fcta.team IN (:teamIds)'
                . ' AND (fcta.startDate IS NULL OR fcta.startDate <= :today)'
                . ' AND (fcta.endDate IS NULL OR fcta.endDate >= :today)'
            )
            ->setParameter('selfCoach', 'self_coach')
            ->setParameter('teamIds', $teamIds)
            ->setParameter('today', $today);
        }

        return $qb->getQuery()->getResult();
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
     * Sammelt alle Team-IDs, denen der Benutzer als aktiver Trainer zugeordnet ist.
     *
     * @return int[]
     */
    private function resolveAccessibleTeamIds(User $user): array
    {
        $now = new DateTimeImmutable();
        $teamIds = [];

        foreach ($user->getUserRelations() as $relation) {
            if ('self_coach' !== $relation->getRelationType()->getIdentifier()) {
                continue;
            }

            $coach = $relation->getCoach();
            if (null === $coach) {
                continue;
            }

            foreach ($coach->getCoachTeamAssignments() as $cta) {
                if ($this->isActiveOnDate($cta->getStartDate(), $cta->getEndDate(), $now)) {
                    $teamIds[] = $cta->getTeam()->getId();
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
