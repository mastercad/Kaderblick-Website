<?php

namespace App\Repository;

use App\Entity\Club;
use App\Entity\User;
use App\Entity\UserClubAdminAssignment;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @template-extends ServiceEntityRepository<UserClubAdminAssignment> */
class UserClubAdminAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UserClubAdminAssignment::class);
    }

    public function userAdministersClub(User $user, Club $club, ?DateTimeInterface $date = null): bool
    {
        return null !== $this->createActiveQuery($user, $date)
            ->andWhere('a.club = :club')
            ->setParameter('club', $club)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function countActiveForUser(User $user, ?DateTimeInterface $date = null): int
    {
        return (int) $this->createActiveQuery($user, $date)
            ->select('COUNT(a.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }

    /** @return UserClubAdminAssignment[] */
    public function findActiveForUser(User $user, ?DateTimeInterface $date = null): array
    {
        return $this->createActiveQuery($user, $date)->getQuery()->getResult();
    }

    private function createActiveQuery(User $user, ?DateTimeInterface $date = null): \Doctrine\ORM\QueryBuilder
    {
        $day = $date ? DateTimeImmutable::createFromInterface($date) : new DateTimeImmutable('today');

        return $this->createQueryBuilder('a')
            ->where('a.user = :user')
            ->andWhere('a.startDate IS NULL OR a.startDate <= :day')
            ->andWhere('a.endDate IS NULL OR a.endDate >= :day')
            ->setParameter('user', $user)
            ->setParameter('day', $day->setTime(0, 0));
    }
}
