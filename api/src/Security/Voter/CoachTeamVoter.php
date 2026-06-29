<?php

namespace App\Security\Voter;

use App\Entity\Team;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Prüft ob ein User als aktiver Coach Zugriff auf ein bestimmtes Team hat.
 *
 * @template-extends Voter<string, Team>
 */
final class CoachTeamVoter extends Voter
{
    public const ACCESS = 'COACH_TEAM_ACCESS';

    public function __construct(private CoachTeamPlayerService $coachTeamPlayerService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return self::ACCESS === $attribute && $subject instanceof Team;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return true;
        }

        // @TODO hier noch implementieren wenn der User im Verein eine Funktionalität hat oder ein Staffmitglied mit rechten für Teams hat

        /** @var Team $team */
        $team = $subject;

        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        foreach ($activeTeams as $activeTeam) {
            if ($activeTeam->getId() === $team->getId()) {
                return true;
            }
        }

        return false;
    }
}
