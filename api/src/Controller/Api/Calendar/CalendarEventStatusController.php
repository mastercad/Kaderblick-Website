<?php

namespace App\Controller\Api\Calendar;

use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\EmailNotificationService;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarEventStatusController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly NotificationService $notificationService,
        private readonly TeamMembershipService $teamMembershipService,
        private readonly EmailNotificationService $emailService,
        private readonly CalendarEventService $calendarEventService,
    ) {
    }

    #[Route('/event/{id}/cancel', name: 'event_cancel', methods: ['PATCH'])]
    public function cancelEvent(CalendarEvent $calendarEvent, Request $request): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::CANCEL, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden — nur Admins und Trainer können absagen.'], 403);
        }

        if ($calendarEvent->isCancelled()) {
            return $this->json(['error' => 'Event ist bereits abgesagt.'], 400);
        }

        $data   = json_decode($request->getContent(), true);
        $reason = trim($data['reason'] ?? '');

        if ('' === $reason) {
            return $this->json(['error' => 'Bitte gib einen Grund für die Absage an.'], 400);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $calendarEvent->setCancelled(true);
        $calendarEvent->setCancelReason($reason);
        $calendarEvent->setCancelledBy($currentUser);
        $this->entityManager->flush();

        $recipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $currentUser);

        if (count($recipients) > 0) {
            $eventTitle = $calendarEvent->getTitle();
            $startDate  = $calendarEvent->getStartDate()?->format('d.m.Y H:i') ?? '';
            $location   = $calendarEvent->getLocation();

            $lines = [];
            if ('' !== $startDate) {
                $lines[] = '📅 ' . $startDate;
            }
            if ($location) {
                $lines[] = '📍 ' . $location->getName();
            }
            $lines[] = 'Das Event "' . $eventTitle . '" wurde abgesagt.';
            $lines[] = 'Grund: ' . $reason;

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_cancelled',
                'Absage: ' . $eventTitle,
                implode("\n", $lines),
                [
                    'eventTitle'  => $eventTitle,
                    'reason'      => $reason,
                    'cancelledBy' => $currentUser->getFullName(),
                    'url'         => '/calendar?eventId=' . $calendarEvent->getId(),
                ]
            );
        }

        return $this->json(['success' => true, 'recipientCount' => count($recipients)]);
    }

    #[Route('/event/{id}/reactivate', name: 'event_reactivate', methods: ['PATCH'])]
    public function reactivateEvent(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::CANCEL, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden — nur Admins und Trainer können Events reaktivieren.'], 403);
        }

        if (!$calendarEvent->isCancelled()) {
            return $this->json(['error' => 'Event ist nicht abgesagt.'], 400);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $calendarEvent->setCancelled(false);
        $calendarEvent->setCancelReason(null);
        $calendarEvent->setCancelledBy(null);
        $this->entityManager->flush();

        $recipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $currentUser);

        if (count($recipients) > 0) {
            $eventTitle = $calendarEvent->getTitle();
            $startDate  = $calendarEvent->getStartDate()?->format('d.m.Y H:i') ?? '';
            $location   = $calendarEvent->getLocation();

            $lines = [];
            if ('' !== $startDate) {
                $lines[] = '📅 ' . $startDate;
            }
            if ($location) {
                $lines[] = '📍 ' . $location->getName();
            }
            $lines[] = 'Das Event "' . $eventTitle . '" findet doch statt!';

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_reactivated',
                'Reaktiviert: ' . $eventTitle,
                implode("\n", $lines),
                [
                    'eventTitle'    => $eventTitle,
                    'reactivatedBy' => $currentUser->getFullName(),
                    'url'           => '/calendar?eventId=' . $calendarEvent->getId(),
                ]
            );
        }

        return $this->json(['success' => true, 'recipientCount' => count($recipients)]);
    }

    #[Route('/event/{id}/notify', name: 'event_notify', methods: ['POST'])]
    public function notifyAboutEvent(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::EDIT, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $recipients = $this->calendarEventService->loadEventRecipients($calendarEvent);
        $emails     = array_filter(array_map(fn (User $u) => $u->getEmail(), $recipients));
        $this->emailService->sendEventNotification($emails, $calendarEvent);

        $calendarEvent->setNotificationSent(true);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }
}
