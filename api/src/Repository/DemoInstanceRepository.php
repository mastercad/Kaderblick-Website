<?php

namespace App\Repository;

use App\Entity\DemoInstance;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DemoInstance>
 */
class DemoInstanceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DemoInstance::class);
    }

    public function findByToken(string $token): ?DemoInstance
    {
        return $this->findOneBy(['demoToken' => $token]);
    }

    /**
     * @return DemoInstance[]
     */
    public function findActive(): array
    {
        return $this->findBy(['status' => DemoInstance::STATUS_ACTIVE]);
    }
}
