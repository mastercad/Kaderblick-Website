<?php

namespace App\Controller\Api;

use App\Entity\CalendarEvent;
use App\Entity\TeamRide;
use App\Entity\TeamRidePassenger;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Enum\CalendarEventPermissionType;
use App\Event\CarpoolOfferedEvent;
use App\Repository\CalendarEventRepository;
use App\Repository\TeamRideRepository;
use App\Security\Voter\TeamRideVoter;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/teamrides', name: 'api_teamride_')]
class TeamRidesController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private TeamRideRepository $teamRideRepo,
        private CalendarEventRepository $eventRepo,
        private NotificationService $notificationService,
        private EventDispatcherInterface $dispatcher
    ) {
    }

    #[Route('/event/{eventId}', methods: ['GET'])]
    public function list(int $eventId): JsonResponse
    {
        $event = $this->eventRepo->find($eventId);
        if (!$event) {
            return $this->json(['error' => 'Event not found'], Response::HTTP_NOT_FOUND);
        }
        $rides = $this->teamRideRepo->findBy(['event' => $event]);

        $rides = array_filter($rides, fn ($r) => $this->isGranted(TeamRideVoter::VIEW, $r));

        $data = [];
        foreach ($rides as $ride) {
            $data[] = [
                'id' => $ride->getId(),
                'driverId' => $ride->getDriver()->getId(),
                'driver' => $ride->getDriver()->getFullName(),
                'seats' => $ride->getSeats(),
                'note' => $ride->getNote(),
                'availableSeats' => $ride->getSeats() - $ride->getPassengers()->count(),
                'passengers' => array_map(fn ($p) => [
                    'id' => $p->getUser()->getId(),
                    'name' => $p->getUser()->getFullName(),
                ], $ride->getPassengers()->toArray()),
            ];
        }

        return $this->json(['rides' => $data]);
    }

    #[Route('/add', methods: ['POST'])]
    public function add(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $event = $this->eventRepo->find($data['event_id'] ?? null);
        /** @var User $user */
        $user = $this->getUser();

        if (!$event instanceof CalendarEvent) {
            return $this->json(['error' => 'Event not found'], Response::HTTP_BAD_REQUEST);
        }

        $ride = new TeamRide();
        $ride->setEvent($event);
        $ride->setDriver($user);
        $ride->setSeats($data['seats'] ?? 1);
        $ride->setNote($data['note'] ?? null);

        if (!$this->isGranted(TeamRideVoter::CREATE, $ride)) {
            return $this->json(['error' => 'Nur Teammitglieder können Mitfahrgelegenheiten anbieten.'], Response::HTTP_FORBIDDEN);
        }

        $this->em->persist($ride);
        $this->em->flush();

        $this->dispatcher->dispatch(new CarpoolOfferedEvent($user, $ride));

        // Push notification: notify all team members about new ride
        $teamUsers = $this->getTeamUsersForEvent($event);
        $filteredUsers = array_filter($teamUsers, fn (User $u) => $u->getId() !== $user->getId());
        if (!empty($filteredUsers)) {
            $eventDate = $event->getStartDate()?->format('d.m.Y H:i') ?? '';
            $location = $event->getLocation();
            $rideLines = [$user->getFullName() . ' bietet eine Mitfahrgelegenheit an (' . $ride->getSeats() . ' Plätze).'];
            $rideLines[] = '📅 ' . $event->getTitle() . ($eventDate ? ' – ' . $eventDate : '');
            if ($location) {
                $rideLines[] = '📍 ' . $location->getName();
            }

            $this->notificationService->createNotificationForUsers(
                array_values($filteredUsers),
                'team_ride',
                'Neue Mitfahrgelegenheit: ' . $event->getTitle(),
                implode("\n", $rideLines),
                ['eventTitle' => $event->getTitle(), 'url' => '/calendar?eventId=' . $event->getId() . '&openRides=1']
            );
        }

        return $this->json(['success' => true, 'id' => $ride->getId()]);
    }

    #[Route('/book/{rideId}', methods: ['POST'])]
    public function book(int $rideId): JsonResponse
    {
        $ride = $this->teamRideRepo->find($rideId);
        /** @var User $user */
        $user = $this->getUser();

        if (!$ride instanceof TeamRide) {
            return $this->json(['error' => 'Ride not found'], Response::HTTP_BAD_REQUEST);
        }

        if (!$this->isGranted(TeamRideVoter::VIEW, $ride)) {
            return $this->json(['error' => 'Nur Teammitglieder können Mitfahrgelegenheiten buchen.'], Response::HTTP_FORBIDDEN);
        }

        if ($ride->getPassengers()->count() >= $ride->getSeats()) {
            return $this->json(['error' => 'No seats available'], Response::HTTP_CONFLICT);
        }
        foreach ($ride->getPassengers() as $p) {
            if ($p->getUser()->getId() === $user->getId()) {
                return $this->json(['error' => 'Already booked'], Response::HTTP_CONFLICT);
            }
        }
        $passenger = new TeamRidePassenger();
        $passenger->setTeamRide($ride);
        $passenger->setUser($user);
        $this->em->persist($passenger);
        $this->em->flush();

        $event = $ride->getEvent();
        $eventTitle = $event ? $event->getTitle() : '';
        $eventDate = $event?->getStartDate()?->format('d.m.Y H:i') ?? '';
        $eventInfo = $eventTitle . ($eventDate ? ' am ' . $eventDate : '');

        $notificationUrl = $event ? '/calendar?eventId=' . $event->getId() . '&openRides=1' : '/calendar';

        // Push notification: notify the driver that someone booked
        $this->notificationService->createNotification(
            $ride->getDriver(),
            'team_ride_booking',
            'Mitfahrgelegenheit gebucht',
            $user->getFullName() . ' hat einen Platz in deiner Mitfahrgelegenheit für ' . $eventInfo . ' gebucht.',
            ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
        );

        // Push notification: confirm the booking to the passenger
        if ($user->getId() !== $ride->getDriver()->getId()) {
            $this->notificationService->createNotification(
                $user,
                'team_ride_booking',
                'Platz gebucht',
                'Du hast einen Platz in der Mitfahrgelegenheit von ' . $ride->getDriver()->getFullName() . ' für ' . $eventInfo . ' gebucht.',
                ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
            );
        }

        return $this->json(['success' => true]);
    }

    #[Route('/cancel-booking/{rideId}', methods: ['DELETE'])]
    public function cancelBooking(int $rideId): JsonResponse
    {
        $ride = $this->teamRideRepo->find($rideId);
        /** @var User $user */
        $user = $this->getUser();

        if (!$ride instanceof TeamRide) {
            return $this->json(['error' => 'Ride not found'], Response::HTTP_BAD_REQUEST);
        }

        if (!$this->isGranted(TeamRideVoter::VIEW, $ride)) {
            return $this->json(['error' => 'Nur Teammitglieder können Buchungen stornieren.'], Response::HTTP_FORBIDDEN);
        }

        $passengerEntity = null;
        foreach ($ride->getPassengers() as $p) {
            if ($p->getUser()->getId() === $user->getId()) {
                $passengerEntity = $p;
                break;
            }
        }

        if (!$passengerEntity) {
            return $this->json(['error' => 'You are not booked on this ride'], Response::HTTP_CONFLICT);
        }

        $this->em->remove($passengerEntity);
        $this->em->flush();

        $event = $ride->getEvent();
        $eventTitle = $event ? $event->getTitle() : '';
        $eventDate = $event?->getStartDate()?->format('d.m.Y H:i') ?? '';
        $eventInfo = $eventTitle . ($eventDate ? ' am ' . $eventDate : '');

        $notificationUrl = $event ? '/calendar?eventId=' . $event->getId() . '&openRides=1' : '/calendar';

        // Push notification: notify the driver that someone cancelled
        $this->notificationService->createNotification(
            $ride->getDriver(),
            'team_ride_cancel',
            'Buchung storniert',
            $user->getFullName() . ' hat die Buchung der Mitfahrgelegenheit für ' . $eventInfo . ' storniert.',
            ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
        );

        // Push notification: confirm the cancellation to the passenger
        if ($user->getId() !== $ride->getDriver()->getId()) {
            $this->notificationService->createNotification(
                $user,
                'team_ride_cancel',
                'Buchung storniert',
                'Du hast deine Buchung der Mitfahrgelegenheit von ' . $ride->getDriver()->getFullName() . ' für ' . $eventInfo . ' storniert.',
                ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
            );
        }

        return $this->json(['success' => true]);
    }

    #[Route('/remove-passenger/{rideId}/{userId}', methods: ['DELETE'])]
    public function removePassenger(int $rideId, int $userId): JsonResponse
    {
        $ride = $this->teamRideRepo->find($rideId);
        /** @var User $currentUser */
        $currentUser = $this->getUser();

        if (!$ride instanceof TeamRide) {
            return $this->json(['error' => 'Ride not found'], Response::HTTP_BAD_REQUEST);
        }

        // Only the driver or an admin can remove passengers
        if (
            $ride->getDriver()->getId() !== $currentUser->getId()
            && !in_array('ROLE_ADMIN', $currentUser->getRoles())
            && !in_array('ROLE_SUPERADMIN', $currentUser->getRoles())
        ) {
            return $this->json(['error' => 'Not authorized'], Response::HTTP_FORBIDDEN);
        }

        $passengerEntity = null;
        foreach ($ride->getPassengers() as $p) {
            if ($p->getUser()->getId() === $userId) {
                $passengerEntity = $p;
                break;
            }
        }

        if (!$passengerEntity) {
            return $this->json(['error' => 'Passenger not found on this ride'], Response::HTTP_NOT_FOUND);
        }

        $removedUser = $passengerEntity->getUser();
        $this->em->remove($passengerEntity);
        $this->em->flush();

        $event = $ride->getEvent();
        $eventTitle = $event ? $event->getTitle() : '';
        $eventDate = $event?->getStartDate()?->format('d.m.Y H:i') ?? '';
        $eventInfo = $eventTitle . ($eventDate ? ' am ' . $eventDate : '');

        $notificationUrl = $event ? '/calendar?eventId=' . $event->getId() . '&openRides=1' : '/calendar';

        // Push notification: notify the removed passenger
        $this->notificationService->createNotification(
            $removedUser,
            'team_ride_cancel',
            'Aus Mitfahrgelegenheit entfernt',
            $ride->getDriver()->getFullName() . ' hat dich aus der Mitfahrgelegenheit für ' . $eventInfo . ' entfernt.',
            ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
        );

        // Push notification: confirm removal to the driver
        if ($currentUser->getId() !== $removedUser->getId()) {
            $this->notificationService->createNotification(
                $currentUser,
                'team_ride_cancel',
                'Mitfahrer entfernt',
                $removedUser->getFullName() . ' wurde aus deiner Mitfahrgelegenheit für ' . $eventInfo . ' entfernt.',
                ['eventTitle' => $eventTitle, 'url' => $notificationUrl]
            );
        }

        return $this->json(['success' => true]);
    }

    #[Route('/delete/{rideId}', methods: ['DELETE'])]
    public function delete(int $rideId): JsonResponse
    {
        $ride = $this->teamRideRepo->find($rideId);
        /** @var User $currentUser */
        $currentUser = $this->getUser();

        if (!$ride instanceof TeamRide) {
            return $this->json(['error' => 'Ride not found'], Response::HTTP_BAD_REQUEST);
        }

        if (!$this->isGranted(TeamRideVoter::DELETE, $ride)) {
            return $this->json(['error' => 'Not authorized'], Response::HTTP_FORBIDDEN);
        }

        $event = $ride->getEvent();
        $eventTitle = $event ? $event->getTitle() : '';
        $eventDate = $event?->getStartDate()?->format('d.m.Y H:i') ?? '';
        $eventInfo = $eventTitle . ($eventDate ? ' am ' . $eventDate : '');
        $driverName = $ride->getDriver()->getFullName();

        // Collect passengers before removal for notifications
        $passengerUsers = [];
        foreach ($ride->getPassengers() as $p) {
            $passengerUsers[] = $p->getUser();
        }

        $this->em->remove($ride);
        $this->em->flush();

        $notificationUrl = $event ? '/calendar?eventId=' . $event->getId() . '&openRides=1' : '/calendar';
        $notificationData = ['eventTitle' => $eventTitle, 'url' => $notificationUrl];
        $deleteMessage = $driverName . ' hat die Mitfahrgelegenheit für ' . $eventInfo . ' zurückgezogen.';

        // Push notification: notify all passengers that the ride was withdrawn
        foreach ($passengerUsers as $passengerUser) {
            $this->notificationService->createNotification(
                $passengerUser,
                'team_ride_deleted',
                'Mitfahrgelegenheit zurückgezogen',
                $deleteMessage,
                $notificationData
            );
        }

        // Push notification: notify team members that the ride was withdrawn
        if ($event) {
            $teamUsers = $this->getTeamUsersForEvent($event);
            // Exclude the driver and already-notified passengers
            $passengerIds = array_map(fn (User $u) => $u->getId(), $passengerUsers);
            $filteredUsers = array_filter($teamUsers, fn (User $u) => $u->getId() !== $currentUser->getId() && !in_array($u->getId(), $passengerIds));
            if (!empty($filteredUsers)) {
                $this->notificationService->createNotificationForUsers(
                    array_values($filteredUsers),
                    'team_ride_deleted',
                    'Mitfahrgelegenheit zurückgezogen',
                    $deleteMessage,
                    $notificationData
                );
            }
        }

        return $this->json(['success' => true]);
    }

    /**
     * Get all users related to teams associated with a calendar event.
     *
     * @return User[]
     */
    private function getTeamUsersForEvent(CalendarEvent $event): array
    {
        $users = [];

        foreach ($event->getPermissions() as $permission) {
            if (CalendarEventPermissionType::TEAM === $permission->getPermissionType() && $permission->getTeam()) {
                $team = $permission->getTeam();

                // Get users through player team assignments
                $playerRelations = $this->em->getRepository(UserRelation::class)
                    ->createQueryBuilder('ur')
                    ->join('ur.player', 'p')
                    ->join('p.playerTeamAssignments', 'pta')
                    ->where('pta.team = :team')
                    ->setParameter('team', $team)
                    ->getQuery()
                    ->getResult();

                foreach ($playerRelations as $relation) {
                    $users[$relation->getUser()->getId()] = $relation->getUser();
                }

                // Get users through coach team assignments
                $coachRelations = $this->em->getRepository(UserRelation::class)
                    ->createQueryBuilder('ur')
                    ->join('ur.coach', 'c')
                    ->join('c.coachTeamAssignments', 'cta')
                    ->where('cta.team = :team')
                    ->setParameter('team', $team)
                    ->getQuery()
                    ->getResult();

                foreach ($coachRelations as $relation) {
                    $users[$relation->getUser()->getId()] = $relation->getUser();
                }
            }
        }

        return array_values($users);
    }
}
