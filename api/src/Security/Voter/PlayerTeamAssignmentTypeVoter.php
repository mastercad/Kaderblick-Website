<?php

namespace App\Security\Voter;

use App\Entity\PlayerTeamAssignmentType;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, PlayerTeamAssignmentType>
 */
final class PlayerTeamAssignmentTypeVoter extends Voter
{
    public const CREATE = 'PLAYER_TEAM_ASSIGNMENT_TYPE_CREATE';
    public const EDIT = 'PLAYER_TEAM_ASSIGNMENT_TYPE_EDIT';
    public const VIEW = 'PLAYER_TEAM_ASSIGNMENT_TYPE_VIEW';
    public const DELETE = 'PLAYER_TEAM_ASSIGNMENT_TYPE_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof PlayerTeamAssignmentType;
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
            case self::EDIT:
            case self::DELETE:
                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::VIEW:
                return true;
        }

        return false;
    }
}
