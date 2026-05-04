<?php

declare(strict_types=1);

namespace App\MessageHandler;

use App\Message\CheckCardThresholdsMessage;
use App\Repository\GameEventRepository;
use App\Service\SuspensionService;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class CheckCardThresholdsHandler
{
    public function __construct(
        private readonly GameEventRepository $gameEventRepository,
        private readonly SuspensionService $suspensionService,
    ) {
    }

    public function __invoke(CheckCardThresholdsMessage $message): void
    {
        $gameEvent = $this->gameEventRepository->find($message->gameEventId);

        if (null === $gameEvent) {
            // GameEvent wurde zwischenzeitlich gelöscht – nichts zu tun
            return;
        }

        $this->suspensionService->handleCardEvent($gameEvent);
    }
}
