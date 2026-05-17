<?php

declare(strict_types=1);

namespace Tests\Integration\EventSubscriber;

use App\EventSubscriber\DailyLoginXpSubscriber;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Integration tests for DailyLoginXpSubscriber.
 *
 * These tests boot the real Symfony kernel to verify that:
 *  1. The subscriber can be instantiated from the DI container (i.e. the
 *     daily_login_xp.cache pool is properly configured).
 *  2. The APCu extension is loaded — without it the cache pool cannot be
 *     created and the container will throw during boot.
 *  3. The cache pool itself is functional: it can store and retrieve values.
 *
 * A unit-test mock of CacheInterface never catches missing PHP extensions or
 * misconfigured cache adapters in cache.yaml. This test closes that gap.
 */
class DailyLoginXpSubscriberIntegrationTest extends KernelTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        restore_exception_handler();
    }

    public function testSubscriberCanBeRetrievedFromContainer(): void
    {
        self::bootKernel();

        $subscriber = static::getContainer()->get(DailyLoginXpSubscriber::class);

        $this->assertInstanceOf(DailyLoginXpSubscriber::class, $subscriber);
    }

    public function testApCuExtensionIsLoaded(): void
    {
        $this->assertTrue(
            extension_loaded('apcu'),
            'The APCu PHP extension is not loaded. Install it via "pecl install apcu" and ' .
            'enable it in the Docker image. Without APCu the daily_login_xp.cache pool ' .
            'cannot be used.',
        );
    }

    public function testDailyLoginXpCachePoolIsUsable(): void
    {
        self::bootKernel();

        /** @var CacheInterface $pool */
        $pool = static::getContainer()->get('daily_login_xp.cache');

        $testKey = 'integration_test_probe_' . uniqid();

        $value = $pool->get($testKey, static function (ItemInterface $item): string {
            $item->expiresAfter(60);

            return 'probe_ok';
        });

        $this->assertSame(
            'probe_ok',
            $value,
            'The daily_login_xp.cache pool did not return the expected value. ' .
            'Verify that cache.adapter.apcu is configured correctly in cache.yaml ' .
            'and that APCu is installed in the container.',
        );

        // Second call must hit the cache (no callback invoked).
        $callbackInvoked = false;
        $cached = $pool->get($testKey, static function (ItemInterface $item) use (&$callbackInvoked): string {
            $callbackInvoked = true;
            $item->expiresAfter(60);

            return 'should_not_be_returned';
        });

        $this->assertFalse($callbackInvoked, 'Cache miss on second get — APCu is not persisting values.');
        $this->assertSame('probe_ok', $cached);
    }
}
