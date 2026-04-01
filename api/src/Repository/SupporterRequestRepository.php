<?php

namespace App\Repository;

use App\Entity\SupporterRequest;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SupporterRequest>
 */
class SupporterRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SupporterRequest::class);
    }

    public function findOneByUserPending(int $userId): ?SupporterRequest
    {
        return $this->createQueryBuilder('r')
            ->where('r.user = :userId')
            ->andWhere('r.status = :status')
            ->setParameter('userId', $userId)
            ->setParameter('status', SupporterRequest::STATUS_PENDING)
            ->getQuery()
            ->getOneOrNullResult();
    }
}