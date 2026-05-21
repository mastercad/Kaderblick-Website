<?php

namespace App\Repository;

use App\Entity\PublicHoliday;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PublicHoliday>
 */
class PublicHolidayRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PublicHoliday::class);
    }

    /**
     * @return PublicHoliday[]
     */
    public function findByYearAndState(int $year, string $stateCode): array
    {
        return $this->createQueryBuilder('h')
            ->andWhere('h.year = :year')
            ->andWhere('h.stateCode = :stateCode')
            ->setParameter('year', $year)
            ->setParameter('stateCode', $stateCode)
            ->orderBy('h.date', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
