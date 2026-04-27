<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\GamesController;
use App\Entity\Game;
use App\Service\CoachTeamPlayerService;
use App\Service\GameSchedulePdfService;
use App\Service\GoalCountingService;
use App\Service\TournamentAdvancementService;
use App\Service\VideoTimelineService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

#[AllowMockObjectsWithoutExpectations]
class GamesControllerTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private GamesController $controller;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);

        $this->controller = new GamesController(
            $this->entityManager,
            $this->createMock(VideoTimelineService::class),
            $this->createMock(TournamentAdvancementService::class),
            $this->createMock(CoachTeamPlayerService::class),
            $this->createMock(GoalCountingService::class),
            $this->createMock(GameSchedulePdfService::class),
        );

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);

        $container = new ContainerBuilder();
        $container->set('security.authorization_checker', $authChecker);
        $container->set('serializer', new class {
            /** @param array<string, mixed> $context */
            public function serialize(mixed $data, string $format, array $context = []): string
            {
                return json_encode($data, JSON_THROW_ON_ERROR);
            }
        });
        $this->controller->setContainer($container);
    }

    private function makeGame(bool $isFinished = false): Game&MockObject
    {
        $game = $this->createMock(Game::class);
        $game->method('isFinished')->willReturn($isFinished);

        return $game;
    }

    public function testControllerInitialization(): void
    {
        $this->assertInstanceOf(GamesController::class, $this->controller);
    }

    // ── finish() ─────────────────────────────────────────────────────────────

    public function testFinishReturns400WhenGameAlreadyFinished(): void
    {
        $game = $this->makeGame(isFinished: true);

        $response = $this->controller->finish($game);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertStringContainsString('bereits beendet', $data['error']);
    }

    // ── timing() ─────────────────────────────────────────────────────────────

    public function testTimingReturns400WhenHalfDurationTooLow(): void
    {
        $game = $this->makeGame();
        $request = Request::create('/', 'PATCH', [], [], [], [], json_encode(['halfDuration' => 0]));

        $response = $this->controller->timing($game, $request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testTimingReturns400WhenHalfDurationTooHigh(): void
    {
        $game = $this->makeGame();
        $request = Request::create('/', 'PATCH', [], [], [], [], json_encode(['halfDuration' => 91]));

        $response = $this->controller->timing($game, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testTimingReturns400WhenHalftimeBreakTooHigh(): void
    {
        $game = $this->makeGame();
        $game->method('getHalfDuration')->willReturn(45);
        $request = Request::create('/', 'PATCH', [], [], [], [], json_encode(['halftimeBreakDuration' => 61]));

        $response = $this->controller->timing($game, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testTimingReturns400WhenHalftimeBreakNegative(): void
    {
        $game = $this->makeGame();
        $game->method('getHalfDuration')->willReturn(45);
        $request = Request::create('/', 'PATCH', [], [], [], [], json_encode(['halftimeBreakDuration' => -1]));

        $response = $this->controller->timing($game, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ── saveMatchPlan() ───────────────────────────────────────────────────────

    public function testSaveMatchPlanReturns400WhenDataIsNotArray(): void
    {
        $game = $this->makeGame();
        $request = Request::create('/', 'PATCH', [], [], [], [], 'not-json');

        $response = $this->controller->saveMatchPlan($game, $request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }
}
