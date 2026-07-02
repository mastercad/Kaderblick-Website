<?php

namespace App\Repository;

use App\Entity\Coach;
use App\Entity\User;
use App\Service\AdminScopeService;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template-extends ServiceEntityRepository<Coach>
 *
 * @implements OptimizedRepositoryInterface<Coach>
 */
class CoachRepository extends ServiceEntityRepository implements OptimizedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry, private readonly AdminScopeService $adminScopeService)
    {
        parent::__construct($registry, Coach::class);
    }

    /**
     * @return Coach[]
     */
    public function fetchFullList(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('c')
            ->select('c', 'cta', 'cna', 'cca')
            ->leftJoin('c.coachTeamAssignments', 'cta', 'WITH', 'cta.coach = c')
            ->leftJoin('c.coachNationalityAssignments', 'cna', 'WITH', 'cna.coach = c')
            ->leftJoin('c.coachClubAssignments', 'cca', 'WITH', 'cca.coach = c')
            ->orderBy('c.lastName', 'ASC')
            ->addOrderBy('c.firstName', 'ASC');

        if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $teamIds = $user instanceof User ? array_keys($this->adminScopeService->getAdministeredTeams($user)) : [];
            if ($teamIds) {
                $qb->andWhere('cta.team IN (:teamIds)')
                   ->setParameter('teamIds', $teamIds);
            } else {
                $qb->andWhere('1 = 0');
            }
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return Coach[]
     */
    public function fetchOptimizedList(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('c')
            ->select('c', 'cta', 'cna', 'cca')
            ->leftJoin('c.coachTeamAssignments', 'cta', 'WITH', 'cta.coach = c')
            ->leftJoin('c.coachNationalityAssignments', 'cna', 'WITH', 'cna.coach = c')
            ->leftJoin('c.coachClubAssignments', 'cca', 'WITH', 'cca.coach = c')
            ->orderBy('c.lastName', 'ASC')
            ->addOrderBy('c.firstName', 'ASC');

        if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $teamIds = [];
            $relatedCoachIds = [];
            if ($user instanceof User) {
                $teamIds = array_keys($this->adminScopeService->getAdministeredTeams($user));
                foreach ($user->getUserRelations() as $relation) {
                    if ($relation->getPlayer()) {
                        foreach ($relation->getPlayer()->getPlayerTeamAssignments() as $pta) {
                            $team = $pta->getTeam();
                            $teamIds[] = $team->getId();
                        }
                    }
                    if ($relation->getCoach()) {
                        foreach ($relation->getCoach()->getCoachTeamAssignments() as $cta) {
                            $team = $cta->getTeam();
                            $teamIds[] = $team->getId();
                        }
                        $relatedCoachIds[] = $relation->getCoach()->getId();
                    }
                }
            }
            $teamIds = array_unique($teamIds);
            $relatedCoachIds = array_unique($relatedCoachIds);
            if ($teamIds || $relatedCoachIds) {
                $orX = $qb->expr()->orX();
                if ($teamIds) {
                    $qb->join('c.coachTeamAssignments', 'cta_filter');
                    $orX->add('cta_filter.team IN (:teamIds)');
                    $qb->setParameter('teamIds', $teamIds);
                }
                if ($relatedCoachIds) {
                    $orX->add('c.id IN (:relatedCoachIds)');
                    $qb->setParameter('relatedCoachIds', $relatedCoachIds);
                }
                $qb->andWhere($orX);
            } else {
                // User hat keine relevante Relation, keine Coaches anzeigen
                $qb->andWhere('1 = 0');
            }
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchFullEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('c')
            ->select('c', 'cta', 'cna', 'cca')
            ->leftJoin('c.coachTeamAssignments', 'cta', 'WITH', 'cta.coach = c')
            ->leftJoin('c.coachNationalityAssignments', 'cna', 'WITH', 'cna.coach = c')
            ->leftJoin('c.coachClubAssignments', 'c')
            ->where('c.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('c')
            ->select('c', 'cta', 'cna', 'cca')
            ->leftJoin('c.coachTeamAssignments', 'cta', 'WITH', 'cta.coach = c')
            ->leftJoin('c.coachNationalityAssignments', 'cna', 'WITH', 'cna.coach = c')
            ->leftJoin('c.coachClubAssignments', 'c')
            ->where('c.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Global full-text search across all coaches regardless of club.
     *
     * @return Coach[]
     */
    public function searchGlobal(string $q, int $limit = 20): array
    {
        $term = '%' . addcslashes($q, '%_') . '%';

        return $this->createQueryBuilder('c')
            ->leftJoin('c.coachClubAssignments', 'cca')
            ->leftJoin('cca.club', 'cl')
            ->addSelect('cca', 'cl')
            ->where(
                'LOWER(CONCAT(c.firstName, \' \', c.lastName)) LIKE LOWER(:term)'
                . ' OR LOWER(c.firstName) LIKE LOWER(:term)'
                . ' OR LOWER(c.lastName) LIKE LOWER(:term)'
            )
            ->setParameter('term', $term)
            ->orderBy('c.lastName', 'ASC')
            ->addOrderBy('c.firstName', 'ASC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
