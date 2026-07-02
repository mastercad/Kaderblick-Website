<?php

namespace App\Service;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\UserClubAdminAssignmentRepository;
use App\Repository\UserTeamAdminAssignmentRepository;
use DateTimeImmutable;
use DateTimeInterface;

class AdminScopeService
{
    public function __construct(
        private readonly UserTeamAdminAssignmentRepository $teamAssignments,
        private readonly UserClubAdminAssignmentRepository $clubAssignments,
    ) {
    }

    public function canAdministerTeam(User $user, Team $team, ?DateTimeInterface $date = null): bool
    {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        return $this->hasAssignedScopeForTeam($user, $team, $date);
    }

    public function hasAssignedScopeForTeam(User $user, Team $team, ?DateTimeInterface $date = null): bool
    {
        if ($this->teamAssignments->userAdministersTeam($user, $team, $date)) {
            return true;
        }

        foreach ($team->getClubs() as $club) {
            if ($this->clubAssignments->userAdministersClub($user, $club, $date)) {
                return true;
            }
        }

        return false;
    }

    public function canAdministerClub(User $user, Club $club, ?DateTimeInterface $date = null): bool
    {
        return $this->isSuperAdmin($user) || $this->hasAssignedScopeForClub($user, $club, $date);
    }

    public function hasAssignedScopeForClub(User $user, Club $club, ?DateTimeInterface $date = null): bool
    {
        return $this->clubAssignments->userAdministersClub($user, $club, $date);
    }

    /** @return array<int, Team> keyed by team ID */
    public function getAdministeredTeams(User $user, ?DateTimeInterface $date = null): array
    {
        $teams = [];
        foreach ($this->teamAssignments->findActiveForUser($user, $date) as $assignment) {
            $team = $assignment->getTeam();
            if (null !== $team) {
                $teams[$team->getId()] = $team;
            }
        }
        foreach ($this->clubAssignments->findActiveForUser($user, $date) as $assignment) {
            foreach ($assignment->getClub()?->getTeams() ?? [] as $team) {
                $teams[$team->getId()] = $team;
            }
        }

        return $teams;
    }

    public function canAdministerPlayer(User $user, Player $player, ?DateTimeInterface $date = null): bool
    {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            if (!$assignment->getTeam() || !$this->isActiveOn($assignment->getStartDate(), $assignment->getEndDate(), $date)) {
                continue;
            }

            if ($this->canAdministerTeam($user, $assignment->getTeam(), $date)) {
                return true;
            }
        }

        return false;
    }

    public function canAdministerCoach(User $user, Coach $coach, ?DateTimeInterface $date = null): bool
    {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        foreach ($coach->getCoachTeamAssignments() as $assignment) {
            if (!$assignment->getTeam() || !$this->isActiveOn($assignment->getStartDate(), $assignment->getEndDate(), $date)) {
                continue;
            }

            if ($this->canAdministerTeam($user, $assignment->getTeam(), $date)) {
                return true;
            }
        }

        foreach ($coach->getCoachClubAssignments() as $assignment) {
            if (!$assignment->getClub() || !$this->isActiveOn($assignment->getStartDate(), $assignment->getEndDate(), $date)) {
                continue;
            }

            if ($this->canAdministerClub($user, $assignment->getClub(), $date)) {
                return true;
            }
        }

        return false;
    }

    public function synchronizeRoleFromAssignments(User $user, ?DateTimeInterface $date = null): void
    {
        $this->synchronizeRole(
            $user,
            $this->teamAssignments->countActiveForUser($user, $date),
            $this->clubAssignments->countActiveForUser($user, $date),
        );
    }

    public function synchronizeRole(User $user, int $teamAssignmentCount, int $clubAssignmentCount): void
    {
        if ($this->isPlatformAdmin($user)) {
            return;
        }

        if ($clubAssignmentCount > 0) {
            $user->addRole('ROLE_CLUB_ADMIN');
        } else {
            $user->removeRole('ROLE_CLUB_ADMIN');
        }

        if ($teamAssignmentCount > 0) {
            $user->addRole('ROLE_TEAM_ADMIN');
        } else {
            $user->removeRole('ROLE_TEAM_ADMIN');
        }
    }

    private function isPlatformAdmin(User $user): bool
    {
        return $this->isSuperAdmin($user);
    }

    private function isSuperAdmin(User $user): bool
    {
        return in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
    }

    private function isActiveOn(
        ?DateTimeInterface $startDate,
        ?DateTimeInterface $endDate,
        ?DateTimeInterface $date = null,
    ): bool {
        $day = DateTimeImmutable::createFromInterface($date ?? new DateTimeImmutable('today'))->setTime(0, 0);

        return (null === $startDate || DateTimeImmutable::createFromInterface($startDate)->setTime(0, 0) <= $day)
            && (null === $endDate || DateTimeImmutable::createFromInterface($endDate)->setTime(0, 0) >= $day);
    }
}
