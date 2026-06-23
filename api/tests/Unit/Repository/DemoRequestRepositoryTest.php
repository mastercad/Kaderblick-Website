<?php

namespace App\Tests\Unit\Repository;

use App\Entity\DemoRequest;
use App\Repository\DemoRequestRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for DemoRequestRepository.
 *
 * Verifies findOneByEmailPending() builds the correct query (WHERE clause, parameters)
 * without touching a real database.
 */
#[AllowMockObjectsWithoutExpectations]
class DemoRequestRepositoryTest extends TestCase
{
    private EntityManagerInterface & MockObject $em;
    private QueryBuilder & MockObject $qb;
    private Query & MockObject $query;
    private DemoRequestRepository $repository;

    /** @var array<string, mixed> */
    private array $capturedParams = [];

    private mixed $queryResult = null;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        $this->capturedParams = [];

        // Fluent QB chain
        $this->qb->method('where')->willReturn($this->qb);
        $this->qb->method('andWhere')->willReturn($this->qb);
        $this->qb->method('setParameter')->willReturnCallback(function (string $key, mixed $value) {
            $this->capturedParams[$key] = $value;

            return $this->qb;
        });
        $this->qb->method('getQuery')->willReturn($this->query);

        $this->query->method('getOneOrNullResult')->willReturnCallback(fn () => $this->queryResult);

        $classMetadata = $this->createMock(ClassMetadata::class);
        $classMetadata->name = DemoRequest::class;

        $this->em->method('getClassMetadata')->willReturn($classMetadata);
        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        // QB for the alias initialisation inside createQueryBuilder on the QB itself
        $this->qb->method('select')->willReturn($this->qb);
        $this->qb->method('from')->willReturn($this->qb);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);

        $this->repository = new DemoRequestRepository($registry);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // findOneByEmailPending
    // ─────────────────────────────────────────────────────────────────────────

    public function testFindOneByEmailPendingFiltersOnEmail(): void
    {
        $this->queryResult = null;
        $this->repository->findOneByEmailPending('test@example.com');

        $this->assertSame('test@example.com', $this->capturedParams['email'] ?? null);
    }

    public function testFindOneByEmailPendingFiltersOnPendingStatus(): void
    {
        $this->queryResult = null;
        $this->repository->findOneByEmailPending('test@example.com');

        $this->assertSame(DemoRequest::STATUS_PENDING, $this->capturedParams['status'] ?? null);
    }

    public function testFindOneByEmailPendingReturnsNullWhenNotFound(): void
    {
        $this->queryResult = null;
        $result = $this->repository->findOneByEmailPending('notfound@example.com');

        $this->assertNull($result);
    }

    public function testFindOneByEmailPendingReturnsDemoRequestWhenFound(): void
    {
        $demoRequest = new DemoRequest();
        $demoRequest->setName('Max')->setEmail('max@example.com');
        $this->queryResult = $demoRequest;

        $result = $this->repository->findOneByEmailPending('max@example.com');

        $this->assertSame($demoRequest, $result);
    }
}
