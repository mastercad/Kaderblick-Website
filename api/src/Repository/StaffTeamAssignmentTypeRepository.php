<?php

namespace App\Repository;

use App\Entity\StaffTeamAssignmentType;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<StaffTeamAssignmentType>
 */
class StaffTeamAssignmentTypeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffTeamAssignmentType::class);
    }
}
