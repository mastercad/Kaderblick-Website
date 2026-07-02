<?php

namespace App\Security\Voter;

use App\Entity\SurveyOption;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, SurveyOption>
 */
final class SurveyOptionVoter extends Voter
{
    public const CREATE = 'SURVEY_OPTION_CREATE';
    public const EDIT = 'SURVEY_OPTION_EDIT';
    public const VIEW = 'SURVEY_OPTION_VIEW';
    public const DELETE = 'SURVEY_OPTION_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof SurveyOption;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var SurveyOption $surveyOption */
        $surveyOption = $subject;

        switch ($attribute) {
            case self::VIEW:
                // System-Optionen sind immer für alle sichtbar
                if ($surveyOption->isSystemOption()) {
                    return true;
                }
                // Benutzerdefinierte Optionen: Ersteller darf sie sehen,
                // und alle dürfen sie sehen wenn sie einer Frage zugeordnet sind (beim Beantworten)
                if ($surveyOption->getCreatedBy()?->getId() === $user->getId()) {
                    return true;
                }
                // Wenn die Option schon an Fragen gebunden ist, darf jeder sie sehen (Beantwortung)
                if ($surveyOption->getQuestions()->count() > 0) {
                    return true;
                }

                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::CREATE:
                // Jeder angemeldete Benutzer darf eigene Optionen erstellen
                return true;
            case self::EDIT:
                // Nur eigenen Optionen bearbeiten, oder Admin
                return $surveyOption->getCreatedBy()?->getId() === $user->getId()
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::DELETE:
                // Nur eigene Optionen löschen, oder Admin
                return $surveyOption->getCreatedBy()?->getId() === $user->getId()
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
        }

        return false;
    }
}
