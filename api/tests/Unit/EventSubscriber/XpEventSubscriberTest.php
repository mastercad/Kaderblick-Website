<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventSubscriber;

use App\Entity\CalendarEvent;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Survey;
use App\Entity\Task;
use App\Entity\TeamRide;
use App\Entity\User;
use App\Entity\XpRule;
use App\Event\CalendarEventCreatedEvent;
use App\Event\CalendarEventParticipatedEvent;
use App\Event\CarpoolOfferedEvent;
use App\Event\DailyLoginEvent;
use App\Event\GameEventCreatedEvent;
use App\Event\GameEventUpdatedEvent;
use App\Event\MatchAttendedEvent;
use App\Event\ParticipationRespondedEvent;
use App\Event\ProfileCompletenessReachedEvent;
use App\Event\ProfileUpdatedEvent;
use App\Event\SurveyCompletedEvent;
use App\Event\TaskCompletedEvent;
use App\Event\TrainingAttendedEvent;
use App\EventSubscriber\XpEventSubscriber;
use App\Repository\XpRuleRepository;
use App\Service\XPRegistrationService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * @covers \App\EventSubscriber\XpEventSubscriber
 */
#[AllowMockObjectsWithoutExpectations]
class XpEventSubscriberTest extends TestCase
{
    private XPRegistrationService & MockObject $registrationService;
    private XpRuleRepository & MockObject $xpRuleRepository;
    private XpEventSubscriber $subscriber;

    protected function setUp(): void
    {
        $this->registrationService = $this->createMock(XPRegistrationService::class);
        $this->xpRuleRepository = $this->createMock(XpRuleRepository::class);

        $this->subscriber = new XpEventSubscriber(
            $this->registrationService,
            $this->xpRuleRepository,
        );
    }

    // ── getSubscribedEvents ───────────────────────────────────────────────────

    public function testSubscribedEventsContainsParticipationRespondedEvent(): void
    {
        $events = XpEventSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(ParticipationRespondedEvent::class, $events);
        $this->assertSame('onParticipationResponded', $events[ParticipationRespondedEvent::class]);
    }

    public function testSubscribedEventsContainsTrainingAttendedEvent(): void
    {
        $events = XpEventSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(TrainingAttendedEvent::class, $events);
    }

    public function testSubscribedEventsContainsMatchAttendedEvent(): void
    {
        $events = XpEventSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(MatchAttendedEvent::class, $events);
    }

    public function testSubscribedEventsContainsDailyLoginEvent(): void
    {
        $events = XpEventSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(DailyLoginEvent::class, $events);
    }

    // ── onParticipationResponded ──────────────────────────────────────────────

    public function testOnParticipationRespondedCallsRegisterXpEventWithCorrectActionType(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(42);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'participation_response', 42);

