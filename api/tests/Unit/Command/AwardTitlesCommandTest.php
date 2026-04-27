<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\AwardTitlesCommand;
use App\Service\GoalCountingService;
use App\Service\HeartbeatService;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class AwardTitlesCommandTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private TitleCalculationService&MockObject $titleCalculationService;
    private GoalCountingService&MockObject $goalCountingService;
    private HeartbeatService&MockObject $heartbeatService;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->titleCalculationService = $this->createMock(TitleCalculationService::class);
        $this->goalCountingService = $this->createMock(GoalCountingService::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);

        $this->titleCalculationService->method('retrieveCurrentSeason')->willReturn('2024/2025');
        $this->titleCalculationService->method('debugGoalsForSeason')->willReturn([]);
        $this->titleCalculationService->method('calculatePlatformTopScorers')->willReturn([]);
        $this->titleCalculationService->method('calculateAllTeamTopScorers')->willReturn([]);
        $this->titleCalculationService->method('calculateLeagueTopScorers')->willReturn([]);

        $command = new AwardTitlesCommand(
            $this->entityManager,
            $this->titleCalculationService,
            $this->goalCountingService,
        );
        $command->setHeartbeatService($this->heartbeatService);

        $application = new Application();
        $application->addCommand($command);

        $this->commandTester = new CommandTester($command);
    }

    public function testCommandSucceedsWithDefaultSeason(): void
    {
        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('2024/2025', $this->commandTester->getDisplay());
    }

    public function testCommandUsesProvidedSeasonOption(): void
    {
        $exitCode = $this->commandTester->execute(['--season' => '2023/2024']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('2023/2024', $this->commandTester->getDisplay());
    }

    public function testCurrentSeasonIsRetrievedWhenNoSeasonOptionGiven(): void
    {
        $this->titleCalculationService->expects($this->once())
            ->method('retrieveCurrentSeason')
            ->willReturn('2024/2025');

        $this->commandTester->execute([]);
    }

    public function testDryRunSuppressesHeartbeat(): void
    {
        $this->heartbeatService->expects($this->never())
            ->method('beat');

        $exitCode = $this->commandTester->execute(['--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testDryRunClearsEntityManager(): void
    {
        $this->entityManager->expects($this->once())
            ->method('clear');

        $this->commandTester->execute(['--dry-run' => true]);
    }

    public function testDryRunOutputContainsDryRunWarning(): void
    {
        $exitCode = $this->commandTester->execute(['--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('DRY-RUN', $this->commandTester->getDisplay());
    }

    public function testNormalRunDoesNotClearEntityManager(): void
    {
        $this->entityManager->expects($this->never())
            ->method('clear');

        $this->commandTester->execute([]);
    }

    public function testHeartbeatIsCalledOnNormalSuccess(): void
    {
        $this->heartbeatService->expects($this->once())
            ->method('beat')
            ->with('app:xp:award-titles');

        $this->commandTester->execute([]);
    }

    public function testAllTitleCalculationMethodsAreCalled(): void
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

        $this->commandTester->execute([]);
    }
}
