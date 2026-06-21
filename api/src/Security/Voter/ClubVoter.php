<?php

namespace App\Security\Voter;

use App\Entity\Club;
use App\Entity\User;
use App\Service\AdminScopeService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Club>
 */
final class ClubVoter extends Voter
{
    public const CREATE = 'CLUB_CREATE';
    public const EDIT = 'CLUB_EDIT';
    public const VIEW = 'CLUB_VIEW';
    public const DELETE = 'CLUB_DELETE';

    public function __construct(private readonly AdminScopeService $adminScopeService)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof Club;
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
            case self::EDIT:
            case self::DELETE:
                /** @var Club $subject */
                if (self::CREATE !== $attribute && $this->adminScopeService->canAdministerClub($user, $subject)) {
                    return true;
                }

                if (
                    in_array('ROLE_ADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                ) {
                    return true;
                }

                break;
            case self::VIEW:
                return true;
        }

        return false;
    }
}
