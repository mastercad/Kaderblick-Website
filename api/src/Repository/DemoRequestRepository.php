<?php

namespace App\Repository;

use App\Entity\DemoRequest;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DemoRequest>
 */
class DemoRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DemoRequest::class);
    }

    public function findOneByEmailPending(string $email): ?DemoRequest
    {
        return $this->createQueryBuilder('r')
            ->where('r.email = :email')
            ->andWhere('r.status = :status')
            ->setParameter('email', $email)
            ->setParameter('status', DemoRequest::STATUS_PENDING)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
