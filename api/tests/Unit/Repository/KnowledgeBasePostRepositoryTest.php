<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\KnowledgeBaseCategory;
use App\Entity\KnowledgeBasePost;
use App\Entity\Team;
use App\Repository\KnowledgeBasePostRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für KnowledgeBasePostRepository.
 *
 * Abgedeckt:
 *  - findGlobalWithFilters(): alle Filterkombinationen, addcslashes-Escaping,
 *    leere Strings werden ignoriert
 *  - findByTeamAndFilters(): Team-Bedingung, analoge Filter
 */
#[AllowMockObjectsWithoutExpectations]
class KnowledgeBasePostRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private KnowledgeBasePostRepository $repository;

    /** @var string[] WHERE-Bedingung (erstes where()) */
    private array $capturedWhere = [];

    /** @var string[] andWhere-Bedingungen */
    private array $capturedAndWhere = [];

    /** @var array<string, mixed> setParameter-Aufrufe */
    private array $capturedParams = [];

    /** @var KnowledgeBasePost[] */
    private array $queryResult = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        $this->qb->method('select')->willReturnSelf();
        $this->qb->method('from')->willReturnSelf();
        $this->qb->method('distinct')->willReturnSelf();
        $this->qb->method('orderBy')->willReturnSelf();
        $this->qb->method('addOrderBy')->willReturnSelf();
        $this->qb->method('leftJoin')->willReturnSelf();

        $this->qb->method('where')->willReturnCallback(function (string $cond) {
            $this->capturedWhere[] = $cond;

            return $this->qb;
        });

        $this->qb->method('andWhere')->willReturnCallback(function (string $cond) {
            $this->capturedAndWhere[] = $cond;

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
        $meta->name = KnowledgeBasePost::class;
        $this->em->method('getClassMetadata')->willReturn($meta);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new KnowledgeBasePostRepository($registry);
    }

    // ─── findGlobalWithFilters – Basis ───────────────────────────────────────

    public function testFindGlobalWithFiltersUsesTeamIsNullCondition(): void
    {
        $this->repository->findGlobalWithFilters();

        $this->assertContains('tp.team IS NULL', $this->capturedWhere);
    }

    public function testFindGlobalWithFiltersNoFiltersAddsNoAndWhere(): void
    {
        $this->repository->findGlobalWithFilters(null, null, null);

        $this->assertSame([], $this->capturedAndWhere);
    }

    public function testFindGlobalWithFiltersReturnsQueryResult(): void
    {
        $post = $this->createMock(KnowledgeBasePost::class);
        $this->queryResult = [$post];

        $result = $this->repository->findGlobalWithFilters();

        $this->assertSame([$post], $result);
    }

    public function testFindGlobalWithFiltersReturnsEmptyArrayWhenNoPosts(): void
    {
        $result = $this->repository->findGlobalWithFilters();

        $this->assertSame([], $result);
    }

    // ─── findGlobalWithFilters – Kategorie-Filter ─────────────────────────────

    public function testFindGlobalWithFiltersCategoryAddsAndWhereCondition(): void
    {
        $cat = $this->createMock(KnowledgeBaseCategory::class);

        $this->repository->findGlobalWithFilters($cat);

        $this->assertContains('tp.category = :category', $this->capturedAndWhere);
    }

    public function testFindGlobalWithFiltersCategorySetsParameter(): void
    {
        $cat = $this->createMock(KnowledgeBaseCategory::class);

        $this->repository->findGlobalWithFilters($cat);

        $this->assertArrayHasKey('category', $this->capturedParams);
        $this->assertSame($cat, $this->capturedParams['category']);
    }

    public function testFindGlobalWithFiltersNullCategoryDoesNotAddCondition(): void
    {
        $this->repository->findGlobalWithFilters(null);

        $this->assertNotContains('tp.category = :category', $this->capturedAndWhere);
        $this->assertArrayNotHasKey('category', $this->capturedParams);
    }

    // ─── findGlobalWithFilters – Such-Filter ──────────────────────────────────

    public function testFindGlobalWithFiltersSearchAddsLikeCondition(): void
    {
        $this->repository->findGlobalWithFilters(null, 'Beispiel');

        $this->assertContains(
            'tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search',
            $this->capturedAndWhere,
        );
    }

    public function testFindGlobalWithFiltersSearchWrapsInPercent(): void
    {
        $this->repository->findGlobalWithFilters(null, 'Beispiel');

        $this->assertSame('%Beispiel%', $this->capturedParams['search']);
    }

    public function testFindGlobalWithFiltersSearchEscapesPercentSign(): void
    {
        $this->repository->findGlobalWithFilters(null, '50%');

        $this->assertSame('%50\%%', $this->capturedParams['search']);
    }

    public function testFindGlobalWithFiltersSearchEscapesUnderscore(): void
    {
        $this->repository->findGlobalWithFilters(null, 'a_b');

        $this->assertSame('%a\_b%', $this->capturedParams['search']);
    }

    public function testFindGlobalWithFiltersEmptyStringSearchIsIgnored(): void
    {
        $this->repository->findGlobalWithFilters(null, '');

        $this->assertNotContains(
            'tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search',
            $this->capturedAndWhere,
        );
        $this->assertArrayNotHasKey('search', $this->capturedParams);
    }

    public function testFindGlobalWithFiltersWhitespaceOnlySearchIsIgnored(): void
    {
        $this->repository->findGlobalWithFilters(null, '   ');

        $this->assertNotContains(
            'tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search',
            $this->capturedAndWhere,
        );
    }

    public function testFindGlobalWithFiltersNullSearchIsIgnored(): void
    {
        $this->repository->findGlobalWithFilters(null, null);

        $this->assertArrayNotHasKey('search', $this->capturedParams);
    }

    // ─── findGlobalWithFilters – Tag-Filter ───────────────────────────────────

    public function testFindGlobalWithFiltersTagAddsAndWhereCondition(): void
    {
        $this->repository->findGlobalWithFilters(null, null, 'Taktik');

        $this->assertContains('tg.name = :tag', $this->capturedAndWhere);
    }

    public function testFindGlobalWithFiltersTagSetsParameter(): void
    {
        $this->repository->findGlobalWithFilters(null, null, 'Taktik');

        $this->assertArrayHasKey('tag', $this->capturedParams);
        $this->assertSame('Taktik', $this->capturedParams['tag']);
    }

    public function testFindGlobalWithFiltersEmptyStringTagIsIgnored(): void
    {
        $this->repository->findGlobalWithFilters(null, null, '');

        $this->assertNotContains('tg.name = :tag', $this->capturedAndWhere);
        $this->assertArrayNotHasKey('tag', $this->capturedParams);
    }

    public function testFindGlobalWithFiltersNullTagIsIgnored(): void
    {
        $this->repository->findGlobalWithFilters(null, null, null);

        $this->assertArrayNotHasKey('tag', $this->capturedParams);
    }

    // ─── findGlobalWithFilters – alle Filter kombiniert ──────────────────────

    public function testFindGlobalWithFiltersAllFiltersApplied(): void
    {
        $cat = $this->createMock(KnowledgeBaseCategory::class);

        $this->repository->findGlobalWithFilters($cat, 'Test', 'Taktik');

        $this->assertContains('tp.category = :category', $this->capturedAndWhere);
        $this->assertContains(
            'tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search',
            $this->capturedAndWhere,
        );
        $this->assertContains('tg.name = :tag', $this->capturedAndWhere);
    }

    // ─── findByTeamAndFilters – Basis ────────────────────────────────────────

    public function testFindByTeamAndFiltersUsesTeamOrNullCondition(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findByTeamAndFilters($team);

        $this->assertContains('tp.team = :team OR tp.team IS NULL', $this->capturedWhere);
    }

    public function testFindByTeamAndFiltersSetsTeamParameter(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findByTeamAndFilters($team);

        $this->assertArrayHasKey('team', $this->capturedParams);
        $this->assertSame($team, $this->capturedParams['team']);
    }

    public function testFindByTeamAndFiltersNoExtraConditionsWhenNoFilters(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findByTeamAndFilters($team);

        $this->assertSame([], $this->capturedAndWhere);
    }

    public function testFindByTeamAndFiltersCategoryAddsCondition(): void
    {
        $team = $this->createMock(Team::class);
        $cat = $this->createMock(KnowledgeBaseCategory::class);

        $this->repository->findByTeamAndFilters($team, $cat);

        $this->assertContains('tp.category = :category', $this->capturedAndWhere);
    }

    public function testFindByTeamAndFiltersSearchAddsLikeCondition(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findByTeamAndFilters($team, null, 'Suche');

        $this->assertContains(
            'tp.title LIKE :search OR tp.description LIKE :search OR tg.name LIKE :search',
            $this->capturedAndWhere,
        );
    }

    public function testFindByTeamAndFiltersEmptySearchIsIgnored(): void
    {
        $team = $this->createMock(Team::class);

        $this->repository->findByTeamAndFilters($team, null, '');

        $this->assertArrayNotHasKey('search', $this->capturedParams);
    }
}
