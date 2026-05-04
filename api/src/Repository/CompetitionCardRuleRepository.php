<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CompetitionCardRule;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<CompetitionCardRule>
 */
class CompetitionCardRuleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CompetitionCardRule::class);
    }

    /**
     * Findet die passende Karten-Regel für einen Wettbewerb zum aktuellen Datum.
     *
     * Priorisierung:
     * 1. Spezifische Regel (competition_type + competition_id + person_type), aktiv zum Datum
     * 2. Generische Regel (competition_type + competition_id IS NULL + person_type), aktiv zum Datum
     * 3. Selbe Hierarchie nochmal für person_type = 'all'
     *
     * Bei mehreren gültigen Regeln (überlappende Zeiträume) gewinnt die zuletzt startende.
     *
     * @param string $personType CompetitionCardRule::PERSON_* ('player'|'coach'|'all')
     */
    public function findApplicableRule(
        string $competitionType,
        ?int $competitionId,
        ?DateTimeImmutable $at = null,
        string $personType = CompetitionCardRule::PERSON_PLAYER,
    ): ?CompetitionCardRule {
        $at ??= new DateTimeImmutable('today');

        // Spezifische Regel (mit competitionId) für genau diesen Personen-Typ
        if (null !== $competitionId) {
            $rule = $this->findActiveRule($competitionType, $competitionId, $at, $personType);
            if (null !== $rule) {
                return $rule;
            }
        }

        // Generische Regel (ohne competitionId) für genau diesen Personen-Typ
        $rule = $this->findActiveRule($competitionType, null, $at, $personType);
        if (null !== $rule) {
            return $rule;
        }

        // Falls kein spezifischer Eintrag vorhanden: auf 'all' zurückfallen
        if (CompetitionCardRule::PERSON_ALL !== $personType) {
            if (null !== $competitionId) {
                $rule = $this->findActiveRule($competitionType, $competitionId, $at, CompetitionCardRule::PERSON_ALL);
                if (null !== $rule) {
                    return $rule;
                }
            }

            return $this->findActiveRule($competitionType, null, $at, CompetitionCardRule::PERSON_ALL);
        }

        return null;
    }

    private function findActiveRule(
        string $competitionType,
        ?int $competitionId,
        DateTimeImmutable $at,
        string $personType,
    ): ?CompetitionCardRule {
        $qb = $this->createQueryBuilder('r')
            ->where('r.competitionType = :type')
            ->andWhere('r.personType = :personType')
            ->andWhere('r.validFrom IS NULL OR r.validFrom <= :at')
            ->andWhere('r.validUntil IS NULL OR r.validUntil >= :at')
            ->setParameter('type', $competitionType)
            ->setParameter('personType', $personType)
            ->setParameter('at', $at)
            ->orderBy('r.validFrom', 'DESC') // jüngste zuerst
            ->setMaxResults(1);

        if (null === $competitionId) {
            $qb->andWhere('r.competitionId IS NULL');
        } else {
            $qb->andWhere('r.competitionId = :cid')
               ->setParameter('cid', $competitionId);
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Alle Regeln (für die Admin-Verwaltung), optional gefiltert nach Wettbewerbstyp.
     *
     * @return CompetitionCardRule[]
     */
    public function findAllForAdmin(?string $competitionType = null): array
    {
        $qb = $this->createQueryBuilder('r')
            ->orderBy('r.competitionType', 'ASC')
            ->addOrderBy('r.competitionId', 'ASC')
            ->addOrderBy('r.validFrom', 'DESC');

        if (null !== $competitionType) {
            $qb->andWhere('r.competitionType = :type')
               ->setParameter('type', $competitionType);
        }

        return $qb->getQuery()->getResult();
    }
}
