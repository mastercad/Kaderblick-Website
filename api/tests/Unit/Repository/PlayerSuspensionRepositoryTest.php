<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\PlayerSuspension;
use App\Repository\PlayerSuspensionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für PlayerSuspensionRepository::findAllActive().
 *
 * Da findAllActive() direkt Doctrine's findBy() delegiert, reicht es zu prüfen,
 * dass die Methode existiert und bei leerem Repository ein leeres Array zurückgibt.
 * Der vollständige Integrationstest würde eine echte DB benötigen – das wird hier
 * durch ein partielles Mock abgedeckt.
 */
#[AllowMockObjectsWithoutExpectations]
class PlayerSuspensionRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    /** @var ClassMetadata<PlayerSuspension>&MockObject */
    private ClassMetadata&MockObject $classMetadata;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->classMetadata = $this->createMock(ClassMetadata::class);
        $this->em->method('getClassMetadata')->willReturn($this->classMetadata);
    }

    /**
     * findAllActive() muss ['isActive' => true] an findBy() übergeben.
     * Wir mocken das Repository partiell und prüfen den Rückgabewert.
     */
    public function testFindAllActiveReturnsOnlyActiveSuspensions(): void
    {
        $activeSuspension = $this->createMock(PlayerSuspension::class);
        $activeSuspension->method('isActive')->willReturn(true);

        // Partielles Mock: findBy() überschreiben
        $repo = $this->getMockBuilder(PlayerSuspensionRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();

        $repo->expects($this->once())
            ->method('findBy')
            ->with(['isActive' => true])
            ->willReturn([$activeSuspension]);

        $result = $repo->findAllActive();

        $this->assertCount(1, $result);
        $this->assertSame($activeSuspension, $result[0]);
        $this->assertTrue($result[0]->isActive());
    }

    public function testFindAllActiveReturnsEmptyArrayWhenNoActiveSuspensions(): void
    {
        $repo = $this->getMockBuilder(PlayerSuspensionRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();

        $repo->expects($this->once())
            ->method('findBy')
            ->with(['isActive' => true])
            ->willReturn([]);

        $result = $repo->findAllActive();

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testFindAllActiveReturnsMultipleSuspensions(): void
    {
        $suspension1 = $this->createMock(PlayerSuspension::class);
        $suspension2 = $this->createMock(PlayerSuspension::class);
        $suspension3 = $this->createMock(PlayerSuspension::class);

        $repo = $this->getMockBuilder(PlayerSuspensionRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();

        $repo->method('findBy')
            ->willReturn([$suspension1, $suspension2, $suspension3]);

        $result = $repo->findAllActive();

        $this->assertCount(3, $result);
    }
}
