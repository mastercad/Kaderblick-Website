<?php

namespace App\EventSubscriber;

use App\Entity\User;
use App\Event\CalendarEventCreatedEvent;
use App\Event\CalendarEventDeletedEvent;
use App\Event\CalendarEventUpdatedEvent;
use App\Repository\UserRepository;
use App\Service\CalendarNotificationMessageBuilder;
use App\Service\NotificationService;
use App\Service\SystemSettingService;
use App\Service\TeamMembershipService;
use Exception;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Sends push notifications to relevant users when a CalendarEvent is created,
 * updated or deleted.
 *
 * Recipients are resolved via TeamMembershipService::resolveEventRecipients(),
 * which respects team/club/user permissions, game teams, task assignments, etc.
 *
 * The push-notification mode (all / only_me / disabled) is read from
 * SystemSettingService and applied before any notification is sent.
 *
 * Message text is built by CalendarNotificationMessageBuilder.
 */
class CalendarEventNotificationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly TeamMembershipService $teamMembershipService,
        private readonly SystemSettingService $settingService,
        private readonly UserRepository $userRepository,
        private readonly LoggerInterface $logger,
        private readonly CalendarNotificationMessageBuilder $messageBuilder,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            CalendarEventCreatedEvent::class => 'onCalendarEventCreated',
            CalendarEventUpdatedEvent::class => 'onCalendarEventUpdated',
            CalendarEventDeletedEvent::class => 'onCalendarEventDeleted',
        ];
    }

    public function onCalendarEventCreated(CalendarEventCreatedEvent $event): void
    {
        $calendarEvent = $event->getCalendarEvent();
        $actor         = $event->getUser();

        if (!$calendarEvent->getId()) {
            return;
        }

        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED === $this->settingService->getPushNotificationsMode()) {
            return;
        }

        try {
            $normalRecipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $actor);
            $recipients       = $this->filterRecipientsByMode($normalRecipients);

            if (0 === count($recipients)) {
                return;
            }

            ['title' => $title, 'body' => $body] = $this->messageBuilder->forCreated($calendarEvent);
            $body = $this->appendOnlyMeHint($body, $normalRecipients);

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_created',
                $title,
                $body,
                [
                    'eventId'    => $calendarEvent->getId(),
                    'eventTitle' => $calendarEvent->getTitle(),
                    'createdBy'  => $actor->getFullName(),
                    'url'        => '/calendar?eventId=' . $calendarEvent->getId(),
                ]
            );
        } catch (Exception $e) {
            $this->logger->error('Failed to send event-created notifications: ' . $e->getMessage(), [
                'eventId' => $calendarEvent->getId(),
                'actorId' => $actor->getId(),
            ]);
        }
    }

    public function onCalendarEventUpdated(CalendarEventUpdatedEvent $event): void
    {
        $calendarEvent = $event->getCalendarEvent();
        $actor         = $event->getUser();
        $scope         = $event->getScope();

        if (!$calendarEvent->getId()) {
            return;
        }

        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED === $this->settingService->getPushNotificationsMode()) {
            return;
        }

        try {
            $normalRecipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $actor);
            $recipients       = $this->filterRecipientsByMode($normalRecipients);

            if (0 === count($recipients)) {
                return;
            }

            ['title' => $title, 'body' => $body] = $this->messageBuilder->forUpdated($event);
            $body = $this->appendOnlyMeHint($body, $normalRecipients);

            // For series edits individual events may have been deleted/recreated,
            // so link to the general calendar rather than a specific (possibly gone) event.
            $url = 'single' === $scope
                ? '/calendar?eventId=' . $calendarEvent->getId()
                : '/calendar';

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_updated',
                $title,
                $body,
                [
                    'eventId'    => $calendarEvent->getId(),
                    'eventTitle' => $calendarEvent->getTitle(),
                    'updatedBy'  => $actor->getFullName(),
                    'url'        => $url,
                ]
            );
        } catch (Exception $e) {
            $this->logger->error('Failed to send event-updated notifications: ' . $e->getMessage(), [
                'eventId' => $calendarEvent->getId(),
                'actorId' => $actor->getId(),
            ]);
        }
    }

    public function onCalendarEventDeleted(CalendarEventDeletedEvent $event): void
    {
        $calendarEvent = $event->getCalendarEvent();
        $actor         = $event->getUser();

        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED === $this->settingService->getPushNotificationsMode()) {
            return;
        }

        try {
            $normalRecipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $actor);
            $recipients       = $this->filterRecipientsByMode($normalRecipients);

            if (0 === count($recipients)) {
                return;
            }

            ['title' => $title, 'body' => $body] = $this->messageBuilder->forDeleted($event);
            $body = $this->appendOnlyMeHint($body, $normalRecipients);

            // Deleted events no longer exist – no "Öffnen" button.
            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_deleted',
                $title,
                $body,
                [
                    'eventTitle' => $calendarEvent->getTitle(),
                    'deletedBy'  => $actor->getFullName(),
                ]
            );
        } catch (Exception $e) {
            $this->logger->error('Failed to send event-deleted notifications: ' . $e->getMessage(), [
                'eventId' => $calendarEvent->getId(),
                'actorId' => $actor->getId(),
            ]);
        }
    }

    /**
     * Applies the current push-notification mode to the resolved recipient list.
     *
     * @param User[] $recipients
     *
     * @return User[]
     */
    private function filterRecipientsByMode(array $recipients): array
    {
        $mode = $this->settingService->getPushNotificationsMode();

        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED === $mode) {
            return [];
        }

        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME === $mode) {
            // Return ALL SuperAdmins — not just those who happen to be in the
            // normal recipient list — so the SuperAdmin always gets every notification.
            return $this->userRepository->findSuperAdmins();
        }

        return $recipients;
    }

    /**
     * In only_me mode: appends a diagnostic line listing who would normally have
     * received this notification, so SuperAdmins can verify delivery.
     *
     * Returns the original body unchanged in all / disabled modes.
     *
     * @param User[] $intendedRecipients
     */
    private function appendOnlyMeHint(string $body, array $intendedRecipients): string
    {
        if (SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME !== $this->settingService->getPushNotificationsMode()) {
            return $body;
        }

        $hint = 0 === count($intendedRecipients)
            ? '👥 Wäre normalerweise an niemanden gegangen.'
            : '👥 Wäre normalerweise an: ' . implode(', ', array_unique(array_map(
                static fn (User $u) => $u->getFullName(),
                $intendedRecipients,
            )));

        return '' === $body ? $hint : $body . "\n" . $hint;
    }
}
