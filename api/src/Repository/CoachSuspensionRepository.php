<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Coach;
use App\Entity\CoachSuspension;
use App\Entity\Game;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<CoachSuspension>
 */
class CoachSuspensionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CoachSuspension::class);
    }

    /**
     * Gibt alle aktiven Sperren eines Trainers in einem Wettbewerb zurück.
     *
     * @return CoachSuspension[]
     */
    public function findActiveSuspensionsForCoachInCompetition(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
    ): array {
        $qb = $this->createQueryBuilder('cs')
            ->where('cs.coach = :coach')
            ->andWhere('cs.competitionType = :competitionType')
            ->andWhere('cs.isActive = true')
            ->setParameter('coach', $coach)
            ->setParameter('competitionType', $competitionType);

        if (null !== $competitionId) {
            $qb->andWhere('cs.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('cs.competitionId IS NULL');
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Gibt die zuletzt erstellte Gelb-Karten-Sperre eines Trainers in einem Wettbewerb zurück.
     */
    public function findLastYellowCardsSuspension(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
    ): ?CoachSuspension {
        $qb = $this->createQueryBuilder('cs')
            ->where('cs.coach = :coach')
            ->andWhere('cs.competitionType = :competitionType')
            ->andWhere('cs.reason = :reason')
            ->setParameter('coach', $coach)
            ->setParameter('competitionType', $competitionType)
            ->setParameter('reason', CoachSuspension::REASON_YELLOW_CARDS)
            ->orderBy('cs.createdAt', 'DESC')
            ->setMaxResults(1);

        if (null !== $competitionId) {
            $qb->andWhere('cs.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('cs.competitionId IS NULL');
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Sucht eine bestehende Sperre anhand des auslösenden Spiels und Grundes.
     */
    public function findByTriggerGameAndReason(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
        string $reason,
        Game $triggeredByGame,
    ): ?CoachSuspension {
        $qb = $this->createQueryBuilder('cs')
            ->where('cs.coach = :coach')
            ->andWhere('cs.competitionType = :competitionType')
            ->andWhere('cs.reason = :reason')
            ->andWhere('cs.triggeredByGame = :game')
            ->setParameter('coach', $coach)
            ->setParameter('competitionType', $competitionType)
            ->setParameter('reason', $reason)
            ->setParameter('game', $triggeredByGame)
            ->setMaxResults(1);

        if (null !== $competitionId) {
            $qb->andWhere('cs.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('cs.competitionId IS NULL');
        }

        return $qb->getQuery()->getOneOrNullResult();
    }
}
