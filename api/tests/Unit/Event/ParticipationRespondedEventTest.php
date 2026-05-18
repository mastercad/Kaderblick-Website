<?php

declare(strict_types=1);

namespace App\Tests\Unit\Event;

use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Event\ParticipationRespondedEvent;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

/**
 * @covers \App\Event\ParticipationRespondedEvent
 */
#[AllowMockObjectsWithoutExpectations]
class ParticipationRespondedEventTest extends TestCase
{
    public function testGetUserReturnsInjectedUser(): void
    {
        $user = $this->createMock(User::class);
        $event = $this->createMock(CalendarEvent::class);

        $sut = new ParticipationRespondedEvent($user, $event);

        $this->assertSame($user, $sut->getUser());
    }

    public function testGetCalendarEventReturnsInjectedCalendarEvent(): void
    {
        $user = $this->createMock(User::class);
        $event = $this->createMock(CalendarEvent::class);

        $sut = new ParticipationRespondedEvent($user, $event);

        $this->assertSame($event, $sut->getCalendarEvent());
    }

    public function testUserAndCalendarEventAreIndependent(): void
    {
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);
        $event1 = $this->createMock(CalendarEvent::class);
        $event2 = $this->createMock(CalendarEvent::class);

        $sut1 = new ParticipationRespondedEvent($user1, $event1);
        $sut2 = new ParticipationRespondedEvent($user2, $event2);

        $this->assertSame($user1, $sut1->getUser());
        $this->assertSame($event1, $sut1->getCalendarEvent());
        $this->assertSame($user2, $sut2->getUser());
        $this->assertSame($event2, $sut2->getCalendarEvent());
    }
}
