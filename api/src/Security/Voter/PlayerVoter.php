<?php

namespace App\Security\Voter;

use App\Entity\Player;
use App\Entity\User;
use App\Service\AdminScopeService;
use App\Service\CoachTeamPlayerService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Player>
 */
final class PlayerVoter extends Voter
{
    public const CREATE = 'POST_CREATE';
    public const EDIT = 'POST_EDIT';
    public const VIEW = 'POST_VIEW';
    public const DELETE = 'POST_DELETE';

    public function __construct(
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
        private readonly AdminScopeService $adminScopeService,
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Player;
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
                if (
                    in_array('ROLE_SUPERADMIN', $user->getRoles(), true)
                    || [] !== $this->adminScopeService->getAdministeredTeams($user)
                ) {
                    return true;
                }

                return 0 < count($this->coachTeamPlayerService->collectCoachTeams($user));

            case self::EDIT:
            case self::DELETE:
                if ($this->adminScopeService->canAdministerPlayer($user, $subject)) {
                    return true;
                }

                // Coach darf Spieler verwalten, die seinen aktiven Teams zugeordnet sind
                $coachTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

                if (0 === count($coachTeams)) {
                    break;
                }

                if (self::EDIT === $attribute) {
                    // Was der Coach tatsächlich ändern darf, wird im Controller per
                    // isFullScope geprüft. So können Coaches auch Testspieler/Leihgaben
                    // aus anderen Vereinen ihrem Team zuordnen.
                    return true;
                }

                break;
            case self::VIEW:
                return true;
        }

        return false;
    }
}
