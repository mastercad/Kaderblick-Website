<?php

namespace App\Repository;

use App\Entity\Team;
use App\Entity\User;
use App\Service\AdminScopeService;
use DateTime;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template-extends ServiceEntityRepository<Team>
 *
 * @implements OptimizedRepositoryInterface<Team>
 */
class TeamRepository extends ServiceEntityRepository implements OptimizedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry, private readonly AdminScopeService $adminScopeService)
    {
        parent::__construct($registry, Team::class);
    }

    /**
     * @param User $user
     *
     * @return Team[]
     */
    public function fetchFullList(?UserInterface $user = null): array
    {
        $qb = $this->createQueryBuilder('t')
            ->select('t', 'ag', 'l', 'pta', 'p', 'cta', 'c', 'cl')
            ->leftJoin('t.ageGroup', 'ag')
            ->leftJoin('t.league', 'l')
            ->leftJoin('t.clubs', 'cl')
            ->leftJoin('t.playerTeamAssignments', 'pta', 'WITH', 'pta.team = t')
            ->leftJoin('t.coachTeamAssignments', 'cta', 'WITH', 'cta.team = t')
            ->leftJoin('cta.coach', 'c', 'WITH', 'cta.coach = c')
            ->leftJoin('pta.player', 'p', 'WITH', 'pta.player = p')
            ->orderBy('t.name', 'ASC');

        /*
                if ($user && !in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    if ($user->getClub()) {
                        $qb->andWhere('cl = :club')
                           ->setParameter('club', $user->getClub());
                    }

                    if ($user->getCoach()) {
                        $qb->andWhere('c = :coach')
                           ->setParameter('coach', $user->getCoach());
                    }

                    if ($user->getPlayer()) {
                        $qb->andWhere('p = :player')
                           ->setParameter('player', $user->getPlayer());
                    }
                }
        */
        return $qb->getQuery()->getResult();
    }

    /**
     * @return array<int, Team>
     */
    public function fetchOptimizedList(?UserInterface $user = null, bool $allTeams = false): array
    {
        $qb = $this->buildOptimizedListQueryBuilder($user, null, $allTeams);

        $qb->select('t.id, t.name')
            ->addSelect('ag.id as age_group_id, ag.name as age_group_name')
            ->addSelect('l.id as league_id, l.name as league_name')
            ->addSelect('t.defaultHalfDuration as default_half_duration')
            ->addSelect('t.defaultHalftimeBreakDuration as default_halftime_break_duration')
            ->addSelect('COUNT(DISTINCT pta.id) as player_count')
            ->addSelect('COUNT(DISTINCT cta.id) as coach_count')
            ->addSelect("GROUP_CONCAT(DISTINCT CONCAT(c.firstName, ' ', c.lastName) SEPARATOR ', ') AS coach_names")
            ->addSelect("GROUP_CONCAT(DISTINCT cl.name SEPARATOR ', ') AS club_names")
            ->groupBy('t.id, ag.id, l.id')
            ->orderBy('t.name', 'ASC');

        return $qb->getQuery()->getResult();
    }

    /**
     * @return array{data: array<int, array<string, mixed>>, total: int}
     */
    public function fetchPaginatedList(?UserInterface $user = null, string $search = '', int $page = 1, int $limit = 25): array
    {
        $qb = $this->buildOptimizedListQueryBuilder($user, $search);

        // Count total matching results
        $countQb = clone $qb;
        $countQb->select('COUNT(DISTINCT t.id)');
        $total = (int) $countQb->getQuery()->getSingleScalarResult();

        // Paginated data with aggregates
        $offset = ($page - 1) * $limit;
        $qb->select('t.id, t.name')
            ->addSelect('ag.id as age_group_id, ag.name as age_group_name')
            ->addSelect('l.id as league_id, l.name as league_name')
            ->addSelect('t.defaultHalfDuration as default_half_duration')
            ->addSelect('t.defaultHalftimeBreakDuration as default_halftime_break_duration')
            ->addSelect('COUNT(DISTINCT pta.id) as player_count')
            ->addSelect('COUNT(DISTINCT cta.id) as coach_count')
            ->addSelect("GROUP_CONCAT(DISTINCT CONCAT(c.firstName, ' ', c.lastName) SEPARATOR ', ') AS coach_names")
            ->addSelect("GROUP_CONCAT(DISTINCT cl.name SEPARATOR ', ') AS club_names")
            ->groupBy('t.id, ag.id, l.id')
            ->orderBy('t.name', 'ASC')
            ->setFirstResult($offset)
            ->setMaxResults($limit);

        return [
            'data' => $qb->getQuery()->getResult(),
            'total' => $total,
        ];
    }

    /**
     * Build the base query builder with joins and permission filters.
     *
     * @param bool $allTeams When true, the user-assignment filter is skipped and all teams are
     *                       returned regardless of the caller's role. Use for contexts like
     *                       match / tournament creation where opponents must be selectable.
     */
    private function buildOptimizedListQueryBuilder(?UserInterface $user = null, ?string $search = null, bool $allTeams = false): \Doctrine\ORM\QueryBuilder
    {
        $qb = $this->createQueryBuilder('t')
            ->leftJoin('t.ageGroup', 'ag')
            ->leftJoin('t.league', 'l')
            ->leftJoin('t.playerTeamAssignments', 'pta')
            ->leftJoin('t.coachTeamAssignments', 'cta')
            ->leftJoin('cta.coach', 'c')
            ->leftJoin('t.clubs', 'cl');

        // Search filter
        if (null !== $search && '' !== $search) {
            $qb->andWhere('LOWER(t.name) LIKE :search OR LOWER(ag.name) LIKE :search OR LOWER(l.name) LIKE :search')
               ->setParameter('search', '%' . strtolower($search) . '%');
        }

        // ROLE_SUPERADMIN sees all teams without restriction.
        // When $allTeams is true (e.g. match/tournament context), the user filter is also skipped
        // so that non-admin coaches can select opponents they are not assigned to.
        $isPrivileged = $allTeams || ($user
            && in_array('ROLE_SUPERADMIN', $user->getRoles(), true)
        );
        if (!$isPrivileged) {
            $playerIds = [];
            $coachIds = [];
            $adminTeamIds = [];
            if ($user instanceof User) {
                $adminTeamIds = array_keys($this->adminScopeService->getAdministeredTeams($user));
                foreach ($user->getUserRelations() as $relation) {
                    if ($relation->getPlayer()) {
                        $playerIds[] = $relation->getPlayer()->getId();
                    }
                    if ($relation->getCoach()) {
                        $coachIds[] = $relation->getCoach()->getId();
                    }
                }
            }

            $now = new DateTime();
            $dateCondition = '(pta.startDate IS NULL OR pta.startDate <= :now) AND (pta.endDate IS NULL OR pta.endDate >= :now)';
            $coachDateCondition = '(cta.startDate IS NULL OR cta.startDate <= :now) AND (cta.endDate IS NULL OR cta.endDate >= :now)';

            if ($adminTeamIds) {
                $qb->andWhere('t.id IN (:adminTeamIds)')
                   ->setParameter('adminTeamIds', $adminTeamIds);
            } elseif ($playerIds && $coachIds) {
                $qb->andWhere(
                    "(pta.player IN (:playerIds) AND $dateCondition) OR (cta.coach IN (:coachIds) AND $coachDateCondition)"
                )
                   ->setParameter('playerIds', $playerIds)
                   ->setParameter('coachIds', $coachIds)
                   ->setParameter('now', $now);
            } elseif ($playerIds) {
                $qb->andWhere("pta.player IN (:playerIds) AND $dateCondition")
                   ->setParameter('playerIds', $playerIds)
                   ->setParameter('now', $now);
            } elseif ($coachIds) {
                $qb->andWhere("cta.coach IN (:coachIds) AND $coachDateCondition")
                   ->setParameter('coachIds', $coachIds)
                   ->setParameter('now', $now);
            } else {
                $qb->andWhere('1 = 0');
            }
        }

        return $qb;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchFullEntry(int $id, ?UserInterface $user = null): ?array
    {
        // Für Admin-Detailansicht: Alle Details mit allen Relationen
        return $this->createQueryBuilder('t')
            ->select('t', 'p', 'g', 'l', 'pta', 'cta')
            ->leftJoin('t.players', 'p')
            ->leftJoin('t.games', 'g')
            ->leftJoin('t.league', 'l')
            ->leftJoin('t.playerTeamAssignments', 'pta', 'WITH', 'pta.team = t')
            ->leftJoin('t.coachTeamAssignments', 'cta', 'WITH', 'cta.team = t')
            ->where('t.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): ?array
    {
        // Für Frontend/API: Nur die benötigten Details
        return $this->createQueryBuilder('t')
            ->select('t.id, t.name')
            ->addSelect('p.id as player_id, p.firstName, p.lastName')
            ->leftJoin('t.players', 'p')
            ->where('t.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
