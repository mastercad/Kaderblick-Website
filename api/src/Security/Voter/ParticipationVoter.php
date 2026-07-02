<?php

namespace App\Security\Voter;

use App\Entity\Participation;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Participation>
 */
final class ParticipationVoter extends Voter
{
    public const CREATE = 'PARTICIPATION_CREATE';
    public const EDIT = 'PARTICIPATION_EDIT';
    public const VIEW = 'PARTICIPATION_VIEW';
    public const DELETE = 'PARTICIPATION_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Participation;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Participation $participation */
        $participation = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Eigene Teilnahme oder Team-Mitglieder oder Admins
                if ($participation->getUser() === $user) {
                    return true;
                }

                // Admins und Trainer können alle Teilnahmen sehen
                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::EDIT:
            case self::DELETE:
                // Nur eigene Teilnahme oder Admins
                return $participation->getUser() === $user
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                return true; // Alle authentifizierten User können Teilnahmen erstellen
        }

        return false;
    }
}
