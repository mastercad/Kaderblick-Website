<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Repository\PlayerTitleRepository;
use App\Service\UserTitleService;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

/**
 * Tests for UserTitleService::retrieveTitleStats().
 *
 * Covers:
 *  - Cup rows are included with cupId and cupName
 *  - Different cups receive independent userCounts (not merged by same category/scope/rank)
 *  - League rows still include leagueId and leagueName (regression)
 *  - userCount is correctly aggregated from the allActive count map
 */
#[AllowMockObjectsWithoutExpectations]
class UserTitleServiceTest extends TestCase
{
    /**
     * Returns a QueryBuilder mock whose getQuery()->getArrayResult() returns $arrayResult.
     * All fluent methods (select, leftJoin, where, andWhere, setParameter, groupBy, orderBy) return $this.
     */
    /** @param array<int, array<string, mixed>> $arrayResult */
    private function makeQbMock(array $arrayResult): QueryBuilder
    {
        $queryMock = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getArrayResult'])
            ->getMock();
        $queryMock->method('getArrayResult')->willReturn($arrayResult);

        $qbMock = $this->createMock(QueryBuilder::class);
        $qbMock->method('select')->willReturnSelf();
        $qbMock->method('leftJoin')->willReturnSelf();
        $qbMock->method('where')->willReturnSelf();
        $qbMock->method('andWhere')->willReturnSelf();
        $qbMock->method('setParameter')->willReturnSelf();
        $qbMock->method('groupBy')->willReturnSelf();
        $qbMock->method('orderBy')->willReturnSelf();
        $qbMock->method('getQuery')->willReturn($queryMock);

        return $qbMock;
    }

    /**
     * Builds a repository mock that returns $rawQb on the first createQueryBuilder() call
     * and $allActiveQb on the second call.
     */
    private function makeRepoMock(QueryBuilder $rawQb, QueryBuilder $allActiveQb): PlayerTitleRepository
    {
        $repo = $this->getMockBuilder(PlayerTitleRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['createQueryBuilder'])
            ->getMock();

        $repo->expects($this->exactly(2))
            ->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls($rawQb, $allActiveQb);

        return $repo;
    }

    // ─── Cup: cupId + cupName appear in result ────────────────────────────────

    public function testRetrieveTitleStatsCupRowIncludesCupNameAndId(): void
    {
        $rawRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'cup',
            'titleRank' => 'gold',
            'teamId' => null,
            'teamName' => null,
            'leagueId' => null,
            'leagueName' => null,
            'cupId' => 7,
            'cupName' => 'Sparkassenkreispokal',
        ];

