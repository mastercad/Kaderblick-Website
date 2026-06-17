<?php

namespace App\Repository;

use App\Entity\FunctionaryClubAssignment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<FunctionaryClubAssignment>
 */
class FunctionaryClubAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FunctionaryClubAssignment::class);
    }
}
