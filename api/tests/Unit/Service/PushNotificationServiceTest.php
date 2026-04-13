<?php

namespace App\Tests\Unit\Service;

use App\Entity\PushSubscription;
use App\Entity\User;
use App\Service\PushNotificationService;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Generator;
use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\WebPush;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

#[AllowMockObjectsWithoutExpectations]
class PushNotificationServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private LoggerInterface&MockObject $logger;
    private ParameterBagInterface&MockObject $params;
    private WebPush&MockObject $webPush;
    private PushNotificationService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->webPush = $this->createMock(WebPush::class);

        $this->service = new PushNotificationService(
            $this->em,
            'test-public-key-base64',
            'test-private-key-base64',
            $this->params,
            $this->logger
        );

        // Inject the mock WebPush (avoids real VAPID init)
        $this->service->setWebPush($this->webPush);
    }

    // ======================================================================
    //  HAPPY PATH
    // ======================================================================

    public function testSendNotificationWithSingleSubscription(): void
    {
        $sub = $this->createPushSubscription(
            'https://fcm.googleapis.com/fcm/send/test-endpoint',
            'p256dh-key',
            'auth-token'
        );

        $user = $this->createUserWithSubscriptions([$sub]);

        // Expect sendOneNotification to be called exactly once
        $this->webPush->expects($this->once())
            ->method('sendOneNotification')
            ->with(
                $this->anything(),
                $this->callback(function (string $payload) {
                    $data = json_decode($payload, true);

                    return 'Test Title' === $data['title']
                        && 'Test Body' === $data['body']
                        && '/test/123' === $data['url']
                        && '/test/123' === $data['data']['url']
                        && '/images/icon-192.png' === $data['icon']
                        && '/images/icon-192.png' === $data['badge']
                        && str_starts_with($data['tag'], 'notification-42-')
                        && false === $data['requireInteraction'];
                })
            );

        // Successful flush (flush() returns Generator)
        $report = $this->createSuccessReport('https://fcm.googleapis.com/fcm/send/test-endpoint');
        $this->webPush->expects($this->once())
            ->method('flush')
            ->willReturnCallback(function () use ($report): Generator {
                yield $report;
            });

        $this->em->expects($this->once())->method('flush');

        $this->service->sendNotification($user, 'Test Title', 'Test Body', '/test/123');
    }

    public function testSendNotificationWithMultipleSubscriptions(): void
    {
        $sub1 = $this->createPushSubscription('https://fcm.googleapis.com/1', 'key1', 'auth1');
        $sub2 = $this->createPushSubscription('https://push.mozilla.com/2', 'key2', 'auth2');

        $user = $this->createUserWithSubscriptions([$sub1, $sub2]);

        // Both subscriptions should get a push
        $this->webPush->expects($this->exactly(2))
            ->method('sendOneNotification');

        $report1 = $this->createSuccessReport('https://fcm.googleapis.com/1');
        $report2 = $this->createSuccessReport('https://push.mozilla.com/2');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report1, $report2): Generator {
            yield $report1;
            yield $report2;
        });

        $this->em->expects($this->once())->method('flush');

        $this->service->sendNotification($user, 'Title', 'Body');
    }

    public function testDefaultUrlIsSlash(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/x', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $this->webPush->expects($this->once())
            ->method('sendOneNotification')
            ->with(
                $this->anything(),
                $this->callback(function (string $payload) {
                    $data = json_decode($payload, true);

                    return '/' === $data['url'] && '/' === $data['data']['url'];
                })
            );

        $report = $this->createSuccessReport('https://fcm.googleapis.com/x');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        $this->service->sendNotification($user, 'Title', 'Body');
    }

    // ======================================================================
    //  NO SUBSCRIPTIONS
    // ======================================================================

    public function testSkipsWhenUserHasNoSubscriptions(): void
    {
        $user = $this->createUserWithSubscriptions([]);

        // WebPush should never be called
        $this->webPush->expects($this->never())->method('sendOneNotification');
        $this->webPush->expects($this->never())->method('flush');
        $this->em->expects($this->never())->method('flush');

        $this->service->sendNotification($user, 'Title', 'Body');
    }

    // ======================================================================
    //  EXPIRED SUBSCRIPTIONS → removal
    // ======================================================================

    public function testRemovesExpiredSubscriptionFromDatabase(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/expired', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $this->webPush->method('sendOneNotification');

        $report = $this->createExpiredReport('https://fcm.googleapis.com/expired');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        // The expired subscription must be removed
        $this->em->expects($this->once())
            ->method('remove')
            ->with($sub);

        $this->em->expects($this->once())->method('flush');

        $this->service->sendNotification($user, 'Title', 'Body');
    }

    public function testDoesNotRemoveSubscriptionOnNonExpiredFailure(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/fail', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $this->webPush->method('sendOneNotification');

        $report = $this->createFailedReport('https://fcm.googleapis.com/fail', expired: false);
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        // Should NOT remove the subscription (non-expired error)
        $this->em->expects($this->never())->method('remove');
        $this->em->expects($this->once())->method('flush');

        $this->service->sendNotification($user, 'Title', 'Body');
    }

    // ======================================================================
    //  PAYLOAD FORMAT — ensures frontend SW can parse it
    // ======================================================================

    public function testPayloadContainsAllRequiredFieldsForServiceWorker(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/sw-test', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $capturedPayload = null;

        $this->webPush->expects($this->once())
            ->method('sendOneNotification')
            ->with(
                $this->anything(),
                $this->callback(function (string $payload) use (&$capturedPayload) {
                    $capturedPayload = $payload;

                    return true;
                })
            );

        $report = $this->createSuccessReport('https://fcm.googleapis.com/sw-test');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        $this->service->sendNotification($user, 'Spiel morgen', 'Training um 18 Uhr', '/games/5');

        // Decode and validate all fields the SW expects
        $data = json_decode($capturedPayload, true);
        $this->assertIsArray($data);

        // Required top-level fields
        $this->assertArrayHasKey('title', $data);
        $this->assertArrayHasKey('body', $data);
        $this->assertArrayHasKey('url', $data);
        $this->assertArrayHasKey('data', $data);
        $this->assertArrayHasKey('icon', $data);
        $this->assertArrayHasKey('badge', $data);
        $this->assertArrayHasKey('tag', $data);
        $this->assertArrayHasKey('vibrate', $data);
        $this->assertArrayHasKey('actions', $data);
        $this->assertArrayHasKey('requireInteraction', $data);

        // Values
        $this->assertSame('Spiel morgen', $data['title']);
        $this->assertSame('Training um 18 Uhr', $data['body']);
        $this->assertSame('/games/5', $data['url']);

        // data.url for clickthrough (SW reads this for navigation)
        $this->assertArrayHasKey('url', $data['data']);
        $this->assertSame('/games/5', $data['data']['url']);

        // Icon/badge must NOT be example.com placeholders
        $this->assertStringNotContainsString('example.com', $data['icon']);
        $this->assertStringNotContainsString('example.com', $data['badge']);

        // Tag must be unique (contains user ID + timestamp)
        $this->assertMatchesRegularExpression('/^notification-42-\d+$/', $data['tag']);

        // vibrate is a numeric array
        $this->assertIsArray($data['vibrate']);
        $this->assertSame([200, 100, 200], $data['vibrate']);

        // requireInteraction must be false (for mobile)
        $this->assertFalse($data['requireInteraction']);

        // actions array
        $this->assertIsArray($data['actions']);
        $this->assertNotEmpty($data['actions']);
        $this->assertArrayHasKey('action', $data['actions'][0]);
        $this->assertArrayHasKey('title', $data['actions'][0]);
    }

    public function testPayloadIsValidJson(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/json-test', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $capturedPayload = null;

        $this->webPush->expects($this->once())
            ->method('sendOneNotification')
            ->with(
                $this->anything(),
                $this->callback(function (string $payload) use (&$capturedPayload) {
                    $capturedPayload = $payload;

                    return true;
                })
            );

        $report = $this->createSuccessReport('https://fcm.googleapis.com/json-test');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        $this->service->sendNotification($user, 'Ümläut Tëst', 'Spëcial Chärs: <>&"', '/t?a=1&b=2');

        // Must be valid JSON
        $this->assertNotNull($capturedPayload);
        $decoded = json_decode($capturedPayload, true);
        $this->assertSame(JSON_ERROR_NONE, json_last_error(), 'Payload must be valid JSON');
        $this->assertSame('Ümläut Tëst', $decoded['title'], 'UTF-8 must be preserved');
    }

    // ======================================================================
    //  LOGGING
    // ======================================================================

    public function testLogsSendingInfo(): void
    {
        $sub = $this->createPushSubscription('https://fcm.googleapis.com/log-test', 'k', 'a');
        $user = $this->createUserWithSubscriptions([$sub]);

        $loggedMessages = [];
        $this->logger->method('info')
            ->willReturnCallback(function (string $message, array $context = []) use (&$loggedMessages) {
                $loggedMessages[] = ['message' => $message, 'context' => $context];
            });

        $this->webPush->method('sendOneNotification');
        $report = $this->createSuccessReport('https://fcm.googleapis.com/log-test');
        $this->webPush->method('flush')->willReturnCallback(function () use ($report): Generator {
            yield $report;
        });

        $this->service->sendNotification($user, 'T', 'B');

        // Check that "Sending push notification" was logged with correct context
        $sendingLog = array_filter($loggedMessages, fn ($l) => str_contains($l['message'], 'Sending push notification'));
        $this->assertNotEmpty($sendingLog, 'Must log "Sending push notification"');
        $first = array_values($sendingLog)[0];
        $this->assertSame(42, $first['context']['user_id']);
        $this->assertSame(1, $first['context']['subscriptions_count']);
    }

    // ======================================================================
    //  HELPERS
    // ======================================================================

    /** @param array<int, PushSubscription&MockObject> $subscriptions */
    private function createUserWithSubscriptions(array $subscriptions): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);
        $user->method('getPushSubscriptions')->willReturn(new ArrayCollection($subscriptions));

        return $user;
    }

    private function createPushSubscription(string $endpoint, string $publicKey, string $authToken): PushSubscription&MockObject
    {
        $sub = $this->createMock(PushSubscription::class);
        $sub->method('getEndpoint')->willReturn($endpoint);
        $sub->method('getPublicKey')->willReturn($publicKey);
        $sub->method('getAuthToken')->willReturn($authToken);

        return $sub;
    }

    private function createSuccessReport(string $endpoint): MessageSentReport&MockObject
    {
        $report = $this->createMock(MessageSentReport::class);
        $report->method('getEndpoint')->willReturn($endpoint);
        $report->method('isSuccess')->willReturn(true);
        $report->method('isSubscriptionExpired')->willReturn(false);

        return $report;
    }

    private function createExpiredReport(string $endpoint): MessageSentReport&MockObject
    {
        $report = $this->createMock(MessageSentReport::class);
        $report->method('getEndpoint')->willReturn($endpoint);
        $report->method('isSuccess')->willReturn(false);
        $report->method('isSubscriptionExpired')->willReturn(true);
        $report->method('getReason')->willReturn('Subscription expired');

        return $report;
    }

    private function createFailedReport(string $endpoint, bool $expired = false): MessageSentReport&MockObject
    {
        $report = $this->createMock(MessageSentReport::class);
        $report->method('getEndpoint')->willReturn($endpoint);
        $report->method('isSuccess')->willReturn(false);
        $report->method('isSubscriptionExpired')->willReturn($expired);
        $report->method('getReason')->willReturn('Server error');

        return $report;
    }
}
