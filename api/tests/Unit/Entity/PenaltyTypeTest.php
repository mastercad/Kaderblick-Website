<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\Club;
use App\Entity\PenaltyType;
use App\Entity\Team;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

class PenaltyTypeTest extends TestCase
{
    private PenaltyType $penaltyType;

    protected function setUp(): void
    {
        $this->penaltyType = new PenaltyType();
    }

    public function testGetIdReturnsNullBeforePersistence(): void
    {
        $this->assertNull($this->penaltyType->getId());
    }

    public function testSetAndGetName(): void
    {
        $this->penaltyType->setName('Late Arrival');
        $this->assertSame('Late Arrival', $this->penaltyType->getName());
    }

    public function testSetNameReturnsSelf(): void
    {
        $result = $this->penaltyType->setName('Late Arrival');
        $this->assertSame($this->penaltyType, $result);
    }

    public function testDescriptionDefaultsToNull(): void
    {
        $this->assertNull($this->penaltyType->getDescription());
    }

    public function testSetAndGetDescription(): void
    {
        $this->penaltyType->setDescription('Penalty for arriving late');
        $this->assertSame('Penalty for arriving late', $this->penaltyType->getDescription());
    }

    public function testSetDescriptionToNull(): void
    {
        $this->penaltyType->setDescription('Some description');
        $this->penaltyType->setDescription(null);
        $this->assertNull($this->penaltyType->getDescription());
    }

    public function testSetDescriptionReturnsSelf(): void
    {
        $result = $this->penaltyType->setDescription('desc');
        $this->assertSame($this->penaltyType, $result);
    }

    public function testSetAndGetAmount(): void
    {
        $this->penaltyType->setAmount(25.50);
        $this->assertSame(25.50, $this->penaltyType->getAmount());
    }

    public function testGetAmountReturnsSetValue(): void
    {
        $this->penaltyType->setAmount(10.0);
        $this->assertSame(10.0, $this->penaltyType->getAmount());
    }

    public function testSetAmountReturnsSelf(): void
    {
        $result = $this->penaltyType->setAmount(10.0);
        $this->assertSame($this->penaltyType, $result);
    }

    public function testIsPositiveDefaultsFalse(): void
    {
        $this->assertFalse($this->penaltyType->isPositive());
    }

    public function testSetPositiveToTrue(): void
    {
        $this->penaltyType->setPositive(true);
        $this->assertTrue($this->penaltyType->isPositive());
    }

    public function testSetPositiveToFalse(): void
    {
        $this->penaltyType->setPositive(true);
        $this->penaltyType->setPositive(false);
        $this->assertFalse($this->penaltyType->isPositive());
    }

    public function testSetPositiveReturnsSelf(): void
    {
        $result = $this->penaltyType->setPositive(true);
        $this->assertSame($this->penaltyType, $result);
    }

    public function testIsActiveDefaultsTrue(): void
    {
        $this->assertTrue($this->penaltyType->isActive());
    }

    public function testSetActiveToFalse(): void
    {
        $this->penaltyType->setActive(false);
        $this->assertFalse($this->penaltyType->isActive());
    }

    public function testSetActiveToTrue(): void
    {
        $this->penaltyType->setActive(false);
        $this->penaltyType->setActive(true);
        $this->assertTrue($this->penaltyType->isActive());
    }

    public function testSetActiveReturnsSelf(): void
    {
        $result = $this->penaltyType->setActive(false);
        $this->assertSame($this->penaltyType, $result);
    }

    public function testValidFromDefaultsToNull(): void
    {
        $this->assertNull($this->penaltyType->getValidFrom());
    }

    public function testSetAndGetValidFrom(): void
    {
        $date = new DateTimeImmutable('2026-01-01');
        $this->penaltyType->setValidFrom($date);
        $this->assertSame($date, $this->penaltyType->getValidFrom());
    }

