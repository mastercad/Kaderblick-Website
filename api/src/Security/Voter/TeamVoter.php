<?php

namespace App\Security\Voter;

use App\Entity\Team;
use App\Entity\User;
use App\Service\AdminScopeService;
use App\Service\CoachTeamPlayerService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Team>
 */
final class TeamVoter extends Voter
{
    public const CREATE = 'TEAM_CREATE';
    public const EDIT = 'TEAM_EDIT';
    public const VIEW = 'TEAM_VIEW';
    public const DELETE = 'TEAM_DELETE';

    public function __construct(
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
        private readonly AdminScopeService $adminScopeService,
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Team;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        // SUPERADMIN darf immer alles
        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return true;
        }

        switch ($attribute) {
            case self::CREATE:
                // Neue Teams anlegen: nur ADMIN
                return in_array('ROLE_ADMIN', $user->getRoles());

            case self::EDIT:
            case self::DELETE:
                /** @var Team $subject */
                if ($this->adminScopeService->canAdministerTeam($user, $subject)) {
                    return true;
                }

                // ADMIN darf immer bearbeiten/löschen
                if (in_array('ROLE_ADMIN', $user->getRoles())) {
                    return true;
                }

                // Coach darf nur Teams bearbeiten/löschen, denen er aktuell aktiv zugeordnet ist
                $coachTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

                return isset($coachTeams[$subject->getId()]);

            case self::VIEW:
                return true;
        }

        return false;
    }
}
