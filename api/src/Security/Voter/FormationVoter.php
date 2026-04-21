<?php

namespace App\Security\Voter;

use App\Entity\Formation;
use App\Entity\User;
use App\Service\UserTeamAccessService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Formation>
 */
final class FormationVoter extends Voter
{
    public const CREATE = 'FORMATION_CREATE';
    public const EDIT = 'FORMATION_EDIT';
    public const VIEW = 'FORMATION_VIEW';
    public const DELETE = 'FORMATION_DELETE';

    public function __construct(private readonly UserTeamAccessService $teamAccessService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Formation;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Formation $formation */
        $formation = $subject;

        switch ($attribute) {
            case self::VIEW:
            case self::EDIT:
            case self::DELETE:
                if (
                    in_array('ROLE_ADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }
                $team = $formation->getTeam();
                if (null === $team) {
                    // Noch kein Team gesetzt (Altdaten): Ersteller-Fallback
                    return $formation->getUser()?->getId() === $user->getId();
                }
                // Nur Trainer, die aktiv diesem Team zugeordnet sind
                $coachTeams = $this->teamAccessService->getSelfCoachTeams($user);

                return isset($coachTeams[$team->getId()]);
            case self::CREATE:
                return true;
        }

        return false;
    }
}
