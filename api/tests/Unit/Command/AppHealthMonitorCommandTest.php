<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\AppHealthMonitorCommand;
use App\Service\AdminAlertService;
use App\Service\HeartbeatService;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

class AppHealthMonitorCommandTest extends TestCase
{
    private AdminAlertService&MockObject $alertService;
    private HeartbeatService&MockObject $heartbeatService;
    private Connection&MockObject $connection;
    private LoggerInterface&MockObject $cronLogger;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->alertService = $this->createMock(AdminAlertService::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);
        $this->connection = $this->createMock(Connection::class);
        $this->cronLogger = $this->createMock(LoggerInterface::class);

        // Use a non-existent dir so the disk-space check is skipped gracefully
        $command = new AppHealthMonitorCommand(
            $this->alertService,
            $this->heartbeatService,
            $this->connection,
            $this->cronLogger,
            '/tmp/health_monitor_test_nonexistent',
        );

        $application = new Application();
        $application->add($command);

        $this->commandTester = new CommandTester($command);
    }

    // ── Disk Space ────────────────────────────────────────────────────────

    public function testSucceedsWithNoIssuesAndEmptyQueue(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('0');

        $this->connection->method('executeQuery')->willReturn($dbResult);

        // All heartbeats fresh
        $this->heartbeatService->method('getLastBeat')
            ->willReturn(new DateTimeImmutable('@' . (time() - 60)));

        $exitCode = $this->commandTester->execute([]);

        // Disk dirs won't exist on CI, so no disk checks fire – queue + cron checks pass
        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('gesund', $this->commandTester->getDisplay());
    }

    // ── Queue check ───────────────────────────────────────────────────────

    public function testTriggersQueueAlertWhenFailedMessagesExist(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('5');

        $this->connection->method('executeQuery')->willReturn($dbResult);

        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        $this->alertService->expects($this->once())
            ->method('trackQueueFailure')
            ->with(5);

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('5 fehlgeschlagene', $this->commandTester->getDisplay());
    }

    public function testDoesNotTriggerQueueAlertWhenQueueIsEmpty(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('0');

        $this->connection->method('executeQuery')->willReturn($dbResult);

        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        $this->alertService->expects($this->never())->method('trackQueueFailure');

        $this->commandTester->execute([]);
    }

    public function testContinuesGracefullyWhenQueueTableMissing(): void
    {
        $this->connection->method('executeQuery')
            ->willThrowException(new RuntimeException('Table not found'));

        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        // No exception should propagate; command must not crash
        $exitCode = $this->commandTester->execute([]);
        $this->assertContains($exitCode, [Command::SUCCESS, Command::FAILURE]);
    }

    // ── Cron Heartbeat check ──────────────────────────────────────────────

    public function testTriggersCronAlertWhenHeartbeatIsStale(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('0');
        $this->connection->method('executeQuery')->willReturn($dbResult);

        // Return stale timestamp (2 hours ago) for xp:process-pending (max 60 min)
        $staleTimestamp = new DateTimeImmutable('@' . (time() - 7200));

        $this->heartbeatService->method('getLastBeat')
            ->willReturnCallback(static function (string $cmd) use ($staleTimestamp): ?DateTimeImmutable {
                return 'app:xp:process-pending' === $cmd ? $staleTimestamp : null;
            });

        $this->alertService->expects($this->once())
            ->method('trackCronFailure')
            ->with('app:xp:process-pending', $this->greaterThan(60));

        $this->commandTester->execute([]);
    }

    public function testDoesNotTriggerCronAlertWhenHeartbeatIsFresh(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('0');
        $this->connection->method('executeQuery')->willReturn($dbResult);

        // Recent timestamp – within all expected intervals
        $freshTimestamp = new DateTimeImmutable('@' . (time() - 60));

        $this->heartbeatService->method('getLastBeat')
            ->willReturn($freshTimestamp);

        $this->alertService->expects($this->never())->method('trackCronFailure');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testNoCronAlertWhenNoHeartbeatExistsYet(): void
    {
        $dbResult = $this->createMock(Result::class);
        $dbResult->method('fetchOne')->willReturn('0');
        $this->connection->method('executeQuery')->willReturn($dbResult);

        // No prior heartbeat at all (initial deployment)
        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        $this->alertService->expects($this->never())->method('trackCronFailure');

        $this->commandTester->execute([]);
    }
}
