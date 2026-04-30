<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\KnowledgeBaseCategory;
use App\Entity\Team;
use App\Repository\KnowledgeBaseCategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für KnowledgeBaseCategoryRepository::findGlobal().
 *
 * Prüft die QueryBuilder-Logik ohne echte Datenbankverbindung.
 */
#[AllowMockObjectsWithoutExpectations]
class KnowledgeBaseCategoryRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private KnowledgeBaseCategoryRepository $repository;

    /** @var string[] Alle WHERE/andWhere-Bedingungen die übergeben wurden */
    private array $capturedWhere = [];

    /** @var array<string, string> orderBy-Aufrufe: Spalte → Richtung */
    private array $capturedOrderBy = [];

    /** Steuerung des getResult()-Rückgabewerts */
    /** @var KnowledgeBaseCategory[] */
    private array $queryResult = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        // Fluente QB-Methoden die sich selbst zurückgeben
        foreach (['select', 'from', 'distinct', 'addOrderBy'] as $m) {
            $this->qb->method($m)->willReturnSelf();
        }

        $this->qb->method('where')->willReturnCallback(function (string $cond) {
            $this->capturedWhere[] = $cond;

            return $this->qb;
        });

        $this->qb->method('andWhere')->willReturnCallback(function (string $cond) {
            $this->capturedWhere[] = $cond;

            return $this->qb;
        });

        $this->qb->method('orderBy')->willReturnCallback(function (string $col, string $dir) {
            $this->capturedOrderBy[$col] = $dir;

            return $this->qb;
        });

        $this->qb->method('setParameter')->willReturnSelf();
        $this->qb->method('getQuery')->willReturn($this->query);
        $this->query->method('getResult')->willReturnCallback(fn () => $this->queryResult);

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $meta = $this->createMock(ClassMetadata::class);
        $meta->name = KnowledgeBaseCategory::class;
        $this->em->method('getClassMetadata')->willReturn($meta);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new KnowledgeBaseCategoryRepository($registry);
    }

    // ─── findGlobal ──────────────────────────────────────────────────────────

    public function testFindGlobalFiltersOnTeamIsNull(): void
    {
        $this->repository->findGlobal();

        $this->assertContains('tc.team IS NULL', $this->capturedWhere);
    }

    public function testFindGlobalDoesNotAddExtraWhereConditions(): void
    {
        $this->repository->findGlobal();

        $this->assertCount(1, $this->capturedWhere);
        $this->assertSame('tc.team IS NULL', $this->capturedWhere[0]);
    }

    public function testFindGlobalOrdersBySortOrderAsc(): void
    {
        $this->repository->findGlobal();

        $this->assertArrayHasKey('tc.sortOrder', $this->capturedOrderBy);
        $this->assertSame('ASC', $this->capturedOrderBy['tc.sortOrder']);
    }

    public function testFindGlobalReturnsQueryResult(): void
    {
        $cat = $this->createMock(KnowledgeBaseCategory::class);
        $this->queryResult = [$cat];

        $result = $this->repository->findGlobal();

        $this->assertSame([$cat], $result);
    }

    public function testFindGlobalReturnsEmptyArrayWhenNoCategoriesExist(): void
    {
        $this->queryResult = [];

        $result = $this->repository->findGlobal();

        $this->assertSame([], $result);
    }

    public function testFindGlobalReturnsMultipleResults(): void
    {
        $cat1 = $this->createMock(KnowledgeBaseCategory::class);
        $cat2 = $this->createMock(KnowledgeBaseCategory::class);
        $this->queryResult = [$cat1, $cat2];

        $result = $this->repository->findGlobal();

        $this->assertCount(2, $result);
        $this->assertSame($cat1, $result[0]);
        $this->assertSame($cat2, $result[1]);
    }

    // ─── findForTeam ─────────────────────────────────────────────────────────

    public function testFindForTeamFiltersOnTeam(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findForTeam($team);

        $this->assertContains('tc.team = :team', $this->capturedWhere);
    }

    public function testFindForTeamDoesNotAddExtraWhereConditions(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findForTeam($team);

        $this->assertCount(1, $this->capturedWhere);
        $this->assertSame('tc.team = :team', $this->capturedWhere[0]);
    }

    public function testFindForTeamOrdersBySortOrderAsc(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findForTeam($team);

        $this->assertArrayHasKey('tc.sortOrder', $this->capturedOrderBy);
        $this->assertSame('ASC', $this->capturedOrderBy['tc.sortOrder']);
    }

    public function testFindForTeamReturnsQueryResult(): void
    {
        $team = $this->createMock(Team::class);
        $cat = $this->createMock(KnowledgeBaseCategory::class);
        $this->queryResult = [$cat];

        $result = $this->repository->findForTeam($team);

        $this->assertSame([$cat], $result);
    }

    public function testFindForTeamReturnsEmptyArrayWhenNoCategories(): void
    {
        $team = $this->createMock(Team::class);
        $this->queryResult = [];

        $result = $this->repository->findForTeam($team);

        $this->assertSame([], $result);
    }
}
