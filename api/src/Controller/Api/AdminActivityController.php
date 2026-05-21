<?php

namespace App\Controller\Api;

use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin')]
#[IsGranted('ROLE_SUPERADMIN')]
class AdminActivityController extends AbstractController
{
    private const ALLOWED_SORTS = ['last_activity_at', 'full_name', 'email'];
    private const ALLOWED_DIRS = ['asc', 'desc'];

    #[Route('/activity', name: 'api_admin_activity', methods: ['GET'])]
    public function activity(Request $request, Connection $connection): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(5, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));
        $sort = in_array($request->query->get('sort'), self::ALLOWED_SORTS, true)
            ? $request->query->get('sort') : 'last_activity_at';
        $dir = in_array(strtolower((string) $request->query->get('dir', 'desc')), self::ALLOWED_DIRS, true)
            ? strtolower((string) $request->query->get('dir', 'desc')) : 'desc';

        $now = new DateTimeImmutable();
        $todayStart = $now->setTime(0, 0, 0)->format('Y-m-d H:i:s');
        $sevenDays = $now->modify('-7 days')->format('Y-m-d H:i:s');

        // ── Stats über ALLE Nutzer (unabhängig von Pagination und Suche) ──────
        $stats = $connection->fetchAssociative(
            'SELECT
                COUNT(*) AS total_count,
                SUM(CASE WHEN last_activity_at >= :today THEN 1 ELSE 0 END) AS active_today,
                SUM(CASE WHEN last_activity_at >= :seven_days THEN 1 ELSE 0 END) AS active_last7,
                SUM(CASE WHEN last_activity_at IS NULL THEN 1 ELSE 0 END) AS never_active
            FROM users',
            ['today' => $todayStart, 'seven_days' => $sevenDays]
        );

        // ── Paginierte Nutzerliste ────────────────────────────────────────────
        $whereParts = [];
        $params = [];
        $types = [];

        if ('' !== $search) {
            $whereParts[] = "(email LIKE :search OR CONCAT(first_name, ' ', last_name) LIKE :search)";
            $params['search'] = '%' . $search . '%';
            $types['search'] = ParameterType::STRING;
        }

        $where = $whereParts ? 'WHERE ' . implode(' AND ', $whereParts) : '';

        // MySQL: NULLs first in ASC → explicitly push them last for both directions
        $orderBy = match ($sort) {
            'last_activity_at' => 'desc' === $dir
                ? 'ORDER BY last_activity_at IS NULL ASC, last_activity_at DESC'
                : 'ORDER BY last_activity_at IS NOT NULL ASC, last_activity_at ASC',
            'full_name' => "ORDER BY first_name {$dir}, last_name {$dir}",
            default => "ORDER BY {$sort} {$dir}",
        };

        $total = (int) $connection->fetchOne("SELECT COUNT(*) FROM users {$where}", $params, $types);
        $offset = ($page - 1) * $limit;

        $rows = $connection->fetchAllAssociative(
            "SELECT id, email, first_name, last_name, roles, is_verified, last_activity_at
             FROM users {$where} {$orderBy} LIMIT :limit OFFSET :offset",
            array_merge($params, ['limit' => $limit, 'offset' => $offset]),
            array_merge($types, ['limit' => ParameterType::INTEGER, 'offset' => ParameterType::INTEGER])
        );

        // Roles that are computed dynamically by User::getRoles() and must never be read
        // from the raw DB column (they may have been erroneously persisted in the past).
        $dynamicRoles = ['ROLE_USER', 'ROLE_GUEST', 'ROLE_RELATED_USER'];

        $nowTs = $now->getTimestamp();
        $userList = array_map(static function (array $row) use ($nowTs, $dynamicRoles): array {
            $lastActivity = $row['last_activity_at'];
            $minutesAgo = null;
            $isoDate = null;
            if (null !== $lastActivity) {
                $ts = (new DateTimeImmutable($lastActivity))->getTimestamp();
                $minutesAgo = (int) floor(($nowTs - $ts) / 60);
                $isoDate = (new DateTimeImmutable($lastActivity))->format(DateTimeInterface::ATOM);
            }

            // Read only the manually-assigned roles stored in the DB column, then strip
            // any computed roles that may have been erroneously persisted there.
            $storedRoles = $row['roles'] ? json_decode((string) $row['roles'], true) : [];
            $storedRoles = array_values(array_filter(
                is_array($storedRoles) ? $storedRoles : [],
                static fn (string $r) => !in_array($r, $dynamicRoles, true)
            ));

            // Re-apply the same dynamic logic as User::getRoles()
            $storedRoles[] = $row['is_verified'] ? 'ROLE_USER' : 'ROLE_GUEST';
            $roles = array_values(array_unique($storedRoles));

            return [
                'id' => (int) $row['id'],
                'email' => $row['email'],
                'fullName' => trim($row['first_name'] . ' ' . $row['last_name']),
                'roles' => $roles,
                'lastActivityAt' => $isoDate,
                'minutesAgo' => $minutesAgo,
            ];
        }, $rows);

        return $this->json([
            'users' => $userList,
            'stats' => [
                'totalCount' => (int) $stats['total_count'],
                'activeToday' => (int) $stats['active_today'],
                'activeLast7Days' => (int) $stats['active_last7'],
                'neverActive' => (int) $stats['never_active'],
            ],
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => max(1, (int) ceil($total / $limit)),
            ],
        ]);
    }

    #[Route('/activity/trend', name: 'api_admin_activity_trend', methods: ['GET'])]
    public function trend(Request $request, Connection $connection): JsonResponse
    {
        $range = $request->query->get('range', 'month');
        $now = new DateTimeImmutable();

        [$fromDate, $bucketExpr] = match ($range) {
            'today' => [$now->modify('-24 hours'), "DATE_FORMAT(last_activity_at, '%Y-%m-%d %H:00:00')"],
            'week' => [$now->modify('-7 days'),   'DATE(last_activity_at)'],
            '3m' => [$now->modify('-90 days'),  'DATE(last_activity_at)'],
            '6m' => [$now->modify('-180 days'), 'DATE(last_activity_at)'],
            '1y' => [$now->modify('-365 days'), "DATE_FORMAT(last_activity_at, '%Y-%m-01')"],
            default => [$now->modify('-30 days'),  'DATE(last_activity_at)'],  // 'month'
        };

        $rows = $connection->fetchAllAssociative(
            "SELECT {$bucketExpr} AS bucket, COUNT(*) AS cnt
             FROM users
             WHERE last_activity_at >= :from AND last_activity_at IS NOT NULL
             GROUP BY bucket
             ORDER BY bucket ASC",
            ['from' => $fromDate->format('Y-m-d H:i:s')]
        );

        $data = array_map(static fn (array $row): array => [
            'label' => $row['bucket'],
            'count' => (int) $row['cnt'],
        ], $rows);

        return $this->json(['range' => $range, 'data' => $data]);
    }
}
