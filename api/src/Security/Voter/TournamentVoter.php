<?php

namespace App\Security\Voter;

use App\Entity\Tournament;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Tournament>
 */
class TournamentVoter extends Voter
{
    public const VIEW = 'TOURNAMENT_VIEW';
    public const EDIT = 'TOURNAMENT_EDIT';
    public const DELETE = 'TOURNAMENT_DELETE';
    public const CREATE = 'TOURNAMENT_CREATE';

    protected function supports(string $attribute, $subject): bool
    {
        if (!in_array($attribute, [self::VIEW, self::EDIT, self::DELETE, self::CREATE], true)) {
            return false;
        }

        // CREATE does not require a Tournament subject
        if (self::CREATE === $attribute) {
            return true;
        }

        if (!$subject instanceof Tournament) {
            return false;
        }

        return true;
    }

    /**
     * @param Tournament $subject
     */
    protected function voteOnAttribute(string $attribute, $subject, TokenInterface $token): bool
    {
        $user = $token->getUser();
        if (!$user instanceof User) {
            return false;
        }

        // superadmin can do everything
        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return true;
        }

        if (self::CREATE === $attribute) {
            return $user->isVerified() && in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        }

        switch ($attribute) {
            case self::VIEW:
                return $this->isOwner($subject, $user);
            case self::EDIT:
            case self::DELETE:
                return in_array('ROLE_SUPERADMIN', $user->getRoles(), true)
                    || $this->isOwner($subject, $user);
        }

        return false;
    }

    private function isOwner(Tournament $tournament, User $user): bool
    {
        $owner = $tournament->getCreatedBy();
        if (!$owner) {
            return false;
        }

        return $owner->getId() === $user->getId();
    }
}
