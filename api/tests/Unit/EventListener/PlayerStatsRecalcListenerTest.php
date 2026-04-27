<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventListener;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\EventListener\PlayerStatsRecalcListener;
use App\Message\RecalcPlayerStatsMessage;
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
 * Unit tests für PlayerStatsRecalcListener.
 *
 * Getestete Branches:
 * - postUpdate(Game) mit relevantem Feldwechsel → puffert gameId
 * - postUpdate(Game) mit irrelevantem Feldwechsel → puffert NICHT
 * - postUpdate(GameEvent/Auswechslung) → puffert gameId
 * - postUpdate(beliebiges anderes Entity) → puffert NICHT
 * - postPersist(GameEvent/Auswechslung) → puffert gameId
 * - postPersist(beliebiges anderes Entity) → puffert NICHT
 * - preRemove(GameEvent/Auswechslung) → puffert gameId vor dem Löschen
 * - preRemove(beliebiges anderes Entity) → puffert NICHT
 * - postFlush mit gepufferten IDs → dispatcht eine Message pro eindeutiger gameId
 * - postFlush mit leerm Puffer → dispatcht nichts
 * - Doppelte gameIds werden dedupliziert (nur eine Message pro gameId)
 * - postFlush leert den Puffer BEVOR Nachrichten dispatcht werden (Rekursionsschutz)
 */
#[AllowMockObjectsWithoutExpectations]
class PlayerStatsRecalcListenerTest extends TestCase
{
    private MessageBusInterface&MockObject $messageBus;
    private EntityManagerInterface&MockObject $em;
    private UnitOfWork&MockObject $uow;
    private PlayerStatsRecalcListener $listener;

