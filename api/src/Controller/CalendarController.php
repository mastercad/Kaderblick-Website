<?php

namespace App\Controller;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Location;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\WeatherData;
use App\Enum\CalendarEventPermissionType;
use App\Event\CalendarEventCreatedEvent;
use App\Repository\CalendarEventRepository;
use App\Repository\ParticipationRepository;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventService;
use App\Service\EmailNotificationService;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly EmailNotificationService $emailService,
        private readonly ParticipationRepository $participationRepository,
        private readonly CalendarEventService $calendarEventService,
        private readonly NotificationService $notificationService,
        private readonly TeamMembershipService $teamMembershipService,
        private readonly EventDispatcherInterface $dispatcher
    ) {
    }

    #[Route('/events', name: 'events', methods: ['GET'])]
    public function retrieveEvents(Request $request, CalendarEventRepository $calendarEventRepository): JsonResponse
    {
        $start = new DateTime($request->query->get('start'));
        $end = new DateTime($request->query->get('end'));

        // TODO hier noch umbauen, dass nur die Events überhaupt geladen werden, die irgend wie etwas mit dem user zu tun haben
        $unfilteredCalendarEvents = $calendarEventRepository->findBetweenDates($start, $end);

        // Filtere basierend auf VIEW-Berechtigung
        $calendarEvents = array_filter($unfilteredCalendarEvents, fn ($calendarEvent) => $this->isGranted(CalendarEventVoter::VIEW, $calendarEvent));
        $tournamentEventType = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier']);

        /** @var ?User $user */
        $user = $this->getUser();

        $formattedEvents = array_map(
            fn (CalendarEvent $calendarEvent) => $this->serializeCalendarEvent($calendarEvent, $user, $tournamentEventType),
            $calendarEvents
        );

        return $this->json(array_values($formattedEvents));
    }

    #[Route('/event/{id}', name: 'event_show', methods: ['GET'])]
    public function getEvent(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        /** @var ?User $user */
        $user = $this->getUser();
        $tournamentEventType = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier']);

        return $this->json($this->serializeCalendarEvent($calendarEvent, $user, $tournamentEventType));
    }

    #[Route('/event', name: 'event_create', methods: ['POST'])]
    public function createEvent(Request $request, SerializerInterface $serializer): JsonResponse
    {
        $data = $request->getContent();
        $context = ['groups' => ['calendar_event:write']];

        $calendarEvent = $serializer->deserialize(
            $data,
            CalendarEvent::class,
            'json',
            $context
        );

        if (!$this->isGranted(CalendarEventVoter::CREATE, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden', 'success' => false], 403);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();
        $jsonData = json_decode($data, true);

        $ownershipError = $this->calendarEventService->validateMatchTeamOwnership($jsonData, $currentUser);
        if (null !== $ownershipError) {
            return $this->json(['error' => $ownershipError, 'success' => false], 403);
        }

        $errors = $this->calendarEventService->updateEventFromData($calendarEvent, $jsonData);

        $messages = [];
        if (0 < count($errors)) {
            foreach ($errors as $error) {
                $messages[] = $error->getMessage();
            }

            return $this->json(
                ['error' => implode(', ', $messages), 'success' => false],
                400
            );
        }

        $this->dispatcher->dispatch(new CalendarEventCreatedEvent($currentUser, $calendarEvent));

        return $this->json(['success' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCalendarEvent(CalendarEvent $calendarEvent, ?User $user, ?CalendarEventType $tournamentEventType): array
    {
        $endDate = $calendarEvent->getEndDate();
        if (!$endDate) {
            $endDate = new DateTime();
            $endDate->setTimestamp($calendarEvent->getStartDate()->getTimestamp());
            $endDate->modify('23:59:59');
        }

        $participationStatus = null;
        $participation = $user instanceof User ? $this->participationRepository->findByUserAndEvent($user, $calendarEvent) : [];
        if ($participation && $participation->getStatus()) {
            $participationStatus = [
                'id' => $participation->getStatus()->getId(),
                'name' => $participation->getStatus()->getName(),
                'code' => $participation->getStatus()->getCode(),
                'icon' => $participation->getStatus()->getIcon(),
                'color' => $participation->getStatus()->getColor(),
            ];
        }

        $taskFromAssignment = null;
        $taskAssignment = $this->entityManager->getRepository(TaskAssignment::class)
            ->findOneBy(['calendarEvent' => $calendarEvent]);
        if ($taskAssignment && $taskAssignment->getTask()) {
            $task = $taskAssignment->getTask();
            $taskFromAssignment = [
                'id' => $task->getId(),
                'isRecurring' => $task->isRecurring(),
                'recurrenceMode' => $task->getRecurrenceMode(),
                'recurrenceRule' => $task->getRecurrenceRule(),
                'rotationUsers' => $task->getRotationUsers()->map(fn ($rotationUser) => [
                    'id' => $rotationUser->getId(),
                    'fullName' => $rotationUser->getFullName()
                ])->toArray(),
                'rotationCount' => $task->getRotationCount(),
                'offset' => $task->getOffsetDays(),
            ];
        }

        $eventArr = [
            'id' => $calendarEvent->getId(),
            'title' => $calendarEvent->getTitle(),
            'start' => $calendarEvent->getStartDate()->format('Y-m-d\TH:i:s'),
            'end' => $endDate->format('Y-m-d\TH:i:s'),
            'description' => $calendarEvent->getDescription(),
            'tournamentSettings' => $calendarEvent->getTournament()?->getSettings(),
            'weatherData' => [
                'weatherCode' => $calendarEvent->getWeatherData()?->getDailyWeatherData()['weathercode'][0] ?? null,
            ],
            'game' => $calendarEvent->getGame() ? [
                'id' => $calendarEvent->getGame()->getId(),
                'homeTeam' => [
                    'id' => $calendarEvent->getGame()->getHomeTeam() ? $calendarEvent->getGame()->getHomeTeam()->getId() : null,
                    'name' => $calendarEvent->getGame()->getHomeTeam() ? $calendarEvent->getGame()->getHomeTeam()->getName() : null
                ],
                'awayTeam' => [
                    'id' => $calendarEvent->getGame()->getAwayTeam() ? $calendarEvent->getGame()->getAwayTeam()->getId() : null,
                    'name' => $calendarEvent->getGame()->getAwayTeam() ? $calendarEvent->getGame()->getAwayTeam()->getName() : null
                ],
                'gameType' => [
                    'id' => $calendarEvent->getGame()->getGameType()->getId(),
                    'name' => $calendarEvent->getGame()->getGameType()->getName()
                ],
                'league' => [
                    'id' => $calendarEvent->getGame()->getLeague()?->getId(),
                    'name' => $calendarEvent->getGame()->getLeague()?->getName()
                ],
                'cup' => [
                    'id' => $calendarEvent->getGame()->getCup()?->getId(),
                    'name' => $calendarEvent->getGame()->getCup()?->getName()
                ]
            ] : null,
            'task' => $taskFromAssignment,
            'type' => $calendarEvent->getCalendarEventType() ? [
                'id' => $calendarEvent->getCalendarEventType()->getId(),
                'name' => $calendarEvent->getCalendarEventType()->getName(),
                'color' => $calendarEvent->getCalendarEventType()->getColor()
            ] : null,
            'location' => $calendarEvent->getLocation() ? [
                'id' => $calendarEvent->getLocation()->getId(),
                'name' => $calendarEvent->getLocation()->getName(),
                'latitude' => $calendarEvent->getLocation()->getLatitude(),
                'longitude' => $calendarEvent->getLocation()->getLongitude(),
                'city' => $calendarEvent->getLocation()->getCity(),
                'address' => $calendarEvent->getLocation()->getAddress()
            ] : null,
            'permissions' => [
                'canCreate' => $this->isGranted(CalendarEventVoter::CREATE, $calendarEvent->getGame() ?? null),
                'canEdit' => $this->isGranted(CalendarEventVoter::EDIT, $calendarEvent),
                'canDelete' => $this->isGranted(CalendarEventVoter::DELETE, $calendarEvent),
                'canCancel' => $this->isGranted(CalendarEventVoter::CANCEL, $calendarEvent),
                'canViewRides' => $this->canUserViewRides($calendarEvent),
                'canParticipate' => $this->canUserParticipateInCalendarEvent($calendarEvent),
            ],
            'trainingTeamId' => (static function () use ($calendarEvent): ?int {
                foreach ($calendarEvent->getPermissions() as $perm) {
                    if (CalendarEventPermissionType::TEAM === $perm->getPermissionType() && $perm->getTeam()) {
                        return $perm->getTeam()->getId();
                    }
                }

                return null;
            })(),
            'permissionType' => (static function () use ($calendarEvent): string {
                foreach ($calendarEvent->getPermissions() as $perm) {
                    return $perm->getPermissionType()->value;
                }

                return 'public';
            })(),
            'trainingWeekdays' => $calendarEvent->getTrainingWeekdays(),
            'trainingSeriesEndDate' => $calendarEvent->getTrainingSeriesEndDate(),
            'trainingSeriesId' => $calendarEvent->getTrainingSeriesId(),
            'cancelled' => $calendarEvent->isCancelled(),
            'cancelReason' => $calendarEvent->getCancelReason(),
            'cancelledBy' => $calendarEvent->getCancelledBy()?->getFullName(),
            'participation_status' => $participationStatus,
        ];

        $isTournamentEvent = $calendarEvent->getCalendarEventType()?->getId() === $tournamentEventType?->getId();

        if ($isTournamentEvent || $calendarEvent->getTournament()) {
            $tournament = $calendarEvent->getTournament();
            if (!$tournament) {
                $tournament = $this->entityManager->getRepository(\App\Entity\Tournament::class)->findOneBy(['calendarEvent' => $calendarEvent]);
            }
            if ($tournament) {
                $eventArr['tournament'] = [
                    'id' => $tournament->getId(),
                    'settings' => $tournament->getSettings(),
                    'matches' => array_map(function ($match) {
                        return [
                            'id' => $match->getId(),
                            'round' => $match->getRound(),
                            'slot' => $match->getSlot(),
                            'homeTeamId' => $match->getHomeTeam()?->getId(),
                            'awayTeamId' => $match->getAwayTeam()?->getId(),
                            'scheduledAt' => $match->getScheduledAt()?->format('Y-m-d\\TH:i:s'),
                            'gameId' => $match->getGame()?->getId(),
                        ];
                    }, $tournament->getMatches()->toArray()),
                ];
            }
        }

        return $eventArr;
    }

    /**
     * Creates a recurring training series: one CalendarEvent per occurrence.
     */
    #[Route('/training-series', name: 'training_series_create', methods: ['POST'])]
    public function createTrainingSeries(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        // Validate required fields
        $title = $data['title'] ?? '';
        $startDate = $data['startDate'] ?? null;
        $endDate = $data['seriesEndDate'] ?? null;
        $weekdays = $data['weekdays'] ?? [];
        $eventTypeId = $data['eventTypeId'] ?? null;
        $teamId = $data['teamId'] ?? null;
        $time = $data['time'] ?? null;
        $endTime = $data['endTime'] ?? null;
        $duration = isset($data['duration']) ? (int) $data['duration'] : 90;
        $locationId = $data['locationId'] ?? null;
        $description = $data['description'] ?? '';

        if (!$title || !$startDate || !$endDate || empty($weekdays) || !$eventTypeId) {
            return $this->json(['error' => 'Pflichtfelder fehlen (Titel, Startdatum, Enddatum, Wochentage, Event-Typ).', 'success' => false], 400);
        }

        /** @var User $currentUser */
        $currentUser = $this->getUser();

        $eventType = $this->entityManager->getReference(CalendarEventType::class, (int) $eventTypeId);
        $location = $locationId ? $this->entityManager->getReference(Location::class, (int) $locationId) : null;
        $team = $teamId ? $this->entityManager->getReference(Team::class, (int) $teamId) : null;

        // Validate that the current user is allowed to create events for this team
        if ($team && !$this->isGranted(CalendarEventVoter::CREATE, $team)) {
            return $this->json(['error' => 'Keine Berechtigung für das ausgewählte Team.', 'success' => false], 403);
        }

        $cursor = new DateTimeImmutable($startDate);
        $end = new DateTimeImmutable($endDate);
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40); // version 4
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80); // variant
        $seriesId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
        $createdCount = 0;

        while ($cursor <= $end) {
            $dayOfWeek = (int) $cursor->format('w'); // 0=Sunday, 6=Saturday
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

                // Build start datetime
                $startDt = $time
                    ? new DateTime($cursor->format('Y-m-d') . 'T' . $time . ':00')
                    : new DateTime($cursor->format('Y-m-d') . 'T00:00:00');
                $event->setStartDate($startDt);

                // Build end datetime
                if ($endTime) {
                    $endDt = new DateTime($cursor->format('Y-m-d') . 'T' . $endTime . ':00');
                    $event->setEndDate($endDt);
                } elseif ($time && $duration > 0) {
                    $endDt = clone $startDt;
                    $endDt->modify('+' . $duration . ' minutes');
                    $event->setEndDate($endDt);
                } else {
                    $event->setEndDate($startDt);
                }

                // Check permission to create
                if (!$this->isGranted(CalendarEventVoter::CREATE, $event)) {
                    continue;
                }

                $this->entityManager->persist($event);
                $this->entityManager->flush();

                // Set team permission if team selected
                if ($team) {
                    $permission = new CalendarEventPermission();
                    $permission->setCalendarEvent($event);
                    $permission->setPermissionType(CalendarEventPermissionType::TEAM);
                    $permission->setTeam($team);
                    $this->entityManager->persist($permission);
                } else {
                    // Default: public
                    $permission = new CalendarEventPermission();
                    $permission->setCalendarEvent($event);
                    $permission->setPermissionType(CalendarEventPermissionType::PUBLIC);
                    $this->entityManager->persist($permission);
                }

                $this->entityManager->flush();
                ++$createdCount;
                $this->dispatcher->dispatch(new CalendarEventCreatedEvent($currentUser, $event));
            }
            $cursor = $cursor->modify('+1 day');
        }

        return $this->json(['success' => true, 'createdCount' => $createdCount]);
    }

    /**
     * Drag & Drop endpunkt für die Aktualisierung von Kalendereinträgen.
     */
    #[Route('/event/{id}', name: 'event_update', methods: ['PUT'])]
    public function updateCalendarEvent(CalendarEvent $calendarEvent, Request $request, EntityManagerInterface $entityManager): JsonResponse
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

        $this->calendarEventService->updateEventFromData($calendarEvent, $data);
        $entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/event/{id}', name: 'event_delete', methods: ['DELETE'])]
    public function deleteEvent(CalendarEvent $calendarEvent, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::DELETE, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $deletionMode = $data['deletionMode'] ?? 'single'; // 'single' oder 'series'

        $taskAssignmentRepo = $entityManager->getRepository(TaskAssignment::class);
        $taskAssignment = $taskAssignmentRepo->findOneBy(['calendarEvent' => $calendarEvent]);
        $task = $taskAssignment?->getTask();

        if ($task && 'series' === $deletionMode) {
            $taskAssignments = $taskAssignmentRepo->findBy(['task' => $task]);
            foreach ($taskAssignments as $taskAssignment) {
                if ($taskAssignment->getCalendarEvent()) {
                    $this->calendarEventService->deleteCalendarEventWithDependencies($taskAssignment->getCalendarEvent());
                }
                $entityManager->remove($taskAssignment);
            }

            $taskRotationUsers = $task->getRotationUsers();
            foreach ($taskRotationUsers as $user) {
                $task->removeRotationUser($user);
            }

            $entityManager->remove($task);
            $entityManager->flush();
        } elseif ('series' === $deletionMode && $calendarEvent->getTrainingSeriesId()) {
            $seriesEvents = $entityManager->getRepository(CalendarEvent::class)->findBy([
                'trainingSeriesId' => $calendarEvent->getTrainingSeriesId(),
            ]);
            foreach ($seriesEvents as $seriesEvent) {
                $this->calendarEventService->deleteCalendarEventWithDependencies($seriesEvent);
            }
        } else {
            $this->calendarEventService->deleteCalendarEventWithDependencies($calendarEvent);
        }

        return $this->json(['success' => true]);
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

        $data = json_decode($request->getContent(), true);
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

        // Resolve recipients and send push notifications
        $recipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $currentUser);

        if (count($recipients) > 0) {
            $eventTitle = $calendarEvent->getTitle();
            $startDate = $calendarEvent->getStartDate()?->format('d.m.Y H:i') ?? '';
            $location = $calendarEvent->getLocation();
            $notificationTitle = 'Absage: ' . $eventTitle;

            $lines = [];
            if ('' !== $startDate) {
                $lines[] = '📅 ' . $startDate;
            }
            if ($location) {
                $lines[] = '📍 ' . $location->getName();
            }
            $lines[] = 'Das Event "' . $eventTitle . '" wurde abgesagt.';
            $lines[] = 'Grund: ' . $reason;
            $notificationMessage = implode("\n", $lines);

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_cancelled',
                $notificationTitle,
                $notificationMessage,
                [
                    'eventTitle' => $eventTitle,
                    'reason' => $reason,
                    'cancelledBy' => $currentUser->getFullName(),
                    'url' => '/calendar?eventId=' . $calendarEvent->getId(),
                ]
            );
        }

        return $this->json([
            'success' => true,
            'recipientCount' => count($recipients),
        ]);
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

        // Benachrichtige alle Betroffenen, dass das Event wieder stattfindet
        $recipients = $this->teamMembershipService->resolveEventRecipients($calendarEvent, $currentUser);

        if (count($recipients) > 0) {
            $eventTitle = $calendarEvent->getTitle();
            $startDate = $calendarEvent->getStartDate()?->format('d.m.Y H:i') ?? '';
            $location = $calendarEvent->getLocation();
            $notificationTitle = 'Reaktiviert: ' . $eventTitle;

            $lines = [];
            if ('' !== $startDate) {
                $lines[] = '📅 ' . $startDate;
            }
            if ($location) {
                $lines[] = '📍 ' . $location->getName();
            }
            $lines[] = 'Das Event "' . $eventTitle . '" findet doch statt!';
            $notificationMessage = implode("\n", $lines);

            $this->notificationService->createNotificationForUsers(
                $recipients,
                'event_reactivated',
                $notificationTitle,
                $notificationMessage,
                [
                    'eventTitle' => $eventTitle,
                    'reactivatedBy' => $currentUser->getFullName(),
                    'url' => '/calendar?eventId=' . $calendarEvent->getId(),
                ]
            );
        }

        return $this->json([
            'success' => true,
            'recipientCount' => count($recipients),
        ]);
    }

    /**
     * Returns true when the currently authenticated user may view team rides for this event.
     * Mirrors TeamRideVoter::VIEW logic: ROLE_SUPERADMIN always, otherwise team members only.
     */
    private function canUserViewRides(CalendarEvent $calendarEvent): bool
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return false;
        }

        return $this->teamMembershipService->isUserTeamMemberForEvent($user, $calendarEvent);
    }

    /**
     * Returns true when the currently authenticated user is eligible to participate
     * in this event (and should see the participation section in the UI).
     * Mirrors ParticipationController::canUserParticipate logic via TeamMembershipService.
     */
    private function canUserParticipateInCalendarEvent(CalendarEvent $calendarEvent): bool
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return false;
        }

        return $this->teamMembershipService->canUserParticipateInEvent($user, $calendarEvent);
    }

    #[Route('/event/{id}/weather-data', name: 'event_weather_data', methods: ['GET'])]
    public function viewEventWeatherData(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::VIEW, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $weatherData = $calendarEvent->getWeatherData();

        if (!$weatherData instanceof WeatherData) {
            return $this->json([
                'dailyWeatherData' => null,
                'hourlyWeatherData' => null
            ]);
        }

        $indexStart = $calendarEvent->getStartDate()->format('H');
        $indexEnd = 23 - (23 - ($calendarEvent->getEndDate() ? $calendarEvent->getEndDate()->format('H') : 0));

        $rawHourlyWeatherData = $weatherData->getHourlyWeatherData();
        $hourlyWeatherData = [];

        foreach ($rawHourlyWeatherData as $key => $information) {
            foreach ($information as $index => $value) {
                if ($index < (int) $indexStart || $index > (int) $indexEnd) {
                    continue;
                }
                $hourlyWeatherData[$key][$index] = $value;
            }
        }

        return $this->json([
            'dailyWeatherData' => $weatherData->getDailyWeatherData() ?: [],
            'hourlyWeatherData' => $hourlyWeatherData,
        ]);
    }

    #[Route('/event/notify', name: 'event_notify', methods: ['POST'])]
    public function notifyAboutEvent(CalendarEvent $calendarEvent): JsonResponse
    {
        if (!$this->isGranted(CalendarEventVoter::EDIT, $calendarEvent)) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $recipients = $this->calendarEventService->loadEventRecipients($calendarEvent);
        $emails = array_filter(array_map(fn (User $u) => $u->getEmail(), $recipients));
        $this->emailService->sendEventNotification($emails, $calendarEvent);

        $calendarEvent->setNotificationSent(true);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/upcoming', name: 'upcoming', methods: ['GET'])]
    public function retrieveUpcomingEvents(CalendarEventRepository $calendarEventRepository): JsonResponse
    {
        $calendarEvents = $calendarEventRepository->findUpcoming();

        return $this->json($calendarEvents, 200, [], ['groups' => ['calendar_event:read']]);
    }

    #[Route('/locations/search', name: 'search_locations', methods: ['GET'])]
    public function searchLocations(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $term = $request->query->get('term', '');

        $qb = $entityManager->createQueryBuilder();
        $qb->select('l')
           ->from(Location::class, 'l')
           ->orWhere('l.name LIKE :term')
           ->orWhere('l.city LIKE :term')
           ->orWhere('l.address LIKE :term')
           ->setParameter('term', '%' . $term . '%')
           ->setMaxResults(10);

        $locations = $qb->getQuery()->getArrayResult();

        return new JsonResponse($locations);
    }
}
