<?php

namespace App\Security\Voter;

use App\Entity\Notification;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Notification>
 */
final class NotificationVoter extends Voter
{
    public const CREATE = 'NOTIFICATION_CREATE';
    public const EDIT = 'NOTIFICATION_EDIT';
    public const VIEW = 'NOTIFICATION_VIEW';
    public const DELETE = 'NOTIFICATION_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Notification;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Notification $notification */
        $notification = $subject;

        switch ($attribute) {
            case self::VIEW:
            case self::EDIT:
                // Nur eigene Benachrichtigungen
                return $notification->getUser()->getId() === $user->getId();
            case self::DELETE:
                // Eigene Benachrichtigungen oder Admin
                return $notification->getUser()->getId() === $user->getId()
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                // Admins können Benachrichtigungen erstellen
                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
        }

        return false;
    }
}
