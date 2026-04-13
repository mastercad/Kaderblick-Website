<?php

namespace App\Tests\Unit\Service;

use App\Entity\SystemSetting;
use App\Repository\SystemSettingRepository;
use App\Service\SystemSettingService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for SystemSettingService.
 *
 * Focuses on the getMatchdayLookaheadDays() method that was introduced to
 * control how many days ahead upcoming games are shown in "Mein Spieltag".
 */
#[AllowMockObjectsWithoutExpectations]
class SystemSettingServiceTest extends TestCase
{
    private SystemSettingRepository&MockObject $repository;
    private EntityManagerInterface&MockObject $em;
    private SystemSettingService $service;

    protected function setUp(): void
    {
        $this->repository = $this->createMock(SystemSettingRepository::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->service = new SystemSettingService($this->repository, $this->em);
    }

    // ── Convenience helper ─────────────────────────────────────────────────────

    private function stubSetting(string $key, ?string $value): void
    {
        if (null === $value) {
            $this->repository
                ->method('findByKey')
                ->with($key)
                ->willReturn(null);
        } else {
            $setting = new SystemSetting($key, $value);
            $this->repository
                ->method('findByKey')
                ->with($key)
                ->willReturn($setting);
        }
    }

    // ── getMatchdayLookaheadDays() ─────────────────────────────────────────────

    public function testGetMatchdayLookaheadDaysReturnsDefaultWhenNotConfigured(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, null);

        $this->assertSame(
            SystemSettingService::MATCHDAY_LOOKAHEAD_DAYS_DEFAULT,
            $this->service->getMatchdayLookaheadDays()
        );
    }

    public function testGetMatchdayLookaheadDaysReturnsStoredValue(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '14');

        $this->assertSame(14, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysReturnsSevenByDefault(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, null);

        $this->assertSame(7, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysClampsZeroToOne(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '0');

        $this->assertSame(1, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysClampsNegativeToOne(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '-10');

        $this->assertSame(1, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysClampsAboveNinetyToNinety(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '91');

        $this->assertSame(90, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysClampsLargeValueToNinety(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '9999');

        $this->assertSame(90, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysReturnsExactMinimumOne(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '1');

        $this->assertSame(1, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysReturnsExactMaximumNinety(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '90');

        $this->assertSame(90, $this->service->getMatchdayLookaheadDays());
    }

    public function testGetMatchdayLookaheadDaysReturnsMidRangeValue(): void
    {
        $this->stubSetting(SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS, '30');

        $this->assertSame(30, $this->service->getMatchdayLookaheadDays());
    }

    // ── Constants ──────────────────────────────────────────────────────────────

    public function testKeyConstantHasExpectedValue(): void
    {
        $this->assertSame(
            'matchday_lookahead_days',
            SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS
        );
    }

    public function testDefaultConstantIsSevenDays(): void
    {
        $this->assertSame(7, SystemSettingService::MATCHDAY_LOOKAHEAD_DAYS_DEFAULT);
    }
}
