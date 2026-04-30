<?php

namespace App\Repository;

use App\Entity\KnowledgeBasePostMedia;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<KnowledgeBasePostMedia>
 */
class KnowledgeBasePostMediaRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, KnowledgeBasePostMedia::class);
    }
}
