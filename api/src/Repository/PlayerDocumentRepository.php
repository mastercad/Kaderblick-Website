<?php

namespace App\Repository;

use App\Entity\Player;
use App\Entity\PlayerDocument;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PlayerDocument> */
class PlayerDocumentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PlayerDocument::class);
    }

    /** @return PlayerDocument[] */
    public function findForPlayer(Player $player): array
    {
        return $this->findBy(['player' => $player], ['createdAt' => 'DESC']);
    }

    /** @return PlayerDocument[] */
    public function findExpiringWithin(int $days): array
    {
        return $this->createQueryBuilder('d')
            ->andWhere('d.expiresAt BETWEEN :today AND :until')
            ->andWhere('d.processingStatus = :status')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('until', new DateTimeImmutable("today +{$days} days"))
            ->setParameter('status', 'ready')
            ->orderBy('d.expiresAt', 'ASC')->getQuery()->getResult();
    }

    /** @return PlayerDocument[] */
    public function findUndispatchedPending(int $limit = 100): array
    {
        return $this->createQueryBuilder('d')->andWhere('d.processingStatus = :pending')
            ->andWhere('d.processingDispatchedAt IS NULL')->setParameter('pending', 'pending')
            ->orderBy('d.createdAt', 'ASC')->setMaxResults($limit)->getQuery()->getResult();
    }
}
