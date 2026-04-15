<?php

namespace App\Tests\Unit\Service;

use App\Entity\GameEvent;
use App\Entity\League;
use App\Entity\PlayerTitle;
use App\Entity\Team;
use App\Repository\PlayerTitleRepository;
use App\Service\GoalCountingService;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[AllowMockObjectsWithoutExpectations]
class TitleCalculationServiceFullTest extends TestCase
{
    public function testAwardTitlesOlympicPrinciple(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $repo->method('findOneBy')->willReturn(null);
        $repo->method('deactivateTitles');

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $service = new TitleCalculationService($em, $repo, $goalCountingService);

        $player1 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player1->method('getId')->willReturn(1);
        $player1->method('getLastName')->willReturn('A');
        $player2 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player2->method('getId')->willReturn(2);
        $player2->method('getLastName')->willReturn('B');
        $player3 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player3->method('getId')->willReturn(3);
        $player3->method('getLastName')->willReturn('C');

        $playerGoals = [
            ['player' => $player1, 'goal_count' => 10],
            ['player' => $player2, 'goal_count' => 10],
            ['player' => $player3, 'goal_count' => 8],
        ];

        $ref = new ReflectionClass($service);
        $method = $ref->getMethod('awardTitlesPerPlayerFromArray');
        $method->setAccessible(true);
        // Request Olympic ranking for this test to keep previous expectations
        $result = $method->invoke($service, $playerGoals, 'top_scorer', 'platform', null, '2025/2026', null, true);
        $this->assertCount(3, $result, 'Alle drei Spieler sollten einen Titel erhalten.');
        $ranks = array_map(fn ($t) => $t->getTitleRank(), $result);
        $this->assertEqualsCanonicalizing(['bronze', 'gold', 'gold'], $ranks, 'Zwei Gold, dann Bronze (Silber entfällt, Logik wie im Service).');
    }

    public function testCalculatePlatformTopScorers(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();

        $service->expects($this->once())
            ->method('debugGoalsForSeason')
            ->with('2025/2026')
            ->willReturn([$this->createGoalMock(1, 'A')]);

        $result = $service->calculatePlatformTopScorers('2025/2026');
    }

    public function testCalculateTeamTopScorers(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();
        $team = $this->createMock(Team::class);
        $service->expects($this->once())
            ->method('debugGoalsForSeason')
            ->with('2025/2026', $team)
            ->willReturn([$this->createGoalMock(2, 'B')]);
        $result = $service->calculateTeamTopScorers($team, '2025/2026');
    }

