<?php

namespace App\Tests\Unit\Command;

use App\Command\SendUnsentNotificationsCommand;
use App\Entity\Notification;
use App\Entity\User;
use App\Repository\NotificationRepository;
use App\Service\HeartbeatService;
use App\Service\PushNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionProperty;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

class SendUnsentNotificationsCommandTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private NotificationRepository&MockObject $repo;
    private PushNotificationService&MockObject $pushService;
    private LoggerInterface&MockObject $logger;
    private HeartbeatService&MockObject $heartbeatService;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->repo = $this->createMock(NotificationRepository::class);
        $this->pushService = $this->createMock(PushNotificationService::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);

        $command = new SendUnsentNotificationsCommand(
            $this->em,
            $this->repo,
            $this->pushService,
            $this->logger,
            $this->heartbeatService,
        );

        $application = new Application();
        $application->addCommand($command);

        $this->commandTester = new CommandTester($application->find('app:notifications:send-unsent'));
    }

    // ======================================================================
    //  Happy path
    // ======================================================================

    public function testProcessesUnsentNotificationsAndMarksSent(): void
    {
        $user = $this->createMock(User::class);

        $notification1 = $this->createNotification($user, 'Title 1', 'Body 1', ['url' => '/news/1']);
        $notification2 = $this->createNotification($user, 'Title 2', 'Body 2', ['url' => '/messages/2']);

        $this->repo->method('findUnsent')->willReturn([$notification1, $notification2]);

        $this->pushService->expects($this->exactly(2))
            ->method('sendNotification');

        $this->em->expects($this->exactly(2))->method('persist');
        // flush called: once for batch + once for final flush (batch=20, 2 items means 1 final flush only)
        $this->em->expects($this->atLeastOnce())->method('flush');

        $this->commandTester->execute([]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $this->assertTrue($notification1->isSent());
        $this->assertTrue($notification2->isSent());
        $this->assertStringContainsString('Processed 2 notifications', $this->commandTester->getDisplay());
    }

    public function testExitsSuccessfullyWhenNoUnsentNotifications(): void
    {
        $this->repo->method('findUnsent')->willReturn([]);

        $this->pushService->expects($this->never())->method('sendNotification');

        $this->commandTester->execute([]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $this->assertStringContainsString('No unsent notifications', $this->commandTester->getDisplay());
    }

    // ======================================================================
    //  URL extraction
    // ======================================================================

    public function testExtractsUrlFromNotificationData(): void
    {
        $user = $this->createMock(User::class);
        $notification = $this->createNotification($user, 'Title', 'Body', ['url' => '/games/5']);

        $this->repo->method('findUnsent')->willReturn([$notification]);

        $this->pushService->expects($this->once())
            ->method('sendNotification')
            ->with($user, 'Title', 'Body', '/games/5');

        $this->commandTester->execute([]);
    }

    public function testDefaultsToSlashWhenNoUrl(): void
    {
        $user = $this->createMock(User::class);
        $notification = $this->createNotification($user, 'Title', 'Body', null);

        $this->repo->method('findUnsent')->willReturn([$notification]);

        $this->pushService->expects($this->once())
            ->method('sendNotification')
            ->with($user, 'Title', 'Body', '/');

        $this->commandTester->execute([]);
    }

    // ======================================================================
    //  Error handling
    // ======================================================================

    public function testContinuesProcessingWhenSinglePushFails(): void
    {
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);

        $notification1 = $this->createNotification($user1, 'N1', 'B1', ['url' => '/a']);
        $notification2 = $this->createNotification($user2, 'N2', 'B2', ['url' => '/b']);

        $this->repo->method('findUnsent')->willReturn([$notification1, $notification2]);

        // First call throws, second succeeds
        $this->pushService->expects($this->exactly(2))
            ->method('sendNotification')
            ->willReturnCallback(function (User $u, string $title) {
                if ('N1' === $title) {
                    throw new Exception('Network error');
                }

                return [
                    'attempted' => 1,
                    'successful' => 1,
                    'failed' => 0,
                ];
            });

        $this->logger->expects($this->once())->method('error');

        $this->commandTester->execute([]);

        // Command still succeeds overall
        $this->assertSame(0, $this->commandTester->getStatusCode());
        // First notification NOT marked as sent
        $this->assertFalse($notification1->isSent());
        // Second IS marked as sent
        $this->assertTrue($notification2->isSent());
    }

    public function testRespectsLimitOption(): void
    {
        $this->repo->expects($this->once())
            ->method('findUnsent')
            ->with(10)
            ->willReturn([]);

        $this->commandTester->execute(['--limit' => 10]);
    }

    // ======================================================================
    //  Helpers
    // ======================================================================

    private static int $nextId = 1;

    /** @param array<string, mixed>|null $data */
    private function createNotification(User&MockObject $user, string $title, string $body, ?array $data): Notification
    {
        $notification = new Notification();
        $notification->setUser($user);
        $notification->setTitle($title);
        $notification->setMessage($body);
        $notification->setData($data);
        $notification->setIsSent(false);

        // Set ID via reflection (normally set by DB auto-increment)
        $ref = new ReflectionProperty(Notification::class, 'id');
        $ref->setValue($notification, self::$nextId++);

        return $notification;
    }
}
