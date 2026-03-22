<?php

namespace App\Tests\Unit\Service;

use App\Entity\GameEvent;
use App\Entity\PlayerTitle;
use App\Entity\Team;
use App\Repository\PlayerTitleRepository;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
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

        $service = new TitleCalculationService($em, $repo);

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
            ->setConstructorArgs([$em, $repo])
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
            ->setConstructorArgs([$em, $repo])
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
            ->setConstructorArgs([$em, $repo])
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
        $service = new TitleCalculationService($em, $repo);
        $season = $service->retrieveCurrentSeason();
        $this->assertMatchesRegularExpression('/\d{4}\/\d{4}/', $season);
    }

    public function testDebugGoalsForSeasonWithParams(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $qb = $this->getMockBuilder(\Doctrine\ORM\QueryBuilder::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['select', 'leftJoin', 'where', 'andWhere', 'setParameter', 'orderBy', 'getQuery'])
            ->getMock();
        $qb->method('select')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        // Mock für Doctrine\ORM\Query oder AbstractQuery, damit getQuery() den richtigen Typ liefert
        $queryClass = class_exists('Doctrine\\ORM\\Query') ? 'Doctrine\\ORM\\Query' : 'Doctrine\\ORM\\AbstractQuery';
        $query = $this->getMockBuilder($queryClass)
            ->disableOriginalConstructor()
            ->onlyMethods(['getResult'])
            ->getMock();
        $query->method('getResult')->willReturn([]);
        $qb->method('getQuery')->willReturn($query);
        $repoMock = $this->createMock(class_exists('Doctrine\\ORM\\EntityRepository') ? 'Doctrine\\ORM\\EntityRepository' : 'Doctrine\\Persistence\\ObjectRepository');
        $repoMock->method('createQueryBuilder')->willReturn($qb);
        $em->method('getRepository')->willReturn($repoMock);
        $service = new TitleCalculationService($em, $repo);
        $result = $service->debugGoalsForSeason('2025/2026');
        $this->assertEmpty($result);
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
