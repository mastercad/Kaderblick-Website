<?php

namespace App\Tests\Unit\Service;

use App\Repository\PlayerTitleRepository;
use App\Service\GoalCountingService;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[AllowMockObjectsWithoutExpectations]
class TitleCalculationServiceLeagueTest extends TestCase
{
    public function testAwardTitlesOlympicPrincipleLeague(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $repo->method('findOneBy')->willReturn(null);
        $repo->method('deactivateTitles');

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $service = new TitleCalculationService($em, $repo, $goalCountingService);
        $league = $this->getMockBuilder(\App\Entity\League::class)->onlyMethods(['getId', 'getName'])->getMock();
        $league->method('getId')->willReturn(1);
        $league->method('getName')->willReturn('Testliga');

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
        // Request Olympic ranking for this league test to match previous expectation
        $result = $method->invoke($service, $playerGoals, 'top_scorer', 'league', null, '2025/2026', $league, null, true);
        $this->assertCount(3, $result, 'Alle drei Spieler sollten einen Titel erhalten.');
        $ranks = array_map(fn ($t) => $t->getTitleRank(), $result);
        $this->assertEqualsCanonicalizing(['bronze', 'gold', 'gold'], $ranks, 'Zwei Gold, dann Bronze (Silber entfällt, Logik wie im Service).');
    }

    public function testCalculateLeagueTopScorersAwardsTitlesPerLeague(): void
    {
        $league1 = $this->getMockBuilder(\App\Entity\League::class)->onlyMethods(['getId', 'getName'])->getMock();
        $league1->method('getId')->willReturn(1);
        $league1->method('getName')->willReturn('Kreisliga');
        $league2 = $this->getMockBuilder(\App\Entity\League::class)->onlyMethods(['getId', 'getName'])->getMock();
        $league2->method('getId')->willReturn(2);
        $league2->method('getName')->willReturn('Bezirksliga');
        $leagues = [$league1, $league2];

        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        // Mock QueryBuilder-Kette für die Liga-Abfrage in calculateLeagueTopScorers
        $queryMock = $this->getMockBuilder(\Doctrine\ORM\Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getScalarResult'])
            ->getMock();
        $queryMock->method('getScalarResult')->willReturn([['leagueId' => 1], ['leagueId' => 2]]);
        $qbMock = $this->createMock(QueryBuilder::class);
        $qbMock->method('select')->willReturnSelf();
        $qbMock->method('from')->willReturnSelf();
        $qbMock->method('join')->willReturnSelf();
        $qbMock->method('where')->willReturnSelf();
        $qbMock->method('andWhere')->willReturnSelf();
        $qbMock->method('setParameter')->willReturnSelf();
        $qbMock->method('groupBy')->willReturnSelf();
        $qbMock->method('getQuery')->willReturn($queryMock);
        $em->method('createQueryBuilder')->willReturn($qbMock);

        $leagueRepoMock = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $leagueRepoMock->method('findBy')->willReturn($leagues);
        $em->method('getRepository')->willReturnCallback(function ($class) use ($leagueRepoMock, $repo) {
            if (\App\Entity\League::class === $class) {
                return $leagueRepoMock;
            }

            return $repo;
        });

        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();

        // Simuliere: Für jede Liga gibt es ein Tor von Spieler 1
        $goalMock = $this->getMockBuilder(\App\Entity\GameEvent::class)->disableOriginalConstructor()->onlyMethods(['getPlayer'])->getMock();
        $playerMock = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $playerMock->method('getId')->willReturn(1);
        $playerMock->method('getLastName')->willReturn('Test');
        $goalMock->method('getPlayer')->willReturn($playerMock);
        $service->expects($this->exactly(2))
            ->method('debugGoalsForSeason')
            ->willReturn([$goalMock]);

        $result = $service->calculateLeagueTopScorers('2025/2026');
        $this->assertCount(2, $result, 'Es sollten für beide Ligen Titel vergeben werden.');
    }

    /**
     * Kerntest für Bug-Fix: Ligen OHNE Spiele in der aktuellen Saison müssen ihre alten Titel verlieren.
     * deactivateAllTitlesForScopeAndSeason muss VOR dem Loop aufgerufen werden – auch wenn $rows leer ist.
     */
    public function testCalculateLeagueTopScorersDeactivatesAllLeagueTitlesGlobally(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        // QB gibt leeres Ergebnis zurück – keine Liga hat in dieser Saison Spiele
        $queryMock = $this->getMockBuilder(\Doctrine\ORM\Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getScalarResult'])
            ->getMock();
        $queryMock->method('getScalarResult')->willReturn([]);
        $qbMock = $this->createMock(QueryBuilder::class);
        $qbMock->method('select')->willReturnSelf();
        $qbMock->method('from')->willReturnSelf();
        $qbMock->method('join')->willReturnSelf();
        $qbMock->method('where')->willReturnSelf();
        $qbMock->method('andWhere')->willReturnSelf();
        $qbMock->method('setParameter')->willReturnSelf();
        $qbMock->method('groupBy')->willReturnSelf();
        $qbMock->method('getQuery')->willReturn($queryMock);
        $em->method('createQueryBuilder')->willReturn($qbMock);

        $leagueRepoMock = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $leagueRepoMock->method('findBy')->willReturn([]);
        $em->method('getRepository')->willReturnCallback(function ($class) use ($leagueRepoMock, $repo) {
            if (\App\Entity\League::class === $class) {
                return $leagueRepoMock;
            }

            return $repo;
        });

        // KERNAUSSAGE: deactivateAllTitlesForScopeAndSeason muss aufgerufen werden,
        // obwohl keine Liga Spiele hat – damit Alttitel aus Vorjahren entfernt werden.
        $repo->expects($this->once())
            ->method('deactivateAllTitlesForScopeAndSeason')
            ->with('top_scorer', 'league', '2025/2026');

        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();

        $service->expects($this->never())->method('debugGoalsForSeason');

        $result = $service->calculateLeagueTopScorers('2025/2026');
        $this->assertSame([], $result, 'Ohne Spiele werden keine Titel vergeben.');
    }
}
