<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\QuickEventPreset;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<QuickEventPreset>
 */
class QuickEventPresetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, QuickEventPreset::class);
    }

    public function findActive(): ?QuickEventPreset
    {
        return $this->findOneBy(['isActive' => true]);
    }

    /**
     * Gibt alle Presets zurück, die dem Benutzer gehören oder die mit ihm geteilt wurden.
     *
     * @return QuickEventPreset[]
     */
    public function findForUser(User $user): array
    {
        return $this->createQueryBuilder('p')
            ->leftJoin('p.sharedWith', 'sw')
            ->where('p.owner = :user')
            ->orWhere('sw = :user')
            ->setParameter('user', $user)
            ->orderBy('p.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
