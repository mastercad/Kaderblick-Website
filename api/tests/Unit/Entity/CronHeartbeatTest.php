<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\CronHeartbeat;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class CronHeartbeatTest extends TestCase
{
    // ── Constructor / command ─────────────────────────────────────────────

    public function testConstructorSetsCommand(): void
    {
        $entry = new CronHeartbeat('app:notifications:push');

        $this->assertSame('app:notifications:push', $entry->getCommand());
    }

    public function testIdIsNullBeforePersistence(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertNull($entry->getId());
    }

    // ── lastRunAt ─────────────────────────────────────────────────────────

    public function testLastRunAtIsNullByDefault(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertNull($entry->getLastRunAt());
    }

    public function testSetLastRunAt(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $dt = new DateTimeImmutable('2026-04-30 22:00:00');
        $result = $entry->setLastRunAt($dt);

        $this->assertSame($dt, $entry->getLastRunAt());
        $this->assertSame($entry, $result, 'setLastRunAt should return self');
    }

    public function testSetLastRunAtToNull(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt(new DateTimeImmutable());
        $entry->setLastRunAt(null);

        $this->assertNull($entry->getLastRunAt());
    }

    // ── lastError ─────────────────────────────────────────────────────────

    public function testLastErrorIsNullByDefault(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertNull($entry->getLastError());
    }

    public function testSetLastError(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $result = $entry->setLastError('DB connection refused');

        $this->assertSame('DB connection refused', $entry->getLastError());
        $this->assertSame($entry, $result, 'setLastError should return self');
    }

    public function testSetLastErrorToNull(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastError('some error');
        $entry->setLastError(null);

        $this->assertNull($entry->getLastError());
    }

    // ── runningPid ────────────────────────────────────────────────────────

    public function testRunningPidIsNullByDefault(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertNull($entry->getRunningPid());
    }

    public function testSetRunningPid(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $result = $entry->setRunningPid(1234);

        $this->assertSame(1234, $entry->getRunningPid());
        $this->assertSame($entry, $result, 'setRunningPid should return self');
    }

    public function testSetRunningPidToNull(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(42);
        $entry->setRunningPid(null);

        $this->assertNull($entry->getRunningPid());
    }

    // ── runningStartedAt ──────────────────────────────────────────────────

    public function testRunningStartedAtIsNullByDefault(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertNull($entry->getRunningStartedAt());
    }

    public function testSetRunningStartedAt(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $ts = time();
        $result = $entry->setRunningStartedAt($ts);

        $this->assertSame($ts, $entry->getRunningStartedAt());
        $this->assertSame($entry, $result, 'setRunningStartedAt should return self');
    }

    public function testSetRunningStartedAtToNull(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningStartedAt(time());
        $entry->setRunningStartedAt(null);

        $this->assertNull($entry->getRunningStartedAt());
    }

    // ── isRunning() ───────────────────────────────────────────────────────

    public function testIsRunningReturnsFalseWhenNoPidSet(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');

        $this->assertFalse($entry->isRunning());
    }

    public function testIsRunningReturnsTrueWhenPidIsSet(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(42);

        $this->assertTrue($entry->isRunning());
    }

    public function testIsRunningReturnsFalseAfterPidCleared(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(42);
        $entry->setRunningPid(null);

        $this->assertFalse($entry->isRunning());
    }
}
