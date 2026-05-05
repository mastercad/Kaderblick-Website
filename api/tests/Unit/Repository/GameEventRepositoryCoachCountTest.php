<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\Coach;
use App\Entity\GameEvent;
use App\Repository\GameEventRepository;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für die Coach-Zählmethoden in GameEventRepository:
 * - countYellowCardsForCoachInCompetition()
 * - countYellowCardsForCoachInCompetitionAfterDate()
 *
 * Es wird verifiziert, dass:
 * - Der :coach-Parameter (nicht :player) übergeben wird
 * - Der :code-Parameter auf 'yellow_card' gesetzt wird
 * - Für friendly-Spiele die IS-NULL-Bedingungen gesetzt werden
 * - Für league/cup/tournament die entsprechenden Joins durchgeführt werden
 * - Das Ergebnis korrekt als int zurückgegeben wird
 */
#[AllowMockObjectsWithoutExpectations]
class GameEventRepositoryCoachCountTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private GameEventRepository $repository;

    /** @var array<string, mixed> */
    private array $capturedParameters = [];

    /** @var string[] */
    private array $capturedAndWhere = [];

    /** @var string[] */
    private array $capturedJoins = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        $this->qb->method('setParameter')->willReturnCallback(
            function (string $name, mixed $value) {
                $this->capturedParameters[$name] = $value;

                return $this->qb;
            }
        );

        $this->qb->method('andWhere')->willReturnCallback(
            function (string $condition) {
                $this->capturedAndWhere[] = $condition;

                return $this->qb;
            }
        );

        $this->qb->method('join')->willReturnCallback(
            function (string $join, string $alias) {
                $this->capturedJoins[] = $join . ' ' . $alias;

                return $this->qb;
            }
        );

        foreach (['select', 'where', 'from'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }

        $this->qb->method('getQuery')->willReturn($this->query);
        $this->query->method('getSingleScalarResult')->willReturn('3');

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $metadata = $this->createMock(ClassMetadata::class);
        $metadata->name = GameEvent::class;
        $this->em->method('getClassMetadata')->willReturn($metadata);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new GameEventRepository($registry);
    }

    // ── countYellowCardsForCoachInCompetition: Grundverhalten ─────────────────

    public function testCountYellowCardsCoachSetztCoachParameter(): void
    {
        $coach = $this->createMock(Coach::class);
        $this->repository->countYellowCardsForCoachInCompetition($coach, 'friendly', null);

        $this->assertArrayHasKey(
            'coach',
            $this->capturedParameters,
            ':coach-Parameter muss übergeben werden (nicht :player)'
        );
        $this->assertSame($coach, $this->capturedParameters['coach']);
    }

    public function testCountYellowCardsCoachSetztYellowCardCode(): void
    {
        $this->repository->countYellowCardsForCoachInCompetition(
            $this->createMock(Coach::class),
            'friendly',
            null
        );

        $this->assertArrayHasKey('code', $this->capturedParameters);
        $this->assertSame('yellow_card', $this->capturedParameters['code']);
    }

    public function testCountYellowCardsCoachReturnsInteger(): void
    {
        $count = $this->repository->countYellowCardsForCoachInCompetition(
            $this->createMock(Coach::class),
            'friendly',
            null
        );

        $this->assertSame(3, $count, 'Ergebnis muss als int zurückgegeben werden');
    }

    // ── friendly: IS-NULL-Bedingungen ─────────────────────────────────────────

    public function testCountYellowCardsCoachFriendlyAddsIsNullConditions(): void
    {
        $this->repository->countYellowCardsForCoachInCompetition(
            $this->createMock(Coach::class),
            'friendly',
            null
        );

        $this->assertContains(
            'g.league IS NULL',
            $this->capturedAndWhere,
            'friendly: g.league IS NULL muss gesetzt sein'
        );
        $this->assertContains(
            'g.cup IS NULL',
            $this->capturedAndWhere,
            'friendly: g.cup IS NULL muss gesetzt sein'
        );
        $this->assertContains(
            'g.tournamentMatch IS NULL',
            $this->capturedAndWhere,
            'friendly: g.tournamentMatch IS NULL muss gesetzt sein'
        );
    }

    // ── league: kompetitions-Join ─────────────────────────────────────────────

    public function testCountYellowCardsCoachLeagueJoinsLeague(): void
    {
        $this->repository->countYellowCardsForCoachInCompetition(
            $this->createMock(Coach::class),
            'league',
            5
        );

        $joinedRelations = array_map(fn ($j) => explode(' ', $j)[0], $this->capturedJoins);
        $this->assertContains(
            'g.league',
            $joinedRelations,
            'league: g.league muss gejoint werden'
        );

        $this->assertArrayHasKey('competitionId', $this->capturedParameters);
        $this->assertSame(5, $this->capturedParameters['competitionId']);
    }

    // ── cup: kompetitions-Join ────────────────────────────────────────────────

    public function testCountYellowCardsCoachCupJoinsCup(): void
    {
        $this->repository->countYellowCardsForCoachInCompetition(
            $this->createMock(Coach::class),
            'cup',
            3
        );

        $joinedRelations = array_map(fn ($j) => explode(' ', $j)[0], $this->capturedJoins);
        $this->assertContains(
            'g.cup',
            $joinedRelations,
            'cup: g.cup muss gejoint werden'
        );
    }

    // ── countYellowCardsForCoachInCompetitionAfterDate ────────────────────────

    public function testCountYellowCardsCoachAfterDateSetztAfterDateParameter(): void
    {
        $afterDate = new DateTime('2025-01-01');
        $this->repository->countYellowCardsForCoachInCompetitionAfterDate(
            $this->createMock(Coach::class),
            'friendly',
            null,
            $afterDate
        );

        $this->assertArrayHasKey(
            'afterDate',
            $this->capturedParameters,
            ':afterDate-Parameter muss gesetzt werden'
        );
        $this->assertSame($afterDate, $this->capturedParameters['afterDate']);
    }

    public function testCountYellowCardsCoachAfterDateSetztCoachParameter(): void
    {
        $coach = $this->createMock(Coach::class);
        $this->repository->countYellowCardsForCoachInCompetitionAfterDate(
            $coach,
            'league',
            1,
            new DateTime('2025-01-01')
        );

        $this->assertArrayHasKey('coach', $this->capturedParameters);
        $this->assertSame($coach, $this->capturedParameters['coach']);
    }

    public function testCountYellowCardsCoachAfterDateReturnsInteger(): void
    {
        $count = $this->repository->countYellowCardsForCoachInCompetitionAfterDate(
            $this->createMock(Coach::class),
            'friendly',
            null,
            new DateTime('2025-01-01')
        );

        $this->assertSame(3, $count);
    }
}