        $this->subscriber->onParticipationResponded(
            new ParticipationRespondedEvent($user, $calendarEvent)
        );
    }

    public function testOnParticipationRespondedPassesCorrectCalendarEventId(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(99);

        $capturedActionId = null;
        $this->registrationService->method('registerXpEvent')
            ->willReturnCallback(function ($u, $type, $actionId) use (&$capturedActionId): void {
                $capturedActionId = $actionId;
            });

        $this->subscriber->onParticipationResponded(
            new ParticipationRespondedEvent($user, $calendarEvent)
        );

        $this->assertSame(99, $capturedActionId);
    }

    // ── onTrainingAttended ────────────────────────────────────────────────────

    public function testOnTrainingAttendedRegistersTrainingAttendedActionType(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(7);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'training_attended', 7);

        $this->subscriber->onTrainingAttended(new TrainingAttendedEvent($user, $calendarEvent));
    }

    // ── onMatchAttended ───────────────────────────────────────────────────────

    public function testOnMatchAttendedRegistersMatchAttendedActionType(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(8);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'match_attended', 8);

        $this->subscriber->onMatchAttended(new MatchAttendedEvent($user, $calendarEvent));
    }

    // ── Ensure only one XP call per event ────────────────────────────────────

    public function testOnParticipationRespondedCallsRegisterXpEventExactlyOnce(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(1);

        $this->registrationService->expects($this->once())->method('registerXpEvent');

        $this->subscriber->onParticipationResponded(
            new ParticipationRespondedEvent($user, $calendarEvent)
        );
    }

    // ── getSubscribedEvents (all keys) ────────────────────────────────────────

    public function testSubscribedEventsContainsAllExpectedEvents(): void
    {
        $events = XpEventSubscriber::getSubscribedEvents();

        $expected = [
            DailyLoginEvent::class,
            ProfileUpdatedEvent::class,
            ProfileCompletenessReachedEvent::class,
            SurveyCompletedEvent::class,
            TaskCompletedEvent::class,
            CalendarEventParticipatedEvent::class,
            CalendarEventCreatedEvent::class,
            TrainingAttendedEvent::class,
            MatchAttendedEvent::class,
            ParticipationRespondedEvent::class,
            CarpoolOfferedEvent::class,
            GameEventCreatedEvent::class,
            GameEventUpdatedEvent::class,
        ];

        foreach ($expected as $eventClass) {
            $this->assertArrayHasKey($eventClass, $events, "Missing event: {$eventClass}");
        }
    }

    // ── onDailyLogin ──────────────────────────────────────────────────────────

    public function testOnDailyLoginRegistersWithUserId(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(5);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'daily_login', 5);

        $this->subscriber->onDailyLogin(new DailyLoginEvent($user));
    }

    // ── onProfileUpdated ──────────────────────────────────────────────────────

    public function testOnProfileUpdatedRegistersWithUserId(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(7);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'profile_update', 7);

        $this->subscriber->onProfileUpdated(new ProfileUpdatedEvent($user));
    }

    // ── onProfileCompletenessReached ──────────────────────────────────────────

    public function testOnProfileCompletenessReachedRegistersWithMilestone(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(3);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'profile_completion_50', 3);

        $this->subscriber->onProfileCompletenessReached(
            new ProfileCompletenessReachedEvent($user, 50)
        );
    }

    // ── onSurveyCompleted ─────────────────────────────────────────────────────

    public function testOnSurveyCompletedRegistersWithSurveyId(): void
    {
        $user = $this->createMock(User::class);
        $survey = $this->createMock(Survey::class);
        $survey->method('getId')->willReturn(11);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'survey_completed', 11);

        $this->subscriber->onSurveyCompleted(new SurveyCompletedEvent($user, $survey));
    }

    // ── onTaskCompleted ───────────────────────────────────────────────────────

    public function testOnTaskCompletedRegistersWithTaskId(): void
    {
        $user = $this->createMock(User::class);
        $task = $this->createMock(Task::class);
        $task->method('getId')->willReturn(22);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'task_completed', 22);

        $this->subscriber->onTaskCompleted(new TaskCompletedEvent($user, $task));
    }

    // ── onCalendarEventParticipated ───────────────────────────────────────────

    public function testOnCalendarEventParticipatedRegistersCalendarEventActionType(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(33);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'calendar_event', 33);

        $this->subscriber->onCalendarEventParticipated(
            new CalendarEventParticipatedEvent($user, $calendarEvent)
        );
    }

    // ── onCalendarEventCreated ────────────────────────────────────────────────

    public function testOnCalendarEventCreatedRegistersCalendarEventCreatedActionType(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(44);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'calendar_event_created', 44);

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($user, $calendarEvent)
        );
    }

    // ── onCarpoolOffered ──────────────────────────────────────────────────────

    public function testOnCarpoolOfferedRegistersWithTeamRideId(): void
    {
        $user = $this->createMock(User::class);
        $teamRide = $this->createMock(TeamRide::class);
        $teamRide->method('getId')->willReturn(55);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'carpool_offered', 55);

        $this->subscriber->onCarpoolOffered(new CarpoolOfferedEvent($user, $teamRide));
    }

    // ── onGameEventCreated (type-specific rule exists) ────────────────────────

    public function testOnGameEventCreatedUsesTypeSpecificRuleWhenEnabled(): void
    {
        $user = $this->createMock(User::class);
        $gameEventType = $this->createMock(GameEventType::class);
        $gameEventType->method('getCode')->willReturn('goal');

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn(77);
        $gameEvent->method('getGameEventType')->willReturn($gameEventType);

        $rule = $this->createMock(XpRule::class);
        $this->xpRuleRepository->method('findEnabledByActionType')
            ->with('game_event_type_goal')
            ->willReturn($rule);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'game_event_type_goal', 77);

        $this->subscriber->onGameEventCreated(new GameEventCreatedEvent($user, $gameEvent));
    }

    // ── onGameEventCreated (fallback to generic rule) ─────────────────────────

    public function testOnGameEventCreatedFallsBackToGenericRuleWhenNoSpecificRuleExists(): void
    {
        $user = $this->createMock(User::class);
        $gameEventType = $this->createMock(GameEventType::class);
        $gameEventType->method('getCode')->willReturn('yellow_card');

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn(88);
        $gameEvent->method('getGameEventType')->willReturn($gameEventType);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn(null);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'game_event', 88);

        $this->subscriber->onGameEventCreated(new GameEventCreatedEvent($user, $gameEvent));
    }

    public function testOnGameEventCreatedFallsBackToGenericRuleWhenNoEventType(): void
    {
        $user = $this->createMock(User::class);
        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn(89);
        $gameEvent->method('getGameEventType')->willReturn(null);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'game_event', 89);

        $this->subscriber->onGameEventCreated(new GameEventCreatedEvent($user, $gameEvent));
    }

    // ── onGameEventUpdated ────────────────────────────────────────────────────

    public function testOnGameEventUpdatedRegistersGameEventUpdatedActionType(): void
    {
        $user = $this->createMock(User::class);
        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn(99);

        $this->registrationService->expects($this->once())
            ->method('registerXpEvent')
            ->with($user, 'game_event_updated', 99);

        $this->subscriber->onGameEventUpdated(new GameEventUpdatedEvent($user, $gameEvent));
    }
}
