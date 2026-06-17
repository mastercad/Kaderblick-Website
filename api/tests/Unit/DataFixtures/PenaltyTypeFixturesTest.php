<?php

declare(strict_types=1);

namespace App\Tests\Unit\DataFixtures;

use App\DataFixtures\MasterData\PenaltyTypeFixtures;
use App\Entity\PenaltyType;
use App\Repository\PenaltyTypeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class PenaltyTypeFixturesTest extends TestCase
{
    public function testGetGroupsReturnsMasterGroup(): void
    {
        $this->assertSame(['master'], PenaltyTypeFixtures::getGroups());
    }

    public function testLoadPersistsAllPenaltyTypesWhenNoneExist(): void
    {
        $repository = $this->createMock(PenaltyTypeRepository::class);
        $repository->method('findOneBy')->willReturn(null);

        $manager = $this->createMock(EntityManagerInterface::class);
        $manager->method('getRepository')->willReturn($repository);

        $persistedNames = [];
        $manager->expects($this->exactly(9))
            ->method('persist')
            ->willReturnCallback(function (object $entity) use (&$persistedNames): void {
                $this->assertInstanceOf(PenaltyType::class, $entity);
                $persistedNames[] = $entity->getName();
            });

        $manager->expects($this->once())->method('flush');

        (new PenaltyTypeFixtures())->load($manager);

        $this->assertContains('Verspätung', $persistedNames);
        $this->assertContains('Unentschuldigtes Fehlen', $persistedNames);
        $this->assertContains('Gelbe Karte', $persistedNames);
        $this->assertContains('Rote Karte', $persistedNames);
        $this->assertContains('Nicht abgesagte Teilnahme', $persistedNames);
        $this->assertContains('Handyklingeln', $persistedNames);
        $this->assertContains('Trainingsteilnahme', $persistedNames);
        $this->assertContains('Spielteilnahme', $persistedNames);
        $this->assertContains('Tor des Monats', $persistedNames);
    }

    public function testLoadSkipsAlreadyExistingPenaltyType(): void
    {
        $existing = new PenaltyType();
        $existing->setName('Gelbe Karte');

        $repository = $this->createMock(PenaltyTypeRepository::class);
        $repository->method('findOneBy')
            ->willReturnCallback(function (array $criteria) use ($existing): ?PenaltyType {
                return 'Gelbe Karte' === $criteria['name'] ? $existing : null;
            });

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $manager->expects($this->exactly(8))->method('persist');
        $manager->expects($this->once())->method('flush');

        (new PenaltyTypeFixtures())->load($manager);
    }

    public function testLoadSkipsAllWhenAllAlreadyExist(): void
    {
        $existing = new PenaltyType();
        $existing->setName('existing');

        $repository = $this->createMock(PenaltyTypeRepository::class);
        $repository->method('findOneBy')->willReturn($existing);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $manager->expects($this->never())->method('persist');
        $manager->expects($this->once())->method('flush');

        (new PenaltyTypeFixtures())->load($manager);
    }

    public function testLoadSetsPenaltyTypePropertiesCorrectly(): void
    {
        $repository = $this->createMock(PenaltyTypeRepository::class);
        $repository->method('findOneBy')->willReturn(null);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $persisted = [];
        $manager->method('persist')
            ->willReturnCallback(function (object $entity) use (&$persisted): void {
                $persisted[] = $entity;
            });

        (new PenaltyTypeFixtures())->load($manager);

        $this->assertCount(9, $persisted);

        $byName = [];
        foreach ($persisted as $entity) {
            $byName[$entity->getName()] = $entity;
        }

        $verspaetung = $byName['Verspätung'];
        $this->assertSame(5.00, $verspaetung->getAmount());
        $this->assertFalse($verspaetung->isPositive());
        $this->assertSame('Verspätung zum Training oder Spiel', $verspaetung->getDescription());

        $handyklingeln = $byName['Handyklingeln'];
        $this->assertSame(2.00, $handyklingeln->getAmount());
        $this->assertFalse($handyklingeln->isPositive());
        $this->assertSame('Handy klingelt in der Kabine', $handyklingeln->getDescription());

        $trainingsteilnahme = $byName['Trainingsteilnahme'];
        $this->assertSame(0.20, $trainingsteilnahme->getAmount());
        $this->assertTrue($trainingsteilnahme->isPositive());
        $this->assertSame('Gutschrift für Trainingsbesuch', $trainingsteilnahme->getDescription());

        $spielteilnahme = $byName['Spielteilnahme'];
        $this->assertSame(0.50, $spielteilnahme->getAmount());
        $this->assertTrue($spielteilnahme->isPositive());
        $this->assertSame('Gutschrift für Spielteilnahme', $spielteilnahme->getDescription());

        $torDesMonats = $byName['Tor des Monats'];
        $this->assertSame(5.00, $torDesMonats->getAmount());
        $this->assertTrue($torDesMonats->isPositive());
        $this->assertSame('Belohnung für das Tor des Monats', $torDesMonats->getDescription());
    }

    public function testLoadAlwaysCallsFlush(): void
    {
        $existing = new PenaltyType();
        $existing->setName('existing');

        $repository = $this->createMock(PenaltyTypeRepository::class);
        $repository->method('findOneBy')->willReturn($existing);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);
        $manager->method('persist');

        $manager->expects($this->once())->method('flush');

        (new PenaltyTypeFixtures())->load($manager);
    }
}
