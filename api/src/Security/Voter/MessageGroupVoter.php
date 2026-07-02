<?php

namespace App\Security\Voter;

use App\Entity\MessageGroup;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, MessageGroup>
 */
final class MessageGroupVoter extends Voter
{
    public const CREATE = 'MESSAGE_GROUP_CREATE';
    public const EDIT = 'MESSAGE_GROUP_EDIT';
    public const VIEW = 'MESSAGE_GROUP_VIEW';
    public const DELETE = 'MESSAGE_GROUP_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof MessageGroup;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var MessageGroup $messageGroup */
        $messageGroup = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Owner can always view their own group
                if ($messageGroup->getOwner() === $user) {
                    return true;
                }

                // All group members can view the group
                foreach ($messageGroup->getMembers() as $member) {
                    if ($member === $user) {
                        return true;
                    }
                }

                return false;
            case self::EDIT:
            case self::DELETE:
                // Nur Ersteller oder Admins
                return $messageGroup->getOwner() === $user
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                return true; // Alle authentifizierten User können Gruppen erstellen
        }

        return false;
    }
}
