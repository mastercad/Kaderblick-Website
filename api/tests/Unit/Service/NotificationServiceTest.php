<?php

namespace App\Tests\Unit\Service;

use App\Entity\Notification;
use App\Entity\User;
use App\Repository\NotificationRepository;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class NotificationServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private NotificationRepository&MockObject $repo;
    private NotificationService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->repo = $this->createMock(NotificationRepository::class);

        // PushNotificationService is intentionally NOT injected — push is handled
        // asynchronously by the cron job app:notifications:send-unsent.
        $this->service = new NotificationService(
            $this->em,
            $this->repo
        );
    }

    // ======================================================================
    //  createNotification — single user
    // ======================================================================

    public function testCreateNotificationPersistsEntity(): void
    {
        $user = $this->createMock(User::class);

        $this->em->expects($this->once())->method('persist')->with($this->isInstanceOf(Notification::class));
        $this->em->expects($this->once())->method('flush');

        $notification = $this->service->createNotification(
            $user,
            'news',
            'Test Title',
            'Test Body',
            ['url' => '/test/url']
        );

        $this->assertInstanceOf(Notification::class, $notification);
        $this->assertSame('news', $notification->getType());
        $this->assertSame('Test Title', $notification->getTitle());
        $this->assertSame('Test Body', $notification->getMessage());
    }

    /**
     * Regression: push must NOT be sent synchronously inside the HTTP request.
     * isSent stays false — the cron job app:notifications:send-unsent handles delivery.
     */
    public function testCreateNotificationDoesNotSendPushSynchronously(): void
    {
        $user = $this->createMock(User::class);

        // Only ONE flush: after persist. The old code called flush twice (second time
        // after setting isSent=true on push success). One flush proves no sync push happened.
        $this->em->expects($this->once())->method('flush');

        $notification = $this->service->createNotification($user, 'news', 'Title', 'Body');

        $this->assertFalse(
            $notification->isSent(),
            'isSent must be false — push delivery is deferred to the cron job'
        );
    }

    public function testCreateNotificationWithNullMessageAndData(): void
    {
        $user = $this->createMock(User::class);

        $notification = $this->service->createNotification($user, 'system', 'Title only');

        $this->assertNull($notification->getMessage());
        $this->assertNull($notification->getData());
        $this->assertFalse($notification->isSent());
    }

    public function testCreateNotificationStoresDataArray(): void
    {
        $user = $this->createMock(User::class);
        $data = ['newsId' => 42, 'url' => '/news/42'];

        $notification = $this->service->createNotification($user, 'news', 'Title', null, $data);

        $this->assertSame($data, $notification->getData());
    }

    public function testCreateNotificationSetsUser(): void
    {
        $user = $this->createMock(User::class);

        $notification = $this->service->createNotification($user, 'news', 'Title');

        $this->assertSame($user, $notification->getUser());
    }

    // ======================================================================
    //  createNotificationForUsers — multiple users
    // ======================================================================

    public function testCreateNotificationForUsersCreatesOneEntityPerUser(): void
    {
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);
        $user3 = $this->createMock(User::class);

        $this->em->expects($this->exactly(3))->method('persist');
        // Single flush after all persists — not one per user
        $this->em->expects($this->once())->method('flush');

        $notifications = $this->service->createNotificationForUsers(
            [$user1, $user2, $user3],
            'news',
            'Neue Nachricht',
            'Details...',
            ['url' => '/news/1']
        );

        $this->assertCount(3, $notifications);
    }

    /**
     * Regression: no synchronous push for any user in the multi-user variant either.
     */
    public function testCreateNotificationForUsersDoesNotSendPushSynchronously(): void
    {
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);

        // Single flush — proves no per-user isSent=true + flush cycle
        $this->em->expects($this->once())->method('flush');

        $notifications = $this->service->createNotificationForUsers(
            [$user1, $user2],
            'news',
            'Title',
            'Body',
            ['url' => '/news/1']
        );

        foreach ($notifications as $notification) {
            $this->assertFalse(
                $notification->isSent(),
                'isSent must be false — cron will deliver push asynchronously'
            );
        }
    }

    public function testCreateNotificationForUsersHandlesEmptyArray(): void
    {
        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $result = $this->service->createNotificationForUsers([], 'news', 'T');
        $this->assertSame([], $result);
    }

    public function testCreateNotificationForUsersSetsCorrectFieldsOnEachEntity(): void
    {
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);

        $notifications = $this->service->createNotificationForUsers(
            [$user1, $user2],
            'participation',
            'Teilnahme',
            'Du hast zugesagt',
            ['url' => '/games/5']
        );

        $this->assertSame($user1, $notifications[0]->getUser());
        $this->assertSame($user2, $notifications[1]->getUser());

        foreach ($notifications as $notification) {
            $this->assertSame('participation', $notification->getType());
            $this->assertSame('Teilnahme', $notification->getTitle());
            $this->assertSame('Du hast zugesagt', $notification->getMessage());
            $this->assertSame(['url' => '/games/5'], $notification->getData());
            $this->assertFalse($notification->isSent());
        }
    }

    // ======================================================================
    //  Convenience methods — createNewsNotification, createMessageNotification
    // ======================================================================

    public function testCreateNewsNotificationSetsCorrectTypeAndTitle(): void
    {
        $user = $this->createMock(User::class);

        $notification = $this->service->createNewsNotification($user, 'Breaking News', 'Short text', 42);

        $this->assertSame('news', $notification->getType());
        $this->assertSame('Neue Nachricht: Breaking News', $notification->getTitle());
        $this->assertSame('Short text', $notification->getMessage());
        $this->assertSame(['newsId' => 42, 'url' => '/news/42'], $notification->getData());
        $this->assertFalse($notification->isSent());
    }

    public function testCreateMessageNotificationSetsCorrectTypeAndDeepLinkUrl(): void
    {
        $user = $this->createMock(User::class);

        $notification = $this->service->createMessageNotification($user, 'Max', 'RE: Training', 99);

        $this->assertSame('message', $notification->getType());
        $this->assertSame('Neue Nachricht von Max', $notification->getTitle());
        $this->assertSame('RE: Training', $notification->getMessage());
        $this->assertSame(
            ['messageId' => 99, 'url' => '/?modal=messages&messageId=99'],
            $notification->getData()
        );
        $this->assertFalse($notification->isSent());
    }

    public function testCreateMessageNotificationDeepLinkContainsCorrectMessageId(): void
    {
        $user = $this->createMock(User::class);

        $notification = $this->service->createMessageNotification($user, 'Jana', 'Spielplan', 7);

        $data = $notification->getData();
        $this->assertSame(7, $data['messageId']);
        $this->assertStringContainsString('modal=messages', $data['url']);
        $this->assertStringContainsString('messageId=7', $data['url']);
        // Regression: die alte Direktroute /messages/{id} darf nicht mehr verwendet werden
        $this->assertStringNotContainsString('/messages/7', $data['url']);
    }
}
