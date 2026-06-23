<?php

declare(strict_types=1);

namespace App\Tests\Unit\MessageHandler;

use App\Entity\Game;
use App\Message\RecalcPlayerStatsMessage;
use App\MessageHandler\RecalcPlayerStatsHandler;
use App\Repository\GameRepository;
use App\Service\PlayerStatsRecalcService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class RecalcPlayerStatsHandlerTest extends TestCase
{
    private GameRepository & MockObject $gameRepository;
    private PlayerStatsRecalcService & MockObject $recalcService;
    private RecalcPlayerStatsHandler $handler;

    protected function setUp(): void
    {
        $this->gameRepository = $this->createMock(GameRepository::class);
        $this->recalcService = $this->createMock(PlayerStatsRecalcService::class);
        $this->handler = new RecalcPlayerStatsHandler($this->gameRepository, $this->recalcService);
    }

    public function testInvokeDelegatesToRecalcServiceWhenGameFound(): void
    {
        $game = $this->createMock(Game::class);

        $this->gameRepository->expects(self::once())
            ->method('find')
            ->with(42)
            ->willReturn($game);

        $this->recalcService->expects(self::once())
            ->method('recalcForGame')
            ->with($game);

        ($this->handler)(new RecalcPlayerStatsMessage(42));
    }

    public function testInvokeDoesNothingWhenGameNotFound(): void
    {
        $this->gameRepository->expects(self::once())
            ->method('find')
            ->with(99)
            ->willReturn(null); // Spiel wurde gelöscht

        $this->recalcService->expects(self::never())
            ->method('recalcForGame');

        ($this->handler)(new RecalcPlayerStatsMessage(99));
    }
}
