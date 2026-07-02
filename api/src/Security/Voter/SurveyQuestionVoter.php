<?php

namespace App\Security\Voter;

use App\Entity\SurveyQuestion;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, SurveyQuestion>
 */
final class SurveyQuestionVoter extends Voter
{
    public const CREATE = 'SURVEY_QUESTION_CREATE';
    public const EDIT = 'SURVEY_QUESTION_EDIT';
    public const VIEW = 'SURVEY_QUESTION_VIEW';
    public const DELETE = 'SURVEY_QUESTION_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof SurveyQuestion;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var SurveyQuestion $surveyQuestion */
        $surveyQuestion = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Alle können Fragen sehen, wenn sie die Umfrage sehen können
                return true;
            case self::CREATE:
            case self::EDIT:
            case self::DELETE:
                // Nur Admins oder Umfrage-Ersteller
                return in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
        }

        return false;
    }
}
