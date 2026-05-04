<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<PlayerSuspension>
 */
class PlayerSuspensionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PlayerSuspension::class);
    }

    /**
     * Gibt alle aktiven Sperren eines Spielers in einem Wettbewerb zurück.
     *
     * @return PlayerSuspension[]
     */
    public function findActiveSuspensionsForPlayerInCompetition(
        Player $player,
        string $competitionType,
        ?int $competitionId,
    ): array {
        $qb = $this->createQueryBuilder('ps')
            ->where('ps.player = :player')
            ->andWhere('ps.competitionType = :competitionType')
            ->andWhere('ps.isActive = true')
            ->setParameter('player', $player)
            ->setParameter('competitionType', $competitionType);

        if (null !== $competitionId) {
            $qb->andWhere('ps.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('ps.competitionId IS NULL');
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Prüft ob ein Spieler aktuell in einem bestimmten Wettbewerb gesperrt ist.
     */
    public function isSuspended(Player $player, string $competitionType, ?int $competitionId): bool
    {
        return count($this->findActiveSuspensionsForPlayerInCompetition(
            $player,
            $competitionType,
            $competitionId,
        )) > 0;
    }

    /**
     * Alle aktiven Sperren eines Spielers (über alle Wettbewerbe).
     *
     * @return PlayerSuspension[]
     */
    public function findAllActiveSuspensionsForPlayer(Player $player): array
    {
        return $this->createQueryBuilder('ps')
            ->where('ps.player = :player')
            ->andWhere('ps.isActive = true')
            ->setParameter('player', $player)
            ->orderBy('ps.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Gibt die zuletzt erstellte Gelb-Karten-Sperre eines Spielers in einem Wettbewerb zurück.
     * Wird genutzt, um den Gelb-Karten-Zähler nach einer Sperre zurückzusetzen.
     */
    public function findLastYellowCardsSuspension(
        Player $player,
        string $competitionType,
        ?int $competitionId,
    ): ?PlayerSuspension {
        $qb = $this->createQueryBuilder('ps')
            ->where('ps.player = :player')
            ->andWhere('ps.competitionType = :competitionType')
            ->andWhere('ps.reason = :reason')
            ->setParameter('player', $player)
            ->setParameter('competitionType', $competitionType)
            ->setParameter('reason', PlayerSuspension::REASON_YELLOW_CARDS)
            ->orderBy('ps.createdAt', 'DESC')
            ->setMaxResults(1);

        if (null !== $competitionId) {
            $qb->andWhere('ps.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('ps.competitionId IS NULL');
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Sucht eine bestehende Sperre anhand des auslösenden Spiels und Grundes.
     * Wird vom Backfill-Command genutzt, um Duplikate zu vermeiden.
     */
    public function findByTriggerGameAndReason(
        Player $player,
        string $competitionType,
        ?int $competitionId,
        string $reason,
        Game $triggeredByGame,
    ): ?PlayerSuspension {
        $qb = $this->createQueryBuilder('ps')
            ->where('ps.player = :player')
            ->andWhere('ps.competitionType = :competitionType')
            ->andWhere('ps.reason = :reason')
            ->andWhere('ps.triggeredByGame = :game')
            ->setParameter('player', $player)
            ->setParameter('competitionType', $competitionType)
            ->setParameter('reason', $reason)
            ->setParameter('game', $triggeredByGame)
            ->setMaxResults(1);

        if (null !== $competitionId) {
            $qb->andWhere('ps.competitionId = :competitionId')
               ->setParameter('competitionId', $competitionId);
        } else {
            $qb->andWhere('ps.competitionId IS NULL');
        }

        return $qb->getQuery()->getOneOrNullResult();
    }
}
