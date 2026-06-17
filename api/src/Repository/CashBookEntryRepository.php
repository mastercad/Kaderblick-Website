<?php

namespace App\Repository;

use App\Entity\CashBook;
use App\Entity\CashBookEntry;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<CashBookEntry>
 */
class CashBookEntryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CashBookEntry::class);
    }

    /**
     * Returns all entries for a cash book ordered by entry_date DESC, id DESC.
     *
     * @return CashBookEntry[]
     */
    public function findByCashBookOrdered(CashBook $cashBook): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.cashBook = :cashBook')
            ->setParameter('cashBook', $cashBook)
            ->orderBy('e.entryDate', 'DESC')
            ->addOrderBy('e.id', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
