<?php

namespace Tests\Unit\EventSubscriber;

use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Event\CalendarEventCreatedEvent;
use App\Event\CalendarEventDeletedEvent;
use App\Event\CalendarEventUpdatedEvent;
use App\EventSubscriber\CalendarEventNotificationSubscriber;
use App\Repository\UserRepository;
use App\Service\CalendarNotificationMessageBuilder;
use App\Service\NotificationService;
use App\Service\SystemSettingService;
use App\Service\TeamMembershipService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

#[AllowMockObjectsWithoutExpectations]
class CalendarEventNotificationSubscriberTest extends TestCase
{
    private NotificationService&MockObject $notificationService;
    private TeamMembershipService&MockObject $teamMembershipService;
    private SystemSettingService&MockObject $settingService;
    private UserRepository&MockObject $userRepository;
    private CalendarNotificationMessageBuilder&MockObject $messageBuilder;
    private CalendarEventNotificationSubscriber $subscriber;

    protected function setUp(): void
    {
        $this->notificationService   = $this->createMock(NotificationService::class);
        $this->teamMembershipService = $this->createMock(TeamMembershipService::class);
        $this->settingService        = $this->createMock(SystemSettingService::class);
        $this->userRepository        = $this->createMock(UserRepository::class);
        $this->messageBuilder        = $this->createMock(CalendarNotificationMessageBuilder::class);

        // Default: builder always returns dummy strings so wiring tests don't fail on content.
        $this->messageBuilder->method('forCreated')->willReturn(['title' => 'T-created', 'body' => 'B-created']);
        $this->messageBuilder->method('forUpdated')->willReturn(['title' => 'T-updated', 'body' => 'B-updated']);
        $this->messageBuilder->method('forDeleted')->willReturn(['title' => 'T-deleted', 'body' => 'B-deleted']);

        $this->subscriber = new CalendarEventNotificationSubscriber(
            $this->notificationService,
            $this->teamMembershipService,
            $this->settingService,
            $this->userRepository,
            new NullLogger(),
            $this->messageBuilder,
        );
    }

    // ────────────────────────────── getSubscribedEvents ──────────────────────

    public function testSubscribestoAllThreeEvents(): void
    {
        $events = CalendarEventNotificationSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(CalendarEventCreatedEvent::class, $events);
        $this->assertArrayHasKey(CalendarEventUpdatedEvent::class, $events);
        $this->assertArrayHasKey(CalendarEventDeletedEvent::class, $events);
    }

    // ────────────────────────────── mode: disabled ───────────────────────────

    public function testDisabledModeSkipsCreatedNotification(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED);

        $this->notificationService->expects($this->never())->method('createNotificationForUsers');
        $this->teamMembershipService->expects($this->never())->method('resolveEventRecipients');

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testDisabledModeSkipsUpdatedNotification(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED);

        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventUpdated(
            new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testDisabledModeSkipsDeletedNotification(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED);

        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventDeleted(
            new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    // ────────────────────────────── mode: only_me ────────────────────────────

    public function testOnlyMeModeLimitRecipientsToSuperadmins(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME);

        $superAdmin      = $this->makeUser(['ROLE_SUPERADMIN', 'ROLE_USER']);
        $normalRecipient = $this->makeUser(['ROLE_USER'], 'Max Mustermann');

        $this->userRepository->method('findSuperAdmins')->willReturn([$superAdmin]);
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$normalRecipient]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                [$superAdmin],
                $this->anything(),
                $this->anything(),
                $this->stringContains('Max Mustermann'),
                $this->anything()
            );

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testOnlyMeModeWithNoSuperadminsSkipsNotification(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME);

