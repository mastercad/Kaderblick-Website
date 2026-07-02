<?php

namespace App\Security\Voter;

use App\Entity\AgeGroup;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, AgeGroup>
 */
final class AgeGroupVoter extends Voter
{
    public const CREATE = 'AGE_GROUP_CREATE';
    public const EDIT = 'AGE_GROUP_EDIT';
    public const VIEW = 'AGE_GROUP_VIEW';
    public const DELETE = 'AGE_GROUP_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof AgeGroup;
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
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }

                break;
            case self::VIEW:
                return true;
        }

        return false;
    }
}
