<?php

namespace App\Security\Voter;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, GameEvent>
 * @template-extends Voter<string, Game>
 */
final class GameEventVoter extends Voter
{
    public const CREATE = 'GAME_EVENT_CREATE';
    public const EDIT = 'GAME_EVENT_EDIT';
    public const VIEW = 'GAME_EVENT_VIEW';
    public const DELETE = 'GAME_EVENT_DELETE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return (in_array($attribute, [self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof GameEvent)
            || (self::CREATE === $attribute && $subject instanceof Game)
        ;
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
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return true;
                }

                if (in_array('ROLE_ADMIN', $user->getRoles()) || in_array('ROLE_SUPPORTER', $user->getRoles())) {
                    return true;
                }

                if (
                    !in_array('ROLE_ADMIN', $user->getRoles())
                    && !in_array('ROLE_SUPPORTER', $user->getRoles())
                ) {
                    return false;
                }

                foreach ($user->getUserRelations() as $userRelation) {
                    if ($userRelation->getPlayer()) {
                        foreach ($userRelation->getPlayer()->getPlayerTeamAssignments() as $assignment) {
                            if (
                                $assignment->getTeam() === $subject->getHomeTeam()
                                || $assignment->getTeam() === $subject->getAwayTeam()
                            ) {
                                return true;
                            }
                        }
                    }

                    if ($userRelation->getCoach()) {
                        foreach ($userRelation->getCoach()->getCoachTeamAssignments() as $assignment) {
                            if (
                                $assignment->getTeam() === $subject->getHomeTeam()
                                || $assignment->getTeam() === $subject->getAwayTeam()
                            ) {
                                return true;
                            }
                        }
                    }
                }

                break;
            case self::DELETE:
            case self::EDIT:
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return true;
                }

                if (in_array('ROLE_ADMIN', $user->getRoles()) || in_array('ROLE_SUPPORTER', $user->getRoles())) {
                    return true;
                }

                if (
                    !in_array('ROLE_ADMIN', $user->getRoles())
                    && !in_array('ROLE_SUPPORTER', $user->getRoles())
                ) {
                    return false;
                }

                foreach ($user->getUserRelations() as $userRelation) {
                    if ($userRelation->getPlayer()) {
                        foreach ($userRelation->getPlayer()->getPlayerTeamAssignments() as $assignment) {
                            /** @var GameEvent $subject */
                            if (
                                $assignment->getTeam() === $subject->getGame()->getHomeTeam()
                                || $assignment->getTeam() === $subject->getGame()->getAwayTeam()
                            ) {
                                return true;
                            }
                        }
                    }

                    if ($userRelation->getCoach()) {
                        foreach ($userRelation->getCoach()->getCoachTeamAssignments() as $assignment) {
                            /** @var GameEvent $subject */
                            if (
                                $assignment->getTeam() === $subject->getGame()->getHomeTeam()
                                || $assignment->getTeam() === $subject->getGame()->getAwayTeam()
                            ) {
                                return true;
                            }
                        }
                    }
                }
                break;
            case self::VIEW:
                return true;
        }

        return false;
    }
}
