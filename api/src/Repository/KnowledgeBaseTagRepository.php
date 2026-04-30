<?php

namespace App\Repository;

use App\Entity\KnowledgeBaseTag;
use App\Entity\Team;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<KnowledgeBaseTag>
 */
class KnowledgeBaseTagRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KnowledgeBaseTag::class);
    }

    /**
     * Returns global tags plus team-specific ones, ordered alphabetically.
     *
     * @return KnowledgeBaseTag[]
     */
    public function findForTeam(Team $team): array
    {
        return $this->createQueryBuilder('tt')
            ->where('tt.team IS NULL OR tt.team = :team')
            ->setParameter('team', $team)
            ->orderBy('tt.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
