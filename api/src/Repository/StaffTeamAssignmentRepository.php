<?php

namespace App\Repository;

use App\Entity\StaffTeamAssignment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<StaffTeamAssignment>
 */
class StaffTeamAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffTeamAssignment::class);
    }
}
