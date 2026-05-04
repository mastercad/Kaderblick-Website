<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\CompetitionCardRule;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class CompetitionCardRuleTest extends TestCase
{
    public function testConstructorDefaults(): void
    {
        $rule = new CompetitionCardRule('league');

        $this->assertSame('league', $rule->getCompetitionType());
        $this->assertNull($rule->getCompetitionId());
        $this->assertSame(4, $rule->getYellowWarningThreshold());
        $this->assertSame(5, $rule->getYellowSuspensionThreshold());
        $this->assertSame(1, $rule->getSuspensionGames());
        $this->assertTrue($rule->isResetAfterSuspension());
    }

    public function testConstructorWithCustomValues(): void
    {
        $rule = new CompetitionCardRule(
            competitionType: 'cup',
            competitionId: 7,
            yellowWarningThreshold: 3,
            yellowSuspensionThreshold: 4,
            suspensionGames: 2,
            resetAfterSuspension: false,
        );

        $this->assertSame('cup', $rule->getCompetitionType());
        $this->assertSame(7, $rule->getCompetitionId());
        $this->assertSame(3, $rule->getYellowWarningThreshold());
        $this->assertSame(4, $rule->getYellowSuspensionThreshold());
        $this->assertSame(2, $rule->getSuspensionGames());
        $this->assertFalse($rule->isResetAfterSuspension());
    }

    public function testSetters(): void
    {
        $rule = new CompetitionCardRule('league');

        $rule->setCompetitionType('tournament');
        $this->assertSame('tournament', $rule->getCompetitionType());

        $rule->setCompetitionId(99);
        $this->assertSame(99, $rule->getCompetitionId());

        $rule->setYellowWarningThreshold(2);
        $this->assertSame(2, $rule->getYellowWarningThreshold());

        $rule->setYellowSuspensionThreshold(3);
        $this->assertSame(3, $rule->getYellowSuspensionThreshold());

        $rule->setSuspensionGames(3);
        $this->assertSame(3, $rule->getSuspensionGames());

        $rule->setResetAfterSuspension(false);
        $this->assertFalse($rule->isResetAfterSuspension());

        $rule->setCompetitionId(null);
        $this->assertNull($rule->getCompetitionId());
    }

    public function testTypeConstants(): void
    {
        $this->assertSame('league', CompetitionCardRule::TYPE_LEAGUE);
        $this->assertSame('cup', CompetitionCardRule::TYPE_CUP);
        $this->assertSame('tournament', CompetitionCardRule::TYPE_TOURNAMENT);
        $this->assertSame('friendly', CompetitionCardRule::TYPE_FRIENDLY);
    }

    public function testIdIsNullBeforePersist(): void
    {
        $rule = new CompetitionCardRule('league');

        $this->assertNull($rule->getId());
    }
}
