<?php

declare(strict_types=1);

namespace App\Service;

use Doctrine\DBAL\Connection;
use RuntimeException;
use Throwable;

/**
 * Synchronisiert zeitabhängige Admin-Rollen mit konstant drei Bulk-Updates.
 * Es werden weder User-Entities hydriert noch Queries pro Benutzer ausgeführt.
 */
class AdminScopeRoleSynchronizer
{
    private const LOCK_NAME = 'kaderblick_admin_scope_role_sync';

    public function __construct(private readonly Connection $connection)
    {
    }

    /** @return array{skipped: bool, clubPromotions: int, teamPromotions: int, demotions: int} */
    public function synchronizeAll(): array
    {
        if (1 !== (int) $this->connection->fetchOne('SELECT GET_LOCK(?, 0)', [self::LOCK_NAME])) {
            return ['skipped' => true, 'clubPromotions' => 0, 'teamPromotions' => 0, 'demotions' => 0];
        }

        try {
            // Der Command wartet höchstens fünf Sekunden auf konkurrierende DB-Schreiblocks.
            $this->connection->executeStatement('SET SESSION innodb_lock_wait_timeout = 5');
            $this->connection->beginTransaction();

            $clubPromotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                INNER JOIN (
                    SELECT DISTINCT user_id
                    FROM user_club_admin_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_club ON active_club.user_id = u.id
                SET u.roles = JSON_ARRAY_APPEND(u.roles, '$', 'ROLE_CLUB_ADMIN'),
                    u.role_before_scoped_admin = NULL
                WHERE NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_CLUB_ADMIN"')
                SQL);

            $teamPromotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                INNER JOIN (
                    SELECT DISTINCT user_id
                    FROM user_team_admin_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_team ON active_team.user_id = u.id
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_club_admin_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_club ON active_club.user_id = u.id
                SET u.roles = JSON_ARRAY_APPEND(u.roles, '$', 'ROLE_TEAM_ADMIN'),
                    u.role_before_scoped_admin = NULL
                WHERE NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_TEAM_ADMIN"')
                SQL);

            $teamDemotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_team_admin_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_team ON active_team.user_id = u.id
                SET u.roles = JSON_REMOVE(u.roles, JSON_UNQUOTE(JSON_SEARCH(u.roles, 'one', 'ROLE_TEAM_ADMIN'))),
                    u.role_before_scoped_admin = NULL
                WHERE active_team.user_id IS NULL
                  AND JSON_CONTAINS(u.roles, '"ROLE_TEAM_ADMIN"')
                SQL);

            $clubDemotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_club_admin_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_club ON active_club.user_id = u.id
                SET u.roles = JSON_REMOVE(u.roles, JSON_UNQUOTE(JSON_SEARCH(u.roles, 'one', 'ROLE_CLUB_ADMIN'))),
                    u.role_before_scoped_admin = NULL
                WHERE active_club.user_id IS NULL
                  AND JSON_CONTAINS(u.roles, '"ROLE_CLUB_ADMIN"')
                SQL);

            $demotions = $teamDemotions + $clubDemotions;

            $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                SET u.roles = JSON_ARRAY('ROLE_USER')
                WHERE JSON_LENGTH(u.roles) = 0
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                SQL);

            $this->connection->commit();

            return [
                'skipped' => false,
                'clubPromotions' => $clubPromotions,
                'teamPromotions' => $teamPromotions,
                'demotions' => $demotions,
            ];
        } catch (Throwable $exception) {
            if ($this->connection->isTransactionActive()) {
                $this->connection->rollBack();
            }
            throw new RuntimeException('Admin-Rollen konnten nicht performant synchronisiert werden.', 0, $exception);
        } finally {
            try {
                $this->connection->fetchOne('SELECT RELEASE_LOCK(?)', [self::LOCK_NAME]);
            } catch (Throwable) {
                // Die Verbindung gibt den Lock beim Schließen ohnehin frei.
            }
        }
    }
}
