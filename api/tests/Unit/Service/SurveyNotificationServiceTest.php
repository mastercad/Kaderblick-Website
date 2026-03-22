<?php

namespace App\Tests\Unit\Service;

use App\Entity\Survey;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\NotificationService;
use App\Service\SurveyNotificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionClass;

#[AllowMockObjectsWithoutExpectations]
class SurveyNotificationServiceTest extends TestCase
{
    private SurveyNotificationService $service;
    private EntityManagerInterface&MockObject $entityManager;
    private NotificationService&MockObject $notificationService;
    private UserRepository&MockObject $userRepository;
    private LoggerInterface&MockObject $logger;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->notificationService = $this->createMock(NotificationService::class);
        $this->userRepository = $this->createMock(UserRepository::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $this->service = new SurveyNotificationService(
            $this->entityManager,
            $this->notificationService,
            $this->userRepository,
            $this->logger
        );
    }

    // --- REMINDER THRESHOLDS ---

    public function testReminderThresholdsExist(): void
    {
        $this->assertArrayHasKey('7_days', SurveyNotificationService::REMINDER_THRESHOLDS);
        $this->assertArrayHasKey('3_days', SurveyNotificationService::REMINDER_THRESHOLDS);
        $this->assertArrayHasKey('1_day', SurveyNotificationService::REMINDER_THRESHOLDS);
        $this->assertArrayHasKey('3_hours', SurveyNotificationService::REMINDER_THRESHOLDS);
    }

    public function testReminderThresholdsAreEscalating(): void
    {
        $thresholds = SurveyNotificationService::REMINDER_THRESHOLDS;
        $this->assertGreaterThan($thresholds['3_days'], $thresholds['7_days']);
        $this->assertGreaterThan($thresholds['1_day'], $thresholds['3_days']);
        $this->assertGreaterThan($thresholds['3_hours'], $thresholds['1_day']);
    }

    // --- getApplicableReminderKey ---

    public function testGetApplicableReminderKeyReturnsNullWithoutDueDate(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');

        $result = $this->service->getApplicableReminderKey($survey);

        $this->assertNull($result);
    }

    public function testGetApplicableReminderKeyReturnsNullForExpiredSurvey(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('-1 hour'));

        $result = $this->service->getApplicableReminderKey($survey);

