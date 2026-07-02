<?php

namespace App\Security\Voter;

use App\Entity\SurveyOptionType;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, SurveyOptionType>
 */
final class SurveyOptionTypeVoter extends Voter
{
    public const CREATE = 'SURVEY_OPTION_TYPE_CREATE';
    public const EDIT = 'SURVEY_OPTION_TYPE_EDIT';
    public const VIEW = 'SURVEY_OPTION_TYPE_VIEW';
    public const DELETE = 'SURVEY_OPTION_TYPE_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof SurveyOptionType;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        switch ($attribute) {
            case self::VIEW:
                // Alle authentifizierten User können Option-Types sehen
                return true;
            case self::CREATE:
            case self::EDIT:
            case self::DELETE:
                // Nur Admins
                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
        }

        return false;
    }
}
