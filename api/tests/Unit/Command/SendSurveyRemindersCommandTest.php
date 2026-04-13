<?php

namespace App\Tests\Unit\Command;

use App\Command\SendSurveyRemindersCommand;
use App\Entity\Survey;
use App\Repository\SurveyRepository;
use App\Service\HeartbeatService;
use App\Service\SurveyNotificationService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use RuntimeException;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class SendSurveyRemindersCommandTest extends TestCase
{
    private SurveyRepository&MockObject $surveyRepository;
    private SurveyNotificationService&MockObject $notificationService;
    private LoggerInterface&MockObject $logger;
    private HeartbeatService&MockObject $heartbeatService;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->surveyRepository = $this->createMock(SurveyRepository::class);
        $this->notificationService = $this->createMock(SurveyNotificationService::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);

        $command = new SendSurveyRemindersCommand(
            $this->surveyRepository,
            $this->notificationService,
            $this->logger,
            $this->heartbeatService,
        );

        $application = new Application();
        $application->addCommand($command);

        $this->commandTester = new CommandTester($command);
    }

    public function testCommandSucceedsWithNoSurveys(): void
    {
        $this->surveyRepository->method('findSurveysNeedingReminders')->willReturn([]);

        $exitCode = $this->commandTester->execute([]);

        $this->assertEquals(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Found 0 active surveys', $this->commandTester->getDisplay());
    }

    public function testCommandProcessesSurveysNeedingReminders(): void
    {
        $survey = $this->createSurveyWithId(1, 'Test Survey');

        $this->surveyRepository->method('findSurveysNeedingReminders')->willReturn([$survey]);

        $this->notificationService->method('getApplicableReminderKey')
            ->with($survey)
            ->willReturn('3_days');

        $this->notificationService->expects($this->once())
            ->method('sendSurveyReminder')
            ->with($survey, '3_days')
            ->willReturn(5);

        $exitCode = $this->commandTester->execute([]);

        $this->assertEquals(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Reminded 5 users', $this->commandTester->getDisplay());
        $this->assertStringContainsString('Processed 1 surveys', $this->commandTester->getDisplay());
    }

    public function testCommandSkipsSurveysWithNoApplicableReminder(): void
    {
        $survey = $this->createSurveyWithId(1, 'Test Survey');

        $this->surveyRepository->method('findSurveysNeedingReminders')->willReturn([$survey]);

        $this->notificationService->method('getApplicableReminderKey')
            ->with($survey)
            ->willReturn(null);

        $this->notificationService->expects($this->never())
            ->method('sendSurveyReminder');

        $exitCode = $this->commandTester->execute([]);

        $this->assertEquals(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 surveys', $this->commandTester->getDisplay());
    }

    public function testCommandHandlesMultipleSurveys(): void
    {
        $survey1 = $this->createSurveyWithId(1, 'Survey A');
        $survey2 = $this->createSurveyWithId(2, 'Survey B');

        $this->surveyRepository->method('findSurveysNeedingReminders')
            ->willReturn([$survey1, $survey2]);

        $this->notificationService->method('getApplicableReminderKey')
            ->willReturnMap([
                [$survey1, '1_day'],
                [$survey2, '3_hours'],
            ]);

        $this->notificationService->method('sendSurveyReminder')
            ->willReturnMap([
                [$survey1, '1_day', 3],
                [$survey2, '3_hours', 8],
            ]);

        $exitCode = $this->commandTester->execute([]);

        $this->assertEquals(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 2 surveys', $this->commandTester->getDisplay());
        $this->assertStringContainsString('11 users total', $this->commandTester->getDisplay());
    }

    public function testCommandHandlesExceptionGracefully(): void
    {
        $survey = $this->createSurveyWithId(1, 'Failing Survey');

        $this->surveyRepository->method('findSurveysNeedingReminders')->willReturn([$survey]);

        $this->notificationService->method('getApplicableReminderKey')
            ->willReturn('3_days');

        $this->notificationService->method('sendSurveyReminder')
            ->willThrowException(new RuntimeException('Database error'));

        $this->logger->expects($this->once())
            ->method('error')
            ->with('Failed to send survey reminder', $this->anything());

        $exitCode = $this->commandTester->execute([]);

        $this->assertEquals(Command::SUCCESS, $exitCode);
    }

    public function testCommandName(): void
    {
        $command = new SendSurveyRemindersCommand(
            $this->surveyRepository,
            $this->notificationService,
            $this->logger,
            $this->heartbeatService,
        );

        $this->assertEquals('app:surveys:send-reminders', $command->getName());
    }

    private function createSurveyWithId(int $id, string $title): Survey
    {
        $survey = new Survey();
        $survey->setTitle($title);

        $reflection = new ReflectionClass($survey);
        $idProperty = $reflection->getProperty('id');
        $idProperty->setValue($survey, $id);

        return $survey;
    }
}
