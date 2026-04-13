<?php

namespace App\Tests\Unit\DataFixtures;

use App\DataFixtures\MasterData\CupFixtures;
use App\Entity\Cup;
use Doctrine\Persistence\ObjectManager;
use Doctrine\Persistence\ObjectRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class CupFixturesTest extends TestCase
{
    // -------------------------------------------------------------------------
    // getGroups
    // -------------------------------------------------------------------------

    public function testGetGroupsReturnsMasterGroup(): void
    {
        $this->assertSame(['master'], CupFixtures::getGroups());
    }

    // -------------------------------------------------------------------------
    // load – all-new scenario
    // -------------------------------------------------------------------------

    public function testLoadPersistsAllCupsWhenNoneExist(): void
    {
        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findOneBy')->willReturn(null);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $persistedNames = [];
        $manager->expects($this->exactly(15))
            ->method('persist')
            ->willReturnCallback(function (object $entity) use (&$persistedNames): void {
                $this->assertInstanceOf(Cup::class, $entity);
                $persistedNames[] = $entity->getName();
            });

        $manager->expects($this->once())->method('flush');

        (new CupFixtures())->load($manager);

        $this->assertContains('DFB-Pokal', $persistedNames);
        $this->assertContains('Landespokal', $persistedNames);
        $this->assertContains('Verbandspokal', $persistedNames);
        $this->assertContains('Bezirkspokal', $persistedNames);
        $this->assertContains('Kreispokal', $persistedNames);
        $this->assertContains('DFB-Pokal Frauen', $persistedNames);
        $this->assertContains('Landespokal Frauen', $persistedNames);
        $this->assertContains('DFB-Junioren-Pokal', $persistedNames);
        $this->assertContains('Landespokal Junioren', $persistedNames);
        $this->assertContains('UEFA Champions League', $persistedNames);
        $this->assertContains('UEFA Europa League', $persistedNames);
        $this->assertContains('UEFA Conference League', $persistedNames);
        $this->assertContains('DFL-Supercup', $persistedNames);
        $this->assertContains('Sparkassenpokal', $persistedNames);
        $this->assertContains('Sparkassenkreispokal', $persistedNames);
    }

    // -------------------------------------------------------------------------
    // load – idempotent: skip existing
    // -------------------------------------------------------------------------

    public function testLoadSkipsAlreadyExistingCups(): void
    {
        $existingCup = new Cup();
        $existingCup->setName('DFB-Pokal');

        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findOneBy')
            ->willReturnCallback(function (array $criteria) use ($existingCup): ?Cup {
                return 'DFB-Pokal' === $criteria['name'] ? $existingCup : null;
            });

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        // Only 14 of the 15 cups should be persisted (DFB-Pokal is skipped)
        $manager->expects($this->exactly(14))->method('persist');
        $manager->expects($this->once())->method('flush');

        (new CupFixtures())->load($manager);
    }

    public function testLoadSkipsAllWhenAllAlreadyExist(): void
    {
        $cup = new Cup();
        $cup->setName('existing');

        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findOneBy')->willReturn($cup);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $manager->expects($this->never())->method('persist');
        $manager->expects($this->once())->method('flush');

        (new CupFixtures())->load($manager);
    }

    // -------------------------------------------------------------------------
    // load – each persisted Cup has correct name and type
    // -------------------------------------------------------------------------

    public function testLoadSetsCupNamesCorrectly(): void
    {
        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findOneBy')->willReturn(null);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);

        $persistedCups = [];
        $manager->method('persist')
            ->willReturnCallback(function (object $cup) use (&$persistedCups): void {
                $persistedCups[] = $cup;
            });

        (new CupFixtures())->load($manager);

        foreach ($persistedCups as $cup) {
            /* @var Cup $cup */
            $this->assertInstanceOf(Cup::class, $cup);
            $this->assertNotEmpty($cup->getName());
        }
    }

    // -------------------------------------------------------------------------
    // load – flush is always called (even with zero persists)
    // -------------------------------------------------------------------------

    public function testLoadAlwaysCallsFlush(): void
    {
        $cup = new Cup();
        $cup->setName('existing');

        $repository = $this->createMock(ObjectRepository::class);
        $repository->method('findOneBy')->willReturn($cup);

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getRepository')->willReturn($repository);
        $manager->method('persist');

        $manager->expects($this->once())->method('flush');

        (new CupFixtures())->load($manager);
    }
}
