<?php

namespace App\Repository;

use App\Entity\QuickEventConfig;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<QuickEventConfig>
 */
class QuickEventConfigRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, QuickEventConfig::class);
    }

    public function findByUser(User $user): ?QuickEventConfig
    {
        return $this->findOneBy(['user' => $user]);
    }
}