    protected function setUp(): void
    {
        $this->messageBus = $this->createMock(MessageBusInterface::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->uow = $this->getMockBuilder(UnitOfWork::class)
            ->disableOriginalConstructor()
            ->getMock();
        $this->em->method('getUnitOfWork')->willReturn($this->uow);
        $this->messageBus->method('dispatch')->willReturn(new Envelope(new stdClass()));

        $this->listener = new PlayerStatsRecalcListener($this->messageBus);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return Game&MockObject */
    private function makeGame(int $id = 42): Game
    {
        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn($id);

        return $game;
    }

    /** @return GameEvent&MockObject */
    private function makeSub(Game $game, string $code = 'substitution'): GameEvent
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn($code);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGame')->willReturn($game);
        $event->method('getGameEventType')->willReturn($type);

        return $event;
    }

    private function flush(): void
    {
        $this->listener->postFlush(new PostFlushEventArgs($this->em));
    }

    // ── postUpdate ────────────────────────────────────────────────────────────

    public function testPostUpdateGameWithRelevantMatchPlanChangeBuffersGameId(): void
    {
        $game = $this->makeGame(42);
        $this->uow->method('getEntityChangeSet')->willReturn(['matchPlan' => [null, ['phases' => []]]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->with(self::callback(
                fn (RecalcPlayerStatsMessage $msg) => 42 === $msg->gameId
            ))
            ->willReturn(new Envelope(new stdClass()));

        $this->flush();
    }

    public function testPostUpdateGameWithAllRelevantFieldsTriggersOncePerFlush(): void
    {
        // Alle relevanten Felder – es soll trotzdem nur EINE Message pro Game dispatcht werden
        foreach (['matchPlan', 'halfDuration', 'firstHalfExtraTime', 'secondHalfExtraTime', 'isFinished'] as $field) {
            $game = $this->makeGame(42);
            $this->uow->method('getEntityChangeSet')->willReturn([$field => [null, 'new']]);
            $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));
        }

        // 5 postUpdate-Calls mit gleicher gameId → nach array_unique nur 1 Message
        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->willReturn(new Envelope(new stdClass()));

        $this->flush();
    }

    public function testPostUpdateGameWithIrrelevantFieldChangeDoesNotBuffer(): void
    {
        $game = $this->makeGame(42);
        // 'homeScore' ist kein relevantes Feld
        $this->uow->method('getEntityChangeSet')->willReturn(['homeScore' => [0, 2]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $this->messageBus->expects(self::never())->method('dispatch');
        $this->flush();
    }

    public function testPostUpdateSubstitutionBuffersGameId(): void
    {
        $game = $this->makeGame(7);
        $sub = $this->makeSub($game);

        $this->listener->postUpdate(new PostUpdateEventArgs($sub, $this->em));

        $dispatched = [];
        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->willReturnCallback(function (RecalcPlayerStatsMessage $msg) use (&$dispatched): Envelope {
                $dispatched[] = $msg->gameId;

                return new Envelope($msg);
            });

        $this->flush();
        self::assertSame([7], $dispatched);
    }

    public function testPostUpdateIgnoresOtherEntities(): void
    {
        $this->listener->postUpdate(new PostUpdateEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects(self::never())->method('dispatch');
        $this->flush();
    }

    // ── postPersist ───────────────────────────────────────────────────────────

    public function testPostPersistSubstitutionBuffersGameId(): void
    {
        $game = $this->makeGame(13);
        $sub = $this->makeSub($game);

        $this->listener->postPersist(new PostPersistEventArgs($sub, $this->em));

        $dispatched = [];
        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->willReturnCallback(function (RecalcPlayerStatsMessage $msg) use (&$dispatched): Envelope {
                $dispatched[] = $msg->gameId;

                return new Envelope($msg);
            });

        $this->flush();
        self::assertSame([13], $dispatched);
    }

    public function testPostPersistIgnoresOtherEntities(): void
    {
        $this->listener->postPersist(new PostPersistEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects(self::never())->method('dispatch');
        $this->flush();
    }

    // ── preRemove ─────────────────────────────────────────────────────────────

    public function testPreRemoveSubstitutionBuffersGameIdBeforeDeletion(): void
    {
        $game = $this->makeGame(55);
        $sub = $this->makeSub($game);

        $this->listener->preRemove(new PreRemoveEventArgs($sub, $this->em));

        $dispatched = [];
        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->willReturnCallback(function (RecalcPlayerStatsMessage $msg) use (&$dispatched): Envelope {
                $dispatched[] = $msg->gameId;

                return new Envelope($msg);
            });

        $this->flush();
        self::assertSame([55], $dispatched);
    }

    public function testPreRemoveIgnoresOtherEntities(): void
    {
        $this->listener->preRemove(new PreRemoveEventArgs(new stdClass(), $this->em));

        $this->messageBus->expects(self::never())->method('dispatch');
        $this->flush();
    }

    // ── postFlush ─────────────────────────────────────────────────────────────

    public function testPostFlushWithNoPendingIdsDispatchesNothing(): void
    {
        $this->messageBus->expects(self::never())->method('dispatch');
        $this->flush();
    }

    public function testPostFlushDeduplicatesDuplicateGameIds(): void
    {
        // Zwei Events für dieselbe gameId 42 (z.B. matchPlan + halfDuration geändert)
        $game = $this->makeGame(42);
        $this->uow->method('getEntityChangeSet')->willReturn(['matchPlan' => [null, []]]);

        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));
        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        $dispatchCount = 0;
        $this->messageBus->expects(self::once()) // nur EINE Message trotz zwei Events
            ->method('dispatch')
            ->willReturnCallback(function (RecalcPlayerStatsMessage $msg) use (&$dispatchCount): Envelope {
                ++$dispatchCount;

                return new Envelope($msg);
            });

        $this->flush();
        self::assertSame(1, $dispatchCount);
    }

    public function testPostFlushClearsBufferSoSubsequentFlushDoesNotRedispatch(): void
    {
        $game = $this->makeGame(42);
        $this->uow->method('getEntityChangeSet')->willReturn(['matchPlan' => [null, []]]);
        $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));

        // Erster Flush dispatcht genau eine Message
        $this->messageBus->expects(self::once())
            ->method('dispatch')
            ->willReturn(new Envelope(new stdClass()));

        $this->flush();

        // Zweiter Flush OHNE neue Events – Puffer war geleert → kein weiterer Dispatch
        // (expects(once()) ist bereits gesetzt, ein zweiter Aufruf würde den Test fehlschlagen lassen)
        $this->flush();
    }

    public function testPostFlushDispatchesOneMessagePerUniqueGame(): void
    {
        // Drei verschiedene Games puffern → 3 Messages
        foreach ([1, 2, 3] as $gameId) {
            $game = $this->makeGame($gameId);
            $this->uow->method('getEntityChangeSet')->willReturn(['halfDuration' => [45, 30]]);
            $this->listener->postUpdate(new PostUpdateEventArgs($game, $this->em));
        }

        $dispatchedIds = [];
        $this->messageBus->expects(self::exactly(3))
            ->method('dispatch')
            ->willReturnCallback(function (RecalcPlayerStatsMessage $msg) use (&$dispatchedIds): Envelope {
                $dispatchedIds[] = $msg->gameId;

                return new Envelope($msg);
            });

        $this->flush();
        sort($dispatchedIds);
        self::assertSame([1, 2, 3], $dispatchedIds);
    }
}
