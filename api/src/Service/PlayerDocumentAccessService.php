<?php

namespace App\Service;

use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerDocument;
use App\Entity\User;
use App\Repository\UserRelationRepository;
use DateTimeImmutable;

class PlayerDocumentAccessService
{
    public function __construct(
        private readonly CoachTeamPlayerService $coachTeams,
        private readonly UserRelationRepository $relations,
        private readonly AdminScopeService $adminScope,
    ) {
    }

    public function canView(User $user, PlayerDocument $document): bool
    {
        return $this->canManageClubDocument($user, $document->getPlayer(), $document->getClub())
            || $this->hasRelationPermission($user, $document->getPlayer(), ['view_documents', 'manage_documents']);
    }

    public function canManagePlayer(User $user, Player $player): bool
    {
        if ($this->isPlatformAdmin($user)) {
            return true;
        }
        $accessibleTeamIds = array_keys($this->coachTeams->collectCoachTeams($user));
        $today = new DateTimeImmutable('today');
        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            if (
                (null === $assignment->getStartDate() || $assignment->getStartDate() <= $today)
                && (null === $assignment->getEndDate() || $assignment->getEndDate() >= $today)
                && in_array($assignment->getTeam()->getId(), $accessibleTeamIds, true)
            ) {
                return true;
            }
        }

        return $this->hasRelationPermission($user, $player, ['manage_documents']);
    }

    public function canManageClubDocument(User $user, Player $player, Club $club): bool
    {
        if (
            $this->isPlatformAdmin($user)
            || $this->adminScope->hasAssignedScopeForClub($user, $club)
            || $this->hasRelationPermission($user, $player, ['manage_documents'])
        ) {
            return true;
        }
        $accessibleTeamIds = array_keys($this->coachTeams->collectCoachTeams($user));
        $today = new DateTimeImmutable('today');
        foreach ($player->getPlayerTeamAssignments() as $assignment) {
            if (
                (null !== $assignment->getStartDate() && $assignment->getStartDate() > $today)
                || (null !== $assignment->getEndDate() && $assignment->getEndDate() < $today)
                || !in_array($assignment->getTeam()->getId(), $accessibleTeamIds, true)
            ) {
                continue;
            }
            foreach ($assignment->getTeam()->getClubs() as $teamClub) {
                if ($teamClub->getId() === $club->getId()) {
                    return true;
                }
            }
        }

        return false;
    }

    /** @param list<string> $permissions */
    public function hasRelationPermission(User $user, Player $player, array $permissions): bool
    {
        foreach ($this->relations->findBy(['user' => $user, 'player' => $player]) as $relation) {
            foreach ($permissions as $permission) {
                if ($relation->hasPermission($permission)) {
                    return true;
                }
                if ('view_documents' === $permission && $relation->hasPermission('Dokumente ansehen')) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isPlatformAdmin(User $user): bool
    {
        return (bool) array_intersect(['ROLE_ADMIN', 'ROLE_SUPERADMIN'], $user->getRoles());
    }
}
