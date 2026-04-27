<?php

declare(strict_types=1);

namespace App\Tests\Unit\MessageHandler;

use App\Message\AwardTitlesMessage;
use App\MessageHandler\AwardTitlesHandler;
use App\Service\TitleCalculationService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class AwardTitlesHandlerTest extends TestCase
{
    private TitleCalculationService&MockObject $titleCalculationService;
    private AwardTitlesHandler $handler;

    protected function setUp(): void
    {
        $this->titleCalculationService = $this->createMock(TitleCalculationService::class);
        $this->handler = new AwardTitlesHandler($this->titleCalculationService);
    }

    public function testHandlerCallsAllThreeCalculateMethods(): void
    {
        $this->titleCalculationService->expects($this->once())
            ->method('calculatePlatformTopScorers')
            ->with('2024/2025');

        $this->titleCalculationService->expects($this->once())
            ->method('calculateAllTeamTopScorers')
            ->with('2024/2025');

        $this->titleCalculationService->expects($this->once())
            ->method('calculateLeagueTopScorers')
            ->with('2024/2025');

        ($this->handler)(new AwardTitlesMessage('2024/2025'));
    }

    public function testHandlerPassesSeasonToAllMethods(): void
    {
        $season = '2023/2024';

        $this->titleCalculationService->expects($this->once())
            ->method('calculatePlatformTopScorers')
            ->with($season)
            ->willReturn([]);

        $this->titleCalculationService->expects($this->once())
            ->method('calculateAllTeamTopScorers')
            ->with($season)
            ->willReturn([]);

        $this->titleCalculationService->expects($this->once())
            ->method('calculateLeagueTopScorers')
            ->with($season)
            ->willReturn([]);

        ($this->handler)(new AwardTitlesMessage($season));
    }
}