    public function testCalculateAllTeamTopScorers(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $team1 = $this->createMock(Team::class);
        $team2 = $this->createMock(Team::class);
        $entityRepoClass = class_exists('Doctrine\\ORM\\EntityRepository') ? 'Doctrine\\ORM\\EntityRepository' : 'Doctrine\\Persistence\\ObjectRepository';
        $teamRepo = $this->createMock($entityRepoClass);
        $teamRepo->method('findAll')->willReturn([$team1, $team2]);
        $em->method('getRepository')->willReturnMap([
            ['App\\Entity\\Team', $teamRepo],
        ]);
        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['calculateTeamTopScorers'])
            ->getMock();
        $service->expects($this->exactly(2))
            ->method('calculateTeamTopScorers')
            ->willReturn([new PlayerTitle()]);
        $result = $service->calculateAllTeamTopScorers('2025/2026');
        $this->assertCount(2, $result);
    }

    public function testRetrieveCurrentSeason(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $goalCountingService = $this->createMock(GoalCountingService::class);
        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $season = $service->retrieveCurrentSeason();
        $this->assertMatchesRegularExpression('/\d{4}\/\d{4}/', $season);
    }

    public function testDebugGoalsForSeasonReturnsQueryResult(): void
    {
        // The method must return whatever the underlying query returns — no filtering, no transformation.
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        $expectedEvent = $this->createGoalMock(42, 'Müller');

        [$qb, $query, $repoMock] = $this->buildQueryMocks([$expectedEvent]);
        $em->method('getRepository')->willReturn($repoMock);

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $goalCountingService->method('getScorerGoalDqlCondition')->willReturn(["gt.code LIKE '%goal%'", ['excludedGoalCodes' => ['offside_goal']]]);

        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $result = $service->debugGoalsForSeason('2025/2026');

        $this->assertCount(1, $result);
        $this->assertSame($expectedEvent, $result[0]);
    }

    public function testDebugGoalsForSeasonAppliesSeasonDateFilter(): void
    {
        // When a season string is passed, andWhere() must be called with the date-range condition
        // and setParameter() must receive the corresponding start/end dates.
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        [$qb, $query, $repoMock] = $this->buildQueryMocks([]);
        $em->method('getRepository')->willReturn($repoMock);

        // Capture all setParameter calls
        $setParameterCalls = [];
        $qb->method('setParameter')->willReturnCallback(function ($key, $value) use ($qb, &$setParameterCalls) {
            $setParameterCalls[$key] = $value;

            return $qb;
        });

        $andWhereCalls = [];
        $qb->method('andWhere')->willReturnCallback(function ($expr) use ($qb, &$andWhereCalls) {
            $andWhereCalls[] = $expr;

            return $qb;
        });

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $goalCountingService->method('getScorerGoalDqlCondition')->willReturn(['1=1', []]);

        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $service->debugGoalsForSeason('2025/2026');

        $this->assertSame('2025-07-01 00:00:00', $setParameterCalls['startDate'] ?? null, 'startDate must be July 1st of the start year.');
        $this->assertSame('2026-06-30 23:59:59', $setParameterCalls['endDate'] ?? null, 'endDate must be June 30th of the end year.');

        $dateCondition = implode(' ', $andWhereCalls);
        $this->assertStringContainsString('startDate', $dateCondition);
        $this->assertStringContainsString('endDate', $dateCondition);
    }

    public function testDebugGoalsForSeasonAppliesTeamFilter(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        [$qb, $query, $repoMock] = $this->buildQueryMocks([]);
        $em->method('getRepository')->willReturn($repoMock);

        $setParameterCalls = [];
        $qb->method('setParameter')->willReturnCallback(function ($key, $value) use ($qb, &$setParameterCalls) {
            $setParameterCalls[$key] = $value;

            return $qb;
        });

        $andWhereCalls = [];
        $qb->method('andWhere')->willReturnCallback(function ($expr) use ($qb, &$andWhereCalls) {
            $andWhereCalls[] = $expr;

            return $qb;
        });

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $goalCountingService->method('getScorerGoalDqlCondition')->willReturn(['1=1', []]);

        $team = $this->getMockBuilder(Team::class)->onlyMethods(['getId'])->getMock();
        $team->method('getId')->willReturn(7);

        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $service->debugGoalsForSeason(null, $team);

        $this->assertSame(7, $setParameterCalls['teamId'] ?? null, 'teamId parameter must be set when a team is passed.');
        $this->assertStringContainsString('teamId', implode(' ', $andWhereCalls));
    }

    public function testDebugGoalsForSeasonAppliesLeagueFilter(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        [$qb, $query, $repoMock] = $this->buildQueryMocks([]);
        $em->method('getRepository')->willReturn($repoMock);

        $setParameterCalls = [];
        $qb->method('setParameter')->willReturnCallback(function ($key, $value) use ($qb, &$setParameterCalls) {
            $setParameterCalls[$key] = $value;

            return $qb;
        });

        $andWhereCalls = [];
        $qb->method('andWhere')->willReturnCallback(function ($expr) use ($qb, &$andWhereCalls) {
            $andWhereCalls[] = $expr;

            return $qb;
        });

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $goalCountingService->method('getScorerGoalDqlCondition')->willReturn(['1=1', []]);

        $league = $this->getMockBuilder(League::class)->onlyMethods(['getId'])->getMock();
        $league->method('getId')->willReturn(3);

        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $service->debugGoalsForSeason(null, null, $league);

        $this->assertSame(3, $setParameterCalls['leagueId'] ?? null, 'leagueId parameter must be set when a league is passed.');
        $this->assertStringContainsString('leagueId', implode(' ', $andWhereCalls));
    }

    public function testDebugGoalsForSeasonAppliesGoalCountingDqlCondition(): void
    {
        // The DQL returned by GoalCountingService must be passed to the QueryBuilder's where() call.
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        [$qb, $query, $repoMock] = $this->buildQueryMocks([]);
        $em->method('getRepository')->willReturn($repoMock);

        $whereCalls = [];
        $qb->method('where')->willReturnCallback(function ($expr) use ($qb, &$whereCalls) {
            $whereCalls[] = $expr;

            return $qb;
        });

        $setParameterCalls = [];
        $qb->method('setParameter')->willReturnCallback(function ($key, $value) use ($qb, &$setParameterCalls) {
            $setParameterCalls[$key] = $value;

            return $qb;
        });

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $goalCountingService->method('getScorerGoalDqlCondition')->willReturn(
            ["gt.code LIKE '%goal%' AND gt.code NOT IN (:excludedGoalCodes)", ['excludedGoalCodes' => ['offside_goal', 'var_goal_denied']]]
        );

        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $service->debugGoalsForSeason();

        $this->assertStringContainsString("LIKE '%goal%'", implode(' ', $whereCalls), 'Goal DQL condition must be applied in where().');
        $this->assertSame(['offside_goal', 'var_goal_denied'], $setParameterCalls['excludedGoalCodes'] ?? null, 'Goal params must be bound as query parameters.');
    }

    /**
     * Helper: builds a mocked QueryBuilder/Query/Repository triple.
     *
     * @param array<mixed> $queryResult What getResult() should return
     *
     * @return array{0: QueryBuilder&MockObject, 1: object&MockObject, 2: object&MockObject}
     */
    private function buildQueryMocks(array $queryResult): array
    {
        $qb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['select', 'leftJoin', 'where', 'andWhere', 'setParameter', 'orderBy', 'getQuery'])
            ->getMock();
        $qb->method('select')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();

        $queryClass = class_exists('Doctrine\\ORM\\Query') ? 'Doctrine\\ORM\\Query' : 'Doctrine\\ORM\\AbstractQuery';
        $query = $this->getMockBuilder($queryClass)
            ->disableOriginalConstructor()
            ->onlyMethods(['getResult'])
            ->getMock();
        $query->method('getResult')->willReturn($queryResult);
        $qb->method('getQuery')->willReturn($query);

        $repoMock = $this->createMock(
            class_exists('Doctrine\\ORM\\EntityRepository') ? 'Doctrine\\ORM\\EntityRepository' : 'Doctrine\\Persistence\\ObjectRepository'
        );
        $repoMock->method('createQueryBuilder')->willReturn($qb);

        return [$qb, $query, $repoMock];
    }

    private function createGoalMock(int $id, string $lastName): GameEvent
    {
        $player = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player->method('getId')->willReturn($id);
        $player->method('getLastName')->willReturn($lastName);
        $goal = $this->getMockBuilder(GameEvent::class)->disableOriginalConstructor()->onlyMethods(['getPlayer'])->getMock();
        $goal->method('getPlayer')->willReturn($player);

        return $goal;
    }
}
