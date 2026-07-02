<?php

namespace App\Security\Voter;

use App\Entity\Game;
use App\Entity\User;
use App\Service\SupporterScopeService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Game>
 */
final class GameVoter extends Voter
{
    public const CREATE = 'GAME_CREATE';
    public const EDIT = 'GAME_EDIT';
    public const VIEW = 'GAME_VIEW';
    public const DELETE = 'GAME_DELETE';

    public function __construct(private readonly SupporterScopeService $supporterScopeService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Game;
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

                foreach (array_filter([$subject->getHomeTeam(), $subject->getAwayTeam()]) as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }

                break;
            case self::DELETE:
            case self::EDIT:
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return true;
                }

                foreach (array_filter([$subject->getHomeTeam(), $subject->getAwayTeam()]) as $team) {
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
}
