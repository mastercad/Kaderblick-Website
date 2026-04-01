<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\PushController;
use App\Entity\PushSubscription;
use App\Entity\User;
use App\Repository\NotificationRepository;
use App\Repository\PushSubscriptionRepository;
use App\Service\PushNotificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class PushControllerTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private PushSubscriptionRepository&MockObject $repo;
    private ParameterBagInterface&MockObject $params;
    private PushNotificationService&MockObject $pushService;
    private NotificationRepository&MockObject $notificationRepo;
    private PushController $controller;
    private User&MockObject $user;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->repo = $this->createMock(PushSubscriptionRepository::class);
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->pushService = $this->createMock(PushNotificationService::class);
        $this->notificationRepo = $this->createMock(NotificationRepository::class);

        $this->controller = new PushController(
            $this->em,
            $this->repo,
            $this->params,
            $this->pushService,
            $this->notificationRepo,
        );

        $this->user = $this->createMock(User::class);
        $this->user->method('getId')->willReturn(1);

        // Set up security token for getUser()
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        // Use a minimal container to provide getUser() support
        $container = new \Symfony\Component\DependencyInjection\ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);

        $this->controller->setContainer($container);
    }

    // ======================================================================
    //  GET /api/push/vapid-key
    // ======================================================================

    public function testGetVapidKeyReturnsKey(): void
    {
        $this->params->method('get')
            ->with('vapid_public_key')
            ->willReturn('BPnJRyYb34t...');

        $response = $this->controller->getVapidKey();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertArrayHasKey('key', $data);
        $this->assertSame('BPnJRyYb34t...', $data['key']);
    }

    public function testGetVapidKeyReturns500WhenNotConfigured(): void
    {
        $this->params->method('get')
            ->with('vapid_public_key')
            ->willReturn(null);

        $response = $this->controller->getVapidKey();

        $this->assertSame(500, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertSame('VAPID key not configured', $data['error']);
    }

    // ======================================================================
    //  POST /api/push/subscribe
    // ======================================================================

    public function testSubscribeCreatesNewSubscription(): void
    {
        $this->repo->method('findOneBy')->willReturn(null);

        $this->em->expects($this->once())->method('persist')
            ->with($this->callback(function (PushSubscription $sub) {
                return 'https://fcm.googleapis.com/test-endpoint' === $sub->getEndpoint()
                    && true === $sub->isActive();
            }));
        $this->em->expects($this->once())->method('flush');

        $request = new Request([], [], [], [], [], [], json_encode([
            'subscription' => [
                'endpoint' => 'https://fcm.googleapis.com/test-endpoint',
                'keys' => [
                    'p256dh' => 'p256dh-key-value',
                    'auth' => 'auth-key-value'
                ]
            ]
        ]));

        $response = $this->controller->subscribe($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Push subscription created successfully', $data['message']);
    }

    public function testSubscribeReturnsAlreadySubscribed(): void
    {
        $existing = new PushSubscription();
        $this->repo->method('findOneBy')->willReturn($existing);

        // Must NOT persist or flush
        $this->em->expects($this->never())->method('persist');

        $request = new Request([], [], [], [], [], [], json_encode([
            'subscription' => [
                'endpoint' => 'https://fcm.googleapis.com/existing-endpoint',
                'keys' => ['p256dh' => 'x', 'auth' => 'y']
            ]
        ]));

        $response = $this->controller->subscribe($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Already subscribed', $data['message']);
    }

    public function testSubscribeReturns400OnMissingData(): void
    {
        $request = new Request([], [], [], [], [], [], json_encode(['bad' => true]));

        $response = $this->controller->subscribe($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertSame('Invalid subscription data', $data['error']);
    }

    // ======================================================================
    //  POST /api/push/unsubscribe
    // ======================================================================

    public function testUnsubscribeRemovesExistingSubscription(): void
    {
        $existing = new PushSubscription();
        $this->repo->method('findOneBy')->willReturn($existing);

        $this->em->expects($this->once())->method('remove')->with($existing);
        $this->em->expects($this->once())->method('flush');

        $request = new Request([], [], [], [], [], [], json_encode([
            'subscription' => ['endpoint' => 'https://fcm.googleapis.com/test']
        ]));

        $response = $this->controller->unsubscribe($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Push subscription removed successfully', $data['message']);
    }

    public function testUnsubscribeHandlesNonExistentSubscription(): void
    {
        $this->repo->method('findOneBy')->willReturn(null);

        $this->em->expects($this->never())->method('remove');

        $request = new Request([], [], [], [], [], [], json_encode([
            'subscription' => ['endpoint' => 'https://fcm.googleapis.com/unknown']
        ]));

        $response = $this->controller->unsubscribe($request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testUnsubscribeReturns400OnMissingEndpoint(): void
    {
        $request = new Request([], [], [], [], [], [], json_encode(['subscription' => ['bad' => true]]));

        $response = $this->controller->unsubscribe($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ======================================================================
    //  GET /api/push/subscriptions
    // ======================================================================

    public function testGetSubscriptionsReturnsList(): void
    {
        $sub1 = new PushSubscription();
        $sub1->setEndpoint('https://endpoint1.example.com');
        $sub1->setCreatedAt(new DateTime('2024-01-01 10:00:00'));

        $sub2 = new PushSubscription();
        $sub2->setEndpoint('https://endpoint2.example.com');
        $sub2->setCreatedAt(new DateTime('2024-06-15 14:30:00'));

        $this->repo->method('findBy')->willReturn([$sub1, $sub2]);

        $response = $this->controller->getSubscriptions();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(2, $data['subscriptions']);
        $this->assertSame('https://endpoint1.example.com', $data['subscriptions'][0]['endpoint']);
        $this->assertSame('2024-06-15 14:30:00', $data['subscriptions'][1]['createdAt']);
    }

    public function testGetSubscriptionsReturnsEmptyWhenNone(): void
    {
        $this->repo->method('findBy')->willReturn([]);

        $response = $this->controller->getSubscriptions();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(0, $data['subscriptions']);
    }

    public function testHealthDoesNotReportAllDeliveriesFailedWhenRecentPushSucceeded(): void
    {
        $subscription = new PushSubscription();

        $this->params->method('get')
            ->with('vapid_public_key')
            ->willReturn('test-vapid-key');

        $this->repo->method('findBy')->willReturn([$subscription]);

        $this->notificationRepo->expects($this->once())
            ->method('getPushDeliveryStats')
            ->with($this->user, 7)
            ->willReturn([
                'total' => 3,
                'sent' => 0,
                'unsent' => 3,
                'failRate' => 100.0,
            ]);

        $this->notificationRepo->expects($this->once())
            ->method('findUnsentByUser')
            ->with($this->user)
            ->willReturn([]);

        $this->user->method('getLastPushSuccessAt')->willReturn(new DateTime('-5 minutes'));
        $this->user->method('getLastPushFailureAt')->willReturn(new DateTime('-1 minute'));

        $response = $this->controller->health();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertContains('notification_queue_stuck', $data['issues']);
        $this->assertNotContains('all_deliveries_failed', $data['issues']);
    }

    public function testHealthTreatsSingleUnsentNotificationAsQueueIssueNotTotalFailure(): void
    {
        $subscription = new PushSubscription();

        $this->params->method('get')
            ->with('vapid_public_key')
            ->willReturn('test-vapid-key');

        $this->repo->method('findBy')->willReturn([$subscription]);

        $this->notificationRepo->expects($this->once())
            ->method('getPushDeliveryStats')
            ->with($this->user, 7)
            ->willReturn([
                'total' => 1,
                'sent' => 0,
                'unsent' => 1,
                'failRate' => 100.0,
            ]);

        $this->notificationRepo->expects($this->once())
            ->method('findLastSentForUser')
            ->with($this->user)
            ->willReturn(null);

        $this->notificationRepo->expects($this->once())
            ->method('findUnsentByUser')
            ->with($this->user)
            ->willReturn([new stdClass()]);

        $this->user->method('getLastPushSuccessAt')->willReturn(null);
        $this->user->method('getLastPushFailureAt')->willReturn(null);

        $response = $this->controller->health();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertContains('notification_queue_stuck', $data['issues']);
        $this->assertNotContains('all_deliveries_failed', $data['issues']);
        $this->assertNotContains('high_failure_rate', $data['issues']);
    }
}
