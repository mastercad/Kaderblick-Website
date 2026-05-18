<?php

namespace App\Repository;

use App\Entity\Player;
use App\Entity\PlayerTitle;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PlayerTitle>
 */
class PlayerTitleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PlayerTitle::class);
    }

    /**
     * Get active titles for a user, sorted by priority.
     *
     * @return PlayerTitle[]
     */
    public function findActiveByUser(User $user): array
    {
        $titles = $this->createQueryBuilder('pt')
            ->leftJoin('pt.player', 'p')
            ->leftJoin('p.userRelations', 'ur')
            ->leftJoin('ur.relationType', 'rt')
            ->where('ur.user = :user')
            ->andWhere('rt.identifier = :selfPlayer')
            ->andWhere('pt.isActive = true')
            ->setParameter('user', $user)
            ->setParameter('selfPlayer', 'self_player')
            ->getQuery()
            ->getResult();

        // Sort by priority (platform gold first, then team gold, etc.)
        usort($titles, fn (PlayerTitle $a, PlayerTitle $b) => $a->getPriority() <=> $b->getPriority());

        return $titles;
    }

    /**
     * Get active titles for a player, sorted by priority.
     *
     * @return PlayerTitle[]
     */
    public function findActiveByPlayer(Player $player): array
    {
        $titles = $this->createQueryBuilder('pt')
            ->where('pt.player = :player')
            ->andWhere('pt.isActive = true')
            ->setParameter('player', $player)
            ->getQuery()
            ->getResult();

        // Sort by priority (platform gold first, then team gold, etc.)
        usort($titles, fn (PlayerTitle $a, PlayerTitle $b) => $a->getPriority() <=> $b->getPriority());

        return $titles;
    }

    /**
     * Get the highest priority active title for a user.
     */
    public function findHighestPriorityTitle(User $user): ?PlayerTitle
    {
        $titles = $this->findActiveByUser($user);

        return $titles[0] ?? null;
    }

    /**
     * Get the highest priority active title for a user.
     */
    public function findHighestPriorityTitleForPlayer(Player $player): ?PlayerTitle
    {
        $titles = $this->findActiveByPlayer($player);

        return $titles[0] ?? null;
    }

    /**
     * Deactivate all titles of a specific category and scope for a user.
     */
    public function deactivateTitles(User $user, string $titleCategory, string $titleScope, ?int $teamId = null): void
    {
        $qb = $this->createQueryBuilder('pt')
            ->update()
            ->set('pt.isActive', 'false')
            ->set('pt.revokedAt', ':now')
            ->leftJoin('pt.player', 'p')
            ->leftJoin('p.userRelations', 'ur')
            ->leftJoin('ur.relationType', 'rt')
            ->where('ur.user = :user')
            ->andWhere('rt.identifier = :selfPlayer')
            ->andWhere('pt.titleCategory = :category')
            ->andWhere('pt.titleScope = :scope')
            ->andWhere('pt.isActive = true')
            ->setParameter('user', $user)
            ->setParameter('category', $titleCategory)
            ->setParameter('scope', $titleScope)
            ->setParameter('now', new DateTimeImmutable());

        if (null !== $teamId) {
            $qb->andWhere('pt.team = :teamId')
               ->setParameter('teamId', $teamId);
        } else {
            $qb->andWhere('pt.team IS NULL');
        }

        $qb->getQuery()->execute();
    }

    /**
     * Deactivate ALL active titles of a specific category and scope for a season, without filtering by league/cup/team.
     * Use this before recalculating all league or cup titles so that leagues/cups with zero games also get cleaned up.
     */
    public function deactivateAllTitlesForScopeAndSeason(string $titleCategory, string $titleScope, ?string $season = null): void
    {
        $qb = $this->createQueryBuilder('pt')
            ->update()
            ->set('pt.isActive', 'false')
            ->set('pt.revokedAt', ':now')
            ->where('pt.titleCategory = :category')
            ->andWhere('pt.titleScope = :scope')
            ->andWhere('pt.isActive = true')
            ->setParameter('category', $titleCategory)
            ->setParameter('scope', $titleScope)
            ->setParameter('now', new DateTimeImmutable());

        if (null !== $season) {
            $qb->andWhere('pt.season = :season')
               ->setParameter('season', $season);
        }

        $qb->getQuery()->execute();
    }

    /**
     * Deactivate all titles of a specific category and scope for all users (optionale Saison, Team, Liga und Pokal).
     */
    public function deactivateAllTitlesForCategoryAndScope(
        string $titleCategory,
        string $titleScope,
        ?int $teamId = null,
        ?string $season = null,
        ?int $leagueId = null,
        ?int $cupId = null
    ): void {
        $qb = $this->createQueryBuilder('pt')
            ->update()
            ->set('pt.isActive', 'false')
            ->set('pt.revokedAt', ':now')
            ->where('pt.titleCategory = :category')
            ->andWhere('pt.titleScope = :scope')
            ->andWhere('pt.isActive = true')
            ->setParameter('category', $titleCategory)
            ->setParameter('scope', $titleScope)
            ->setParameter('now', new DateTimeImmutable());

        if (null !== $teamId) {
            $qb->andWhere('pt.team = :teamId')
               ->setParameter('teamId', $teamId);
        } else {
            $qb->andWhere('pt.team IS NULL');
        }
        if (null !== $leagueId) {
            $qb->andWhere('pt.league = :leagueId')
               ->setParameter('leagueId', $leagueId);
        } else {
            $qb->andWhere('pt.league IS NULL');
        }
        if (null !== $cupId) {
            $qb->andWhere('pt.cup = :cupId')
               ->setParameter('cupId', $cupId);
        } else {
            $qb->andWhere('pt.cup IS NULL');
        }
        if (null !== $season) {
            $qb->andWhere('pt.season = :season')
               ->setParameter('season', $season);
        }

        $qb->getQuery()->execute();
    }
}
