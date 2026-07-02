<?php

namespace App\Security\Voter;

use App\Entity\Message;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Message>
 */
final class MessageVoter extends Voter
{
    public const CREATE = 'MESSAGE_CREATE';
    public const EDIT = 'MESSAGE_EDIT';
    public const VIEW = 'MESSAGE_VIEW';
    public const DELETE = 'MESSAGE_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Message;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Message $message */
        $message = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Sender oder Empfänger können Nachricht sehen
                return $message->getSender()->getId() === $user->getId() || $message->getRecipients()->contains($user);
            case self::EDIT:
                // Nur Sender kann bearbeiten
                return $message->getSender()->getId() === $user->getId();
            case self::DELETE:
                // Sender oder Admin können löschen
                return $message->getSender()->getId() === $user->getId()
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                return true; // Alle authentifizierten User können Nachrichten senden
        }

        return false;
    }
}
