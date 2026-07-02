<?php

namespace App\Security\Voter;

use App\Entity\Game;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\Video;
use App\Repository\UserTeamAdminAssignmentRepository;
use App\Service\SupporterScopeService;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Video|Team|Game>
 */
final class VideoVoter extends Voter
{
    public const CREATE = 'VIDEO_CREATE';
    public const EDIT = 'VIDEO_EDIT';
    public const VIEW = 'VIDEO_VIEW';
    public const DELETE = 'VIDEO_DELETE';

    public function __construct(
        private readonly UserTeamAdminAssignmentRepository $teamAdminAssignments,
        private readonly SupporterScopeService $supporterScopeService,
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return (
            in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE])
                && $subject instanceof Video)
            || (self::CREATE === $attribute && ($subject instanceof Team || $subject instanceof Game))
            || (self::VIEW === $attribute && $subject instanceof Game)
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
                if ($this->administersSubjectTeam($user, $subject)) {
                    return true;
                }

                foreach ($this->resolveTeams($subject) as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }

                break;
            case self::DELETE:
            case self::EDIT:
                /* @var Video $subject */
                if ($this->administersGameTeam($user, $subject->getGame())) {
                    return true;
                }

                foreach ($this->resolveTeams($subject->getGame()) as $team) {
                    if ($this->supporterScopeService->canSupportTeam($user, $team)) {
                        return true;
                    }
                }
                break;
            case self::VIEW:
                if ($subject instanceof Game) {
                    if ($this->administersGameTeam($user, $subject)) {
                        return true;
                    }

                    // Videos für ein Spiel dürfen nur Teammitglieder sehen
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

                    return false;
                }

                if ($this->administersGameTeam($user, $subject->getGame())) {
                    return true;
                }

                foreach ($user->getUserRelations() as $userRelation) {
                    if ($userRelation->getPlayer()) {
                        foreach ($userRelation->getPlayer()->getPlayerTeamAssignments() as $assignment) {
                            if ($assignment->getTeam() === $subject->getGame()->getHomeTeam()) {
                                return true;
                            }
                            if ($assignment->getTeam() === $subject->getGame()->getAwayTeam()) {
                                return true;
                            }
                        }
                    }

                    if ($userRelation->getCoach()) {
                        foreach ($userRelation->getCoach()->getCoachTeamAssignments() as $assignment) {
                            if ($assignment->getTeam() === $subject->getGame()->getHomeTeam()) {
                                return true;
                            }
                            if ($assignment->getTeam() === $subject->getGame()->getAwayTeam()) {
                                return true;
                            }
                        }
                    }
                }
                break;
        }

        return false;
    }

    private function administersSubjectTeam(User $user, mixed $subject): bool
    {
        if ($subject instanceof Team) {
            return $this->administersTeam($user, $subject);
        }

        if ($subject instanceof Game) {
            return $this->administersGameTeam($user, $subject);
        }

        return false;
    }

    private function administersGameTeam(User $user, Game $game): bool
    {
        foreach (array_filter([$game->getHomeTeam(), $game->getAwayTeam()]) as $team) {
            if ($this->administersTeam($user, $team)) {
                return true;
            }
        }

        return false;
    }

    private function administersTeam(User $user, Team $team): bool
    {
        return in_array('ROLE_TEAM_ADMIN', $user->getRoles(), true)
            && $this->teamAdminAssignments->userAdministersTeam($user, $team);
    }

    /** @return Team[] */
    private function resolveTeams(mixed $subject): array
    {
        if ($subject instanceof Team) {
            return [$subject];
        }

        if ($subject instanceof Game) {
            return array_filter([$subject->getHomeTeam(), $subject->getAwayTeam()]);
        }

        return [];
    }
}
