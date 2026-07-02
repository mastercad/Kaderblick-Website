<?php

namespace App\Security\Voter;

use App\Entity\News;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, News>
 */
final class NewsVoter extends Voter
{
    public const CREATE = 'NEWS_CREATE';
    public const EDIT = 'NEWS_EDIT';
    public const VIEW = 'NEWS_VIEW';
    public const DELETE = 'NEWS_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof News;
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
                // Admin/SuperAdmin can always create news
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }

                // User must have at least one relation (player or coach)
                $userRelations = $user->getUserRelations();
                if ($userRelations->isEmpty()) {
                    return false;
                }

                // Check if user has any active player or coach relations
                foreach ($userRelations as $relation) {
                    if ($relation->getPlayer() || $relation->getCoach()) {
                        return true;
                    }
                }

                return false;

            case self::EDIT:
            case self::DELETE:
                // Admin/SuperAdmin can edit/delete any news
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }

                // Creator can edit/delete their own news
                return $subject->getCreatedBy()->getId() === $user->getId();

            case self::VIEW:
                // Platform visibility: everyone can see
                if ('platform' === $subject->getVisibility()) {
                    return true;
                }

                // Admin/SuperAdmin can view all news
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }

                // Creator can always view their own news
                if ($subject->getCreatedBy()->getId() === $user->getId()) {
                    return true;
                }

                // Club visibility: check if user has access to this club
                if ('club' === $subject->getVisibility() && $subject->getClub()) {
                    foreach ($user->getUserRelations() as $relation) {
                        if ($relation->getPlayer()) {
                            foreach ($relation->getPlayer()->getPlayerClubAssignments() as $pca) {
                                if ($pca->getClub()->getId() === $subject->getClub()->getId()) {
                                    return true;
                                }
                            }
                        }
                        if ($relation->getCoach()) {
                            foreach ($relation->getCoach()->getCoachClubAssignments() as $cca) {
                                if ($cca->getClub()->getId() === $subject->getClub()->getId()) {
                                    return true;
                                }
                            }
                        }
                    }
                }

                // Team visibility: check if user has access to this team
                if ('team' === $subject->getVisibility() && $subject->getTeam()) {
                    foreach ($user->getUserRelations() as $relation) {
                        if ($relation->getPlayer()) {
                            foreach ($relation->getPlayer()->getPlayerTeamAssignments() as $pta) {
                                if ($pta->getTeam()->getId() === $subject->getTeam()->getId()) {
                                    return true;
                                }
                            }
                        }
                        if ($relation->getCoach()) {
                            foreach ($relation->getCoach()->getCoachTeamAssignments() as $cta) {
                                if ($cta->getTeam()->getId() === $subject->getTeam()->getId()) {
                                    return true;
                                }
                            }
                        }
                    }
                }

                return false;
        }

        return false;
    }
}
