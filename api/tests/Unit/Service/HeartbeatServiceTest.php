<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Service\HeartbeatService;
use DateInterval;
use DateTimeImmutable;
use DateTimeInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

#[AllowMockObjectsWithoutExpectations]
class HeartbeatServiceTest extends TestCase
{
    private CacheInterface&MockObject $cache;
    private HeartbeatService $service;

    protected function setUp(): void
    {
        $this->cache = $this->createMock(CacheInterface::class);
        $this->service = new HeartbeatService($this->cache);
    }

    // ── beat() ────────────────────────────────────────────────────────────

    public function testBeatDeletesExistingKeyAndStoresTimestamp(): void
    {
        $this->cache->expects($this->exactly(3))
            ->method('delete');

        $capturedValue = null;
        $this->cache->expects($this->once())
            ->method('get')
            ->willReturnCallback(static function (string $key, callable $callback) use (&$capturedValue): int {
                $item = new class implements ItemInterface {
                    public function getKey(): string
                    {
                        return '';
                    }

                    public function get(): mixed
                    {
                        return null;
                    }

                    public function isHit(): bool
                    {
                        return false;
                    }

                    public function set(mixed $value): static
                    {
                        return $this;
                    }

                    public function expiresAt(?DateTimeInterface $expiration): static
                    {
                        return $this;
                    }

                    public function expiresAfter(int|DateInterval|null $time): static
                    {
                        return $this;
                    }

                    public function tag(string|iterable $tags): static
                    {
                        return $this;
                    }

                    /** @return array<string, mixed> */
                    public function getMetadata(): array
                    {
                        return [];
                    }
                };
                $capturedValue = $callback($item);

                return $capturedValue;
            });

        $before = time();
        $this->service->beat('app:test:command');
        $after = time();

        $this->assertNotNull($capturedValue);
        $this->assertGreaterThanOrEqual($before, $capturedValue);
        $this->assertLessThanOrEqual($after, $capturedValue);
    }

    // ── getLastBeat() ─────────────────────────────────────────────────────

