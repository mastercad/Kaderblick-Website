<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\KnowledgeBaseTag;
use App\Entity\Team;
use App\Repository\KnowledgeBaseTagRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für KnowledgeBaseTagRepository.
 *
 * Abgedeckt:
 *  - findGlobal(): WHERE-Bedingung, ORDER BY, Rückgabewerte
 *  - findForTeam(): WHERE-Bedingung mit Team-Parameter
 */
#[AllowMockObjectsWithoutExpectations]
class KnowledgeBaseTagRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private KnowledgeBaseTagRepository $repository;

    /** @var string[] Alle WHERE/andWhere-Bedingungen */
    private array $capturedWhere = [];

    /** @var array<string, string> orderBy-Aufrufe: Spalte → Richtung */
    private array $capturedOrderBy = [];

    /** @var array<string, mixed> setParameter-Aufrufe */
    private array $capturedParams = [];

    /** Steuerung des getResult()-Rückgabewerts */
    /** @var KnowledgeBaseTag[] */
    private array $queryResult = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        foreach (['select', 'from', 'distinct'] as $m) {
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

        $this->qb->method('setParameter')->willReturnCallback(function (string $key, mixed $val) {
            $this->capturedParams[$key] = $val;

            return $this->qb;
        });

        $this->qb->method('getQuery')->willReturn($this->query);
        $this->query->method('getResult')->willReturnCallback(fn () => $this->queryResult);

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $meta = $this->createMock(ClassMetadata::class);
        $meta->name = KnowledgeBaseTag::class;
        $this->em->method('getClassMetadata')->willReturn($meta);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new KnowledgeBaseTagRepository($registry);
    }

    // ─── findGlobal ──────────────────────────────────────────────────────────

    public function testFindGlobalFiltersOnTeamIsNull(): void
    {
        $this->repository->findGlobal();

        $this->assertContains('tt.team IS NULL', $this->capturedWhere);
    }

    public function testFindGlobalDoesNotAddExtraWhereConditions(): void
    {
        $this->repository->findGlobal();

        $this->assertCount(1, $this->capturedWhere);
    }

    public function testFindGlobalOrdersByNameAsc(): void
    {
        $this->repository->findGlobal();

        $this->assertArrayHasKey('tt.name', $this->capturedOrderBy);
        $this->assertSame('ASC', $this->capturedOrderBy['tt.name']);
    }

    public function testFindGlobalReturnsQueryResult(): void
    {
        $tag = $this->createMock(KnowledgeBaseTag::class);
        $this->queryResult = [$tag];

        $result = $this->repository->findGlobal();

        $this->assertSame([$tag], $result);
    }

    public function testFindGlobalReturnsEmptyArrayWhenNoTagsExist(): void
    {
        $this->queryResult = [];

        $result = $this->repository->findGlobal();

        $this->assertSame([], $result);
    }

    public function testFindGlobalReturnsMultipleTags(): void
    {
        $t1 = $this->createMock(KnowledgeBaseTag::class);
        $t2 = $this->createMock(KnowledgeBaseTag::class);
        $this->queryResult = [$t1, $t2];

        $result = $this->repository->findGlobal();

        $this->assertCount(2, $result);
    }

    // ─── findForTeam ─────────────────────────────────────────────────────────

    public function testFindForTeamIncludesNullTeamCondition(): void
    {
        $team = $this->createMock(Team::class);
        $this->repository->findForTeam($team);

        $this->assertContains('tt.team IS NULL OR tt.team = :team', $this->capturedWhere);
    }

    public function testFindForTeamSetsTeamParameter(): void
    {
        $team = $this->createMock(Team::class);
        $this->repository->findForTeam($team);

        $this->assertArrayHasKey('team', $this->capturedParams);
        $this->assertSame($team, $this->capturedParams['team']);
    }

    public function testFindForTeamOrdersByNameAsc(): void
    {
        $team = $this->createMock(Team::class);
        $this->repository->findForTeam($team);

        $this->assertArrayHasKey('tt.name', $this->capturedOrderBy);
        $this->assertSame('ASC', $this->capturedOrderBy['tt.name']);
    }

    public function testFindForTeamReturnsQueryResult(): void
    {
        $tag = $this->createMock(KnowledgeBaseTag::class);
        $this->queryResult = [$tag];
        $team = $this->createMock(Team::class);

        $result = $this->repository->findForTeam($team);

        $this->assertSame([$tag], $result);
    }
}
