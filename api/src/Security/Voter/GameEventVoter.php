<?php

namespace App\Security\Voter;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\User;
use App\Repository\UserTeamAdminAssignmentRepository;
use App\Service\SupporterScopeService;
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

    public function __construct(
        private readonly UserTeamAdminAssignmentRepository $teamAdminAssignments,
        private readonly SupporterScopeService $supporterScopeService,
    ) {
    }

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

        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return true;
        }

        switch ($attribute) {
            case self::CREATE:
                /** @var Game $subject */
                if ($this->administersGameTeam($user, $subject)) {
                    return true;
                }

                foreach (array_filter([$subject->getHomeTeam(), $subject->getAwayTeam()]) as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }

                break;
            case self::DELETE:
            case self::EDIT:
                /** @var GameEvent $subject */
                if ($this->administersGameTeam($user, $subject->getGame())) {
                    return true;
                }

                foreach (array_filter([$subject->getGame()->getHomeTeam(), $subject->getGame()->getAwayTeam()]) as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }
                break;
            case self::VIEW:
                return true;
        }

        return false;
    }

    private function administersGameTeam(User $user, Game $game): bool
    {
        if (!in_array('ROLE_TEAM_ADMIN', $user->getRoles(), true)) {
            return false;
        }

        foreach (array_filter([$game->getHomeTeam(), $game->getAwayTeam()]) as $team) {
            if ($this->teamAdminAssignments->userAdministersTeam($user, $team)) {
                return true;
            }
        }

        return false;
    }
}
