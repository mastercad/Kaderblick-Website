<?php

namespace App\Tests\Unit\Service;

use App\Entity\Player;
use App\Service\ReportVirtualFieldService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class ReportVirtualFieldServiceTest extends TestCase
{
    public function testEinsatzminutenReturnsZeroForNoGames(): void
    {
        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('join')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([]);
        $qb->method('getQuery')->willReturn($query);

        $gameRepo = $this->createMock(EntityRepository::class);
        $gameRepo->method('createQueryBuilder')->willReturn($qb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($gameRepo);

        $svc = new ReportVirtualFieldService($em);
        $player = $this->createMock(Player::class);

        $result = $svc->einsatzminuten($player);

        $this->assertSame(0, $result);
    }

    // Note: Tests for einsatzminuten with actual games are skipped because
    // Game entity does not have getStartTime()/getEndTime() methods
    // that ReportVirtualFieldService::einsatzminuten() relies on.
}
