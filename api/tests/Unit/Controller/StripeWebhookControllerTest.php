<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\StripeWebhookController;
use App\Entity\BillingPayment;
use App\Entity\BillingSubscription;
use App\Entity\BillingWebhookEvent;
use App\Entity\User;
use App\Repository\NotificationRepository;
use App\Repository\UserRepository;
use App\Service\BillingNotificationService;
use App\Service\NotificationService;
use App\Service\StripeBillingClient;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\MailerInterface;

#[AllowMockObjectsWithoutExpectations]
final class StripeWebhookControllerTest extends TestCase
{
    private const SECRET = 'whsec_webhook_test';
    private EntityManagerInterface&MockObject $em;
    /** @var EntityRepository<BillingWebhookEvent>&MockObject */
    private EntityRepository&MockObject $events;
    /** @var EntityRepository<BillingSubscription>&MockObject */
    private EntityRepository&MockObject $subscriptions;
    /** @var EntityRepository<BillingPayment>&MockObject */
    private EntityRepository&MockObject $payments;
    private BillingSubscription $subscription;
    /** @var list<object> */
    private array $persisted = [];

    protected function setUp(): void
    {
        $_ENV['STRIPE_WEBHOOK_SECRET'] = self::SECRET;
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->events = $this->createMock(EntityRepository::class);
        $this->subscriptions = $this->createMock(EntityRepository::class);
        $this->payments = $this->createMock(EntityRepository::class);
        $this->em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            BillingWebhookEvent::class => $this->events,
            BillingSubscription::class => $this->subscriptions,
            BillingPayment::class => $this->payments,
            default => $this->createMock(EntityRepository::class),
        });
        $this->em->method('persist')->willReturnCallback(function (object $entity): void {
            $this->persisted[] = $entity;
        });
        $user = (new User())->setEmail('kasse@example.test')->setFirstName('Kim')->setLastName('Kasse');
        $this->subscription = (new BillingSubscription($user))->setProviderSubscriptionId('sub_123');
    }

    protected function tearDown(): void
    {
        unset($_ENV['STRIPE_WEBHOOK_SECRET']);
    }

    public function testPaidInvoiceActivatesSubscriptionAndClearsMissedCycles(): void
    {
        $this->subscription->setStatus(BillingSubscription::STATUS_PAST_DUE)->setMissedBillingCycles(2)->setUnpaidSince(new \DateTimeImmutable());
        $this->events->method('findOneBy')->willReturn(null);
        $this->subscriptions->method('findOneBy')->willReturn($this->subscription);
        $this->payments->method('findOneBy')->willReturn(null);
        $payload = [
            'id' => 'evt_paid', 'type' => 'invoice.paid',
            'data' => ['object' => [
                'id' => 'in_123', 'subscription' => 'sub_123', 'status' => 'paid',
                'amount_paid' => 1000, 'currency' => 'eur',
                'hosted_invoice_url' => 'https://example.test/invoice',
                'invoice_pdf' => 'https://example.test/invoice.pdf',
                'status_transitions' => ['paid_at' => 1782216000],
                'lines' => ['data' => [['period' => ['start' => 1782216000, 'end' => 1784894400]]]],
            ]],
        ];

        $response = $this->controller()($this->signedRequest($payload));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(BillingSubscription::STATUS_ACTIVE, $this->subscription->getStatus());
        self::assertSame(0, $this->subscription->getMissedBillingCycles());
        self::assertNull($this->subscription->getUnpaidSince());
        self::assertNotNull($this->subscription->getCurrentPeriodEnd());
        self::assertCount(1, array_filter($this->persisted, static fn (object $entity) => $entity instanceof BillingPayment));
        self::assertCount(1, array_filter($this->persisted, static fn (object $entity) => $entity instanceof BillingWebhookEvent));
    }

    public function testSubscriptionUpdateStoresProviderItemPeriodAndPastDueStatus(): void
    {
        $this->events->method('findOneBy')->willReturn(null);
        $this->subscriptions->method('findOneBy')->willReturn($this->subscription);
        $payload = [
            'id' => 'evt_subscription', 'type' => 'customer.subscription.updated',
            'data' => ['object' => [
                'id' => 'sub_123', 'status' => 'past_due', 'metadata' => [],
                'current_period_start' => 1782216000, 'current_period_end' => 1784894400,
                'items' => ['data' => [['id' => 'si_123']]],
            ]],
        ];

        $response = $this->controller()($this->signedRequest($payload));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(BillingSubscription::STATUS_PAST_DUE, $this->subscription->getStatus());
        self::assertSame('si_123', $this->subscription->getProviderSubscriptionItemId());
        self::assertNotNull($this->subscription->getCurrentPeriodStart());
        self::assertNotNull($this->subscription->getCurrentPeriodEnd());
    }

    public function testDuplicateEventIsIgnoredWithoutWritingAgain(): void
    {
        $this->events->method('findOneBy')->willReturn(new BillingWebhookEvent('evt_duplicate', 'invoice.paid'));
        $this->em->expects(self::never())->method('flush');
        $payload = ['id' => 'evt_duplicate', 'type' => 'invoice.paid', 'data' => ['object' => []]];

        $response = $this->controller()($this->signedRequest($payload));

        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('duplicate', (string) $response->getContent());
        self::assertSame([], $this->persisted);
    }

    private function controller(): StripeWebhookController
    {
        $notificationRepository = $this->createMock(NotificationRepository::class);
        $notificationService = new NotificationService($this->em, $notificationRepository);
        $billingNotifications = new BillingNotificationService(
            $notificationService,
            $this->createMock(UserRepository::class),
            $this->createMock(MailerInterface::class),
            'no-reply@example.test',
            'https://app.example.test',
            $this->em,
        );
        $controller = new StripeWebhookController($this->em, new StripeBillingClient(new MockHttpClient()), $billingNotifications);
        $controller->setContainer(new ContainerBuilder());
        return $controller;
    }

    /** @param array<string, mixed> $event */
    private function signedRequest(array $event): Request
    {
        $payload = json_encode($event, JSON_THROW_ON_ERROR);
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $payload, self::SECRET);
        return Request::create('/api/billing/webhook/stripe', 'POST', server: ['HTTP_STRIPE_SIGNATURE' => sprintf('t=%d,v1=%s', $timestamp, $signature)], content: $payload);
    }
}
