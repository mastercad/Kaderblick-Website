<?php

namespace App\Service;

use App\Entity\Notification;
use App\Entity\User;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;

class NotificationService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private NotificationRepository $notificationRepository
    ) {
    }

    /**
     * Create a new notification for a user.
     *
     * @param array<mixed> $data
     */
    public function createNotification(
        User $user,
        string $type,
        string $title,
        ?string $message = null,
        ?array $data = null
    ): Notification {
        $notification = new Notification();
        $notification->setUser($user)
            ->setType($type)
            ->setTitle($title)
            ->setMessage($message)
            ->setData($data)
            ->setIsSent(false);

        $this->entityManager->persist($notification);
        $this->entityManager->flush();

        // Push-Versand erfolgt asynchron durch den Cron-Job app:notifications:send-unsent.
        // isSent bleibt false, bis der Cron die Notification verarbeitet.

        return $notification;
    }

    /**
     * Create notification for multiple users.
     *
     * @param User[]       $users
     * @param array<mixed> $data
     *
     * @return Notification[]
     */
    public function createNotificationForUsers(
        array $users,
        string $type,
        string $title,
        ?string $message = null,
        ?array $data = null
    ): array {
        $notifications = [];

        foreach ($users as $user) {
            $notification = new Notification();
            $notification->setUser($user)
                ->setType($type)
                ->setTitle($title)
                ->setMessage($message)
                ->setData($data)
                ->setIsSent(false);

            $this->entityManager->persist($notification);
            $notifications[] = $notification;
        }

        $this->entityManager->flush();

        // Push-Versand erfolgt asynchron durch den Cron-Job app:notifications:send-unsent.
        // isSent bleibt false, bis der Cron die Notifications verarbeitet.

        return $notifications;
    }

    /**
     * Mark a notification as read.
     */
    public function markAsRead(Notification $notification): void
    {
        if (!$notification->isRead()) {
            $notification->setIsRead(true);
            $this->entityManager->flush();
        }
    }

    /**
     * Mark multiple notifications as read.
     *
     * @param Notification[] $notifications
     */
    public function markAsReadBatch(array $notifications): void
    {
        foreach ($notifications as $notification) {
            if (!$notification->isRead()) {
                $notification->setIsRead(true);
            }
        }
        $this->entityManager->flush();
    }

    /**
     * Mark all notifications as read for a user.
     */
    public function markAllAsReadForUser(User $user): int
    {
        return $this->notificationRepository->markAllAsReadForUser($user);
    }

    /**
     * Get notifications for a user.
     *
     * @return Notification[]
     */
    public function getNotificationsForUser(User $user, int $limit = 50): array
    {
        return $this->notificationRepository->findByUser($user, $limit);
    }

    /**
     * Get unread notifications for a user.
     *
     * @return Notification[]
     */
    public function getUnreadNotificationsForUser(User $user): array
    {
        return $this->notificationRepository->findUnreadByUser($user);
    }

    /**
     * Get unread notification count for a user.
     */
    public function getUnreadCountForUser(User $user): int
    {
        return $this->notificationRepository->countUnreadByUser($user);
    }

    /**
     * Clean up old read notifications.
     */
    public function cleanupOldNotifications(int $daysOld = 30): int
    {
        return $this->notificationRepository->deleteOldReadNotifications($daysOld);
    }

    /**
     * Create a news notification.
     */
    public function createNewsNotification(User $user, string $title, string $message, int $newsId): Notification
    {
        return $this->createNotification(
            $user,
            'news',
            'Neue Nachricht: ' . $title,
            $message,
            ['newsId' => $newsId, 'url' => '/news/' . $newsId]
        );
    }

    /**
     * Create a message notification.
     */
    public function createMessageNotification(User $user, string $sender, string $subject, int $messageId): Notification
    {
        return $this->createNotification(
            $user,
            'message',
            'Neue Nachricht von ' . $sender,
            $subject,
            ['messageId' => $messageId, 'url' => '/?modal=messages&messageId=' . $messageId]
        );
    }

    /**
     * Create a participation status notification.
     */
    public function createParticipationNotification(
        User $user,
        string $gameName,
        string $status,
        int $participationId
    ): Notification {
        $statusText = match ($status) {
            'confirmed' => 'zugesagt',
            'declined' => 'abgesagt',
            'pending' => 'offen',
            default => $status
        };

        return $this->createNotification(
            $user,
            'participation',
            'Teilnahme ' . $statusText . ': ' . $gameName,
            'Ihre Teilnahme wurde auf "' . $statusText . '" gesetzt.',
            ['participationId' => $participationId, 'url' => '/games/' . $participationId]
        );
    }
}
