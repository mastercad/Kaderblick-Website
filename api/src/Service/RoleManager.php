<?php

namespace App\Service;

use App\Entity\User;
use InvalidArgumentException;

class RoleManager
{
    public function canAssignRole(User $currentUser, User $targetUser, string $newRole): bool
    {
        if ($currentUser->hasRole('ROLE_SUPERADMIN')) {
            return true;
        }

        if (!$currentUser->hasRole('ROLE_ADMIN')) {
            return false;
        }

        return $this->retrieveRoleRank($targetUser->getRole()) < $this->retrieveRoleRank('ROLE_ADMIN')
            && $this->retrieveRoleRank($newRole) < $this->retrieveRoleRank('ROLE_ADMIN');
    }

    public function retrieveRoleRank(string $role): int
    {
        return match ($role) {
            'ROLE_GUEST' => 0,
            'ROLE_USER' => 10,
            'ROLE_SUPPORTER' => 20,
            'ROLE_CLUB' => 30,
            'ROLE_TEAM_ADMIN' => 40,
            'ROLE_CLUB_ADMIN' => 50,
            'ROLE_ADMIN' => 60,
            'ROLE_SUPERADMIN' => 70,
            default => throw new InvalidArgumentException("Unknown role: $role"),
        };
    }
}
