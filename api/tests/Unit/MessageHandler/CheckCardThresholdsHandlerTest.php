<?php

declare(strict_types=1);

namespace App\Tests\Unit\MessageHandler;

use App\Entity\GameEvent;
use App\Message\CheckCardThresholdsMessage;
use App\MessageHandler\CheckCardThresholdsHandler;
use App\Repository\GameEventRepository;
use App\Service\SuspensionService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class CheckCardThresholdsHandlerTest extends TestCase
{
    private GameEventRepository&MockObject $gameEventRepository;
    private SuspensionService&MockObject $suspensionService;
    private CheckCardThresholdsHandler $handler;

    protected function setUp(): void
    {
        $this->gameEventRepository = $this->createMock(GameEventRepository::class);
        $this->suspensionService = $this->createMock(SuspensionService::class);

        $this->handler = new CheckCardThresholdsHandler(
            $this->gameEventRepository,
            $this->suspensionService,
        );
    }

    public function testHandlerCallsSuspensionServiceWithFoundEvent(): void
    {
        $gameEvent = $this->createMock(GameEvent::class);
        $this->gameEventRepository
            ->method('find')
            ->with(42)
            ->willReturn($gameEvent);

        $this->suspensionService
            ->expects($this->once())
            ->method('handleCardEvent')
            ->with($gameEvent);

        ($this->handler)(new CheckCardThresholdsMessage(42));
    }

    public function testHandlerDoesNothingIfEventNotFound(): void
    {
        $this->gameEventRepository
            ->method('find')
            ->with(999)
            ->willReturn(null);

        $this->suspensionService
            ->expects($this->never())
            ->method('handleCardEvent');

        ($this->handler)(new CheckCardThresholdsMessage(999));
    }

    public function testHandlerUsesGameEventIdFromMessage(): void
    {
        $gameEvent = $this->createMock(GameEvent::class);
        $this->gameEventRepository
            ->method('find')
            ->with(77)
            ->willReturn($gameEvent);

        $this->suspensionService->expects($this->once())->method('handleCardEvent');

        ($this->handler)(new CheckCardThresholdsMessage(77));
    }
}
