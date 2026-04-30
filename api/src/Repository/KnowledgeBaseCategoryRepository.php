<?php

namespace App\Repository;

use App\Entity\KnowledgeBaseCategory;
use App\Entity\Team;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<KnowledgeBaseCategory>
 */
class KnowledgeBaseCategoryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KnowledgeBaseCategory::class);
    }

    /**
     * Returns global categories plus team-specific ones, ordered by sortOrder.
     *
     * @return KnowledgeBaseCategory[]
     */
    public function findForTeam(Team $team): array
    {
        return $this->createQueryBuilder('tc')
            ->where('tc.team IS NULL OR tc.team = :team')
            ->setParameter('team', $team)
            ->orderBy('tc.sortOrder', 'ASC')
            ->addOrderBy('tc.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
