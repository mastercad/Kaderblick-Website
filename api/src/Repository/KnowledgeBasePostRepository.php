<?php

namespace App\Repository;

use App\Entity\KnowledgeBaseCategory;
use App\Entity\KnowledgeBasePost;
use App\Entity\Team;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<KnowledgeBasePost>
 */
class KnowledgeBasePostRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KnowledgeBasePost::class);
    }

    /**
     * @return KnowledgeBasePost[]
     */
    public function findByTeamAndFilters(
        Team $team,
        ?KnowledgeBaseCategory $category = null,
        ?string $search = null,
        ?string $tag = null
    ): array {
        $qb = $this->createQueryBuilder('tp')
            ->leftJoin('tp.tags', 'tg')
            ->where('tp.team = :team OR tp.team IS NULL')
            ->setParameter('team', $team)
            ->orderBy('tp.isPinned', 'DESC')
            ->addOrderBy('tp.createdAt', 'DESC')
            ->distinct();

        if (null !== $category) {
            $qb->andWhere('tp.category = :category')
                ->setParameter('category', $category);
        }

        if (null !== $search && '' !== trim($search)) {
            $safe = '%' . addcslashes(trim($search), '%_\\') . '%';
            $qb->andWhere('tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search')
                ->setParameter('search', $safe);
        }

        if (null !== $tag && '' !== trim($tag)) {
            $qb->andWhere('tg.name = :tag')
                ->setParameter('tag', trim($tag));
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Returns only global posts (team IS NULL) with optional filters.
     *
     * @return KnowledgeBasePost[]
     */
    public function findGlobalWithFilters(
        ?KnowledgeBaseCategory $category = null,
        ?string $search = null,
        ?string $tag = null
    ): array {
        $qb = $this->createQueryBuilder('tp')
            ->leftJoin('tp.tags', 'tg')
            ->where('tp.team IS NULL')
            ->orderBy('tp.isPinned', 'DESC')
            ->addOrderBy('tp.createdAt', 'DESC')
            ->distinct();

        if (null !== $category) {
            $qb->andWhere('tp.category = :category')
                ->setParameter('category', $category);
        }

        if (null !== $search && '' !== trim($search)) {
            $safe = '%' . addcslashes(trim($search), '%_\\') . '%';
            $qb->andWhere('tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search')
                ->setParameter('search', $safe);
        }

        if (null !== $tag && '' !== trim($tag)) {
            $qb->andWhere('tg.name = :tag')
                ->setParameter('tag', trim($tag));
        }

        return $qb->getQuery()->getResult();
    }
}
