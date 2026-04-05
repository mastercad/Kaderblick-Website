<?php

namespace App\Controller\Api\Calendar;

use App\Entity\CalendarEvent;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Event\CalendarEventDeletedEvent;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarEventDeleteController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventService $calendarEventService,
        private readonly EventDispatcherInterface $dispatcher,
    ) {
    }

    #[Route('/event/{id}', name: 'event_delete', methods: ['DELETE'])]
    public function deleteEvent(CalendarEvent $calendarEvent, Request $request): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::DELETE, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $data         = json_decode($request->getContent(), true);
        $deletionMode = $data['deletionMode'] ?? 'single';

        // Pre-compute deletion scope for the notification.
        $delNotifCount    = 1;
        $firstDeletedDate = null;
        $lastDeletedDate  = null;

        if (in_array($deletionMode, ['series', 'from_here'], true) && $calendarEvent->getTrainingSeriesId()) {
            $allSeriesEvts = $this->entityManager->getRepository(CalendarEvent::class)->findBy([
                'trainingSeriesId' => $calendarEvent->getTrainingSeriesId(),
            ]);
            $refDate = $calendarEvent->getStartDate();
            /** @var CalendarEvent[] $scopedForNotif */
            $scopedForNotif = 'series' === $deletionMode
                ? $allSeriesEvts
                : array_values(array_filter(
                    $allSeriesEvts,
                    fn (CalendarEvent $e) => null !== $e->getStartDate() && $e->getStartDate() >= $refDate
                ));
            if (!empty($scopedForNotif)) {
                $delNotifCount = count($scopedForNotif);
                $dates = array_values(array_filter(array_map(
                    fn (CalendarEvent $e) => $e->getStartDate(), $scopedForNotif
                )));
                usort($dates, fn ($a, $b) => $a <=> $b);
                $firstDeletedDate = isset($dates[0]) ? $dates[0]->format('d.m.Y') : null;
                $lastDeletedDate  = end($dates) ? end($dates)->format('d.m.Y') : null;
            }
        }

        // Dispatch BEFORE deletion while the entity is fully accessible.
        $this->dispatcher->dispatch(new CalendarEventDeletedEvent(
            $currentUser, $calendarEvent,
            $delNotifCount, $deletionMode, $firstDeletedDate, $lastDeletedDate
        ));

        $taskAssignmentRepo = $this->entityManager->getRepository(TaskAssignment::class);
        $taskAssignment     = $taskAssignmentRepo->findOneBy(['calendarEvent' => $calendarEvent]);
        $task               = $taskAssignment?->getTask();

        if ($task && 'series' === $deletionMode) {
            $taskAssignments = $taskAssignmentRepo->findBy(['task' => $task]);
            foreach ($taskAssignments as $ta) {
                if ($ta->getCalendarEvent()) {
                    $this->calendarEventService->deleteCalendarEventWithDependencies($ta->getCalendarEvent());
                }
                $this->entityManager->remove($ta);
            }
            foreach ($task->getRotationUsers() as $user) {
                $task->removeRotationUser($user);
            }
            $this->entityManager->remove($task);
            $this->entityManager->flush();
        } elseif ('series' === $deletionMode && $calendarEvent->getTrainingSeriesId()) {
            $seriesEvents = $this->entityManager->getRepository(CalendarEvent::class)->findBy([
                'trainingSeriesId' => $calendarEvent->getTrainingSeriesId(),
            ]);
            foreach ($seriesEvents as $seriesEvent) {
                $this->calendarEventService->deleteCalendarEventWithDependencies($seriesEvent);
            }
        } elseif ('from_here' === $deletionMode && $calendarEvent->getTrainingSeriesId()) {
            $seriesEvents = $this->entityManager->getRepository(CalendarEvent::class)->findBy([
                'trainingSeriesId' => $calendarEvent->getTrainingSeriesId(),
            ]);
            $refDate = $calendarEvent->getStartDate();
            foreach ($seriesEvents as $seriesEvent) {
                if ($seriesEvent->getStartDate() >= $refDate) {
                    $this->calendarEventService->deleteCalendarEventWithDependencies($seriesEvent);
                }
            }
        } else {
            $this->calendarEventService->deleteCalendarEventWithDependencies($calendarEvent);
        }

        return $this->json(['success' => true]);
    }
}
