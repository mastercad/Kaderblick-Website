<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\RecalcAllPlayerStatsCommand;
use App\Entity\Game;
use App\Repository\GameRepository;
use App\Service\HeartbeatService;
use App\Service\PlayerStatsRecalcService;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class RecalcAllPlayerStatsCommandTest extends TestCase
{
    private GameRepository&MockObject $gameRepository;
    private PlayerStatsRecalcService&MockObject $recalcService;
    private Connection&MockObject $connection;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->gameRepository = $this->createMock(GameRepository::class);
        $this->recalcService = $this->createMock(PlayerStatsRecalcService::class);
        $this->connection = $this->createMock(Connection::class);

        $command = new RecalcAllPlayerStatsCommand(
            $this->gameRepository,
            $this->recalcService,
            $this->connection,
        );
        $command->setHeartbeatService($this->createMock(HeartbeatService::class));

        $application = new Application();
        $application->addCommand($command);
        $this->commandTester = new CommandTester($application->find('app:recalc-player-stats'));
    }

    // ── --game: einzelnes Spiel ──────────────────────────────────────────────

    public function testRecalcSingleGameSucceeds(): void
    {
        $game = $this->makeGame(42);

        $this->gameRepository->expects($this->once())
            ->method('find')
            ->with(42)
            ->willReturn($game);

        $this->recalcService->expects($this->once())
            ->method('recalcForGame')
            ->with($game);

        $exitCode = $this->commandTester->execute(['--game' => '42']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('42', $display);
        $this->assertStringContainsString('Fertig', $display);
    }

    public function testRecalcSingleGameReturnsFailureWhenNotFound(): void
    {
        $this->gameRepository->method('find')->willReturn(null);

        $exitCode = $this->commandTester->execute(['--game' => '99']);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('nicht gefunden', $this->commandTester->getDisplay());
    }

    // ── Standardmodus: nur Spiele ohne Stats ────────────────────────────────

    public function testSucceedsWithNoMissingGames(): void
    {
        $this->connection->method('fetchFirstColumn')->willReturn([]);
        $this->recalcService->expects($this->never())->method('recalcForGame');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Keine Spiele zu verarbeiten', $this->commandTester->getDisplay());
    }

    public function testRecalcsMissingGamesAndReturnsSuccess(): void
    {
        $game1 = $this->makeGame(1);
        $game2 = $this->makeGame(2);

        $this->connection->method('fetchFirstColumn')->willReturn([1, 2]);
        $this->gameRepository->method('findBy')
            ->with(['id' => [1, 2]])
            ->willReturn([$game1, $game2]);

        $this->recalcService->expects($this->exactly(2))->method('recalcForGame');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('2', $display);
        $this->assertStringContainsString('0 Fehler', $display);
    }

    public function testReturnsFailureWhenSomeGamesFail(): void
    {
        $game1 = $this->makeGame(1);
        $game2 = $this->makeGame(2);

        $this->connection->method('fetchFirstColumn')->willReturn([1, 2]);
        $this->gameRepository->method('findBy')->willReturn([$game1, $game2]);
        $this->recalcService->method('recalcForGame')
            ->willReturnCallback(static function (Game $game): void {
                if (2 === $game->getId()) {
                    throw new RuntimeException('Recalc fehlgeschlagen');
                }
            });

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::FAILURE, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('1 Fehler', $display);
    }

    // ── --all: alle abgeschlossenen Spiele ───────────────────────────────────

    public function testAllOptionRecalcsAllFinishedGames(): void
    {
        $game1 = $this->makeGame(1);
        $game2 = $this->makeGame(2);

        $this->gameRepository->expects($this->once())
            ->method('findBy')
            ->with(['isFinished' => true])
            ->willReturn([$game1, $game2]);

        $this->connection->expects($this->never())->method('fetchFirstColumn');
        $this->recalcService->expects($this->exactly(2))->method('recalcForGame');

        $exitCode = $this->commandTester->execute(['--all' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('2', $display);
        $this->assertStringContainsString('0 Fehler', $display);
    }

    public function testAllOptionSucceedsWhenNoGamesExist(): void
    {
        $this->gameRepository->method('findBy')->willReturn([]);
        $this->recalcService->expects($this->never())->method('recalcForGame');

        $exitCode = $this->commandTester->execute(['--all' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Keine Spiele zu verarbeiten', $this->commandTester->getDisplay());
    }

    public function testAllOptionReturnsFailureWhenGamesThrow(): void
    {
        $game = $this->makeGame(10);
        $this->gameRepository->method('findBy')->willReturn([$game]);
        $this->recalcService->method('recalcForGame')->willThrowException(new RuntimeException('boom'));

        $exitCode = $this->commandTester->execute(['--all' => true]);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('1 Fehler', $this->commandTester->getDisplay());
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private function makeGame(int $id): Game&MockObject
    {
        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn($id);

        return $game;
    }
}
