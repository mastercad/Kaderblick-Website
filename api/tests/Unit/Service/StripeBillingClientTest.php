<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Service\StripeBillingClient;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\HttpClient\MockHttpClient;

final class StripeBillingClientTest extends TestCase
{
    private const SECRET = 'whsec_test_secret';

    protected function setUp(): void
    {
        $_ENV['STRIPE_WEBHOOK_SECRET'] = self::SECRET;
    }

    protected function tearDown(): void
    {
        unset($_ENV['STRIPE_WEBHOOK_SECRET']);
    }

    public function testVerifiesValidWebhookSignature(): void
    {
        $payload = '{"id":"evt_123","type":"invoice.paid"}';
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $payload, self::SECRET);
        $event = (new StripeBillingClient(new MockHttpClient()))->verifyWebhook($payload, sprintf('t=%d,v1=%s', $timestamp, $signature));

        self::assertSame('evt_123', $event['id']);
        self::assertSame('invoice.paid', $event['type']);
    }

    public function testRejectsInvalidWebhookSignature(): void
    {
        $this->expectException(RuntimeException::class);
        (new StripeBillingClient(new MockHttpClient()))->verifyWebhook('{}', sprintf('t=%d,v1=invalid', time()));
    }

    public function testRejectsExpiredWebhookSignature(): void
    {
        $this->expectException(RuntimeException::class);
        (new StripeBillingClient(new MockHttpClient()))->verifyWebhook('{}', 't=' . (time() - 301) . ',v1=invalid');
    }
}
