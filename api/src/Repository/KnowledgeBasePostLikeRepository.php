<?php

namespace App\Repository;

use App\Entity\KnowledgeBasePost;
use App\Entity\KnowledgeBasePostLike;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<KnowledgeBasePostLike>
 */
class KnowledgeBasePostLikeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KnowledgeBasePostLike::class);
    }

    public function findByPostAndUser(KnowledgeBasePost $post, User $user): ?KnowledgeBasePostLike
    {
        return $this->findOneBy(['post' => $post, 'user' => $user]);
    }
}
