<?php

namespace App\Repository;

use App\Entity\Formation;
use App\Entity\Team;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Formation>
 */
class FormationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Formation::class);
    }

    /**
     * Gibt alle Formationen zurück, die für den User sichtbar sind.
     *
     * Sichtbar sind ausschließlich Formationen, deren team_id einem der Teams entspricht,
     * in denen der User aktuell aktiv als Trainer eingetragen ist.
     * Legacy-Formationen ohne team_id werden durch die Backfill-Migration Version20260421120000
     * nachträglich mit der korrekten team_id versehen und sind danach ebenfalls über diese
     * Abfrage erreichbar.
     *
     * @param Team[] $coachTeams Aktuell aktive Trainer-Teams des Users
     *
     * @return Formation[]
     */
    public function findVisibleForUser(array $coachTeams): array
    {
        if (empty($coachTeams)) {
            return [];
        }

        return $this->createQueryBuilder('f')
            ->where('f.team IN (:teams)')
            ->setParameter('teams', $coachTeams)
            ->getQuery()
            ->getResult();
    }

    /**
     * Gibt alle Formationen zurück, die einem bestimmten Team zugeordnet sind.
     * Wird ausschließlich für SUPERADMIN/ADMIN genutzt — kein zusätzlicher Zugriffscheck nötig,
     * da der Aufrufer dies sicherstellen muss.
     *
     * @return Formation[]
     */
    public function findByTeam(int $teamId): array
    {
        return $this->createQueryBuilder('f')
            ->where('IDENTITY(f.team) = :teamId')
            ->setParameter('teamId', $teamId)
            ->getQuery()
            ->getResult();
    }
}
