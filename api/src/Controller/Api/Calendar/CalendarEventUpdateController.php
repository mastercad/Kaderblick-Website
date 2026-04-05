<?php

namespace App\Controller\Api\Calendar;

use App\Dto\CalendarEventChangeSet;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Event\CalendarEventUpdatedEvent;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\TrainingSeriesUpdateService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarEventUpdateController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventService $calendarEventService,
        private readonly TrainingSeriesUpdateService $trainingSeriesUpdateService,
        private readonly EventDispatcherInterface $dispatcher,
    ) {
    }

    #[Route('/event/{id}', name: 'event_update', methods: ['PUT'])]
    public function updateCalendarEvent(CalendarEvent $calendarEvent, Request $request): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::EDIT, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $ownershipError = $this->calendarEventService->validateMatchTeamOwnership($data, $currentUser);
        if (null !== $ownershipError) {
            return $this->json(['error' => $ownershipError, 'success' => false], 403);
        }

        $scope    = $data['trainingEditScope'] ?? 'single';
        $seriesId = $calendarEvent->getTrainingSeriesId();

        // Single event (or no series): update only the one event.
        if ('single' === $scope || null === $seriesId) {
            $oldStartTime    = $calendarEvent->getStartDate()?->format('H:i');
            $oldEndTime      = $calendarEvent->getEndDate()?->format('H:i');
            $oldLocationName = $calendarEvent->getLocation()?->getName();

            $this->calendarEventService->updateEventFromData($calendarEvent, $data);
            $this->entityManager->flush();

            $changeSet = new CalendarEventChangeSet(
                oldStartTime:    $oldStartTime,
                newStartTime:    $calendarEvent->getStartDate()?->format('H:i'),
                oldEndTime:      $oldEndTime,
                newEndTime:      $calendarEvent->getEndDate()?->format('H:i'),
                oldLocationName: $oldLocationName,
                newLocationName: $calendarEvent->getLocation()?->getName(),
            );

            $this->dispatcher->dispatch(
                new CalendarEventUpdatedEvent($currentUser, $calendarEvent, 1, 'single', $changeSet)
            );

            return $this->json(['success' => true]);
        }

        // Series update: delegate to the service.
        $result = $this->trainingSeriesUpdateService->update($calendarEvent, $data, $scope, $currentUser);

        // Dispatch BEFORE flush so subscriber can still read relations.
        $this->dispatcher->dispatch(new CalendarEventUpdatedEvent(
            $currentUser,
            $calendarEvent,
            $result->updatedCount,
            $scope,
            $result->changeSet,
            $result->oldSeriesEndDate,
            $result->newSeriesEndDate,
        ));

        $this->entityManager->flush();

        return $this->json(['success' => true, 'updatedCount' => $result->updatedCount]);
    }
}
