<?php

namespace App\Repository;

use App\Entity\Player;
use App\Entity\Team;
use App\Entity\User;
use App\Service\AdminScopeService;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template-extends ServiceEntityRepository<Player>
 *
 * @implements OptimizedRepositoryInterface<Player>
 */
class PlayerRepository extends ServiceEntityRepository implements OptimizedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry, private readonly AdminScopeService $adminScopeService)
    {
        parent::__construct($registry, Player::class);
    }

    /**
     * Finde alle Spieler, die aktuell (ohne Enddatum oder Enddatum in der Zukunft) einer der beiden Teams zugeordnet sind.
     *
     * @param Team[] $teams
     *
     * @return Player[]
     */
    public function findActiveByTeams(array $teams): array
    {
        if (empty($teams)) {
            return [];
        }

        $qb = $this->createQueryBuilder('p')
            ->distinct()
            ->innerJoin('p.playerTeamAssignments', 'pta')
            ->andWhere('pta.team IN (:teams)')
            ->andWhere('(pta.endDate IS NULL OR pta.endDate >= CURRENT_DATE())')
            ->setParameter('teams', $teams);

        return $qb->getQuery()->getResult();
    }

    /**
     * @param User $user
     *
     * @return Player[]
     */
    public function fetchFullList(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('p');

        if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $teamIds = $this->collectVisibleTeamIds($user);

            if ($teamIds) {
                $qb->join('p.playerTeamAssignments', 'pta_filter')
                   ->andWhere('pta_filter.team IN (:teamIds)')
                   ->setParameter('teamIds', $teamIds);
            } else {
                $qb->andWhere('1 = 0');
            }
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return Player[]
     */
    public function fetchOptimizedList(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('p')
            ->select('p', 'pta', 'pna')
            ->leftJoin('p.playerTeamAssignments', 'pta', 'WITH', 'pta.player = p')
            ->leftJoin('p.playerNationalityAssignments', 'pna', 'WITH', 'pna.player = p')
            ->orderBy('p.lastName', 'ASC')
            ->addOrderBy('p.firstName', 'ASC');

        if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $teamIds = $this->collectVisibleTeamIds($user);
            if ($teamIds) {
                $qb->join('p.playerTeamAssignments', 'pta_filter')
                   ->andWhere('pta_filter.team IN (:teamIds)')
                   ->setParameter('teamIds', $teamIds);
            } else {
                // User hat keine relevante Relation, keine Spieler anzeigen
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
        return $this->createQueryBuilder('p')
            ->select('p', 'pta', 'pna')
            ->leftJoin('p.playerTeamAssignments', 'pta', 'WITH', 'pta.player = p')
            ->leftJoin('p.playerNationalityAssignments', 'pna', 'WITH', 'pna.player = p')
            ->where('p.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('p')
            ->select('p', 'pta', 'pna')
            ->leftJoin('p.playerTeamAssignments', 'pta', 'WITH', 'pta.player = p')
            ->leftJoin('p.playerNationalityAssignments', 'pna', 'WITH', 'pna.player = p')
            ->where('p.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @param User $user
     *
     * @return array<int, Player>
     */
    public function findVisiblePlayers(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('p');

        if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $teamIds = $this->collectVisibleTeamIds($user);

            if ($teamIds) {
                $qb->join('p.playerTeamAssignments', 'pta_filter')
                   ->andWhere('pta_filter.team IN (:teamIds)')
                   ->setParameter('teamIds', $teamIds);
            } else {
                $qb->andWhere('1 = 0');
            }
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Global full-text search across all players regardless of club.
     * Searches firstName, lastName and their concatenation.
     *
     * @return Player[]
     */
    public function searchGlobal(string $q, int $limit = 20): array
    {
        $term = '%' . addcslashes($q, '%_') . '%';

        return $this->createQueryBuilder('p')
            ->leftJoin('p.playerClubAssignments', 'pca')
            ->leftJoin('pca.club', 'c')
            ->addSelect('pca', 'c')
            ->where(
                'LOWER(CONCAT(p.firstName, \' \', p.lastName)) LIKE LOWER(:term)'
                . ' OR LOWER(p.firstName) LIKE LOWER(:term)'
                . ' OR LOWER(p.lastName) LIKE LOWER(:term)'
            )
            ->setParameter('term', $term)
            ->orderBy('p.lastName', 'ASC')
            ->addOrderBy('p.firstName', 'ASC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return list<int>
     */
    private function collectVisibleTeamIds(UserInterface $user): array
    {
        $teamIds = [];
        if ($user instanceof User) {
            $teamIds = array_keys($this->adminScopeService->getAdministeredTeams($user));
            foreach ($user->getUserRelations() as $relation) {
                if ($relation->getPlayer()) {
                    foreach ($relation->getPlayer()->getPlayerTeamAssignments() as $pta) {
                        $teamIds[] = $pta->getTeam()->getId();
                    }
                }
                if ($relation->getCoach()) {
                    foreach ($relation->getCoach()->getCoachTeamAssignments() as $cta) {
                        $teamIds[] = $cta->getTeam()->getId();
                    }
                }
            }
        }

        return array_values(array_unique($teamIds));
    }
}
