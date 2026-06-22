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
                SET u.role_before_scoped_admin = CASE
                        WHEN JSON_CONTAINS(u.roles, '"ROLE_TEAM_ADMIN"')
                          OR JSON_CONTAINS(u.roles, '"ROLE_CLUB_ADMIN"')
                        THEN u.role_before_scoped_admin
                        ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(u.roles, '$[0]')), 'ROLE_USER')
                    END,
                    u.roles = JSON_ARRAY('ROLE_CLUB_ADMIN')
                WHERE NOT JSON_CONTAINS(u.roles, '"ROLE_ADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
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
                SET u.role_before_scoped_admin = CASE
                        WHEN JSON_CONTAINS(u.roles, '"ROLE_TEAM_ADMIN"')
                          OR JSON_CONTAINS(u.roles, '"ROLE_CLUB_ADMIN"')
                        THEN u.role_before_scoped_admin
                        ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(u.roles, '$[0]')), 'ROLE_USER')
                    END,
                    u.roles = JSON_ARRAY('ROLE_TEAM_ADMIN')
                WHERE active_club.user_id IS NULL
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_ADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_TEAM_ADMIN"')
                SQL);

            $demotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                LEFT JOIN (
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
                SET u.roles = JSON_ARRAY(COALESCE(u.role_before_scoped_admin, 'ROLE_USER')),
                    u.role_before_scoped_admin = NULL
                WHERE active_team.user_id IS NULL
                  AND active_club.user_id IS NULL
                  AND u.role_before_scoped_admin IS NOT NULL
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
