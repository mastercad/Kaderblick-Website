<?php

namespace App\Security\Voter;

use App\Entity\SurveyResponse;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, SurveyResponse>
 */
final class SurveyResponseVoter extends Voter
{
    public const CREATE = 'SURVEY_RESPONSE_CREATE';
    public const EDIT = 'SURVEY_RESPONSE_EDIT';
    public const VIEW = 'SURVEY_RESPONSE_VIEW';
    public const DELETE = 'SURVEY_RESPONSE_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof SurveyResponse;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var SurveyResponse $surveyResponse */
        $surveyResponse = $subject;

        switch ($attribute) {
            case self::VIEW:
                // Eigene Antworten oder Admins
                return $surveyResponse->getUserId() === $user->getId()
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles());
            case self::EDIT:
            case self::DELETE:
                // Nur eigene Antworten
                return $surveyResponse->getUserId() === $user->getId();
            case self::CREATE:
                return true; // Alle authentifizierten User können antworten
        }

        return false;
    }
}