    public function testGetLastBeatReturnsNullWhenNoBeatRegistered(): void
    {
        // Simulate cache miss: callback is invoked → $isNew = true
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback): int {
                $item = new class implements ItemInterface {
                    public function getKey(): string
                    {
                        return '';
                    }

                    public function get(): mixed
                    {
                        return null;
                    }

                    public function isHit(): bool
                    {
                        return false;
                    }

                    public function set(mixed $value): static
                    {
                        return $this;
                    }

                    public function expiresAt(?DateTimeInterface $expiration): static
                    {
                        return $this;
                    }

                    public function expiresAfter(int|DateInterval|null $time): static
                    {
                        return $this;
                    }

                    public function tag(string|iterable $tags): static
                    {
                        return $this;
                    }

                    /** @return array<string, mixed> */
                    public function getMetadata(): array
                    {
                        return [];
                    }
                };

                return $callback($item);
            });

        $this->assertNull($this->service->getLastBeat('app:never:ran'));
    }

    public function testGetLastBeatReturnsDateTimeWhenBeatExists(): void
    {
        $timestamp = time() - 300; // 5 minutes ago

        // Simulate cache hit: callback is NOT invoked, returns stored timestamp
        $this->cache->method('get')
            ->willReturn($timestamp);

        $result = $this->service->getLastBeat('app:xp:process-pending');

        $this->assertInstanceOf(DateTimeImmutable::class, $result);
        $this->assertEquals($timestamp, $result->getTimestamp());
    }

    // ── isFresh() ─────────────────────────────────────────────────────────

    public function testIsFreshReturnsFalseWhenNoBeatRegistered(): void
    {
        $this->cache->method('get')
            ->willReturnCallback(static function (string $key, callable $callback): int {
                $item = new class implements ItemInterface {
                    public function getKey(): string
                    {
                        return '';
                    }

                    public function get(): mixed
                    {
                        return null;
                    }

                    public function isHit(): bool
                    {
                        return false;
                    }

                    public function set(mixed $value): static
                    {
                        return $this;
                    }

                    public function expiresAt(?DateTimeInterface $expiration): static
                    {
                        return $this;
                    }

                    public function expiresAfter(int|DateInterval|null $time): static
                    {
                        return $this;
                    }

                    public function tag(string|iterable $tags): static
                    {
                        return $this;
                    }

                    /** @return array<string, mixed> */
                    public function getMetadata(): array
                    {
                        return [];
                    }
                };

                return $callback($item);
            });

        $this->assertFalse($this->service->isFresh('app:never:ran', 60));
    }

    public function testIsFreshReturnsTrueWhenBeatIsWithinWindow(): void
    {
        $recentTimestamp = time() - 10; // 10 seconds ago

        $this->cache->method('get')->willReturn($recentTimestamp);

        $this->assertTrue($this->service->isFresh('app:xp:process-pending', 60));
    }

    public function testIsFreshReturnsFalseWhenBeatIsOutsideWindow(): void
    {
        $staleTimestamp = time() - 3700; // >1 hour ago

        $this->cache->method('get')->willReturn($staleTimestamp);

        $this->assertFalse($this->service->isFresh('app:notifications:send-unsent', 60));
    }

    public function testIsFreshReturnsTrueExactlyAtBoundary(): void
    {
        // Exactly at the boundary (maxAge = 60 min → 3600 s)
        $borderlineTimestamp = time() - 3600;

        $this->cache->method('get')->willReturn($borderlineTimestamp);

        $this->assertTrue($this->service->isFresh('app:command', 60));
    }

    public function testIsFreshReturnsFalseOneSecondPastBoundary(): void
    {
        $staleTimestamp = time() - 3601;

        $this->cache->method('get')->willReturn($staleTimestamp);

        $this->assertFalse($this->service->isFresh('app:command', 60));
    }

    // ── beatError() ───────────────────────────────────────────────────────

    public function testBeatErrorStoresErrorMessage(): void
    {
        $capturedError = null;
        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback) use (&$capturedError): string {
                $capturedError = $callback($this->makeCacheItem());

                return (string) $capturedError;
            });

        $this->service->beatError('app:test:command', 'Something went wrong');

        $this->assertSame('Something went wrong', $capturedError);
    }

    public function testBeatErrorClearsRunningState(): void
    {
        // delete() is called once for errorKey and once via clearRunning()
        $this->cache->expects($this->exactly(2))
            ->method('delete');

        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback): string {
                return (string) $callback($this->makeCacheItem());
            });

        $this->service->beatError('app:test:command', 'err');
    }

    // ── getLastError() ────────────────────────────────────────────────────

    public function testGetLastErrorReturnsNullOnCacheMiss(): void
    {
        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback): string {
                // Invoking callback signals cache miss (isNew = true) → returns ''
                return (string) $callback($this->makeCacheItem());
            });

        $this->assertNull($this->service->getLastError('app:test:command'));
    }

    public function testGetLastErrorReturnsStoredMessage(): void
    {
        $this->cache->method('get')->willReturn('Something went wrong');

        $result = $this->service->getLastError('app:test:command');

        $this->assertSame('Something went wrong', $result);
    }

    public function testGetLastErrorReturnsNullForEmptyString(): void
    {
        // Cache returns '' (not a miss, but effectively empty) → null
        $this->cache->method('get')->willReturn('');

        $this->assertNull($this->service->getLastError('app:test:command'));
    }

    // ── setRunning() / clearRunning() ─────────────────────────────────────

    public function testSetRunningStoresPidAndStartedAt(): void
    {
        $capturedData = null;
        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback) use (&$capturedData): array {
                $capturedData = $callback($this->makeCacheItem());

                return (array) $capturedData;
            });

        $before = time();
        $this->service->setRunning('app:test:command', 1234);
        $after = time();

        $this->assertIsArray($capturedData);
        $this->assertSame(1234, $capturedData['pid']);
        $this->assertGreaterThanOrEqual($before, $capturedData['startedAt']);
        $this->assertLessThanOrEqual($after, $capturedData['startedAt']);
    }

    public function testClearRunningDeletesCacheKey(): void
    {
        $this->cache->expects($this->once())
            ->method('delete');

        $this->service->clearRunning('app:test:command');
    }

    // ── getRunningState() ─────────────────────────────────────────────────

    public function testGetRunningStateReturnsNullOnCacheMiss(): void
    {
        $this->cache->method('get')
            ->willReturnCallback(function (string $key, callable $callback): array {
                // Invoking callback signals cache miss (isNew = true) → returns []
                return (array) $callback($this->makeCacheItem());
            });

        $this->assertNull($this->service->getRunningState('app:test:command'));
    }

    public function testGetRunningStateReturnsNullForDeadProcess(): void
    {
        // PHP_INT_MAX is guaranteed to not be a running PID
        $this->cache->method('get')->willReturn(['pid' => PHP_INT_MAX, 'startedAt' => time()]);

        // Dead PID → cache entry should be deleted
        $this->cache->expects($this->once())->method('delete');

        $this->assertNull($this->service->getRunningState('app:test:command'));
    }

    public function testGetRunningStateReturnsStateForLiveProcess(): void
    {
        if (!function_exists('posix_kill')) {
            $this->markTestSkipped('posix_kill not available on this platform.');
        }

        $pid = getmypid();
        $state = ['pid' => $pid, 'startedAt' => time()];

        $this->cache->method('get')->willReturn($state);

        $result = $this->service->getRunningState('app:test:command');

        $this->assertNotNull($result);
        $this->assertSame($pid, $result['pid']);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private function makeCacheItem(): ItemInterface
    {
        return new class implements ItemInterface {
            public function getKey(): string
            {
                return '';
            }

            public function get(): mixed
            {
                return null;
            }

            public function isHit(): bool
            {
                return false;
            }

            public function set(mixed $value): static
            {
                return $this;
            }

            public function expiresAt(?DateTimeInterface $expiration): static
            {
                return $this;
            }

            public function expiresAfter(int|DateInterval|null $time): static
            {
                return $this;
            }

            public function tag(string|iterable $tags): static
            {
                return $this;
            }

            /** @return array<string, mixed> */
            public function getMetadata(): array
            {
                return [];
            }
        };
    }
}
