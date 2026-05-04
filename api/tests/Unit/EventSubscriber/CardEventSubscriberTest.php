<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventSubscriber;

use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\User;
use App\Event\GameEventCreatedEvent;
use App\EventSubscriber\CardEventSubscriber;
use App\Message\CheckCardThresholdsMessage;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\MessageBusInterface;

#[AllowMockObjectsWithoutExpectations]
class CardEventSubscriberTest extends TestCase
{
    private MessageBusInterface&MockObject $bus;
    private CardEventSubscriber $subscriber;

    protected function setUp(): void
    {
        $this->bus = $this->createMock(MessageBusInterface::class);
        $this->subscriber = new CardEventSubscriber($this->bus);
    }

    private function makeEvent(string $typeCode, ?int $gameEventId = 1): GameEventCreatedEvent
    {
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getCode')->willReturn($typeCode);

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getGameEventType')->willReturn($eventType);
        $gameEvent->method('getId')->willReturn($gameEventId);

        $user = $this->createMock(User::class);

        return new GameEventCreatedEvent($user, $gameEvent);
    }

    /** @return array<string, array{string}> */
    public static function cardEventCodesProvider(): array
    {
        return [
            'yellow_card' => ['yellow_card'],
            'red_card' => ['red_card'],
            'yellow_red_card' => ['yellow_red_card'],
        ];
    }

    #[DataProvider('cardEventCodesProvider')]
    public function testCardEventDispatchesMessage(string $code): void
    {
        $this->bus->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(CheckCardThresholdsMessage::class))
            ->willReturn(new Envelope(new CheckCardThresholdsMessage(1)));

        $this->subscriber->onGameEventCreated($this->makeEvent($code, 1));
    }

    public function testCardEventMessageContainsCorrectId(): void
    {
        $capturedMessage = null;
        $this->bus->method('dispatch')->willReturnCallback(function ($message) use (&$capturedMessage) {
            $capturedMessage = $message;

            return new Envelope($message);
        });

        $this->subscriber->onGameEventCreated($this->makeEvent('yellow_card', 42));

        $this->assertInstanceOf(CheckCardThresholdsMessage::class, $capturedMessage);
        $this->assertSame(42, $capturedMessage->gameEventId);
    }

    public function testNonCardEventDoesNotDispatch(): void
    {
        $this->bus->expects($this->never())->method('dispatch');
        $this->subscriber->onGameEventCreated($this->makeEvent('goal', 1));
    }

    public function testOtherNonCardEventDoesNotDispatch(): void
    {
        $this->bus->expects($this->never())->method('dispatch');
        $this->subscriber->onGameEventCreated($this->makeEvent('substitution', 1));
    }

    public function testNullGameEventTypeDoesNotDispatch(): void
    {
        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getGameEventType')->willReturn(null);
        $gameEvent->method('getId')->willReturn(1);

        $user = $this->createMock(User::class);
        $event = new GameEventCreatedEvent($user, $gameEvent);

        $this->bus->expects($this->never())->method('dispatch');
        $this->subscriber->onGameEventCreated($event);
    }

    public function testNullGameEventIdDoesNotDispatch(): void
    {
        // ID = null (noch nicht persistiert)
        $this->bus->expects($this->never())->method('dispatch');
        $this->subscriber->onGameEventCreated($this->makeEvent('yellow_card', null));
    }

    public function testGetSubscribedEvents(): void
    {
        $events = CardEventSubscriber::getSubscribedEvents();
        $this->assertArrayHasKey(GameEventCreatedEvent::class, $events);
    }
}
