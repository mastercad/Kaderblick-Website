<?php

namespace App\Security\Voter;

use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\Survey;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @template-extends Voter<string, Survey>
 */
final class SurveyVoter extends Voter
{
    public const CREATE = 'SURVEY_CREATE';
    public const EDIT = 'SURVEY_EDIT';
    public const VIEW = 'SURVEY_VIEW';
    public const DELETE = 'SURVEY_DELETE';
    public const VIEW_STATS = 'SURVEY_VIEW_STATS';

    public function __construct(
        private EntityManagerInterface $entityManager
    ) {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::CREATE, self::EDIT, self::VIEW, self::DELETE, self::VIEW_STATS])
            && $subject instanceof Survey;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        /** @var ?User $user */
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        $isAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles())
            || in_array('ROLE_SUPERADMIN', $user->getRoles());

        switch ($attribute) {
            case self::CREATE:
            case self::EDIT:
            case self::DELETE:
                return $isAdmin;

            case self::VIEW:
                return true;

            case self::VIEW_STATS:
                if ($isAdmin) {
                    return true;
                }

                // Coach of any team assigned to this survey
                foreach ($subject->getTeams() as $team) {
                    if ($this->isCoachOfTeam($user, $team->getId())) {
                        return true;
                    }
                }

                // Coach of any club assigned to this survey
                foreach ($subject->getClubs() as $club) {
                    if ($this->isCoachOfClub($user, $club->getId())) {
                        return true;
                    }
                }

                break;
        }

        return false;
    }

    private function isCoachOfTeam(User $user, int $teamId): bool
    {
        $result = $this->entityManager->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cta.team = :teamId')
            ->setParameter('user', $user)
            ->setParameter('teamId', $teamId)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $result;
    }

    private function isCoachOfClub(User $user, int $clubId): bool
    {
        $result = $this->entityManager->getRepository(CoachClubAssignment::class)
            ->createQueryBuilder('cca')
            ->innerJoin('cca.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->where('ur.user = :user')
            ->andWhere('cca.club = :clubId')
            ->setParameter('user', $user)
            ->setParameter('clubId', $clubId)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return null !== $result;
    }
}
