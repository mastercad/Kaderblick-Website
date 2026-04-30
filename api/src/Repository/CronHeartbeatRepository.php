<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CronHeartbeat;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<CronHeartbeat>
 */
class CronHeartbeatRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CronHeartbeat::class);
    }

    public function findByCommand(string $command): ?CronHeartbeat
    {
        return $this->findOneBy(['command' => $command]);
    }

    /**
     * Gibt den CronHeartbeat-Eintrag für einen Befehl zurück und legt ihn an, falls er noch nicht existiert.
     */
    public function findOrCreate(string $command): CronHeartbeat
    {
        $entry = $this->findByCommand($command);

        if (null === $entry) {
            $entry = new CronHeartbeat($command);
            $this->getEntityManager()->persist($entry);
        }

        return $entry;
    }
}
