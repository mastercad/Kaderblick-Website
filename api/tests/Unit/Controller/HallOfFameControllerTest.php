<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\HallOfFameController;
use App\Entity\User;
use App\Service\UserTitleService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\Query\Expr;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Unit tests for HallOfFameController private methods.
 *
 * Covers:
 * - getTopLevel(): allowedTypes parameter is ['self_player', 'self_coach']
 * - getTopLevel(): titleObj enriched via UserTitleService
 * - getTopLevel(): fallback titleObj when user not found in title map
 * - getTitleHolders(): avatarFrame computed as {scope}_{category}_{rank}
 * - getTitleHolders(): hasTitle is always true
 */
#[AllowMockObjectsWithoutExpectations]
class HallOfFameControllerTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private UserTitleService&MockObject $userTitleService;
    private HallOfFameController $controller;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->userTitleService = $this->createMock(UserTitleService::class);
        $this->controller = new HallOfFameController($this->em, $this->userTitleService);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Creates a QB mock where every fluent builder method returns self and
     * getQuery()->getArrayResult() returns $rows.
     *
     * @param array<int, array<string, mixed>> $rows
     */
    private function makeQbMock(array $rows): QueryBuilder&MockObject
    {
        $query = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getArrayResult'])
            ->getMock();
        $query->method('getArrayResult')->willReturn($rows);

        $qb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->getMock();

        foreach (['select', 'from', 'join', 'leftJoin', 'where', 'andWhere', 'setParameter', 'orderBy', 'addOrderBy', 'setMaxResults'] as $method) {
            $qb->method($method)->willReturnSelf();
        }
        $qb->method('expr')->willReturn(new Expr());
        $qb->method('getQuery')->willReturn($query);

        return $qb;
    }

    /**
     * Creates a sub-query QB mock for the EXISTS clause.
     * Only the builder methods used in getTopLevel()'s subquery are mocked.
     */
    private function makeSubQbMock(): QueryBuilder&MockObject
    {
        $qb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->getMock();

        foreach (['select', 'from', 'join', 'where', 'andWhere'] as $method) {
            $qb->method($method)->willReturnSelf();
        }
        $qb->method('getDQL')->willReturn(
            'SELECT 1 FROM App\\Entity\\UserRelation ur JOIN rt WHERE ur.user = u AND rt.identifier IN (:allowedTypes)'
        );

        return $qb;
    }

    /**
     * Invokes a private method on the controller via reflection.
     *
     * @return array<int, array<string, mixed>>
     */
    private function callPrivate(string $method): array
    {
        $ref = new ReflectionMethod(HallOfFameController::class, $method);
        $ref->setAccessible(true);

        /* @var array<int, array<string, mixed>> */
        return $ref->invoke($this->controller);
    }

    // ─── getTopLevel(): relation-type filter ──────────────────────────────────

    public function testGetTopLevelUsesAllowedRelationTypesParameter(): void
    {
        // Build the main QB manually so we can set a specific expectation on setParameter.
        $query = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getArrayResult'])
            ->getMock();
        $query->method('getArrayResult')->willReturn([]);

        $mainQb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->getMock();

        foreach (['select', 'from', 'join', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'setMaxResults'] as $method) {
            $mainQb->method($method)->willReturnSelf();
        }
        $mainQb->method('expr')->willReturn(new Expr());
        $mainQb->method('getQuery')->willReturn($query);

        // The key assertion: the filter parameter must include exactly these two types.
        $mainQb->expects($this->once())
            ->method('setParameter')
            ->with('allowedTypes', ['self_player', 'self_coach'])
            ->willReturnSelf();

        $subQb = $this->makeSubQbMock();
        $userRepo = $this->createMock(EntityRepository::class);
        $userRepo->method('findBy')->willReturn([]);

        $this->em->expects($this->exactly(2))
            ->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls($mainQb, $subQb);
        $this->em->method('getRepository')->willReturn($userRepo);

        $this->callPrivate('getTopLevel');
    }

    public function testGetTopLevelEnrichesTitleObjFromUserTitleService(): void
    {
        $row = [
            'id' => 42,
            'firstName' => 'Max',
            'lastName' => 'Muster',
            'avatarFilename' => null,
            'level' => 7,
            'xpTotal' => 2500,
        ];

        $mainQb = $this->makeQbMock([$row]);
        $subQb = $this->makeSubQbMock();

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);

        $userRepo = $this->createMock(EntityRepository::class);
        $userRepo->method('findBy')->willReturn([$user]);

        $this->em->expects($this->exactly(2))
            ->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls($mainQb, $subQb);
        $this->em->method('getRepository')->willReturn($userRepo);

        $this->userTitleService->expects($this->once())
            ->method('retrieveTitleDataForUser')
            ->with($user)
            ->willReturn(['hasTitle' => true, 'avatarFrame' => 'league_top_scorer_gold']);

        $result = $this->callPrivate('getTopLevel');

        $this->assertCount(1, $result);
        $this->assertSame(42, $result[0]['id']);
        $this->assertEquals(
            ['hasTitle' => true, 'avatarFrame' => 'league_top_scorer_gold'],
            $result[0]['titleObj'],
        );
    }

    public function testGetTopLevelFallsBackToNoTitleWhenUserIsNotInTitleMap(): void
    {
        $row = [
            'id' => 99,
            'firstName' => 'Unbekannt',
            'lastName' => 'Nutzer',
            'avatarFilename' => null,
            'level' => 1,
            'xpTotal' => 100,
        ];

        $mainQb = $this->makeQbMock([$row]);
        $subQb = $this->makeSubQbMock();

        $userRepo = $this->createMock(EntityRepository::class);
        // Repository returns nothing → user 99 not found in titleMap
        $userRepo->method('findBy')->willReturn([]);

        $this->em->expects($this->exactly(2))
            ->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls($mainQb, $subQb);
        $this->em->method('getRepository')->willReturn($userRepo);

        $result = $this->callPrivate('getTopLevel');

        $this->assertEquals(
            ['hasTitle' => false, 'avatarFrame' => null],
            $result[0]['titleObj'],
        );
    }

    public function testGetTopLevelReturnsEmptyArrayWhenQueryHasNoResults(): void
    {
        $mainQb = $this->makeQbMock([]);
        $subQb = $this->makeSubQbMock();

        $userRepo = $this->createMock(EntityRepository::class);
        $userRepo->method('findBy')->willReturn([]);

        $this->em->expects($this->exactly(2))
            ->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls($mainQb, $subQb);
        $this->em->method('getRepository')->willReturn($userRepo);

        $this->assertSame([], $this->callPrivate('getTopLevel'));
    }

    // ─── getTitleHolders(): avatarFrame computed from entry data ──────────────

    public function testGetTitleHoldersComputesAvatarFrameForLeagueEntry(): void
    {
        $row = $this->makeTitleRow(['titleScope' => 'league', 'titleCategory' => 'top_scorer', 'titleRank' => 'gold']);

        $qb = $this->makeQbMock([$row]);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $result = $this->callPrivate('getTitleHolders');

        $this->assertSame('league_top_scorer_gold', $result[0]['titleObj']['avatarFrame']);
    }

    public function testGetTitleHoldersComputesAvatarFrameForCupEntry(): void
    {
        $row = $this->makeTitleRow(['titleScope' => 'cup', 'titleCategory' => 'top_scorer', 'titleRank' => 'silver', 'cupName' => 'Kreispokal']);

        $qb = $this->makeQbMock([$row]);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $result = $this->callPrivate('getTitleHolders');

        $this->assertSame('cup_top_scorer_silver', $result[0]['titleObj']['avatarFrame']);
    }

    public function testGetTitleHoldersComputesAvatarFrameForPlatformEntry(): void
    {
        $row = $this->makeTitleRow(['titleScope' => 'platform', 'titleCategory' => 'most_appearances', 'titleRank' => 'bronze', 'leagueName' => null]);

        $qb = $this->makeQbMock([$row]);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $result = $this->callPrivate('getTitleHolders');

        $this->assertSame('platform_most_appearances_bronze', $result[0]['titleObj']['avatarFrame']);
    }

    public function testGetTitleHoldersComputesAvatarFrameForTeamEntry(): void
    {
        $row = $this->makeTitleRow(['titleScope' => 'team', 'titleCategory' => 'top_assist', 'titleRank' => 'gold', 'leagueName' => null, 'teamName' => 'FC Muster']);

        $qb = $this->makeQbMock([$row]);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $result = $this->callPrivate('getTitleHolders');

        $this->assertSame('team_top_assist_gold', $result[0]['titleObj']['avatarFrame']);
    }

    public function testGetTitleHoldersAlwaysSetsHasTitleToTrue(): void
    {
        $rows = [
            $this->makeTitleRow(['id' => 1, 'titleScope' => 'league', 'titleRank' => 'gold']),
            $this->makeTitleRow(['id' => 2, 'titleScope' => 'team', 'titleRank' => 'silver', 'leagueName' => null, 'teamName' => 'FC Muster']),
            $this->makeTitleRow(['id' => 3, 'titleScope' => 'platform', 'titleRank' => 'bronze', 'leagueName' => null]),
        ];

        $qb = $this->makeQbMock($rows);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $result = $this->callPrivate('getTitleHolders');

        foreach ($result as $entry) {
            $this->assertTrue($entry['titleObj']['hasTitle'], 'Every getTitleHolders entry must have hasTitle = true');
        }
    }

    public function testGetTitleHoldersReturnsEmptyArrayWhenNoActiveTitlesExist(): void
    {
        $qb = $this->makeQbMock([]);
        $this->em->expects($this->once())->method('createQueryBuilder')->willReturn($qb);

        $this->assertSame([], $this->callPrivate('getTitleHolders'));
    }

    // ─── Row factory ──────────────────────────────────────────────────────────

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function makeTitleRow(array $overrides = []): array
    {
        return array_merge([
            'id' => 1,
            'titleCategory' => 'top_scorer',
            'titleScope' => 'league',
            'titleRank' => 'gold',
            'value' => 10,
            'season' => '2024/2025',
            'playerFirstName' => 'Max',
            'playerLastName' => 'Muster',
            'userId' => 1,
            'avatarFilename' => null,
            'teamName' => null,
            'leagueName' => 'Kreisliga A',
            'cupName' => null,
        ], $overrides);
    }
}
