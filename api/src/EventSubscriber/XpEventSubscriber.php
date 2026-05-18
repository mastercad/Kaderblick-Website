<?php

namespace App\EventSubscriber;

use App\Event\CalendarEventCreatedEvent;
use App\Event\CalendarEventParticipatedEvent;
use App\Event\CarpoolOfferedEvent;
use App\Event\DailyLoginEvent;
use App\Event\GameEventCreatedEvent;
use App\Event\GameEventUpdatedEvent;
use App\Event\GoalAssistedEvent;
use App\Event\GoalScoredEvent;
use App\Event\MatchAttendedEvent;
use App\Event\ParticipationRespondedEvent;
use App\Event\ProfileCompletenessReachedEvent;
use App\Event\ProfileUpdatedEvent;
use App\Event\SurveyCompletedEvent;
use App\Event\TaskCompletedEvent;
use App\Event\TrainingAttendedEvent;
use App\Repository\XpRuleRepository;
use App\Service\XPRegistrationService;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class XpEventSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private XPRegistrationService $xpRegistrationService,
        private XpRuleRepository $xpRuleRepository,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            // ── Platform ──────────────────────────────────────────────────────
            DailyLoginEvent::class => 'onDailyLogin',
            ProfileUpdatedEvent::class => 'onProfileUpdated',
            ProfileCompletenessReachedEvent::class => 'onProfileCompletenessReached',
            SurveyCompletedEvent::class => 'onSurveyCompleted',
            TaskCompletedEvent::class => 'onTaskCompleted',
            // ── Sport ─────────────────────────────────────────────────────────
            CalendarEventParticipatedEvent::class => 'onCalendarEventParticipated',
            CalendarEventCreatedEvent::class => 'onCalendarEventCreated',
            TrainingAttendedEvent::class => 'onTrainingAttended',
            MatchAttendedEvent::class => 'onMatchAttended',
            ParticipationRespondedEvent::class => 'onParticipationResponded',
            CarpoolOfferedEvent::class => 'onCarpoolOffered',
            GameEventCreatedEvent::class => 'onGameEventCreated',
            GameEventUpdatedEvent::class => 'onGameEventUpdated',
            GoalScoredEvent::class => 'onGoalScored',
            GoalAssistedEvent::class => 'onGoalAssisted',
        ];
    }

    // ── Platform handlers ────────────────────────────────────────────────────

    public function onDailyLogin(DailyLoginEvent $event): void
    {
        $user = $event->getUser();
        // Use userId as actionId so the rule dedup works per user scope.
        // The cooldown=-1 + dailyLimit=1 on the rule prevents multiple awards/day.
        $this->xpRegistrationService->registerXpEvent($user, 'daily_login', $user->getId());
    }

    public function onProfileUpdated(ProfileUpdatedEvent $event): void
    {
        $user = $event->getUser();
        $this->xpRegistrationService->registerXpEvent($user, 'profile_update', $user->getId());
    }

    public function onProfileCompletenessReached(ProfileCompletenessReachedEvent $event): void
    {
        $user = $event->getUser();
        $actionType = 'profile_completion_' . $event->getMilestone();
        $this->xpRegistrationService->registerXpEvent($user, $actionType, $user->getId());
    }

    public function onSurveyCompleted(SurveyCompletedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'survey_completed',
            $event->getSurvey()->getId()
        );
    }

    public function onTaskCompleted(TaskCompletedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'task_completed',
            $event->getTask()->getId()
        );
    }

    // ── Sport handlers ───────────────────────────────────────────────────────

    public function onCalendarEventParticipated(CalendarEventParticipatedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'calendar_event',
            $event->getCalendarEvent()->getId()
        );
    }

    public function onCalendarEventCreated(CalendarEventCreatedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'calendar_event_created',
            $event->getCalendarEvent()->getId()
        );
    }

    public function onTrainingAttended(TrainingAttendedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'training_attended',
            $event->getCalendarEvent()->getId()
        );
    }

    public function onMatchAttended(MatchAttendedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'match_attended',
            $event->getCalendarEvent()->getId()
        );
    }

    public function onParticipationResponded(ParticipationRespondedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'participation_response',
            $event->getCalendarEvent()->getId()
        );
    }

    public function onCarpoolOffered(CarpoolOfferedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'carpool_offered',
            $event->getTeamRide()->getId()
        );
    }

    /**
     * Awards XP for game events, preferring a type-specific rule
     * (e.g. 'game_event_type_goal') over the generic 'game_event' fallback.
     *
     * Admin can add custom rules per GameEventType by creating an XpRule with
     * actionType = 'game_event_type_{code}' in the XP-Konfiguration panel.
     */
    public function onGameEventCreated(GameEventCreatedEvent $event): void
    {
        $user = $event->getUser();
        $gameEvent = $event->getGameEvent();
        $eventId = $gameEvent->getId();

        $typeCode = $gameEvent->getGameEventType()?->getCode();
        $specific = $typeCode ? 'game_event_type_' . $typeCode : null;

        // Use type-specific rule when it exists and is enabled; fall back to generic.
        if ($specific && null !== $this->xpRuleRepository->findEnabledByActionType($specific)) {
            $this->xpRegistrationService->registerXpEvent($user, $specific, $eventId);
        } else {
            $this->xpRegistrationService->registerXpEvent($user, 'game_event', $eventId);
        }
    }

    public function onGameEventUpdated(GameEventUpdatedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'game_event_updated',
            $event->getGameEvent()->getId()
        );
    }

    public function onGoalScored(GoalScoredEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'goal_scored',
            $event->getGameEvent()->getId()
        );
    }

    public function onGoalAssisted(GoalAssistedEvent $event): void
    {
        $this->xpRegistrationService->registerXpEvent(
            $event->getUser(),
            'goal_assisted',
            $event->getGameEvent()->getId()
        );
    }
}
