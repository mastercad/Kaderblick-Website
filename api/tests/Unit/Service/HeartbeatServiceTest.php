<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\CronHeartbeat;
use App\Repository\CronHeartbeatRepository;
use App\Service\HeartbeatService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class HeartbeatServiceTest extends TestCase
{
    private CronHeartbeatRepository&MockObject $repository;
    private EntityManagerInterface&MockObject $em;
    private HeartbeatService $service;

    protected function setUp(): void
    {
        $this->repository = $this->createMock(CronHeartbeatRepository::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->service = new HeartbeatService($this->repository, $this->em);
    }

    // ── beat() ────────────────────────────────────────────────────────────

    public function testBeatSetsLastRunAtAndClearsErrorAndRunning(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastError('previous error');
        $entry->setRunningPid(999);
        $entry->setRunningStartedAt(1000);

        $this->repository->method('findOrCreate')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $before = time();
        $this->service->beat('app:test:cmd');
        $after = time();

        $this->assertNotNull($entry->getLastRunAt());
        $this->assertGreaterThanOrEqual($before, $entry->getLastRunAt()->getTimestamp());
        $this->assertLessThanOrEqual($after, $entry->getLastRunAt()->getTimestamp());
        $this->assertNull($entry->getLastError());
        $this->assertNull($entry->getRunningPid());
        $this->assertNull($entry->getRunningStartedAt());
    }

    public function testBeatCallsFindOrCreateWithCommandName(): void
    {
        $entry = new CronHeartbeat('app:xp:process-pending');
        $this->repository
            ->expects($this->once())
            ->method('findOrCreate')
            ->with('app:xp:process-pending')
            ->willReturn($entry);

        $this->service->beat('app:xp:process-pending');
    }

    // ── beatError() ───────────────────────────────────────────────────────

    public function testBeatErrorStoresErrorMessageAndClearsRunning(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(42);
        $entry->setRunningStartedAt(1000);

        $this->repository->method('findOrCreate')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $this->service->beatError('app:test:cmd', 'Something went wrong');

        $this->assertSame('Something went wrong', $entry->getLastError());
        $this->assertNull($entry->getRunningPid());
        $this->assertNull($entry->getRunningStartedAt());
    }

    public function testBeatErrorDoesNotChangeLastRunAt(): void
    {
        $existingDate = new DateTimeImmutable('2026-01-01 12:00:00');
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt($existingDate);

        $this->repository->method('findOrCreate')->willReturn($entry);

        $this->service->beatError('app:test:cmd', 'err');

        $this->assertSame($existingDate, $entry->getLastRunAt());
    }

    // ── getLastBeat() ─────────────────────────────────────────────────────

    public function testGetLastBeatReturnsNullWhenNoEntryExists(): void
    {
        $this->repository->method('findByCommand')->willReturn(null);

        $this->assertNull($this->service->getLastBeat('app:never:ran'));
    }

    public function testGetLastBeatReturnsNullWhenEntryExistsButNeverRan(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        // lastRunAt is null by default
        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertNull($this->service->getLastBeat('app:test:cmd'));
    }

    public function testGetLastBeatReturnsStoredDateTime(): void
    {
        $dt = new DateTimeImmutable('2026-04-30 22:00:00');
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt($dt);

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertSame($dt, $this->service->getLastBeat('app:test:cmd'));
    }

    // ── getLastError() ────────────────────────────────────────────────────

    public function testGetLastErrorReturnsNullWhenNoEntryExists(): void
    {
        $this->repository->method('findByCommand')->willReturn(null);

        $this->assertNull($this->service->getLastError('app:test:cmd'));
    }

    public function testGetLastErrorReturnsNullWhenNoErrorSet(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertNull($this->service->getLastError('app:test:cmd'));
    }

    public function testGetLastErrorReturnsStoredMessage(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastError('DB connection failed');

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertSame('DB connection failed', $this->service->getLastError('app:test:cmd'));
    }

    // ── isFresh() ─────────────────────────────────────────────────────────

    public function testIsFreshReturnsFalseWhenNoEntryExists(): void
    {
        $this->repository->method('findByCommand')->willReturn(null);

        $this->assertFalse($this->service->isFresh('app:never:ran', 60));
    }

    public function testIsFreshReturnsFalseWhenNeverRan(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertFalse($this->service->isFresh('app:test:cmd', 60));
    }

    public function testIsFreshReturnsTrueWhenBeatIsWithinWindow(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt(new DateTimeImmutable('@' . (time() - 10))); // 10 seconds ago

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertTrue($this->service->isFresh('app:test:cmd', 60));
    }

    public function testIsFreshReturnsFalseWhenBeatIsOutsideWindow(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt(new DateTimeImmutable('@' . (time() - 3700))); // >1 hour ago

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertFalse($this->service->isFresh('app:test:cmd', 60));
    }

    public function testIsFreshReturnsTrueExactlyAtBoundary(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt(new DateTimeImmutable('@' . (time() - 3600))); // exactly 60 min

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertTrue($this->service->isFresh('app:test:cmd', 60));
    }

    public function testIsFreshReturnsFalseOneSecondPastBoundary(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setLastRunAt(new DateTimeImmutable('@' . (time() - 3601)));

        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertFalse($this->service->isFresh('app:test:cmd', 60));
    }

    // ── setRunning() ──────────────────────────────────────────────────────

    public function testSetRunningStoresPidAndTimestamp(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $this->repository->method('findOrCreate')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $before = time();
        $this->service->setRunning('app:test:cmd', 1234);
        $after = time();

        $this->assertSame(1234, $entry->getRunningPid());
        $this->assertGreaterThanOrEqual($before, $entry->getRunningStartedAt());
        $this->assertLessThanOrEqual($after, $entry->getRunningStartedAt());
    }

    // ── clearRunning() ────────────────────────────────────────────────────

    public function testClearRunningDoesNothingWhenNoEntryExists(): void
    {
        $this->repository->method('findByCommand')->willReturn(null);
        $this->em->expects($this->never())->method('flush');

        $this->service->clearRunning('app:test:cmd');
    }

    public function testClearRunningClearsPidAndStartedAt(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(42);
        $entry->setRunningStartedAt(1000);

        $this->repository->method('findByCommand')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $this->service->clearRunning('app:test:cmd');

        $this->assertNull($entry->getRunningPid());
        $this->assertNull($entry->getRunningStartedAt());
    }

    // ── getRunningState() ─────────────────────────────────────────────────

    public function testGetRunningStateReturnsNullWhenNoEntryExists(): void
    {
        $this->repository->method('findByCommand')->willReturn(null);

        $this->assertNull($this->service->getRunningState('app:test:cmd'));
    }

    public function testGetRunningStateReturnsNullWhenNoPidSet(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        // runningPid is null by default
        $this->repository->method('findByCommand')->willReturn($entry);

        $this->assertNull($this->service->getRunningState('app:test:cmd'));
    }

    public function testGetRunningStateReturnsNullAndClearsEntryForDeadProcess(): void
    {
        // PHP_INT_MAX is guaranteed not to be a running PID
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(PHP_INT_MAX);
        $entry->setRunningStartedAt(1000);

        $this->repository->method('findByCommand')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $this->assertNull($this->service->getRunningState('app:test:cmd'));
        $this->assertNull($entry->getRunningPid());
        $this->assertNull($entry->getRunningStartedAt());
    }

    public function testGetRunningStateReturnsStateForLiveProcess(): void
    {
        if (!function_exists('posix_kill')) {
            $this->markTestSkipped('posix_kill not available on this platform.');
        }

        $pid = (int) getmypid();
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid($pid);
        $entry->setRunningStartedAt(time());

        $this->repository->method('findByCommand')->willReturn($entry);

        $result = $this->service->getRunningState('app:test:cmd');

        $this->assertNotNull($result);
        $this->assertSame($pid, $result['pid']);
    }

    public function testGetRunningStateRejectsNegativePid(): void
    {
        $entry = new CronHeartbeat('app:test:cmd');
        $entry->setRunningPid(-1);
        $entry->setRunningStartedAt(time());

        $this->repository->method('findByCommand')->willReturn($entry);
        $this->em->expects($this->once())->method('flush');

        $this->assertNull($this->service->getRunningState('app:test:cmd'));
    }
}
