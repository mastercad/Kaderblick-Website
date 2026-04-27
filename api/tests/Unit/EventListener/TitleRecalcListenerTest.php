<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventListener;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\EventListener\TitleRecalcListener;
use App\Message\AwardTitlesMessage;
use App\Service\GoalCountingService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PreRemoveEventArgs;
use Doctrine\ORM\UnitOfWork;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Unit tests for TitleRecalcListener.
 *
 * Branches covered:
 * - postPersist: goal GameEvent → buffers season
 * - postPersist: non-goal GameEvent → does not buffer
 * - postPersist: unrelated entity → does not buffer
 * - postPersist: GameEvent without calendarEvent → does not buffer
 * - postPersist: GameEvent without startDate → does not buffer
 * - preRemove: goal GameEvent → buffers season before deletion
 * - preRemove: non-goal GameEvent → does not buffer
 * - preRemove: unrelated entity → does not buffer
 * - postUpdate: goal GameEvent → buffers season
 * - postUpdate: non-goal GameEvent with gameEventType change → buffers season (code may have changed)
 * - postUpdate: non-goal GameEvent without gameEventType change → does not buffer
 * - postUpdate: Game with calendarEvent change → buffers old AND new season
 * - postUpdate: Game with calendarEvent change, old CE has no startDate → buffers only new season
 * - postUpdate: Game without calendarEvent change → does not buffer
 * - postUpdate: unrelated entity → does not buffer
 * - postFlush: dispatches one message per unique season
 * - postFlush: deduplicates the same season from multiple events
 * - postFlush: clears buffer so a second flush dispatches nothing
 * - postFlush: does nothing when buffer is empty
 * - Season calculation: July–December → current/next year
 * - Season calculation: January–June → previous/current year
 */
#[AllowMockObjectsWithoutExpectations]
class TitleRecalcListenerTest extends TestCase
{
    private MessageBusInterface&MockObject $messageBus;
    private EntityManagerInterface&MockObject $em;
    private UnitOfWork&MockObject $uow;
    private GoalCountingService&MockObject $goalCountingService;
    private TitleRecalcListener $listener;

    protected function setUp(): void
    {
        $this->messageBus = $this->createMock(MessageBusInterface::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->uow = $this->getMockBuilder(UnitOfWork::class)
            ->disableOriginalConstructor()
            ->getMock();
        $this->em->method('getUnitOfWork')->willReturn($this->uow);
        $this->messageBus->method('dispatch')->willReturn(new Envelope(new stdClass()));
        $this->goalCountingService = $this->createMock(GoalCountingService::class);

        $this->listener = new TitleRecalcListener($this->messageBus, $this->goalCountingService);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeGoalEvent(string $season = '2024/2025'): GameEvent&MockObject
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('goal');

        $this->goalCountingService->method('isGoalForScorer')
            ->with('goal')
            ->willReturn(true);

        return $this->makeGameEventWithSeason($type, $season);
    }

    private function makeNonGoalEvent(string $code = 'yellow_card'): GameEvent&MockObject
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn($code);

        $this->goalCountingService->method('isGoalForScorer')
            ->willReturn(false);

        return $this->makeGameEventWithSeason($type);
    }

    private function makeGameEventWithSeason(GameEventType $type, string $season = '2024/2025'): GameEvent&MockObject
    {
        [$startYear] = explode('/', $season);
        $startDate = new DateTimeImmutable(sprintf('%d-09-15', (int) $startYear));

        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn($startDate);

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getGame')->willReturn($game);

        return $event;
    }

    private function makeCalendarEvent(?DateTimeImmutable $startDate): CalendarEvent&MockObject
    {
        $ce = $this->createMock(CalendarEvent::class);
        $ce->method('getStartDate')->willReturn($startDate);

        return $ce;
    }

    /** @return array<string> collected season strings */
    private function flushAndCollectSeasons(): array
    {
        $seasons = [];
        $this->messageBus->method('dispatch')
            ->willReturnCallback(function (AwardTitlesMessage $msg) use (&$seasons): Envelope {
                $seasons[] = $msg->season;

                return new Envelope($msg);
            });

        $this->listener->postFlush(new PostFlushEventArgs($this->em));

        return $seasons;
    }

    private function flush(): void
    {
        $this->listener->postFlush(new PostFlushEventArgs($this->em));
    }

    // ── postPersist ───────────────────────────────────────────────────────────

    public function testPostPersistGoalEventBuffersSeason(): void
    {
        $event = $this->makeGoalEvent('2024/2025');

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }

