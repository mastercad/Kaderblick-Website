<?php

namespace App\Security\Voter;

use App\Entity\Coach;
use App\Entity\User;
use App\Service\AdminScopeService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Coach>
 */
final class CoachVoter extends Voter
{
    public const CREATE = 'COACH_CREATE';
    public const EDIT = 'COACH_EDIT';
    public const VIEW = 'COACH_VIEW';
    public const DELETE = 'COACH_DELETE';

    public function __construct(private readonly AdminScopeService $adminScopeService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Coach;
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
                return in_array('ROLE_SUPERADMIN', $user->getRoles(), true)
                    || [] !== $this->adminScopeService->getAdministeredTeams($user);

            case self::EDIT:
            case self::DELETE:
                return $this->adminScopeService->canAdministerCoach($user, $subject);
            case self::VIEW:
                return true;
        }

        return false;
    }
}
