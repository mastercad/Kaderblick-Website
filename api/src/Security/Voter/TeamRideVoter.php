<?php

namespace App\Security\Voter;

use App\Entity\TeamRide;
use App\Entity\User;
use App\Service\TeamMembershipService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, TeamRide>
 */
final class TeamRideVoter extends Voter
{
    public const CREATE = 'TEAM_RIDE_CREATE';
    public const EDIT = 'TEAM_RIDE_EDIT';
    public const VIEW = 'TEAM_RIDE_VIEW';
    public const DELETE = 'TEAM_RIDE_DELETE';

    public function __construct(
        private readonly TeamMembershipService $teamMembershipService
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
            && $subject instanceof TeamRide;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var TeamRide $teamRide */
        $teamRide = $subject;

        if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return true;
        }

        switch ($attribute) {
            case self::VIEW:
            case self::CREATE:
                // Only team members of the associated event may view/create rides
                return $this->isUserTeamMemberForRide($user, $teamRide);

            case self::EDIT:
            case self::DELETE:
                // Driver may always manage their own ride
                if ($teamRide->getDriver()->getId() === $user->getId()) {
                    return true;
                }

                // ROLE_SUPERADMIN must also be in the same team
                if (in_array('ROLE_SUPERADMIN', $user->getRoles())) {
                    return $this->isUserTeamMemberForRide($user, $teamRide);
                }

                return false;
        }

        return false;
    }

    /**
     * Returns true when $user belongs to any team that is associated with the
     * TeamRide's CalendarEvent (via TEAM-type permissions or via game teams).
     */
    private function isUserTeamMemberForRide(User $user, TeamRide $teamRide): bool
    {
        $event = $teamRide->getEvent();
        if (!$event instanceof \App\Entity\CalendarEvent) {
            return false;
        }

        return $this->teamMembershipService->isUserTeamMemberForEvent($user, $event);
    }
}
