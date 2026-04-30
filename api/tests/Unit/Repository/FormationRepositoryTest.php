<?php

namespace App\Tests\Unit\Repository;

use App\Entity\Formation;
use App\Entity\Team;
use App\Repository\FormationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für FormationRepository.
 *
 * Prüft die QueryBuilder-Logik für findVisibleForUser(), findByTeam(),
 * findArchivedForUser() und findArchivedByTeam() ohne echte Datenbankverbindung.
 */
#[AllowMockObjectsWithoutExpectations]
class FormationRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private FormationRepository $repository;

    /** @var Formation[] Steuerung des getResult()-Rückgabewerts über Tests hinweg */
    private array $queryResult = [];

    /** Zuletzt übergebene Teams aus setParameter(':teams', ...) */
    private mixed $capturedTeamsParam = null;

    /** Alle setParameter-Aufrufe */
    /** @var array<string, mixed> */
    private array $capturedParams = [];

    /** Alle andWhere-Aufrufe */
    /** @var string[] */
    private array $capturedAndWhere = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        $this->qb
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) {
                if ('teams' === $key) {
                    $this->capturedTeamsParam = $value;
                }
                $this->capturedParams[$key] = $value;

                return $this->qb;
            });

        $this->qb
            ->method('andWhere')
            ->willReturnCallback(function (string $condition) {
                $this->capturedAndWhere[] = $condition;

                return $this->qb;
            });

        // Alle fluenten QB-Methoden zurückgeben sich selbst
        foreach (['select', 'from', 'where', 'orderBy'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }

        $this->qb
            ->method('getQuery')
            ->willReturn($this->query);

        $this->query
            ->method('getResult')
            ->willReturnCallback(fn () => $this->queryResult);

        $this->em
            ->method('createQueryBuilder')
            ->willReturn($this->qb);

        $meta = $this->createMock(ClassMetadata::class);
        $meta->name = Formation::class;
        $this->em->method('getClassMetadata')->willReturn($meta);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new FormationRepository($registry);
    }

    // ─── findVisibleForUser ────────────────────────────────────────────────────

    public function testReturnsEmptyArrayWhenCoachTeamsIsEmpty(): void
    {
        $result = $this->repository->findVisibleForUser([]);

        $this->assertSame([], $result);
    }

    public function testPassesTeamsToQueryBuilder(): void
    {
        $team1 = $this->createMock(Team::class);
        $team2 = $this->createMock(Team::class);
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $this->repository->findVisibleForUser([1 => $team1, 2 => $team2]);

        $this->assertSame([1 => $team1, 2 => $team2], $this->capturedTeamsParam);
    }

    public function testReturnsQueryResult(): void
    {
        $team = $this->createMock(Team::class);
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $result = $this->repository->findVisibleForUser([10 => $team]);

        $this->assertSame([$formation], $result);
    }

    public function testReturnsEmptyArrayWhenQueryReturnsNothing(): void
    {
        $team = $this->createMock(Team::class);
        $this->queryResult = [];

        $result = $this->repository->findVisibleForUser([10 => $team]);

        $this->assertSame([], $result);
    }

    public function testFindVisibleForUserFiltersOutArchivedFormations(): void
    {
        $team = $this->createMock(Team::class);
        $this->repository->findVisibleForUser([1 => $team]);

        $this->assertContains('f.archivedAt IS NULL', $this->capturedAndWhere);
    }

    // ─── findByTeam ───────────────────────────────────────────────────────────

    public function testFindByTeamNeverCallsSetParametersWithArray(): void
    {
        $this->qb->expects($this->never())->method('setParameters');

        $this->repository->findByTeam(42);
    }

    public function testFindByTeamSetsTeamIdParameter(): void
    {
        $this->repository->findByTeam(42);

        $this->assertArrayHasKey('teamId', $this->capturedParams);
        $this->assertSame(42, $this->capturedParams['teamId']);
    }

    public function testFindByTeamReturnsQueryResult(): void
    {
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $result = $this->repository->findByTeam(1);

        $this->assertCount(1, $result);
        $this->assertSame($formation, $result[0]);
    }

    public function testFindByTeamReturnsEmptyArrayWhenNoFormationsFound(): void
    {
        $this->queryResult = [];

        $result = $this->repository->findByTeam(99);

        $this->assertSame([], $result);
    }

    public function testFindByTeamFiltersOutArchivedFormations(): void
    {
        $this->repository->findByTeam(1);

        $this->assertContains('f.archivedAt IS NULL', $this->capturedAndWhere);
    }

    // ─── findArchivedForUser ───────────────────────────────────────────────────

    public function testFindArchivedForUserReturnsEmptyArrayWhenCoachTeamsIsEmpty(): void
    {
        $result = $this->repository->findArchivedForUser([]);

        $this->assertSame([], $result);
    }

    public function testFindArchivedForUserPassesTeamsToQueryBuilder(): void
    {
        $team1 = $this->createMock(Team::class);
        $team2 = $this->createMock(Team::class);
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $this->repository->findArchivedForUser([1 => $team1, 2 => $team2]);

        $this->assertSame([1 => $team1, 2 => $team2], $this->capturedTeamsParam);
    }

    public function testFindArchivedForUserReturnsQueryResult(): void
    {
        $team = $this->createMock(Team::class);
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $result = $this->repository->findArchivedForUser([1 => $team]);

        $this->assertSame([$formation], $result);
    }

    public function testFindArchivedForUserReturnsEmptyArrayWhenQueryReturnsNothing(): void
    {
        $team = $this->createMock(Team::class);
        $this->queryResult = [];

        $result = $this->repository->findArchivedForUser([1 => $team]);

        $this->assertSame([], $result);
    }

    public function testFindArchivedForUserFiltersOnlyArchivedFormations(): void
    {
        $team = $this->createMock(Team::class);
        $this->repository->findArchivedForUser([1 => $team]);

        $this->assertContains('f.archivedAt IS NOT NULL', $this->capturedAndWhere);
        $this->assertNotContains('f.archivedAt IS NULL', $this->capturedAndWhere);
    }

    // ─── findArchivedByTeam ───────────────────────────────────────────────────

    public function testFindArchivedByTeamSetsTeamIdParameter(): void
    {
        $this->repository->findArchivedByTeam(7);

        $this->assertArrayHasKey('teamId', $this->capturedParams);
        $this->assertSame(7, $this->capturedParams['teamId']);
    }

    public function testFindArchivedByTeamReturnsQueryResult(): void
    {
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $result = $this->repository->findArchivedByTeam(1);

        $this->assertCount(1, $result);
        $this->assertSame($formation, $result[0]);
    }

    public function testFindArchivedByTeamReturnsEmptyArrayWhenNoFormationsFound(): void
    {
        $this->queryResult = [];

        $result = $this->repository->findArchivedByTeam(99);

        $this->assertSame([], $result);
    }

    public function testFindArchivedByTeamFiltersOnlyArchivedFormations(): void
    {
        $this->repository->findArchivedByTeam(1);

        $this->assertContains('f.archivedAt IS NOT NULL', $this->capturedAndWhere);
        $this->assertNotContains('f.archivedAt IS NULL', $this->capturedAndWhere);
    }
}
