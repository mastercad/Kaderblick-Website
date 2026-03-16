<?php

namespace App\Repository;

use App\Entity\SystemAlert;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<SystemAlert>
 */
class SystemAlertRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SystemAlert::class);
    }

    /**
     * Finds an existing open (non-resolved) alert with the same fingerprint,
     * or returns null if none exists or all matching ones are resolved.
     */
    public function findOpenByFingerprint(string $fingerprint): ?SystemAlert
    {
        return $this->createQueryBuilder('a')
            ->where('a.fingerprint = :fp')
            ->andWhere('a.isResolved = false')
            ->setParameter('fp', $fingerprint)
            ->orderBy('a.firstOccurrenceAt', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Returns all alerts grouped into open (not resolved) and resolved buckets,
     * newest-last-occurrence first.
     *
     * @return array{open: SystemAlert[], resolved: SystemAlert[]}
     */
    public function findGrouped(): array
    {
        $all = $this->createQueryBuilder('a')
            ->orderBy('a.lastOccurrenceAt', 'DESC')
            ->getQuery()
            ->getResult();

        $open = [];
        $resolved = [];

        foreach ($all as $alert) {
            if ($alert->isResolved()) {
                $resolved[] = $alert;
            } else {
                $open[] = $alert;
            }
        }

        return ['open' => $open, 'resolved' => $resolved];
    }

    /**
     * Count open (unresolved) alerts per category.
     *
     * @return array<string, int>
     */
    public function countOpenByCategory(): array
    {
        $rows = $this->createQueryBuilder('a')
            ->select('a.category', 'COUNT(a.id) AS cnt')
            ->where('a.isResolved = false')
            ->groupBy('a.category')
            ->getQuery()
            ->getArrayResult();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['category']->value] = (int) $row['cnt'];
        }

        return $result;
    }

    /** Count all open alerts. */
    public function countOpen(): int
    {
        return (int) $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.isResolved = false')
            ->getQuery()
            ->getSingleScalarResult();
    }
}
