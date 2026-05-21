<?php

namespace App\Repository;

use App\Entity\Coach;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Player;
use App\Entity\Team;
use App\Entity\User;
use DateTimeInterface;
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

    /**
     * Zählt die Gelben Karten eines Spielers innerhalb eines Wettbewerbs.
     *
     * @param string   $competitionType one of CompetitionCardRule::TYPE_*
     * @param int|null $competitionId   league_id / cup_id / tournament_id – NULL für Friendly-Spiele
     */
    public function countYellowCardsForPlayerInCompetition(
        Player $player,
        string $competitionType,
        ?int $competitionId,
    ): int {
        $qb = $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->join('e.gameEventType', 'et')
            ->join('e.game', 'g')
            ->where('e.player = :player')
            ->andWhere('et.code = :code')
            ->setParameter('player', $player)
            ->setParameter('code', 'yellow_card');

        switch ($competitionType) {
            case 'league':
                $qb->join('g.league', 'l')
                   ->andWhere('l.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'cup':
                $qb->join('g.cup', 'c')
                   ->andWhere('c.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'tournament':
                $qb->join('g.tournamentMatch', 'tm')
                   ->join('tm.tournament', 't')
                   ->andWhere('t.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            default: // 'friendly'
                $qb->andWhere('g.league IS NULL')
                   ->andWhere('g.cup IS NULL')
                   ->andWhere('g.tournamentMatch IS NULL');
                break;
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Zählt Gelbe Karten eines Spielers in einem Wettbewerb, jedoch nur ab einem bestimmten Datum.
     * Wird genutzt, wenn der Zähler nach einer Sperre zurückgesetzt werden soll.
     *
     * @param DateTimeInterface $afterDate nur Karten aus Spielen NACH diesem Datum werden gezählt
     */
    public function countYellowCardsForPlayerInCompetitionAfterDate(
        Player $player,
        string $competitionType,
        ?int $competitionId,
        DateTimeInterface $afterDate,
    ): int {
        $qb = $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->join('e.gameEventType', 'et')
            ->join('e.game', 'g')
            ->join('g.calendarEvent', 'ce')
            ->where('e.player = :player')
            ->andWhere('et.code = :code')
            ->andWhere('ce.startDate > :afterDate')
            ->setParameter('player', $player)
            ->setParameter('code', 'yellow_card')
            ->setParameter('afterDate', $afterDate);

        switch ($competitionType) {
            case 'league':
                $qb->join('g.league', 'l')
                   ->andWhere('l.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'cup':
                $qb->join('g.cup', 'c')
                   ->andWhere('c.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'tournament':
                $qb->join('g.tournamentMatch', 'tm')
                   ->join('tm.tournament', 't')
                   ->andWhere('t.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            default: // 'friendly'
                $qb->andWhere('g.league IS NULL')
                   ->andWhere('g.cup IS NULL')
                   ->andWhere('g.tournamentMatch IS NULL');
                break;
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Gibt alle Karten-Events (Gelb/Rot/Gelb-Rot) für Spieler in chronologischer Reihenfolge zurück.
     * Wird vom Backfill-Command genutzt, um historische Sperren nachzupflegen.
     *
     * @return GameEvent[]
     */
    public function findAllCardEventsChronological(): array
    {
        return $this->createQueryBuilder('e')
            ->join('e.gameEventType', 'et')
            ->join('e.game', 'g')
            ->leftJoin('g.calendarEvent', 'ce')
            ->where('et.code IN (:codes)')
            ->andWhere('e.player IS NOT NULL')
            ->setParameter('codes', ['yellow_card', 'red_card', 'yellow_red_card'])
            ->orderBy('ce.startDate', 'ASC')
            ->addOrderBy('e.timestamp', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Zählt die Gelben Karten eines Trainers innerhalb eines Wettbewerbs.
     *
     * @param string   $competitionType one of CompetitionCardRule::TYPE_*
     * @param int|null $competitionId   league_id / cup_id / tournament_id – NULL für Friendly-Spiele
     */
    public function countYellowCardsForCoachInCompetition(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
    ): int {
        $qb = $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->join('e.gameEventType', 'et')
            ->join('e.game', 'g')
            ->where('e.coach = :coach')
            ->andWhere('et.code = :code')
            ->setParameter('coach', $coach)
            ->setParameter('code', 'yellow_card');

        switch ($competitionType) {
            case 'league':
                $qb->join('g.league', 'l')
                   ->andWhere('l.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'cup':
                $qb->join('g.cup', 'c')
                   ->andWhere('c.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'tournament':
                $qb->join('g.tournamentMatch', 'tm')
                   ->join('tm.tournament', 't')
                   ->andWhere('t.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            default: // 'friendly'
                $qb->andWhere('g.league IS NULL')
                   ->andWhere('g.cup IS NULL')
                   ->andWhere('g.tournamentMatch IS NULL');
                break;
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Zählt Gelbe Karten eines Trainers in einem Wettbewerb, jedoch nur ab einem bestimmten Datum.
     *
     * @param DateTimeInterface $afterDate nur Karten aus Spielen NACH diesem Datum werden gezählt
     */
    public function countYellowCardsForCoachInCompetitionAfterDate(
        Coach $coach,
        string $competitionType,
        ?int $competitionId,
        DateTimeInterface $afterDate,
    ): int {
        $qb = $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->join('e.gameEventType', 'et')
            ->join('e.game', 'g')
            ->join('g.calendarEvent', 'ce')
            ->where('e.coach = :coach')
            ->andWhere('et.code = :code')
            ->andWhere('ce.startDate > :afterDate')
            ->setParameter('coach', $coach)
            ->setParameter('code', 'yellow_card')
            ->setParameter('afterDate', $afterDate);

        switch ($competitionType) {
            case 'league':
                $qb->join('g.league', 'l')
                   ->andWhere('l.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'cup':
                $qb->join('g.cup', 'c')
                   ->andWhere('c.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            case 'tournament':
                $qb->join('g.tournamentMatch', 'tm')
                   ->join('tm.tournament', 't')
                   ->andWhere('t.id = :competitionId')
                   ->setParameter('competitionId', $competitionId);
                break;
            default: // 'friendly'
                $qb->andWhere('g.league IS NULL')
                   ->andWhere('g.cup IS NULL')
                   ->andWhere('g.tournamentMatch IS NULL');
                break;
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Liefert alle GameEvents ohne Player-Zuweisung (und ohne Coach-Zuweisung),
     * gefiltert nach den Teams, die der User sehen darf.
     *
     * ROLE_SUPERADMIN sieht alle; alle anderen nur Ereignisse ihrer Teams.
     *
     * @return GameEvent[]
     */
    public function findUnknownPlayerEvents(User $user): array
    {
        $qb = $this->createQueryBuilder('ge')
            ->select('ge', 'g', 'ht', 'at', 'get2', 'ce')
            ->leftJoin('ge.game', 'g')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at')
            ->leftJoin('ge.gameEventType', 'get2')
            ->leftJoin('g.calendarEvent', 'ce')
            ->where('ge.player IS NULL')
            ->andWhere('ge.coach IS NULL')
            ->orderBy('ce.startDate', 'DESC')
            ->addOrderBy('ge.timestamp', 'ASC');

        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return $qb->getQuery()->getResult();
        }

        $teamIds = $this->getUserTeamIds($user);

        if (empty($teamIds)) {
            return [];
        }

        $qb->andWhere('ht.id IN (:teamIds) OR at.id IN (:teamIds)')
            ->setParameter('teamIds', $teamIds);

        return $qb->getQuery()->getResult();
    }

    /**
     * Prüft ob der User Zugriff auf ein bestimmtes GameEvent hat.
     */
    public function userCanAccessGameEvent(GameEvent $event, User $user): bool
    {
        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return true;
        }

        $teamIds = $this->getUserTeamIds($user);
        $homeTeamId = $event->getGame()->getHomeTeam()?->getId();
        $awayTeamId = $event->getGame()->getAwayTeam()?->getId();

        return in_array($homeTeamId, $teamIds) || in_array($awayTeamId, $teamIds);
    }

    /**
     * @return int[]
     */
    private function getUserTeamIds(User $user): array
    {
        $teamIds = [];
        foreach ($user->getUserRelations() as $userRelation) {
            if ($userRelation->getPlayer()) {
                foreach ($userRelation->getPlayer()->getPlayerTeamAssignments() as $assignment) {
                    $teamIds[] = $assignment->getTeam()->getId();
                }
            }
            if ($userRelation->getCoach()) {
                foreach ($userRelation->getCoach()->getCoachTeamAssignments() as $assignment) {
                    $teamIds[] = $assignment->getTeam()->getId();
                }
            }
        }

        return array_unique($teamIds);
    }
}
