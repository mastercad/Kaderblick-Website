<?php

namespace App\Security\Voter;

use App\Entity\Game;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Game>
 */
final class MatchPlanVoter extends Voter
{
    public const MANAGE = 'MATCH_PLAN_MANAGE';
    public const PUBLISH = 'MATCH_PLAN_PUBLISH';
    public const VIEW = 'MATCH_PLAN_VIEW';

    public function __construct(private readonly CoachTeamPlayerService $coachTeamPlayerService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::MANAGE, self::PUBLISH, self::VIEW], true)
            && $subject instanceof Game;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Game $subject */
        if ($this->canManage($user, $subject)) {
            return true;
        }

        return match ($attribute) {
            self::VIEW => $this->canViewPublishedPlan($user, $subject),
            self::MANAGE, self::PUBLISH => false,
            default => false,
        };
    }

    private function canManage(User $user, Game $game): bool
    {
        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true) || in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            return true;
        }

        $homeTeamId = $game->getHomeTeam()?->getId();
        $awayTeamId = $game->getAwayTeam()?->getId();

        foreach ($this->coachTeamPlayerService->collectCoachTeams($user) as $team) {
            if ($team->getId() === $homeTeamId || $team->getId() === $awayTeamId) {
                return true;
            }
        }

        return false;
    }

    private function canViewPublishedPlan(User $user, Game $game): bool
    {
        $matchPlan = $game->getMatchPlan();
        if (!is_array($matchPlan) || empty($matchPlan['published'])) {
            return false;
        }

        $selectedTeamId = isset($matchPlan['selectedTeamId']) ? (int) $matchPlan['selectedTeamId'] : 0;
        if ($selectedTeamId <= 0) {
            return false;
        }

        foreach ($this->coachTeamPlayerService->collectPlayerTeams($user) as $team) {
            if ($team->getId() === $selectedTeamId) {
                return true;
            }
        }

        return false;
    }
}
