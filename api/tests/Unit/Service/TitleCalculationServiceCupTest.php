<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Repository\PlayerTitleRepository;
use App\Service\GoalCountingService;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class TitleCalculationServiceCupTest extends TestCase
{
    public function testCalculateAllCupTopScorersAwardsTitlesPerCup(): void
    {
        $cup1 = $this->getMockBuilder(\App\Entity\Cup::class)->onlyMethods(['getId', 'getName'])->getMock();
        $cup1->method('getId')->willReturn(1);
        $cup1->method('getName')->willReturn('Kreispokal');
        $cup2 = $this->getMockBuilder(\App\Entity\Cup::class)->onlyMethods(['getId', 'getName'])->getMock();
        $cup2->method('getId')->willReturn(2);
        $cup2->method('getName')->willReturn('Bezirkspokal');
        $cups = [$cup1, $cup2];

        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        // Mock QueryBuilder-Kette für die Cup-Abfrage in calculateAllCupTopScorers
        $queryMock = $this->getMockBuilder(\Doctrine\ORM\Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getScalarResult'])
            ->getMock();
        $queryMock->method('getScalarResult')->willReturn([['cupId' => 1], ['cupId' => 2]]);
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

        $cupRepoMock = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy', 'findOneBy'])
            ->getMock();
        $cupRepoMock->method('findBy')->willReturn($cups);
        $cupRepoMock->method('findOneBy')->willReturn(null);
        $em->method('getRepository')->willReturnCallback(function ($class) use ($cupRepoMock, $repo) {
            if (\App\Entity\Cup::class === $class) {
                return $cupRepoMock;
            }

            return $repo;
        });

        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();

        // Für jeden Cup gibt es ein Tor von Spieler 1
        $goalMock = $this->getMockBuilder(\App\Entity\GameEvent::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getPlayer'])
            ->getMock();
        $playerMock = $this->getMockBuilder(\App\Entity\Player::class)
            ->onlyMethods(['getId', 'getLastName'])
            ->getMock();
        $playerMock->method('getId')->willReturn(1);
        $playerMock->method('getLastName')->willReturn('Test');
        $goalMock->method('getPlayer')->willReturn($playerMock);

        $service->expects($this->exactly(2))
            ->method('debugGoalsForSeason')
            ->willReturn([$goalMock]);

        $result = $service->calculateAllCupTopScorers('2025/2026');
        $this->assertCount(2, $result, 'Es sollten für beide Cups Titel vergeben werden.');
    }

    /**
     * Kerntest für Bug-Fix: Cups OHNE Spiele in der aktuellen Saison müssen ihre alten Titel verlieren.
     * deactivateAllTitlesForScopeAndSeason muss VOR dem Loop aufgerufen werden – auch wenn $rows leer ist.
     */
    public function testCalculateAllCupTopScorersDeactivatesAllCupTitlesGlobally(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        // QB gibt leeres Ergebnis zurück – kein Cup hat in dieser Saison Spiele
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

        $cupRepoMock = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $cupRepoMock->method('findBy')->willReturn([]);
        $em->method('getRepository')->willReturnCallback(function ($class) use ($cupRepoMock, $repo) {
            if (\App\Entity\Cup::class === $class) {
                return $cupRepoMock;
            }

            return $repo;
        });

        // KERNAUSSAGE: deactivateAllTitlesForScopeAndSeason muss aufgerufen werden,
        // obwohl kein Cup Spiele hat – damit Alttitel aus Vorjahren entfernt werden.
        $repo->expects($this->once())
            ->method('deactivateAllTitlesForScopeAndSeason')
            ->with('top_scorer', 'cup', '2025/2026');

        $service = $this->getMockBuilder(TitleCalculationService::class)
            ->setConstructorArgs([$em, $repo, $this->createMock(GoalCountingService::class)])
            ->onlyMethods(['debugGoalsForSeason'])
            ->getMock();

        $service->expects($this->never())->method('debugGoalsForSeason');

        $result = $service->calculateAllCupTopScorers('2025/2026');
        $this->assertSame([], $result, 'Ohne Spiele werden keine Cup-Titel vergeben.');
    }
}
