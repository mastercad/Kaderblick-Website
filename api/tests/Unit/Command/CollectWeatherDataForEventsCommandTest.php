<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\CollectWeatherDataForEventsCommand;
use App\Service\HeartbeatService;
use App\Service\WeatherService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class CollectWeatherDataForEventsCommandTest extends TestCase
{
    private MockObject $weatherService;
    private HeartbeatService&MockObject $heartbeatService;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->weatherService = $this->createMock(WeatherService::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);

        $command = new CollectWeatherDataForEventsCommand($this->weatherService);
        $command->setHeartbeatService($this->heartbeatService);

        $application = new Application();
        $application->addCommand($command);

        $this->commandTester = new CommandTester($command);
    }

    public function testCommandSucceedsAndCallsRetrieveWeatherData(): void
    {
        $this->weatherService->expects($this->once())
            ->method('retrieveWeatherData');

        $exitCode = $this->commandTester->execute([]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Weather data has been collected', $this->commandTester->getDisplay());
    }

    public function testHeartbeatIsCalledOnSuccess(): void
    {
        $this->heartbeatService->expects($this->once())
            ->method('beat')
            ->with('app:collect-weather-data-for-events');

        $this->commandTester->execute([]);
    }

    public function testClearRunningIsAlwaysCalled(): void
    {
        $this->heartbeatService->expects($this->once())
            ->method('clearRunning')
            ->with('app:collect-weather-data-for-events');

        $this->commandTester->execute([]);
    }
}
