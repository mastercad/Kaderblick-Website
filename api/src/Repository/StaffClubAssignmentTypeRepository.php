<?php

namespace App\Repository;

use App\Entity\StaffClubAssignmentType;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<StaffClubAssignmentType>
 */
class StaffClubAssignmentTypeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffClubAssignmentType::class);
    }
}
