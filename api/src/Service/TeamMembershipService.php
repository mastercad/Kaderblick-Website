<?php

namespace App\Service;

use App\Entity\CalendarEvent;
use App\Entity\Club;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\TeamRide;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Repository\ParticipationRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Checks whether a user belongs to any team or club associated with a CalendarEvent.
 * Used by TeamRideVoter, CalendarController, ParticipationController, and notification subscribers.
 */
class TeamMembershipService
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ParticipationRepository $participationRepository,
    ) {
    }

    /**
     * Returns true when $user belongs to any team that is linked to $event
     * (via TEAM-type CalendarEventPermissions or via a game's home/away teams).
     *
     * ROLE_SUPERADMIN is NOT checked here — callers must handle that separately.
     */
    public function isUserTeamMemberForEvent(User $user, CalendarEvent $event): bool
    {
        foreach ($this->getEventTeams($event) as $team) {
            if ($this->isUserInTeam($user, $team)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true when the user is allowed to participate in (and see the participation
     * section of) the given event, based on its visibility permissions.
     *
     * Rules:
     *  - PUBLIC events  → everyone
     *  - Game events    → only members of home/away teams
     *  - TEAM events    → only members of one of the listed teams
     *  - CLUB events    → only members of one of the listed clubs
     *  - USER events    → only the explicitly listed users
     *  - No permissions → fallback: everyone (should not occur for restricted events)
     *
     * ROLE_SUPERADMIN is NOT checked here — callers must handle that separately.
     */
    public function canUserParticipateInEvent(User $user, CalendarEvent $event): bool
    {
        // Tournament events: user may participate if they belong to any registered team
        // via a self_player or self_coach relation (same rule as game events)
        if ($event->getTournament()) {
            foreach ($event->getTournament()->getTeams() as $tournamentTeam) {
                if ($tournamentTeam->getTeam() && $this->isSelfMemberInTeam($user, $tournamentTeam->getTeam())) {
                    return true;
                }
            }

            return false;
        }

        // Game events: only self_player / self_coach users of participating teams
        // (parents and friends are not obligated to respond to games)
        if ($event->getGame()) {
            $homeTeam = $event->getGame()->getHomeTeam();
            $awayTeam = $event->getGame()->getAwayTeam();

            if ($homeTeam && $this->isSelfMemberInTeam($user, $homeTeam)) {
                return true;
            }
            if ($awayTeam && $this->isSelfMemberInTeam($user, $awayTeam)) {
                return true;
            }

            return false;
        }

        $hasAnyRestriction = false;

        foreach ($event->getPermissions() as $permission) {
            switch ($permission->getPermissionType()) {
                case CalendarEventPermissionType::PUBLIC:
                    return true;

                case CalendarEventPermissionType::TEAM:
                    if ($permission->getTeam()) {
                        $hasAnyRestriction = true;
                        if ($this->isUserInTeam($user, $permission->getTeam())) {
                            return true;
                        }
                    }
                    break;

                case CalendarEventPermissionType::CLUB:
                    if ($permission->getClub()) {
                        $hasAnyRestriction = true;
                        if ($this->isUserInClub($user, $permission->getClub())) {
                            return true;
                        }
                    }
                    break;

                case CalendarEventPermissionType::USER:
                    if ($permission->getUser()) {
                        $hasAnyRestriction = true;
                        if ($permission->getUser()->getId() === $user->getId()) {
                            return true;
                        }
                    }
                    break;
            }
        }

        // If there were explicit restrictions but user matched none → deny
        if ($hasAnyRestriction) {
            return false;
        }

        // No restrictions defined → allow (public fallback)
        return true;
    }

    /**
     * @return Team[]
     */
    public function getEventTeams(CalendarEvent $event): array
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

        foreach ($event->getPermissions() as $permission) {
            if (CalendarEventPermissionType::TEAM === $permission->getPermissionType() && $permission->getTeam()) {
                $teams[] = $permission->getTeam();
            }
        }

        return array_unique($teams, SORT_REGULAR);
    }

    public function isUserInTeam(User $user, Team $team): bool
    {
        $playerAssignment = $this->entityManager->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->innerJoin('pta.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('pta.team = :team')
            ->andWhere('pta.startDate IS NULL OR pta.startDate <= :today')
            ->andWhere('pta.endDate IS NULL OR pta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($playerAssignment) {
            return true;
        }

        $coachAssignment = $this->entityManager->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->andWhere('cta.startDate IS NULL OR cta.startDate <= :today')
            ->andWhere('cta.endDate IS NULL OR cta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachAssignment;
    }

    /**
     * Returns true only when the user is linked to the team via a self_player or self_coach
     * relation type. Parents, friends and other supporter relations are excluded.
     *
     * Used for game and tournament participation, where only players and coaches themselves
     * are obligated to respond.
     */
    public function isSelfMemberInTeam(User $user, Team $team): bool
    {
        $playerAssignment = $this->entityManager->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->innerJoin('pta.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->innerJoin('ur.relationType', 'rt')
            ->where('ur.user = :user')
            ->andWhere('pta.team = :team')
            ->andWhere('rt.identifier = :selfPlayer')
            ->andWhere('pta.startDate IS NULL OR pta.startDate <= :today')
            ->andWhere('pta.endDate IS NULL OR pta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setParameter('selfPlayer', 'self_player')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($playerAssignment) {
            return true;
        }

        $coachAssignment = $this->entityManager->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->innerJoin('ur.relationType', 'rt')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->andWhere('rt.identifier = :selfCoach')
            ->andWhere('cta.startDate IS NULL OR cta.startDate <= :today')
            ->andWhere('cta.endDate IS NULL OR cta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setParameter('selfCoach', 'self_coach')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachAssignment;
    }

    public function isUserInClub(User $user, Club $club): bool
    {
        $playerAssignment = $this->entityManager->getRepository(PlayerClubAssignment::class)
            ->createQueryBuilder('pca')
            ->innerJoin('pca.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('pca.club = :club')
            ->andWhere('pca.startDate <= :today')
            ->andWhere('pca.endDate IS NULL OR pca.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('club', $club)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($playerAssignment) {
            return true;
        }

        $coachAssignment = $this->entityManager->getRepository(CoachClubAssignment::class)
            ->createQueryBuilder('cca')
            ->innerJoin('cca.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cca.club = :club')
            ->andWhere('cca.startDate <= :today')
            ->andWhere('cca.endDate IS NULL OR cca.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('user', $user)
            ->setParameter('club', $club)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $coachAssignment;
    }

    /**
     * Returns all active player + coach users for a team (via userRelations).
     * Only considers assignments where startDate <= today and endDate is null or in the future.
     *
     * @return array<int, User> keyed by user ID
     */
    public function resolveTeamMembers(Team $team): array
    {
        $users = [];

        // Players via team assignments — select User entities directly
        $playerUsers = $this->entityManager->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->innerJoin('u.userRelations', 'ur')
            ->innerJoin('ur.player', 'p')
            ->innerJoin('p.playerTeamAssignments', 'pta')
            ->where('pta.team = :team')
            ->andWhere('pta.startDate IS NULL OR pta.startDate <= :today')
            ->andWhere('pta.endDate IS NULL OR pta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('team', $team)
            ->getQuery()
            ->getResult();
        foreach ($playerUsers as $u) {
            $users[$u->getId()] = $u;
        }

        // Coaches via team assignments — select User entities directly
        $coachUsers = $this->entityManager->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->innerJoin('u.userRelations', 'ur')
            ->innerJoin('ur.coach', 'c')
            ->innerJoin('c.coachTeamAssignments', 'cta')
            ->where('cta.team = :team')
            ->andWhere('cta.startDate IS NULL OR cta.startDate <= :today')
            ->andWhere('cta.endDate IS NULL OR cta.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('team', $team)
            ->getQuery()
            ->getResult();
        foreach ($coachUsers as $u) {
            $users[$u->getId()] = $u;
        }

        return $users;
    }

    /**
     * Returns all active player + coach users for a club (via userRelations).
     * Only considers assignments where startDate <= today and endDate is null or in the future.
     *
     * @return array<int, User> keyed by user ID
     */
    public function resolveClubMembers(Club $club): array
    {
        $users = [];

        // Players via club assignments — select User entities directly
        $playerUsers = $this->entityManager->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->innerJoin('u.userRelations', 'ur')
            ->innerJoin('ur.player', 'p')
            ->innerJoin('p.playerClubAssignments', 'pca')
            ->where('pca.club = :club')
            ->andWhere('pca.startDate <= :today')
            ->andWhere('pca.endDate IS NULL OR pca.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('club', $club)
            ->getQuery()
            ->getResult();
        foreach ($playerUsers as $u) {
            $users[$u->getId()] = $u;
        }

        // Coaches via club assignments — select User entities directly
        $coachUsers = $this->entityManager->createQueryBuilder()
            ->select('u')
            ->from(User::class, 'u')
            ->innerJoin('u.userRelations', 'ur')
            ->innerJoin('ur.coach', 'c')
            ->innerJoin('c.coachClubAssignments', 'cca')
            ->where('cca.club = :club')
            ->andWhere('cca.startDate <= :today')
            ->andWhere('cca.endDate IS NULL OR cca.endDate >= :today')
            ->setParameter('today', new DateTimeImmutable('today'))
            ->setParameter('club', $club)
            ->getQuery()
            ->getResult();
        foreach ($coachUsers as $u) {
            $users[$u->getId()] = $u;
        }

        return $users;
    }

    /**
     * Resolves all users that should receive a notification for this event.
     *
     * - For games/tournaments: members of home + away teams
     * - For task events: the assigned user(s)
     * - For events with TEAM permissions: all active team members
     * - For events with CLUB permissions: all active club members
     * - For events with USER permissions: those specific users
     * - For PUBLIC events: users who registered participation (attending/maybe/late)
     * - Additionally: all TeamRide drivers + passengers for this event
     * - Additionally: all admins (ROLE_ADMIN / ROLE_SUPER_ADMIN)
     *
     * @return User[]
     */
    public function resolveEventRecipients(CalendarEvent $calendarEvent, ?User $excludeUser = null): array
    {
        /** @var array<int, User> $usersById */
        $usersById = [];

        // 1) Game teams: home + away
        if ($calendarEvent->getGame()) {
            $game = $calendarEvent->getGame();
            if ($game->getHomeTeam()) {
                $usersById += $this->resolveTeamMembers($game->getHomeTeam());
            }
            if ($game->getAwayTeam()) {
                $usersById += $this->resolveTeamMembers($game->getAwayTeam());
            }
        }

        // 2) Task assignments: the directly assigned users
        $taskAssignments = $this->entityManager->getRepository(TaskAssignment::class)
            ->findBy(['calendarEvent' => $calendarEvent]);
        foreach ($taskAssignments as $ta) {
            if ($ta->getUser()) {
                $usersById[$ta->getUser()->getId()] = $ta->getUser();
            }
        }

        // 3) Permissions-based recipients
        foreach ($calendarEvent->getPermissions() as $permission) {
            switch ($permission->getPermissionType()) {
                case CalendarEventPermissionType::TEAM:
                    if ($permission->getTeam()) {
                        $usersById += $this->resolveTeamMembers($permission->getTeam());
                    }
                    break;

                case CalendarEventPermissionType::CLUB:
                    if ($permission->getClub()) {
                        $usersById += $this->resolveClubMembers($permission->getClub());
                    }
                    break;

                case CalendarEventPermissionType::USER:
                    if ($permission->getUser()) {
                        $usersById[$permission->getUser()->getId()] = $permission->getUser();
                    }
                    break;

                case CalendarEventPermissionType::PUBLIC:
                    // Public events: notify users who registered participation
                    // (attending/maybe/late) — not those who declined.
                    $participations = $this->participationRepository->createQueryBuilder('p')
                        ->innerJoin('p.status', 's')
                        ->where('p.event = :event')
                        ->andWhere('s.code != :declined')
                        ->setParameter('event', $calendarEvent)
                        ->setParameter('declined', 'not_attending')
                        ->getQuery()
                        ->getResult();
                    foreach ($participations as $p) {
                        if ($p->getUser()) {
                            $usersById[$p->getUser()->getId()] = $p->getUser();
                        }
                    }
                    break;
            }
        }

        // 4) TeamRide drivers + passengers
        $teamRides = $this->entityManager->getRepository(TeamRide::class)->findBy(['event' => $calendarEvent]);
        foreach ($teamRides as $ride) {
            if ($ride->getDriver()) {
                $usersById[$ride->getDriver()->getId()] = $ride->getDriver();
            }
            foreach ($ride->getPassengers() as $passenger) {
                if ($passenger->getUser()) {
                    $usersById[$passenger->getUser()->getId()] = $passenger->getUser();
                }
            }
        }

        // 5) Always include admins
        $admins = $this->entityManager->getRepository(User::class)
            ->createQueryBuilder('u')
            ->where('u.isVerified = true')
            ->andWhere('u.isEnabled = true')
            ->getQuery()
            ->getResult();
        foreach ($admins as $admin) {
            $roles = $admin->getRoles();
            if (in_array('ROLE_ADMIN', $roles) || in_array('ROLE_SUPER_ADMIN', $roles) || in_array('ROLE_SUPERADMIN', $roles)) {
                $usersById[$admin->getId()] = $admin;
            }
        }

        // Exclude the triggering user
        if ($excludeUser) {
            unset($usersById[$excludeUser->getId()]);
        }

        return array_values($usersById);
    }
}
