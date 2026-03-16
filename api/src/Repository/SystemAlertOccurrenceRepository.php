<?php

namespace App\Repository;

use App\Entity\SystemAlertOccurrence;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<SystemAlertOccurrence>
 */
class SystemAlertOccurrenceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SystemAlertOccurrence::class);
    }

    /**
     * Liefert Zeitreihen-Daten für den angegebenen Zeitraum.
     *
     * Rückgabe: Array von ['bucket' => 'YYYY-MM-DD'|'YYYY-MM-DD HH', 'category' => string, 'count' => int]
     *
     * @param 'hour'|'day' $bucketSize
     *
     * @return array<int, array{bucket: string, category: string, count: int}>
     */
    public function getTimeSeries(DateTimeImmutable $since, string $bucketSize = 'day'): array
    {
        $format = 'hour' === $bucketSize ? '%Y-%m-%d %H' : '%Y-%m-%d';

        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT DATE_FORMAT(occurred_at, :fmt) AS bucket, category, COUNT(id) AS count
             FROM system_alert_occurrences
             WHERE occurred_at >= :since
             GROUP BY bucket, category
             ORDER BY bucket ASC',
            [
                'fmt' => $format,
                'since' => $since->format('Y-m-d H:i:s'),
            ]
        );

        return array_map(static function (array $row): array {
            return [
                'bucket' => $row['bucket'],
                'category' => $row['category'],
                'count' => (int) $row['count'],
            ];
        }, $rows);
    }

    /**
     * Liefert die Gesamtzahl der Occurrences pro Kategorie in zwei aufeinanderfolgenden Zeitfenstern.
     * Wird für die Trend-Berechnung (↑ ↓ →) verwendet.
     *
     * @return array<string, array{current: int, previous: int}>
     */
    public function getTrendComparison(DateTimeImmutable $windowStart, DateTimeImmutable $prevWindowStart): array
    {
        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT
                category,
                SUM(CASE WHEN occurred_at >= :windowStart THEN 1 ELSE 0 END) AS current_count,
                SUM(CASE WHEN occurred_at >= :prevWindowStart AND occurred_at < :windowStart THEN 1 ELSE 0 END) AS previous_count
             FROM system_alert_occurrences
             WHERE occurred_at >= :prevWindowStart
             GROUP BY category',
            [
                'windowStart' => $windowStart->format('Y-m-d H:i:s'),
                'prevWindowStart' => $prevWindowStart->format('Y-m-d H:i:s'),
            ]
        );

        $result = [];
        foreach ($rows as $row) {
            $result[$row['category']] = [
                'current' => (int) $row['current_count'],
                'previous' => (int) $row['previous_count'],
            ];
        }

        return $result;
    }

    /**
     * Gesamtzahl der Occurrences seit einem Zeitpunkt, pro Kategorie.
     *
     * @return array<string, int>
     */
    public function countSince(DateTimeImmutable $since): array
    {
        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT category, COUNT(id) AS count
             FROM system_alert_occurrences
             WHERE occurred_at >= :since
             GROUP BY category',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $result = [];
        foreach ($rows as $row) {
            $result[$row['category']] = (int) $row['count'];
        }

        return $result;
    }
}
