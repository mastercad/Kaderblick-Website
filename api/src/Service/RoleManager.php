<?php

namespace App\Service;

use App\Entity\User;
use InvalidArgumentException;

class RoleManager
{
    public function canAssignRole(User $currentUser, User $targetUser, string $newRole): bool
    {
        return $currentUser->hasRole('ROLE_SUPERADMIN');
    }

    public function retrieveRoleRank(string $role): int
    {
        return match ($role) {
            'ROLE_GUEST' => 0,
            'ROLE_USER' => 10,
            'ROLE_SUPPORTER' => 20,
            'ROLE_TEAM_ADMIN' => 30,
            'ROLE_CLUB_ADMIN' => 40,
            'ROLE_SUPERADMIN' => 70,
            default => throw new InvalidArgumentException("Unknown role: $role"),
        };
    }
}
