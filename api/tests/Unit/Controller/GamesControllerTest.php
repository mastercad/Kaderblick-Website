<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\GamesController;
use App\Service\CoachTeamPlayerService;
use App\Service\GameSchedulePdfService;
use App\Service\GoalCountingService;
use App\Service\TournamentAdvancementService;
use App\Service\VideoTimelineService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class GamesControllerTest extends TestCase
{
    /**
     * Test dass der Controller korrekt initialisiert werden kann mit VideoTimelineService.
     */
    public function testControllerInitialization(): void
    {
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $videoTimelineService = $this->createMock(VideoTimelineService::class);
        $advancementService = $this->createMock(TournamentAdvancementService::class);
        $coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);

        $goalCountingService = $this->createMock(GoalCountingService::class);
        $gameSchedulePdfService = $this->createMock(GameSchedulePdfService::class);
        $controller = new GamesController($entityManager, $videoTimelineService, $advancementService, $coachTeamPlayerService, $goalCountingService, $gameSchedulePdfService);

        $this->assertInstanceOf(GamesController::class, $controller);
    }
}