        $allActiveRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'cup',
            'titleRank' => 'gold',
            'teamId' => null,
            'leagueId' => null,
            'cupId' => 7,
            'playerTitleId' => 42,
        ];

        $repo = $this->makeRepoMock($this->makeQbMock([$rawRow]), $this->makeQbMock([$allActiveRow]));
        $service = new UserTitleService($repo);

        $result = $service->retrieveTitleStats();

        $this->assertCount(1, $result);
        $this->assertSame(7, $result[0]['cupId']);
        $this->assertSame('Sparkassenkreispokal', $result[0]['cupName']);
        $this->assertSame(1, $result[0]['userCount']);
    }

    // ─── Cup: two different cups → two separate userCount values ─────────────

    public function testRetrieveTitleStatsDifferentCupsHaveSeparateUserCounts(): void
    {
        $rawRows = [
            [
                'titleCategory' => 'top_scorer',
                'titleScope' => 'cup',
                'titleRank' => 'gold',
                'teamId' => null,
                'teamName' => null,
                'leagueId' => null,
                'leagueName' => null,
                'cupId' => 1,
                'cupName' => 'Kreispokal',
            ],
            [
                'titleCategory' => 'top_scorer',
                'titleScope' => 'cup',
                'titleRank' => 'gold',
                'teamId' => null,
                'teamName' => null,
                'leagueId' => null,
                'leagueName' => null,
                'cupId' => 2,
                'cupName' => 'Bezirkspokal',
            ],
        ];

        // Cup 1 has two active PlayerTitle entries; Cup 2 has one.
        $allActiveRows = [
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 1, 'playerTitleId' => 10],
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 1, 'playerTitleId' => 11],
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 2, 'playerTitleId' => 20],
        ];

        $repo = $this->makeRepoMock($this->makeQbMock($rawRows), $this->makeQbMock($allActiveRows));
        $service = new UserTitleService($repo);

        $result = $service->retrieveTitleStats();

        $this->assertCount(2, $result);

        $cup1Row = array_values(array_filter($result, fn ($r) => 1 === $r['cupId']))[0];
        $cup2Row = array_values(array_filter($result, fn ($r) => 2 === $r['cupId']))[0];

        $this->assertSame(2, $cup1Row['userCount'], 'Cup 1 (Kreispokal) should have userCount=2');
        $this->assertSame(1, $cup2Row['userCount'], 'Cup 2 (Bezirkspokal) should have userCount=1');
    }

    // ─── Cup: each cup row retains its own cupName ────────────────────────────

    public function testRetrieveTitleStatsMultipleCupsRetainTheirCupNames(): void
    {
        $rawRows = [
            [
                'titleCategory' => 'top_scorer',
                'titleScope' => 'cup',
                'titleRank' => 'gold',
                'teamId' => null,
                'teamName' => null,
                'leagueId' => null,
                'leagueName' => null,
                'cupId' => 10,
                'cupName' => 'Pokal Alpha',
            ],
            [
                'titleCategory' => 'top_scorer',
                'titleScope' => 'cup',
                'titleRank' => 'silver',
                'teamId' => null,
                'teamName' => null,
                'leagueId' => null,
                'leagueName' => null,
                'cupId' => 20,
                'cupName' => 'Pokal Beta',
            ],
        ];

        $repo = $this->makeRepoMock($this->makeQbMock($rawRows), $this->makeQbMock([]));
        $service = new UserTitleService($repo);

        $result = $service->retrieveTitleStats();

        $this->assertCount(2, $result);

        $alpha = array_values(array_filter($result, fn ($r) => 10 === $r['cupId']))[0];
        $beta = array_values(array_filter($result, fn ($r) => 20 === $r['cupId']))[0];

        $this->assertSame('Pokal Alpha', $alpha['cupName']);
        $this->assertSame('Pokal Beta', $beta['cupName']);
    }

    // ─── League: regression – leagueId + leagueName still appear ─────────────

    public function testRetrieveTitleStatsLeagueRowsIncludeLeagueNameAndId(): void
    {
        $rawRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'league',
            'titleRank' => 'gold',
            'teamId' => null,
            'teamName' => null,
            'leagueId' => 3,
            'leagueName' => 'Kreisliga A',
            'cupId' => null,
            'cupName' => null,
        ];

        $allActiveRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'league',
            'titleRank' => 'gold',
            'teamId' => null,
            'leagueId' => 3,
            'cupId' => null,
            'playerTitleId' => 55,
        ];

        $repo = $this->makeRepoMock($this->makeQbMock([$rawRow]), $this->makeQbMock([$allActiveRow]));
        $service = new UserTitleService($repo);

        $result = $service->retrieveTitleStats();

        $this->assertCount(1, $result);
        $this->assertSame(3, $result[0]['leagueId']);
        $this->assertSame('Kreisliga A', $result[0]['leagueName']);
        $this->assertSame(1, $result[0]['userCount']);
    }

    // ─── userCount = 0 when no allActive entries match ────────────────────────

    public function testRetrieveTitleStatsUserCountIsZeroWhenNoMatchInCountMap(): void
    {
        $rawRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'cup',
            'titleRank' => 'bronze',
            'teamId' => null,
            'teamName' => null,
            'leagueId' => null,
            'leagueName' => null,
            'cupId' => 99,
            'cupName' => 'Orphan Cup',
        ];

        // allActive has a row for a DIFFERENT cup → no match for cupId=99
        $allActiveRow = [
            'titleCategory' => 'top_scorer',
            'titleScope' => 'cup',
            'titleRank' => 'bronze',
            'teamId' => null,
            'leagueId' => null,
            'cupId' => 88,
            'playerTitleId' => 77,
        ];

        $repo = $this->makeRepoMock($this->makeQbMock([$rawRow]), $this->makeQbMock([$allActiveRow]));
        $service = new UserTitleService($repo);

        $result = $service->retrieveTitleStats();

        $this->assertCount(1, $result);
        $this->assertSame(0, $result[0]['userCount']);
    }
}
