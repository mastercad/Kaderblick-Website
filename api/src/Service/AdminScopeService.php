<?php

namespace App\Service;

use App\Entity\Club;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\UserClubAdminAssignmentRepository;
use App\Repository\UserTeamAdminAssignmentRepository;
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
        if ($this->isPlatformAdmin($user) || $this->teamAssignments->userAdministersTeam($user, $team, $date)) {
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
        return $this->isPlatformAdmin($user)
            || $this->clubAssignments->userAdministersClub($user, $club, $date);
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

        $currentRole = $user->getRole();
        $isScopedAdmin = in_array($currentRole, ['ROLE_TEAM_ADMIN', 'ROLE_CLUB_ADMIN'], true);

        if (($teamAssignmentCount > 0 || $clubAssignmentCount > 0) && !$isScopedAdmin) {
            $user->setRoleBeforeScopedAdmin($currentRole);
        }

        if ($clubAssignmentCount > 0) {
            $user->setRoles(['ROLE_CLUB_ADMIN']);

            return;
        }

        if ($teamAssignmentCount > 0) {
            $user->setRoles(['ROLE_TEAM_ADMIN']);

            return;
        }

        if ($isScopedAdmin) {
            $user->setRoles([$user->getRoleBeforeScopedAdmin() ?? 'ROLE_USER']);
            $user->setRoleBeforeScopedAdmin(null);
        }
    }

    private function isPlatformAdmin(User $user): bool
    {
        return in_array($user->getRole(), ['ROLE_ADMIN', 'ROLE_SUPERADMIN'], true);
    }
}