        $this->assertNull($result);
    }

    public function testGetApplicableReminderKeyReturnsNullWhenFarFromDue(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+30 days'));

        $result = $this->service->getApplicableReminderKey($survey);

        $this->assertNull($result);
    }

    public function testGetApplicableReminderKeyReturns7DaysWhenWithin7Days(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+6 days'));

        $result = $this->service->getApplicableReminderKey($survey);

        // 6 days = 144 hours. Sorted ascending: 3h, 24h, 72h, 168h
        // 144 <= 3? no. 144 <= 24? no. 144 <= 72? no. 144 <= 168? yes → 7_days
        $this->assertEquals('7_days', $result);
    }

    public function testGetApplicableReminderKeyReturns7DaysWhenExactly6Days(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        // 6 days = 144 hours, which is <= 168 (7 days threshold)
        $survey->setDueDate(new DateTime('+144 hours'));

        $result = $this->service->getApplicableReminderKey($survey);

        // 144h is <= 168h, so 7_days applies. Also <= 72? No, 144 > 72.
        // So the most urgent applicable is 7_days? Wait, the code sorts ascending and picks first match.
        // Sorted: 3_hours(3), 1_day(24), 3_days(72), 7_days(168)
        // 144 <= 3? no. 144 <= 24? no. 144 <= 72? no. 144 <= 168? yes → 7_days
        $this->assertEquals('7_days', $result);
    }

    public function testGetApplicableReminderKeyReturns3DaysWhenWithin3Days(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+2 days'));

        $result = $this->service->getApplicableReminderKey($survey);

        // 48h <= 3? no. 48h <= 24? no. 48h <= 72? yes → 3_days as most urgent
        // But 3_hours and 1_day not yet applicable. So the service iterates ascending:
        // 3h: 48 <= 3? no
        // 24h: 48 <= 24? no
        // 72h: 48 <= 72? yes → returns 3_days
        $this->assertEquals('3_days', $result);
    }

    public function testGetApplicableReminderKeyReturns1DayWhenWithin1Day(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+20 hours'));

        $result = $this->service->getApplicableReminderKey($survey);

        // 20h <= 3? no. 20h <= 24? yes → 1_day
        $this->assertEquals('1_day', $result);
    }

    public function testGetApplicableReminderKeyReturns3HoursWhenWithin3Hours(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+2 hours'));

        $result = $this->service->getApplicableReminderKey($survey);

        $this->assertEquals('3_hours', $result);
    }

    public function testGetApplicableReminderKeySkipsAlreadySentReminders(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+2 hours'));
        $survey->addReminderSent('3_hours');

        $result = $this->service->getApplicableReminderKey($survey);

        // 3_hours already sent, next applicable is 1_day (2h <= 24h? yes, not sent yet)
        $this->assertEquals('1_day', $result);
    }

    public function testGetApplicableReminderKeyReturnsNullWhenAllSent(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setDueDate(new DateTime('+2 hours'));
        $survey->addReminderSent('3_hours');
        $survey->addReminderSent('1_day');
        $survey->addReminderSent('3_days');
        $survey->addReminderSent('7_days');

        $result = $this->service->getApplicableReminderKey($survey);

        $this->assertNull($result);
    }

    // --- getTargetUsersForSurvey ---

    public function testGetTargetUsersForPlatformSurvey(): void
    {
        $survey = new Survey();
        $survey->setTitle('Platform Survey');
        $survey->setPlatform(true);

        $users = [$this->createUser(1), $this->createUser(2)];
        $this->userRepository->expects($this->once())
            ->method('findBy')
            ->with(['isEnabled' => true])
            ->willReturn($users);

        $result = $this->service->getTargetUsersForSurvey($survey);

        $this->assertCount(2, $result);
    }

    public function testGetTargetUsersForSurveyWithNoTarget(): void
    {
        $survey = new Survey();
        $survey->setTitle('Empty Survey');

        $result = $this->service->getTargetUsersForSurvey($survey);

        $this->assertEmpty($result);
    }

    // --- sendSurveyCreatedNotification ---

    public function testSendSurveyCreatedNotificationSkipsIfAlreadySent(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->setInitialNotificationSent(true);

        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $result = $this->service->sendSurveyCreatedNotification($survey);

        $this->assertEquals(0, $result);
    }

    public function testSendSurveyCreatedNotificationForPlatformSurvey(): void
    {
        $survey = $this->createSurveyWithId(1);
        $survey->setTitle('Test Survey');
        $survey->setPlatform(true);
        $survey->setDescription('Please fill out.');

        $users = [$this->createUser(1), $this->createUser(2)];
        $this->userRepository->expects($this->once())
            ->method('findBy')
            ->with(['isEnabled' => true])
            ->willReturn($users);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $users,
                'survey',
                'Neue Umfrage: Test Survey',
                $this->stringContains('Please fill out.'),
                $this->callback(fn ($data) => 1 === $data['surveyId'] && '/surveys/1' === $data['url'])
            );

        $this->entityManager->expects($this->once())->method('flush');

        $result = $this->service->sendSurveyCreatedNotification($survey);

        $this->assertEquals(2, $result);
        $this->assertTrue($survey->isInitialNotificationSent());
    }

    public function testSendSurveyCreatedNotificationWithDueDateShowsDate(): void
    {
        $survey = $this->createSurveyWithId(1);
        $survey->setTitle('Test');
        $survey->setPlatform(true);
        $survey->setDueDate(new DateTime('2026-04-15'));

        $users = [$this->createUser(1)];
        $this->userRepository->method('findBy')->willReturn($users);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->stringContains('15.04.2026'),
                $this->anything()
            );

        $this->entityManager->method('flush');

        $this->service->sendSurveyCreatedNotification($survey);
    }

    public function testSendSurveyCreatedNotificationReturnsZeroForNoUsers(): void
    {
        $survey = new Survey();
        $survey->setTitle('Empty');

        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $result = $this->service->sendSurveyCreatedNotification($survey);

        $this->assertEquals(0, $result);
    }

    // --- sendSurveyReminder ---

    public function testSendSurveyReminderSkipsIfAlreadySent(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->addReminderSent('3_days');

        $this->notificationService->expects($this->never())
            ->method('createNotificationForUsers');

        $result = $this->service->sendSurveyReminder($survey, '3_days');

        $this->assertEquals(0, $result);
    }

    // --- Survey entity reminder tracking ---

    public function testSurveyAddReminderSentDoesNotDuplicate(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');
        $survey->addReminderSent('3_days');
        $survey->addReminderSent('3_days');

        $this->assertCount(1, $survey->getRemindersSent());
    }

    public function testSurveyHasReminderBeenSent(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');

        $this->assertFalse($survey->hasReminderBeenSent('3_days'));

        $survey->addReminderSent('3_days');

        $this->assertTrue($survey->hasReminderBeenSent('3_days'));
        $this->assertFalse($survey->hasReminderBeenSent('1_day'));
    }

    public function testSurveyInitialNotificationSentDefault(): void
    {
        $survey = new Survey();
        $survey->setTitle('Test');

        $this->assertFalse($survey->isInitialNotificationSent());
    }

    // --- Helpers ---

    /** @param list<string> $roles */
    private function createUser(int $id, array $roles = ['ROLE_USER']): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    private function createSurveyWithId(int $id): Survey
    {
        $survey = new Survey();
        $survey->setTitle('Test');

        $reflection = new ReflectionClass($survey);
        $idProperty = $reflection->getProperty('id');
        $idProperty->setValue($survey, $id);

        return $survey;
    }
}
