<?php

namespace App\Tests\Unit\Repository;

use App\Entity\Club;
use App\Entity\TacticPreset;
use App\Entity\User;
use App\Repository\TacticPresetRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for TacticPresetRepository query-building logic.
 *
 * The QueryBuilder chain is mocked so no real database is required.
 * Key assertion: setParameter() must be used for each named parameter –
 * NOT setParameters(array), which would throw a TypeError at runtime.
 */
#[AllowMockObjectsWithoutExpectations]
class TacticPresetRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    /** @var TacticPreset[] */ private array $queryResult = [];
    private TacticPresetRepository $repository;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        // All fluent QueryBuilder methods must return $this->qb.
        foreach (['select', 'from', 'leftJoin', 'where', 'setParameter', 'orderBy', 'addOrderBy'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }
        $this->qb->method('getQuery')->willReturn($this->query);
        // willReturnCallback reads $this->queryResult, so individual tests can override it.
        $this->query->method('getResult')->willReturnCallback(fn () => $this->queryResult);

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $metadata = $this->createMock(ClassMetadata::class);
        $metadata->name = TacticPreset::class;
        $this->em->method('getClassMetadata')->willReturn($metadata);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new TacticPresetRepository($registry);
    }

    // -----------------------------------------------------------------
    // findVisibleForUser – parameter passing (the bug this test catches)
    // -----------------------------------------------------------------

    /**
     * setParameters(array) throws a TypeError in Doctrine.
     * The repository MUST use individual setParameter() calls instead.
     */
    public function testFindVisibleForUserNeverCallsSetParametersWithArray(): void
    {
        // setParameters() must never be called (Doctrine rejects plain arrays)
        $this->qb->expects($this->never())->method('setParameters');

        $user = $this->createMock(User::class);
        $this->repository->findVisibleForUser($user, []);
    }

    public function testFindVisibleForUserSetsIsSystemParameter(): void
    {
        $user = $this->createMock(User::class);

        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) {
                if ('isSystem' === $key) {
                    $this->assertTrue($value, 'isSystem parameter must be true');
                }

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, []);
    }

    public function testFindVisibleForUserSetsMeParameter(): void
    {
        $user = $this->createMock(User::class);

        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use ($user) {
                if ('me' === $key) {
                    $this->assertSame($user, $value, 'me parameter must be the given User instance');
                }

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, []);
    }

    // -----------------------------------------------------------------
    // findVisibleForUser – without clubs
    // -----------------------------------------------------------------

    public function testFindVisibleForUserWithoutClubsSetsOnlyTwoParameters(): void
    {
        $user = $this->createMock(User::class);

        $calledKeys = [];
        $this->qb->method('setParameter')
            ->willReturnCallback(function (string $key) use (&$calledKeys) {
                $calledKeys[] = $key;

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, []);

        sort($calledKeys);
        $this->assertSame(['isSystem', 'me'], $calledKeys);
    }

    public function testFindVisibleForUserWithoutClubsDoesNotSetClubIdsParameter(): void
    {
        $user = $this->createMock(User::class);

        $calledKeys = [];
        $this->qb->method('setParameter')
            ->willReturnCallback(function (string $key) use (&$calledKeys) {
                $calledKeys[] = $key;

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, []);

        $this->assertNotContains('clubIds', $calledKeys);
    }

    // -----------------------------------------------------------------
    // findVisibleForUser – with clubs
    // -----------------------------------------------------------------

    public function testFindVisibleForUserWithClubsSetsClubIdsParameter(): void
    {
        $user = $this->createMock(User::class);
        $club1 = $this->createMock(Club::class);
        $club2 = $this->createMock(Club::class);
        $club1->method('getId')->willReturn(10);
        $club2->method('getId')->willReturn(20);

        $capturedClubIds = null;
        $this->qb->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$capturedClubIds) {
                if ('clubIds' === $key) {
                    $capturedClubIds = $value;
                }

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, [$club1, $club2]);

        $this->assertNotNull($capturedClubIds, 'clubIds parameter must be set when clubs are provided');
        $this->assertContains(10, $capturedClubIds);
        $this->assertContains(20, $capturedClubIds);
        $this->assertIsArray($capturedClubIds, 'clubIds must be a plain array, not an object');
    }

    public function testFindVisibleForUserWithClubsSetsThreeParameters(): void
    {
        $user = $this->createMock(User::class);
        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn(5);

        $calledKeys = [];
        $this->qb->method('setParameter')
            ->willReturnCallback(function (string $key) use (&$calledKeys) {
                $calledKeys[] = $key;

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, [$club]);

        sort($calledKeys);
        $this->assertSame(['clubIds', 'isSystem', 'me'], $calledKeys);
    }

    public function testFindVisibleForUserFiltersOutNullClubIds(): void
    {
        $user = $this->createMock(User::class);
        $club1 = $this->createMock(Club::class);
        $club2 = $this->createMock(Club::class);
        $club1->method('getId')->willReturn(null); // unsaved club, no ID
        $club2->method('getId')->willReturn(7);

        $capturedClubIds = null;
        $this->qb->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$capturedClubIds) {
                if ('clubIds' === $key) {
                    $capturedClubIds = $value;
                }

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, [$club1, $club2]);

        $this->assertNotContains(null, $capturedClubIds, 'null club IDs must be filtered out');
        $this->assertContains(7, $capturedClubIds);
    }

    // -----------------------------------------------------------------
    // findVisibleForUser – ordering
    // -----------------------------------------------------------------

    public function testFindVisibleForUserAppliesCorrectOrdering(): void
    {
        $user = $this->createMock(User::class);

        $orderCalls = [];
        $this->qb->method('orderBy')
            ->willReturnCallback(function (string $sort, string $dir) use (&$orderCalls) {
                $orderCalls[] = [$sort, $dir];

                return $this->qb;
            });
        $this->qb->method('addOrderBy')
            ->willReturnCallback(function (string $sort, string $dir) use (&$orderCalls) {
                $orderCalls[] = [$sort, $dir];

                return $this->qb;
            });

        $this->repository->findVisibleForUser($user, []);

        $this->assertSame(['p.isSystem', 'DESC'], $orderCalls[0]);
        $this->assertSame(['p.category', 'ASC'], $orderCalls[1]);
        $this->assertSame(['p.title', 'ASC'], $orderCalls[2]);
    }

    // -----------------------------------------------------------------
    // findVisibleForUser – return value
    // -----------------------------------------------------------------

    public function testFindVisibleForUserReturnsQueryResult(): void
    {
        $preset1 = $this->createMock(TacticPreset::class);
        $preset2 = $this->createMock(TacticPreset::class);
        $this->queryResult = [$preset1, $preset2];

        $user = $this->createMock(User::class);
        $result = $this->repository->findVisibleForUser($user, []);

        $this->assertCount(2, $result);
        $this->assertSame($preset1, $result[0]);
        $this->assertSame($preset2, $result[1]);
    }

    public function testFindVisibleForUserReturnsEmptyArrayWhenNoResult(): void
    {
        // $this->queryResult defaults to [] – no extra setup needed.
        $user = $this->createMock(User::class);
        $result = $this->repository->findVisibleForUser($user, []);

        $this->assertSame([], $result);
    }
}