    public function testSetValidFromToNull(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('2026-01-01'));
        $this->penaltyType->setValidFrom(null);
        $this->assertNull($this->penaltyType->getValidFrom());
    }

    public function testSetValidFromReturnsSelf(): void
    {
        $result = $this->penaltyType->setValidFrom(new DateTimeImmutable('2026-01-01'));
        $this->assertSame($this->penaltyType, $result);
    }

    public function testValidUntilDefaultsToNull(): void
    {
        $this->assertNull($this->penaltyType->getValidUntil());
    }

    public function testSetAndGetValidUntil(): void
    {
        $date = new DateTimeImmutable('2026-12-31');
        $this->penaltyType->setValidUntil($date);
        $this->assertSame($date, $this->penaltyType->getValidUntil());
    }

    public function testSetValidUntilToNull(): void
    {
        $this->penaltyType->setValidUntil(new DateTimeImmutable('2026-12-31'));
        $this->penaltyType->setValidUntil(null);
        $this->assertNull($this->penaltyType->getValidUntil());
    }

    public function testSetValidUntilReturnsSelf(): void
    {
        $result = $this->penaltyType->setValidUntil(new DateTimeImmutable('2026-12-31'));
        $this->assertSame($this->penaltyType, $result);
    }

    public function testTeamDefaultsToNull(): void
    {
        $this->assertNull($this->penaltyType->getTeam());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetAndGetTeam(): void
    {
        $team = $this->createMock(Team::class);
        $this->penaltyType->setTeam($team);
        $this->assertSame($team, $this->penaltyType->getTeam());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetTeamToNull(): void
    {
        $team = $this->createMock(Team::class);
        $this->penaltyType->setTeam($team);
        $this->penaltyType->setTeam(null);
        $this->assertNull($this->penaltyType->getTeam());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetTeamReturnsSelf(): void
    {
        $team = $this->createMock(Team::class);
        $result = $this->penaltyType->setTeam($team);
        $this->assertSame($this->penaltyType, $result);
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testClubDefaultsToNull(): void
    {
        $this->assertNull($this->penaltyType->getClub());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetAndGetClub(): void
    {
        $club = $this->createMock(Club::class);
        $this->penaltyType->setClub($club);
        $this->assertSame($club, $this->penaltyType->getClub());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetClubToNull(): void
    {
        $club = $this->createMock(Club::class);
        $this->penaltyType->setClub($club);
        $this->penaltyType->setClub(null);
        $this->assertNull($this->penaltyType->getClub());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testSetClubReturnsSelf(): void
    {
        $club = $this->createMock(Club::class);
        $result = $this->penaltyType->setClub($club);
        $this->assertSame($this->penaltyType, $result);
    }

    public function testGetCreatedAtIsSetInConstructor(): void
    {
        $before = new DateTimeImmutable();
        $penaltyType = new PenaltyType();
        $after = new DateTimeImmutable();

        $this->assertInstanceOf(DateTimeImmutable::class, $penaltyType->getCreatedAt());
        $this->assertGreaterThanOrEqual($before, $penaltyType->getCreatedAt());
        $this->assertLessThanOrEqual($after, $penaltyType->getCreatedAt());
    }

    public function testIsGlobalReturnsTrueWhenBothTeamAndClubAreNull(): void
    {
        $this->assertTrue($this->penaltyType->isGlobal());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testIsGlobalReturnsFalseWhenTeamIsSet(): void
    {
        $team = $this->createMock(Team::class);
        $this->penaltyType->setTeam($team);
        $this->assertFalse($this->penaltyType->isGlobal());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testIsGlobalReturnsFalseWhenClubIsSet(): void
    {
        $club = $this->createMock(Club::class);
        $this->penaltyType->setClub($club);
        $this->assertFalse($this->penaltyType->isGlobal());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testIsGlobalReturnsFalseWhenBothTeamAndClubAreSet(): void
    {
        $team = $this->createMock(Team::class);
        $club = $this->createMock(Club::class);
        $this->penaltyType->setTeam($team);
        $this->penaltyType->setClub($club);
        $this->assertFalse($this->penaltyType->isGlobal());
    }

    public function testIsCurrentlyValidWithNoDates(): void
    {
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithFutureValidFrom(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('+1 day'));
        $this->assertFalse($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithPastValidFrom(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('-1 day'));
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithTodayAsValidFrom(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('today'));
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithPastValidUntil(): void
    {
        $this->penaltyType->setValidUntil(new DateTimeImmutable('-1 day'));
        $this->assertFalse($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithFutureValidUntil(): void
    {
        $this->penaltyType->setValidUntil(new DateTimeImmutable('+1 day'));
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithTodayAsValidUntil(): void
    {
        $this->penaltyType->setValidUntil(new DateTimeImmutable('today'));
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithBothBoundsValid(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('-1 day'));
        $this->penaltyType->setValidUntil(new DateTimeImmutable('+1 day'));
        $this->assertTrue($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithExpiredRange(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('-10 days'));
        $this->penaltyType->setValidUntil(new DateTimeImmutable('-1 day'));
        $this->assertFalse($this->penaltyType->isCurrentlyValid());
    }

    public function testIsCurrentlyValidWithFutureRange(): void
    {
        $this->penaltyType->setValidFrom(new DateTimeImmutable('+1 day'));
        $this->penaltyType->setValidUntil(new DateTimeImmutable('+10 days'));
        $this->assertFalse($this->penaltyType->isCurrentlyValid());
    }
}
