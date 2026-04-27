<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Player;
use App\Entity\Team;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template-extends ServiceEntityRepository<GameEvent>
 *
 * @implements OptimizedRepositoryInterface<GameEvent>
 */
class GameEventRepository extends ServiceEntityRepository implements OptimizedRepositoryInterface
{
    /**
     * Legt ein GameEvent aus Crawler-Daten an oder aktualisiert es (Platzhalter-Implementierung).
     *
     * @param array<string, mixed> $data
     */
    public function updateOrCreateFromCrawler(array $data): void
    {
        // TODO: Implementiere die eigentliche Logik zum Anlegen/Aktualisieren eines GameEvent
    }

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GameEvent::class);
    }

    /**
     * @return GameEvent[]
     */
    public function findAllGameEvents(Game $game): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.game = :game')
            ->setParameter('game', $game)
            ->orderBy('e.timestamp', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return GameEvent[]
     */
    public function findPlayerEvents(Player $player, string $eventTypeCode): array
    {
        return $this->createQueryBuilder('e')
            ->join('e.type', 't')
            ->where('e.player = :player')
            ->andWhere('t.code = :typeCode')
            ->setParameter('player', $player)
            ->setParameter('typeCode', $eventTypeCode)
            ->orderBy('e.timestamp', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return GameEvent[]
     */
    public function findTeamEvents(Team $team, string $eventTypeCode): array
    {
        return $this->createQueryBuilder('e')
            ->join('e.type', 't')
            ->where('e.team = :team')
            ->andWhere('e.player IS NULL')
            ->andWhere('t.code = :typeCode')
            ->setParameter('team', $team)
            ->setParameter('typeCode', $eventTypeCode)
            ->orderBy('e.timestamp', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return GameEvent[]
     */
    public function findSubstitutions(Game $game): array
    {
        return $this->createQueryBuilder('e')
            ->join('e.gameEventType', 'get')
            ->leftJoin('e.substitutionReason', 'sr')
            ->leftJoin('e.relatedPlayer', 'rp')
            ->where('e.game = :game')
            ->andWhere('get.code IN (:codes)')
            ->setParameter('game', $game)
            ->setParameter('codes', ['substitution', 'substitution_in', 'substitution_out', 'substitution_injury'])
            ->orderBy('e.timestamp', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return GameEvent[]
     */
    public function fetchFullList(?UserInterface $user = null): array
    {
        return $this->createQueryBuilder('ge')
            ->select('ge', 'g', 't', 'p', 'get', 'rp', 'sr', 'ce')
            ->leftJoin('ge.game', 'g')
            ->leftJoin('ge.team', 't')
            ->leftJoin('ge.player', 'p')
            ->leftJoin('ge.gameEventType', 'get')
            ->leftJoin('ge.relatedPlayer', 'rp')
            ->leftJoin('ge.substitutionReason', 'sr')
            ->leftJoin('g.calendarEvent', 'ce')
            ->orderBy('ce.startDate', 'DESC')
            ->addOrderBy('ge.timestamp', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return GameEvent[]
     */
    public function fetchOptimizedList(?UserInterface $user = null): array
    {
        return $this->createQueryBuilder('ge')
            ->select('ge.id, ge.timestamp, ge.description')
            ->addSelect('g.id as game_id, g.date as game_date')
            ->addSelect('t.id as team_id, t.name as team_name')
            ->addSelect('p.id as player_id, p.firstName as player_firstName, p.lastName as player_lastName')
            ->addSelect('get.id as event_type_id, get.name as event_type_name, get.code as event_type_code')
            ->addSelect('rp.id as related_player_id, rp.firstName as related_player_firstName, rp.lastName as related_player_lastName')
            ->addSelect('sr.id as substitution_reason_id, sr.name as substitution_reason_name')
            ->leftJoin('ge.game', 'g')
            ->leftJoin('ge.team', 't')
            ->leftJoin('ge.player', 'p')
            ->leftJoin('ge.gameEventType', 'get')
            ->leftJoin('ge.relatedPlayer', 'rp')
            ->leftJoin('ge.substitutionReason', 'sr')
            ->orderBy('g.date', 'DESC')
            ->addOrderBy('ge.timestamp', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchFullEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('ge')
            ->select('ge', 'g', 't', 'p')
            ->leftJoin('ge.game', 'g')
            ->leftJoin('ge.team', 't')
            ->leftJoin('ge.player', 'p')
            ->where('ge.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): ?array
    {
        return $this->createQueryBuilder('ge')
            ->select('ge.id, ge.eventType, ge.minute, ge.details')
            ->addSelect('g.id as game_id, g.date, g.homeScore, g.awayScore')
            ->addSelect('t.id as team_id, t.name as team_name')
            ->addSelect('p.id as player_id, p.firstName, p.lastName')
            ->leftJoin('ge.game', 'g')
            ->leftJoin('ge.team', 't')
            ->leftJoin('ge.player', 'p')
            ->where('ge.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
