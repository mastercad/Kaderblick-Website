<?php

namespace App\Security\Voter;

use App\Entity\Camera;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Camera>
 */
final class CameraVoter extends Voter
{
    public const CREATE = 'CAMERA_CREATE';
    public const EDIT = 'CAMERA_EDIT';
    public const VIEW = 'CAMERA_VIEW';
    public const DELETE = 'CAMERA_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Camera;
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
