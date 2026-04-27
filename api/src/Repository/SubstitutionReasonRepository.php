<?php

namespace App\Repository;

use App\Entity\SubstitutionReason;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template-extends ServiceEntityRepository<SubstitutionReason>
 *
 * @implements OptimizedRepositoryInterface<SubstitutionReason>
 */
class SubstitutionReasonRepository extends ServiceEntityRepository implements OptimizedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SubstitutionReason::class);
    }

    /**
     * @return SubstitutionReason[]
     */
    public function fetchFullList(?UserInterface $user = null): array
    {
        return $this->createQueryBuilder('sr')
            ->where('sr.active = true')
            ->orderBy('sr.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return SubstitutionReason[]
     */
    public function fetchOptimizedList(?UserInterface $user = null): array
    {
        return $this->createQueryBuilder('sr')
            ->select('sr.id, sr.name, sr.description')
            ->where('sr.active = true')
            ->orderBy('sr.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchFullEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('sr')
            ->where('sr.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('sr')
            ->select('sr.id, sr.name, sr.description')
            ->where('sr.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
