<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\ProcessPendingXpCommand;
use App\Service\HeartbeatService;
use App\Service\XPEventProcessor;
use Exception;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class ProcessPendingXpCommandTest extends TestCase
{
    private XPEventProcessor&MockObject $xpEventProcessor;
    private LoggerInterface&MockObject $logger;
    private HeartbeatService&MockObject $heartbeatService;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->xpEventProcessor = $this->createMock(XPEventProcessor::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);

        $command = new ProcessPendingXpCommand($this->xpEventProcessor, $this->logger);
        $command->setHeartbeatService($this->heartbeatService);

        $application = new Application();
        $application->addCommand($command);

        $this->commandTester = new CommandTester($command);
    }

    public function testCommandSucceedsWhenProcessingSucceeds(): void
    {
        $this->xpEventProcessor->expects($this->once())
            ->method('processPendingXpEvents');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Successfully processed all pending XP events', $this->commandTester->getDisplay());
    }

    public function testCommandReturnsFailureWhenExceptionIsThrown(): void
    {
        $this->xpEventProcessor->method('processPendingXpEvents')
            ->willThrowException(new Exception('Database connection lost'));

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('Error processing pending XP events', $this->commandTester->getDisplay());
        $this->assertStringContainsString('Database connection lost', $this->commandTester->getDisplay());
    }

    public function testHeartbeatIsCalledOnSuccess(): void
    {
        $this->heartbeatService->expects($this->once())
            ->method('beat')
            ->with('app:xp:process-pending');

        $this->commandTester->execute([]);
    }

    public function testHeartbeatIsNotCalledOnFailure(): void
    {
        $this->xpEventProcessor->method('processPendingXpEvents')
            ->willThrowException(new Exception('fail'));

        $this->heartbeatService->expects($this->never())
            ->method('beat');

        $this->commandTester->execute([]);
    }

    public function testErrorIsLoggedOnException(): void
    {
        $this->xpEventProcessor->method('processPendingXpEvents')
            ->willThrowException(new Exception('Connection error'));

        $this->logger->expects($this->atLeastOnce())
            ->method('error');

        $this->commandTester->execute([]);
    }

    public function testInfoIsLoggedOnStart(): void
    {
        $this->logger->expects($this->atLeastOnce())
            ->method('info');

        $this->commandTester->execute([]);
    }
}
