<?php

namespace App\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\TaskAssignment;
use App\Entity\Tournament;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Repository\ParticipationRepository;
use App\Security\Voter\CalendarEventVoter;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Converts a CalendarEvent entity into the API response array.
 *
 * Extracted from CalendarController to keep single-responsibility and allow
 * independent testing without an HTTP request cycle.
 */
class CalendarEventSerializer
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ParticipationRepository $participationRepository,
        private readonly TeamMembershipService $teamMembershipService,
        private readonly Security $security,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(
        CalendarEvent $calendarEvent,
        ?User $user,
        ?CalendarEventType $tournamentEventType,
    ): array {
        $endDate = $calendarEvent->getEndDate();
        if (!$endDate) {
            $endDate = new DateTime();
            $endDate->setTimestamp($calendarEvent->getStartDate()->getTimestamp());
            $endDate->modify('23:59:59');
        }

        $participationStatus = null;
        $participation = $user instanceof User
            ? $this->participationRepository->findByUserAndEvent($user, $calendarEvent)
            : [];
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
                'rotationUsers' => $task->getRotationUsers()->map(fn ($u) => [
                    'id' => $u->getId(),
                    'fullName' => $u->getFullName(),
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
                'round' => $calendarEvent->getGame()->getRound(),
                'homeTeam' => [
                    'id' => $calendarEvent->getGame()->getHomeTeam()?->getId(),
                    'name' => $calendarEvent->getGame()->getHomeTeam()?->getName(),
                ],
                'awayTeam' => [
                    'id' => $calendarEvent->getGame()->getAwayTeam()?->getId(),
                    'name' => $calendarEvent->getGame()->getAwayTeam()?->getName(),
                ],
                'gameType' => [
                    'id' => $calendarEvent->getGame()->getGameType()->getId(),
                    'name' => $calendarEvent->getGame()->getGameType()->getName(),
                ],
                'league' => [
                    'id' => $calendarEvent->getGame()->getLeague()?->getId(),
                    'name' => $calendarEvent->getGame()->getLeague()?->getName(),
                ],
                'cup' => [
                    'id' => $calendarEvent->getGame()->getCup()?->getId(),
                    'name' => $calendarEvent->getGame()->getCup()?->getName(),
                ],
            ] : null,
            'task' => $taskFromAssignment,
            'type' => $calendarEvent->getCalendarEventType() ? [
                'id' => $calendarEvent->getCalendarEventType()->getId(),
                'name' => $calendarEvent->getCalendarEventType()->getName(),
                'color' => $calendarEvent->getCalendarEventType()->getColor(),
            ] : null,
            'location' => $calendarEvent->getLocation() ? [
                'id' => $calendarEvent->getLocation()->getId(),
                'name' => $calendarEvent->getLocation()->getName(),
                'latitude' => $calendarEvent->getLocation()->getLatitude(),
                'longitude' => $calendarEvent->getLocation()->getLongitude(),
                'city' => $calendarEvent->getLocation()->getCity(),
                'address' => $calendarEvent->getLocation()->getAddress(),
            ] : null,
            'permissions' => [
                'canCreate' => $this->security->isGranted(CalendarEventVoter::CREATE, $calendarEvent->getGame() ?? null),
                'canEdit' => $this->security->isGranted(CalendarEventVoter::EDIT, $calendarEvent),
                'canDelete' => $this->security->isGranted(CalendarEventVoter::DELETE, $calendarEvent),
                'canCancel' => $this->security->isGranted(CalendarEventVoter::CANCEL, $calendarEvent),
                'canViewRides' => $this->canUserViewRides($calendarEvent),
                'canParticipate' => $this->canUserParticipate($calendarEvent),
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
            'meetingPoint' => $calendarEvent->getMeetingPoint(),
            'meetingTime' => $calendarEvent->getMeetingTime()?->format('Y-m-d\TH:i:s'),
            'meetingLocation' => $calendarEvent->getMeetingLocation() ? [
                'id' => $calendarEvent->getMeetingLocation()->getId(),
                'name' => $calendarEvent->getMeetingLocation()->getName(),
                'latitude' => $calendarEvent->getMeetingLocation()->getLatitude(),
                'longitude' => $calendarEvent->getMeetingLocation()->getLongitude(),
                'address' => $calendarEvent->getMeetingLocation()->getAddress(),
                'city' => $calendarEvent->getMeetingLocation()->getCity(),
            ] : null,
            'cancelled' => $calendarEvent->isCancelled(),
            'cancelReason' => $calendarEvent->getCancelReason(),
            'cancelledBy' => $calendarEvent->getCancelledBy()?->getFullName(),
            'participation_status' => $participationStatus,
        ];

        $isTournamentEvent = $calendarEvent->getCalendarEventType()?->getId() === $tournamentEventType?->getId();

        if ($isTournamentEvent || $calendarEvent->getTournament()) {
            $tournament = $calendarEvent->getTournament();
            if (!$tournament) {
                $tournament = $this->entityManager->getRepository(Tournament::class)
                    ->findOneBy(['calendarEvent' => $calendarEvent]);
            }
            if ($tournament) {
                $eventArr['tournament'] = [
                    'id' => $tournament->getId(),
                    'settings' => $tournament->getSettings(),
                    'matches' => array_map(static function ($match): array {
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

    private function canUserViewRides(CalendarEvent $calendarEvent): bool
    {
        if ($this->security->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return false;
        }

        return $this->teamMembershipService->isUserTeamMemberForEvent($user, $calendarEvent);
    }

    private function canUserParticipate(CalendarEvent $calendarEvent): bool
    {
        if ($this->security->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return false;
        }

        return $this->teamMembershipService->canUserParticipateInEvent($user, $calendarEvent);
    }
}
