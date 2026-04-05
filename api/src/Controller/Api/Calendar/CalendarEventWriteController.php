<?php

namespace App\Controller\Api\Calendar;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Location;
use App\Entity\Team;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Event\CalendarEventCreatedEvent;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarEventWriteController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventService $calendarEventService,
        private readonly EventDispatcherInterface $dispatcher,
    ) {
    }

    #[Route('/event', name: 'event_create', methods: ['POST'])]
    public function createEvent(Request $request, SerializerInterface $serializer): JsonResponse
    {
        $data    = $request->getContent();
        $context = ['groups' => ['calendar_event:write']];

        $calendarEvent = $serializer->deserialize($data, CalendarEvent::class, 'json', $context);

        if (!$this->isGranted(CalendarEventVoter::CREATE, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden', 'success' => false], 403);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();
        $jsonData    = json_decode($data, true);

        $ownershipError = $this->calendarEventService->validateMatchTeamOwnership($jsonData, $currentUser);
        if (null !== $ownershipError) {
            return $this->json(['error' => $ownershipError, 'success' => false], 403);
        }

        $errors = $this->calendarEventService->updateEventFromData($calendarEvent, $jsonData);

        if (0 < count($errors)) {
            $messages = array_map(fn ($e) => $e->getMessage(), iterator_to_array($errors));

            return $this->json(['error' => implode(', ', $messages), 'success' => false], 400);
        }

        $this->dispatcher->dispatch(new CalendarEventCreatedEvent($currentUser, $calendarEvent));

        return $this->json(['success' => true]);
    }

    /**
     * Creates a recurring training series: one CalendarEvent per occurrence.
     */
    #[Route('/training-series', name: 'training_series_create', methods: ['POST'])]
    public function createTrainingSeries(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $title       = $data['title'] ?? '';
        $startDate   = $data['startDate'] ?? null;
        $endDate     = $data['seriesEndDate'] ?? null;
        $weekdays    = $data['weekdays'] ?? [];
        $eventTypeId = $data['eventTypeId'] ?? null;
        $teamId      = $data['teamId'] ?? null;
        $time        = $data['time'] ?? null;
        $endTime     = $data['endTime'] ?? null;
        $duration    = isset($data['duration']) ? (int) $data['duration'] : 90;
        $locationId  = $data['locationId'] ?? null;
        $description = $data['description'] ?? '';

        if (!$title || !$startDate || !$endDate || empty($weekdays) || !$eventTypeId) {
            return $this->json(['error' => 'Pflichtfelder fehlen (Titel, Startdatum, Enddatum, Wochentage, Event-Typ).', 'success' => false], 400);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $eventType = $this->entityManager->getReference(CalendarEventType::class, (int) $eventTypeId);
        $location  = $locationId ? $this->entityManager->getReference(Location::class, (int) $locationId) : null;
        $team      = $teamId ? $this->entityManager->getReference(Team::class, (int) $teamId) : null;

        if ($team && !$this->isGranted(CalendarEventVoter::CREATE, $team)) {
            return $this->json(['error' => 'Keine Berechtigung für das ausgewählte Team.', 'success' => false], 403);
        }

        $cursor  = new DateTimeImmutable($startDate);
        $end     = new DateTimeImmutable($endDate);
        $bytes   = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $seriesId     = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
        $createdCount = 0;

        while ($cursor <= $end) {
            $dayOfWeek = (int) $cursor->format('w');
            if (in_array($dayOfWeek, $weekdays, true)) {
                $event = new CalendarEvent();
                $event->setTitle($title);
                $event->setDescription($description ?: null);
                $event->setCalendarEventType($eventType);
                $event->setCreatedBy($currentUser);
                $event->setTrainingWeekdays($weekdays);
                $event->setTrainingSeriesEndDate($end->format('Y-m-d'));
                $event->setTrainingSeriesId($seriesId);

                if ($location) {
                    $event->setLocation($location);
                }

                $startDt = $time
                    ? new \DateTime($cursor->format('Y-m-d') . 'T' . $time . ':00')
                    : new \DateTime($cursor->format('Y-m-d') . 'T00:00:00');
                $event->setStartDate($startDt);

                if ($endTime) {
                    $event->setEndDate(new \DateTime($cursor->format('Y-m-d') . 'T' . $endTime . ':00'));
                } elseif ($time && $duration > 0) {
                    $endDt = clone $startDt;
                    $endDt->modify('+' . $duration . ' minutes');
                    $event->setEndDate($endDt);
                } else {
                    $event->setEndDate($startDt);
                }

                if (!$this->isGranted(CalendarEventVoter::CREATE, $event)) {
                    $cursor = $cursor->modify('+1 day');
                    continue;
                }

                $this->entityManager->persist($event);
                $this->entityManager->flush();

                $permission = new CalendarEventPermission();
                $permission->setCalendarEvent($event);
                if ($team) {
                    $permission->setPermissionType(CalendarEventPermissionType::TEAM);
                    $permission->setTeam($team);
                } else {
                    $permission->setPermissionType(CalendarEventPermissionType::PUBLIC);
                }
                $this->entityManager->persist($permission);
                $event->addPermission($permission);

                $this->entityManager->flush();
                ++$createdCount;

                $this->dispatcher->dispatch(new CalendarEventCreatedEvent($currentUser, $event));
            }
            $cursor = $cursor->modify('+1 day');
        }

        return $this->json(['success' => true, 'createdCount' => $createdCount]);
    }
}
