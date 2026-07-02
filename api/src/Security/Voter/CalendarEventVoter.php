<?php

namespace App\Security\Voter;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\Club;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Service\AdminScopeService;
use App\Service\SupporterScopeService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, CalendarEvent|Team|null>
 */
final class CalendarEventVoter extends Voter
{
    public const CREATE = 'CALENDAR_EVENT_CREATE';
    public const EDIT = 'CALENDAR_EVENT_EDIT';
    public const VIEW = 'CALENDAR_EVENT_VIEW';
    public const DELETE = 'CALENDAR_EVENT_DELETE';
    public const CANCEL = 'CALENDAR_EVENT_CANCEL';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly AdminScopeService $adminScopeService,
        private readonly SupporterScopeService $supporterScopeService,
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE, self::CANCEL]);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        switch ($attribute) {
            case self::CREATE:
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return true;
                }

                // When subject is a Team (called from createTrainingSeries), verify team membership
                if ($subject instanceof Team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $subject)) {
                        return true;
                    }

                    return $this->isCoachOfTeam($user, $subject);
                }

                // When subject is a CalendarEvent (not yet linked to a team),
                // allow any admin/supporter/coach – team ownership is validated
                // separately in CalendarEventService::validateMatchTeamOwnership().
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPPORTER', $user->getRoles())
                    || $this->isCoachOfAnyTeam($user)
                ) {
                    return true;
                }

                break;

            case self::EDIT:
            case self::DELETE:
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return true;
                }

                if (!$subject instanceof CalendarEvent) {
                    return false;
                }

                $teams = $this->getEventTeams($subject);

                // No team binding – only the creator may edit/delete
                if (empty($teams)) {
                    return $subject->getCreatedBy()?->getId() === $user->getId();
                }

                foreach ($teams as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }

                // Coach of any of the event's teams
                foreach ($teams as $team) {
                    if ($this->isCoachOfTeam($user, $team)) {
                        return true;
                    }
                }

                break;
            case self::CANCEL:
                return $this->canCancelCalendarEvent($subject, $user);
            case self::VIEW:
                return $this->canViewCalendarEvent($subject, $user);
        }

        return false;
    }

    /**
     * Returns all Team objects associated with a CalendarEvent.
     * Checks game teams (homeTeam/awayTeam), tournament teams, and TEAM-type permissions.
     *
     * @return Team[]
     */
    private function getEventTeams(CalendarEvent $event): array
    {
        $teams = [];

        if ($event->getGame()) {
            if ($event->getGame()->getHomeTeam()) {
                $teams[] = $event->getGame()->getHomeTeam();
            }
            if ($event->getGame()->getAwayTeam()) {
                $teams[] = $event->getGame()->getAwayTeam();
            }
        }

        if ($event->getTournament()) {
            foreach ($event->getTournament()->getTeams() as $tournamentTeam) {
                if ($tournamentTeam->getTeam()) {
                    $teams[] = $tournamentTeam->getTeam();
                }
            }
        }

        foreach ($event->getPermissions() as $permission) {
            if (CalendarEventPermissionType::TEAM === $permission->getPermissionType() && $permission->getTeam()) {
                $teams[] = $permission->getTeam();
            }
        }

        return array_unique($teams, SORT_REGULAR);
    }

    private function canViewCalendarEvent(CalendarEvent $calendarEvent, User $user): bool
    {
        if (
            in_array('ROLE_SUPERADMIN', $user->getRoles())
            || in_array('ROLE_SUPERADMIN', $user->getRoles())
        ) {
            return true;
        }
        if ($calendarEvent->getCreatedBy()?->getId() === $user->getId()) {
            return true;
        }

        if ($calendarEvent->getGame()) {
            $game = $calendarEvent->getGame();
            $homeTeam = $game->getHomeTeam();
            $awayTeam = $game->getAwayTeam();

            if ($homeTeam && $this->isUserInTeam($user, $homeTeam)) {
                return true;
            }
            if ($awayTeam && $this->isUserInTeam($user, $awayTeam)) {
                return true;
            }

            // Game events are strictly team-private: a user who is neither a
            // player nor a coach of either team must not see the event,
            // regardless of any additional PUBLIC/CLUB/USER permissions on it.
            return false;
        }

        if ($calendarEvent->getTournament()) {
            // Tournament events are strictly team-private.
            foreach ($calendarEvent->getTournament()->getTeams() as $tournamentTeam) {
                $team = $tournamentTeam->getTeam();
                if ($team && $this->isUserInTeam($user, $team)) {
                    return true;
                }
            }

            return false;
        }

        if (null !== $calendarEvent->getTrainingSeriesId()) {
            // Training events are strictly team-private; only TEAM-type permissions
            // grant access – PUBLIC/CLUB/USER overrides are ignored for training.
            foreach ($calendarEvent->getPermissions() as $permission) {
                if (CalendarEventPermissionType::TEAM === $permission->getPermissionType() && $permission->getTeam()) {
                    if ($this->isUserInTeam($user, $permission->getTeam())) {
                        return true;
                    }
                }
            }

            return false;
        }

        // Generic event: access is governed entirely by configured permissions.
        if ($calendarEvent->getPermissions()->isEmpty()) {
            return false;
        }

        foreach ($calendarEvent->getPermissions() as $permission) {
            if ($this->userHasPermission($user, $permission)) {
                return true;
            }
        }

        return false;
    }

    private function userHasPermission(User $user, CalendarEventPermission $permission): bool
    {
        return match ($permission->getPermissionType()) {
            CalendarEventPermissionType::PUBLIC => true,
            CalendarEventPermissionType::USER => $permission->getUser()?->getId() === $user->getId(),
            CalendarEventPermissionType::TEAM => $permission->getTeam() ? $this->isUserInTeam($user, $permission->getTeam()) : false,
            CalendarEventPermissionType::CLUB => $permission->getClub() ? $this->isUserInClub($user, $permission->getClub()) : false,
        };
    }

    private function isUserInClub(User $user, Club $club): bool
    {
        $playerClubAssignment = $this->entityManager->getRepository(PlayerClubAssignment::class)
            ->createQueryBuilder('pca')
            ->innerJoin('pca.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('pca.club = :club')
            ->setParameter('user', $user)
            ->setParameter('club', $club)
            ->getQuery()
            ->getOneOrNullResult();

        if ($playerClubAssignment) {
            return true;
        }

        $coachClubAssignment = $this->entityManager->getRepository(CoachClubAssignment::class)
            ->createQueryBuilder('cca')
            ->innerJoin('cca.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cca.club = :club')
            ->setParameter('user', $user)
            ->setParameter('club', $club)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachClubAssignment;
    }

    private function isUserInTeam(User $user, Team $team): bool
    {
        $playerTeamAssignment = $this->entityManager->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->innerJoin('pta.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('pta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->getQuery()
            ->getOneOrNullResult();

        if ($playerTeamAssignment) {
            return true;
        }

        $coachTeamAssignment = $this->entityManager->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachTeamAssignment;
    }

    /** Only superadmins and admins/coaches responsible for an associated team or club may cancel. */
    private function canCancelCalendarEvent(CalendarEvent $calendarEvent, User $user): bool
    {
        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return true;
        }

        foreach ($this->getEventTeams($calendarEvent) as $team) {
            if (
                $this->adminScopeService->hasAssignedScopeForTeam($user, $team)
                || $this->isCoachOfTeam($user, $team)
            ) {
                return true;
            }
        }

        // A club-wide event has no concrete team; its club admins may still manage its status.
        foreach ($calendarEvent->getPermissions() as $permission) {
            if (
                CalendarEventPermissionType::CLUB === $permission->getPermissionType()
                && $permission->getClub()
                && $this->adminScopeService->hasAssignedScopeForClub($user, $permission->getClub())
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true if the user is a coach of at least one team.
     * Used to grant coaches general CREATE/EDIT/DELETE access to calendar events
     * (team-ownership of the specific event is validated separately in CalendarEventService).
     */
    private function isCoachOfAnyTeam(User $user): bool
    {
        foreach ($user->getUserRelations() as $relation) {
            if ($relation->getCoach() && $relation->getCoach()->getCoachTeamAssignments()->count() > 0) {
                return true;
            }
        }

        return false;
    }

    private function isCoachOfTeam(User $user, Team $team): bool
    {
        $coachTeamAssignment = $this->entityManager->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachTeamAssignment;
    }
}
