<?php

namespace App\MessageHandler;

use App\Message\AwardTitlesMessage;
use App\Service\TitleCalculationService;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class AwardTitlesHandler
{
    public function __construct(
        private TitleCalculationService $titleCalculationService,
    ) {
    }

    public function __invoke(AwardTitlesMessage $message): void
    {
        $season = $message->season;

        $this->titleCalculationService->calculatePlatformTopScorers($season);
        $this->titleCalculationService->calculateAllTeamTopScorers($season);
        $this->titleCalculationService->calculateLeagueTopScorers($season);
    }
}
