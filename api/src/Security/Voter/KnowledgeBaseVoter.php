<?php

namespace App\Security\Voter;

use App\Entity\CoachTeamAssignment;
use App\Entity\KnowledgeBasePost;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, KnowledgeBasePost|Team>
 */
final class KnowledgeBaseVoter extends Voter
{
    public const POST_VIEW = 'KB_POST_VIEW';
    public const POST_CREATE = 'KB_POST_CREATE';
    public const POST_EDIT = 'KB_POST_EDIT';
    public const POST_DELETE = 'KB_POST_DELETE';
    public const POST_PIN = 'KB_POST_PIN';
    public const COMMENT_VIEW = 'KB_COMMENT_VIEW';
    public const COMMENT_ADD = 'KB_COMMENT_ADD';

    public function __construct(
        private readonly EntityManagerInterface $em
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [
            self::POST_VIEW,
            self::POST_CREATE,
            self::POST_EDIT,
            self::POST_DELETE,
            self::POST_PIN,
            self::COMMENT_VIEW,
            self::COMMENT_ADD,
        ]);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        // SUPERADMIN can always do anything
        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return true;
        }

        $team = $this->resolveTeam($subject);

        switch ($attribute) {
            // ── READ ─────────────────────────────────────────────────────────
            case self::POST_VIEW:
            case self::COMMENT_VIEW:
                if (!$team instanceof Team) {
                    return false;
                }

                // All team members (player, coach, or admin/supporter in team) may read
                return $this->isUserInTeam($user, $team);

                // ── WRITE / CREATE ───────────────────────────────────────────────
            case self::POST_CREATE:
            case self::COMMENT_ADD:
                if (!$team instanceof Team) {
                    return false;
                }

                return $this->canCreate($user, $team);

                // ── EDIT / DELETE ────────────────────────────────────────────────
            case self::POST_EDIT:
            case self::POST_DELETE:
                if (!$subject instanceof KnowledgeBasePost) {
                    return false;
                }

                // ROLE_ADMIN must also belong to the team
                if (
                    in_array('ROLE_ADMIN', $user->getRoles(), true)
                    && $this->isUserInTeam($user, $subject->getTeam())
                ) {
                    return true;
                }

                // Creator can always edit/delete their own post
                return $subject->getCreatedBy()->getId() === $user->getId();

                // ── PIN ──────────────────────────────────────────────────────────
            case self::POST_PIN:
                if (!$subject instanceof KnowledgeBasePost) {
                    return false;
                }

                // Only coaches and admins of the team may pin
                return $this->canCreate($user, $subject->getTeam());
        }

        return false;
    }

    private function resolveTeam(mixed $subject): ?Team
    {
        if ($subject instanceof Team) {
            return $subject;
        }

        if ($subject instanceof KnowledgeBasePost) {
            return $subject->getTeam();
        }

        return null;
    }

    /**
     * Checks whether user has ROLE_ADMIN/ROLE_SUPPORTER AND belongs to the team,
     * OR is a coach of the team.
     */
    private function canCreate(User $user, Team $team): bool
    {
        $isPrivilegedRole = in_array('ROLE_ADMIN', $user->getRoles(), true)
            || in_array('ROLE_SUPPORTER', $user->getRoles(), true);

        if ($isPrivilegedRole && $this->isUserInTeam($user, $team)) {
            return true;
        }

        return $this->isCoachOfTeam($user, $team);
    }

    /**
     * Returns true if the user is linked to the team as a player or coach.
     */
    private function isUserInTeam(User $user, Team $team): bool
    {
        $playerAssignment = $this->em->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->innerJoin('pta.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('pta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if (null !== $playerAssignment) {
            return true;
        }

        return null !== $this->em->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    private function isCoachOfTeam(User $user, Team $team): bool
    {
        return null !== $this->em->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :team')
            ->setParameter('user', $user)
            ->setParameter('team', $team)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