    public function testPostPersistNonGoalEventDoesNotBuffer(): void
    {
        $event = $this->makeNonGoalEvent();

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPostPersistUnrelatedEntityDoesNotBuffer(): void
    {
        $this->listener->postPersist(new PostPersistEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPostPersistGoalEventWithoutCalendarEventDoesNotBuffer(): void
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('goal');
        $this->goalCountingService->method('isGoalForScorer')->willReturn(true);

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn(null);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getGame')->willReturn($game);

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPostPersistGoalEventWithoutStartDateDoesNotBuffer(): void
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('goal');
        $this->goalCountingService->method('isGoalForScorer')->willReturn(true);

        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn(null);

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getGame')->willReturn($game);

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    // ── preRemove ─────────────────────────────────────────────────────────────

    public function testPreRemoveGoalEventBuffersSeason(): void
    {
        $event = $this->makeGoalEvent('2023/2024');

        $this->listener->preRemove(new PreRemoveEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2023/2024'], $seasons);
    }

    public function testPreRemoveNonGoalEventDoesNotBuffer(): void
    {
        $event = $this->makeNonGoalEvent();

        $this->listener->preRemove(new PreRemoveEventArgs($event, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPreRemoveUnrelatedEntityDoesNotBuffer(): void
    {
        $this->listener->preRemove(new PreRemoveEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    // ── postUpdate: GameEvent ─────────────────────────────────────────────────

    public function testPostUpdateGoalEventBuffersSeason(): void
    {
        $event = $this->makeGoalEvent('2024/2025');
        $this->uow->method('getEntityChangeSet')->willReturn([]);

        $this->listener->postUpdate(new PostUpdateEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }

    public function testPostUpdateNonGoalEventWithGameEventTypeChangeBuffersSeason(): void
    {
        // Event type changed (e.g. was goal, now yellow_card) — must still recalculate
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('yellow_card');
        $this->goalCountingService->method('isGoalForScorer')->willReturn(false);

        $event = $this->makeGameEventWithSeason($type, '2024/2025');
        $this->uow->method('getEntityChangeSet')->willReturn(['gameEventType' => [null, $type]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }

    public function testPostUpdateNonGoalEventWithoutGameEventTypeChangeDoesNotBuffer(): void
    {
        $event = $this->makeNonGoalEvent();
        $this->uow->method('getEntityChangeSet')->willReturn(['minute' => [30, 45]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($event, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPostUpdateUnrelatedEntityDoesNotBuffer(): void
    {
        $this->uow->method('getEntityChangeSet')->willReturn([]);

        $this->listener->postUpdate(new PostUpdateEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    // ── postUpdate: Game ──────────────────────────────────────────────────────

    public function testPostUpdateGameCalendarEventChangedBuffersBothSeasons(): void
    {
        $oldCe = $this->makeCalendarEvent(new DateTimeImmutable('2023-09-01'));
        $newCe = $this->makeCalendarEvent(new DateTimeImmutable('2024-09-01'));

        $game = $this->createMock(Game::class);
        $this->uow->method('getEntityChangeSet')
            ->willReturn(['calendarEvent' => [$oldCe, $newCe]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        sort($seasons);
        $this->assertSame(['2023/2024', '2024/2025'], $seasons);
    }

    public function testPostUpdateGameCalendarEventChangedOldHasNoStartDateBuffersOnlyNewSeason(): void
    {
        $oldCe = $this->makeCalendarEvent(null);
        $newCe = $this->makeCalendarEvent(new DateTimeImmutable('2024-09-01'));

        $game = $this->createMock(Game::class);
        $this->uow->method('getEntityChangeSet')
            ->willReturn(['calendarEvent' => [$oldCe, $newCe]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }

    public function testPostUpdateGameWithoutCalendarEventChangeDoesNotBuffer(): void
    {
        $game = $this->createMock(Game::class);
        $this->uow->method('getEntityChangeSet')->willReturn(['homeScore' => [0, 2]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    // ── postFlush ─────────────────────────────────────────────────────────────

    public function testPostFlushWithEmptyBufferDispatchesNothing(): void
    {
        $this->messageBus->expects($this->never())->method('dispatch');
        $this->flush();
    }

    public function testPostFlushDeduplicatesSameSeason(): void
    {
        $event = $this->makeGoalEvent('2024/2025');
        $this->uow->method('getEntityChangeSet')->willReturn([]);

        // Three events for the same season → only one message
        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));
        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));
        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $dispatchCount = 0;
        $this->messageBus->expects($this->once())
            ->method('dispatch')
            ->willReturnCallback(function (AwardTitlesMessage $msg) use (&$dispatchCount): Envelope {
                ++$dispatchCount;

                return new Envelope($msg);
            });

        $this->flush();
        $this->assertSame(1, $dispatchCount);
    }

    public function testPostFlushDispatchesOneMessagePerUniqueSeason(): void
    {
        // Two different seasons → two messages
        foreach (['2022/2023', '2023/2024'] as $season) {
            $event = $this->makeGoalEvent($season);
            $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));
        }

        $seasons = $this->flushAndCollectSeasons();
        sort($seasons);
        $this->assertSame(['2022/2023', '2023/2024'], $seasons);
    }

    public function testPostFlushClearsBufferSoSubsequentFlushDispatchesNothing(): void
    {
        $event = $this->makeGoalEvent('2024/2025');
        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $this->messageBus->expects($this->once())
            ->method('dispatch')
            ->willReturn(new Envelope(new stdClass()));

        $this->flush(); // dispatches once
        $this->flush(); // buffer is cleared → nothing dispatched (once() enforces this)
    }

    // ── Season calculation ────────────────────────────────────────────────────

    public function testSeasonCalculationJulyIsSecondHalfOfYear(): void
    {
        // July 2024 → season 2024/2025
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('goal');
        $this->goalCountingService->method('isGoalForScorer')->willReturn(true);

        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn(new DateTimeImmutable('2024-07-01'));

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getGame')->willReturn($game);

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }

    public function testSeasonCalculationJuneIsFirstHalfOfYear(): void
    {
        // June 2025 → season 2024/2025
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn('goal');
        $this->goalCountingService->method('isGoalForScorer')->willReturn(true);

        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn(new DateTimeImmutable('2025-06-30'));

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getGame')->willReturn($game);

        $this->listener->postPersist(new PostPersistEventArgs($event, $this->em));

        $seasons = $this->flushAndCollectSeasons();
        $this->assertSame(['2024/2025'], $seasons);
    }
}
