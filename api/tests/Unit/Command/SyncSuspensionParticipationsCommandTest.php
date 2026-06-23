<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\SyncSuspensionParticipationsCommand;
use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Repository\PlayerSuspensionRepository;
use App\Service\SuspensionService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class SyncSuspensionParticipationsCommandTest extends TestCase
{
    private PlayerSuspensionRepository & MockObject $suspensionRepository;
    private SuspensionService & MockObject $suspensionService;
    private SyncSuspensionParticipationsCommand $command;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->suspensionRepository = $this->createMock(PlayerSuspensionRepository::class);
        $this->suspensionService = $this->createMock(SuspensionService::class);

        $this->command = new SyncSuspensionParticipationsCommand(
            $this->suspensionRepository,
            $this->suspensionService,
        );

        $this->commandTester = new CommandTester($this->command);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeSuspension(
        int $id = 1,
        bool $hasGame = true,
        string $firstName = 'Andreas',
        string $lastName = 'Wolf',
        string $reason = 'red_card',
        int $gamesSuspended = 1,
        string $competitionType = 'league',
        ?int $competitionId = 1,
    ): PlayerSuspension {
        $player = $this->createMock(Player::class);
        $player->method('getFirstName')->willReturn($firstName);
        $player->method('getLastName')->willReturn($lastName);

        $game = $hasGame ? $this->createMock(Game::class) : null;

        $suspension = $this->createMock(PlayerSuspension::class);
        $suspension->method('getId')->willReturn($id);
        $suspension->method('getPlayer')->willReturn($player);
        $suspension->method('getTriggeredByGame')->willReturn($game);
        $suspension->method('getReason')->willReturn($reason);
        $suspension->method('getGamesSuspended')->willReturn($gamesSuspended);
        $suspension->method('getCompetitionType')->willReturn($competitionType);
        $suspension->method('getCompetitionId')->willReturn($competitionId);

        return $suspension;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /**
     * Ohne Sperren: Command läuft durch, meldet 0 verarbeitet.
     */
    public function testCommandSucceedsWithNoActiveSuspensions(): void
    {
        $this->suspensionRepository->method('findAllActive')->willReturn([]);
        $this->suspensionService->expects($this->never())->method('syncParticipationsForSuspension');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Aktive Sperren gefunden: 0', $this->commandTester->getDisplay());
        $this->assertStringContainsString('0 Sperren verarbeitet', $this->commandTester->getDisplay());
    }

    /**
     * Eine aktive Sperre → syncParticipationsForSuspension wird genau einmal aufgerufen.
     */
    public function testCommandCallsSyncForEachActiveSuspension(): void
    {
        $suspension = $this->makeSuspension(1);

        $this->suspensionRepository->method('findAllActive')->willReturn([$suspension]);

        $this->suspensionService
            ->expects($this->once())
            ->method('syncParticipationsForSuspension')
            ->with($suspension);

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('1 Sperren verarbeitet', $this->commandTester->getDisplay());
        $this->assertStringContainsString('0 übersprungen', $this->commandTester->getDisplay());
    }

    /**
     * Mehrere Sperren → sync wird für jede aufgerufen.
     */
    public function testCommandCallsSyncForMultipleSuspensions(): void
    {
        $suspension1 = $this->makeSuspension(1);
        $suspension2 = $this->makeSuspension(2, firstName: 'Max', lastName: 'Muster');

        $this->suspensionRepository->method('findAllActive')->willReturn([$suspension1, $suspension2]);

        $this->suspensionService->expects($this->exactly(2))->method('syncParticipationsForSuspension');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('2 Sperren verarbeitet', $this->commandTester->getDisplay());
    }

    /**
     * Dry-run: sync wird NICHT aufgerufen, aber Output beschreibt die Sperren.
     */
    public function testDryRunDoesNotCallSync(): void
    {
        $suspension = $this->makeSuspension(1);

        $this->suspensionRepository->method('findAllActive')->willReturn([$suspension]);
        $this->suspensionService->expects($this->never())->method('syncParticipationsForSuspension');

        $exitCode = $this->commandTester->execute(['--dry-run' => true]);

        $this->assertSame(0, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('Dry-Run aktiv', $display);
        $this->assertStringContainsString('[DRY]', $display);
        $this->assertStringContainsString('würden verarbeitet werden', $display);
    }

    /**
     * Dry-run mit 0 Sperren: alles sauber, kein Fehler.
     */
    public function testDryRunWithNoSuspensionsReturnsSuccess(): void
    {
        $this->suspensionRepository->method('findAllActive')->willReturn([]);

        $exitCode = $this->commandTester->execute(['--dry-run' => true]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Dry-Run aktiv', $this->commandTester->getDisplay());
    }

    /**
     * Sperre ohne triggeredByGame → wird übersprungen (Warnung im Output, kein Fehler).
     */
    public function testCommandSkipsSuspensionWithoutTriggeredByGame(): void
    {
        $suspension = $this->makeSuspension(1, hasGame: false);

        $this->suspensionRepository->method('findAllActive')->willReturn([$suspension]);
        $this->suspensionService->expects($this->never())->method('syncParticipationsForSuspension');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(0, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('1 übersprungen', $display);
        $this->assertStringContainsString('kein triggeredByGame', $display);
    }

    /**
     * Mischung: eine gültige Sperre, eine ohne Game → 1 verarbeitet, 1 übersprungen.
     */
    public function testCommandHandlesMixedSuspensions(): void
    {
        $valid = $this->makeSuspension(1, hasGame: true);
        $invalid = $this->makeSuspension(2, hasGame: false);

        $this->suspensionRepository->method('findAllActive')->willReturn([$valid, $invalid]);

        $this->suspensionService
            ->expects($this->once())
            ->method('syncParticipationsForSuspension')
            ->with($valid);

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(0, $exitCode);
        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('1 Sperren verarbeitet', $display);
        $this->assertStringContainsString('1 übersprungen', $display);
    }

    /**
     * Output enthält Spieler-Namen, Grund und Wettbewerb-Infos für [SYNC]-Zeilen.
     */
    public function testCommandOutputContainsSuspensionDetails(): void
    {
        $suspension = $this->makeSuspension(
            id: 42,
            firstName: 'Klaus',
            lastName: 'Fischer',
            reason: 'yellow_red_card',
            gamesSuspended: 2,
            competitionType: 'cup',
            competitionId: 7,
        );

        $this->suspensionRepository->method('findAllActive')->willReturn([$suspension]);
        $this->suspensionService->method('syncParticipationsForSuspension');

        $this->commandTester->execute([]);

        $display = $this->commandTester->getDisplay();
        $this->assertStringContainsString('Klaus Fischer', $display);
        $this->assertStringContainsString('yellow_red_card', $display);
        $this->assertStringContainsString('cup/7', $display);
        $this->assertStringContainsString('[SYNC]', $display);
    }
}
