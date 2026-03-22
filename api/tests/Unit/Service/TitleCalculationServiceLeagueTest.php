<?php

namespace App\Tests\Unit\Service;

use App\Repository\PlayerTitleRepository;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
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

        $service = new TitleCalculationService($em, $repo);
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
        $result = $method->invoke($service, $playerGoals, 'top_scorer', 'league', null, '2025/2026', $league, true);
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
        $entityManagerDummy = $this->createMock(EntityManagerInterface::class);
        $classMetadata = new ClassMetadata(\App\Entity\League::class);
        $leagueRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->setConstructorArgs([$entityManagerDummy, $classMetadata])
            ->onlyMethods(['findAll'])
            ->getMock();
        $leagueRepo->method('findAll')->willReturn($leagues);
        $em->method('getRepository')->willReturnCallback(function ($class) use ($leagueRepo, $repo) {
            if ('App\\Entity\\League' == $class || \App\Entity\League::class == $class) {
                return $leagueRepo;
            }
            if ('App\\Entity\\PlayerTitle' == $class || \App\Entity\PlayerTitle::class == $class) {
                return $repo;
            }
            $entityRepoClass = class_exists('Doctrine\\ORM\\EntityRepository') ? 'Doctrine\\ORM\\EntityRepository' : 'Doctrine\\Persistence\\ObjectRepository';

            return $this->createMock($entityRepoClass);
        });

        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo])
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
}
