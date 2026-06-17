<?php

namespace App\Repository;

use App\Entity\FunctionaryClubAssignmentType;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<FunctionaryClubAssignmentType>
 */
class FunctionaryClubAssignmentTypeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FunctionaryClubAssignmentType::class);
    }
}