        $this->userRepository->method('findSuperAdmins')->willReturn([]);
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser(['ROLE_USER'])]);

        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testOnlyMeModeNotifiesSuperAdminEvenIfNotNormalRecipient(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME);

        $superAdmin = $this->makeUser(['ROLE_SUPERADMIN']);
        $this->userRepository->method('findSuperAdmins')->willReturn([$superAdmin]);
        $this->teamMembershipService->method('resolveEventRecipients')->willReturn([]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                [$superAdmin],
                $this->anything(),
                $this->anything(),
                $this->stringContains('niemanden'),
                $this->anything()
            );

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testOnlyMeModeMessageListsAllIntendedRecipientNames(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME);

        $superAdmin = $this->makeUser(['ROLE_SUPERADMIN'], 'Super Admin');
        $this->userRepository->method('findSuperAdmins')->willReturn([$superAdmin]);
        $this->teamMembershipService->method('resolveEventRecipients')->willReturn([
            $this->makeUser(['ROLE_USER'], 'Anna Müller'),
            $this->makeUser(['ROLE_USER'], 'Ben Schulz'),
        ]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                [$superAdmin],
                $this->anything(),
                $this->anything(),
                $this->logicalAnd(
                    $this->stringContains('Anna Müller'),
                    $this->stringContains('Ben Schulz')
                ),
                $this->anything()
            );

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    // ────────────────────────────── mode: all ────────────────────────────────

    public function testAllModePassesAllRecipients(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $users = [$this->makeUser(), $this->makeUser()];
        $this->teamMembershipService->method('resolveEventRecipients')->willReturn($users);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with($users, $this->anything(), $this->anything(), $this->anything(), $this->anything());

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    // ────────────────────────────── no recipients ────────────────────────────

    public function testNoRecipientsSkipsNotificationForCreated(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')->willReturn([]);
        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testNoRecipientsSkipsNotificationForUpdated(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')->willReturn([]);
        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventUpdated(
            new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testNoRecipientsSkipsNotificationForDeleted(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')->willReturn([]);
        $this->notificationService->expects($this->never())->method('createNotificationForUsers');

        $this->subscriber->onCalendarEventDeleted(
            new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    // ────────────────────────────── event type strings ───────────────────────

    public function testUpdatedNotificationUsesCorrectType(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with($this->anything(), 'event_updated', $this->anything(), $this->anything(), $this->anything());

        $this->subscriber->onCalendarEventUpdated(
            new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testDeletedNotificationUsesCorrectType(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with($this->anything(), 'event_deleted', $this->anything(), $this->anything(), $this->anything());

        $this->subscriber->onCalendarEventDeleted(
            new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    // ────────────────────────────── data / URL wiring ────────────────────────

    public function testCreatedNotificationDataContainsUrl(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(static fn (array $data) => isset($data['url']) && str_contains($data['url'], 'eventId=1'))
            );

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $this->makeEvent())
        );
    }

    public function testUpdatedSingleNotificationDataUrlContainsEventId(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(static fn (array $data) => ($data['url'] ?? '') === '/calendar?eventId=1')
            );

        $this->subscriber->onCalendarEventUpdated(
            new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent(), 1, 'single')
        );
    }

    public function testUpdatedSeriesNotificationDataUrlIsGenericCalendar(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(static fn (array $data) => ($data['url'] ?? '') === '/calendar')
            );

        $this->subscriber->onCalendarEventUpdated(
            new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent(), 3, 'series')
        );
    }

    public function testDeletedSingleNotificationDataHasNoUrlKey(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(static fn (array $data) => !array_key_exists('url', $data))
            );

        $this->subscriber->onCalendarEventDeleted(
            new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent(), 1, 'single')
        );
    }

    public function testDeletedSeriesNotificationDataHasNoUrlKey(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->notificationService->expects($this->once())
            ->method('createNotificationForUsers')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(static fn (array $data) => !array_key_exists('url', $data))
            );

        $this->subscriber->onCalendarEventDeleted(
            new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent(), 5, 'series', '01.04.2026', '30.06.2026')
        );
    }

    // ────────────────────────────── builder delegation ───────────────────────

    public function testCreatedDelegatesToMessageBuilderForCreated(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $calendarEvent = $this->makeEvent();
        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $this->messageBuilder->expects($this->once())->method('forCreated')->with($calendarEvent);

        $this->subscriber->onCalendarEventCreated(
            new CalendarEventCreatedEvent($this->makeUser(), $calendarEvent)
        );
    }

    public function testUpdatedDelegatesToMessageBuilderForUpdated(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $updatedEvent = new CalendarEventUpdatedEvent($this->makeUser(), $this->makeEvent());
        $this->messageBuilder->expects($this->once())->method('forUpdated')->with($updatedEvent);

        $this->subscriber->onCalendarEventUpdated($updatedEvent);
    }

    public function testDeletedDelegatesToMessageBuilderForDeleted(): void
    {
        $this->settingService->method('getPushNotificationsMode')
            ->willReturn(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL);

        $this->teamMembershipService->method('resolveEventRecipients')
            ->willReturn([$this->makeUser()]);

        $deletedEvent = new CalendarEventDeletedEvent($this->makeUser(), $this->makeEvent());
        $this->messageBuilder->expects($this->once())->method('forDeleted')->with($deletedEvent);

        $this->subscriber->onCalendarEventDeleted($deletedEvent);
    }

    // ────────────────────────────── helpers ──────────────────────────────────

    /** @param string[] $roles */
    private function makeUser(array $roles = ['ROLE_USER'], string $fullName = 'Test User'): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getRoles')->willReturn($roles);
        $user->method('getFullName')->willReturn($fullName);
        $user->method('getId')->willReturn(42);

        return $user;
    }

    private function makeEvent(string $title = 'Test Event'): CalendarEvent&MockObject
    {
        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn($title);

        return $event;
    }
}

