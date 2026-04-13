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
        $this->cache->expects($this->once())
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
}
