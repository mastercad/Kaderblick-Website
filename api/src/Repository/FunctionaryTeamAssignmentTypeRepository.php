<?php

namespace App\Repository;

use App\Entity\FunctionaryTeamAssignmentType;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<FunctionaryTeamAssignmentType>
 */
class FunctionaryTeamAssignmentTypeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FunctionaryTeamAssignmentType::class);
    }
}
