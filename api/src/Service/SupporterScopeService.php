<?php

namespace App\Service;

use App\Entity\Club;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\UserClubSupporterAssignmentRepository;
use App\Repository\UserTeamSupporterAssignmentRepository;
use DateTimeInterface;

class SupporterScopeService
{
    public function __construct(
        private readonly UserTeamSupporterAssignmentRepository $teamAssignments,
        private readonly UserClubSupporterAssignmentRepository $clubAssignments,
    ) {
    }

    public function canSupportTeam(User $user, Team $team, ?DateTimeInterface $date = null): bool
    {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        if (!in_array('ROLE_SUPPORTER', $user->getRoles(), true)) {
            return false;
        }

        return $this->hasAssignedScopeForTeam($user, $team, $date);
    }

    public function hasAssignedScopeForTeam(User $user, Team $team, ?DateTimeInterface $date = null): bool
    {
        if ($this->teamAssignments->userSupportsTeam($user, $team, $date)) {
            return true;
        }

        foreach ($team->getClubs() as $club) {
            if ($this->clubAssignments->userSupportsClub($user, $club, $date)) {
                return true;
            }
        }

        return false;
    }

    public function canSupportClub(User $user, Club $club, ?DateTimeInterface $date = null): bool
    {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        if (!in_array('ROLE_SUPPORTER', $user->getRoles(), true)) {
            return false;
        }

        return $this->clubAssignments->userSupportsClub($user, $club, $date);
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
        if ($this->isSuperAdmin($user)) {
            return;
        }

        if ($teamAssignmentCount > 0 || $clubAssignmentCount > 0) {
            $user->addRole('ROLE_SUPPORTER');

            return;
        }

        $user->removeRole('ROLE_SUPPORTER');
    }

    private function isSuperAdmin(User $user): bool
    {
        return in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
    }
}
