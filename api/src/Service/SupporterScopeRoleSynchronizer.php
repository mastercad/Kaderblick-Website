<?php

declare(strict_types=1);

namespace App\Service;

use Doctrine\DBAL\Connection;
use Throwable;

class SupporterScopeRoleSynchronizer
{
    private const LOCK_NAME = 'kaderblick_supporter_scope_role_sync';

    public function __construct(private readonly Connection $connection)
    {
    }

    /** @return array{skipped: bool, promotions: int, demotions: int} */
    public function synchronizeAll(): array
    {
        if (1 !== (int) $this->connection->fetchOne('SELECT GET_LOCK(?, 0)', [self::LOCK_NAME])) {
            return ['skipped' => true, 'promotions' => 0, 'demotions' => 0];
        }

        try {
            $this->connection->executeStatement('SET SESSION innodb_lock_wait_timeout = 5');
            $this->connection->beginTransaction();

            $promotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_team_supporter_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_team ON active_team.user_id = u.id
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_club_supporter_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_club ON active_club.user_id = u.id
                SET u.roles = JSON_ARRAY_APPEND(u.roles, '$', 'ROLE_SUPPORTER')
                WHERE (active_team.user_id IS NOT NULL OR active_club.user_id IS NOT NULL)
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPPORTER"')
                SQL);

            $demotions = $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_team_supporter_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_team ON active_team.user_id = u.id
                LEFT JOIN (
                    SELECT DISTINCT user_id
                    FROM user_club_supporter_assignments
                    WHERE (start_date IS NULL OR start_date <= CURRENT_DATE())
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE())
                ) active_club ON active_club.user_id = u.id
                SET u.roles = JSON_REMOVE(u.roles, JSON_UNQUOTE(JSON_SEARCH(u.roles, 'one', 'ROLE_SUPPORTER')))
                WHERE active_team.user_id IS NULL
                  AND active_club.user_id IS NULL
                  AND JSON_CONTAINS(u.roles, '"ROLE_SUPPORTER"')
                SQL);

            $this->connection->executeStatement(<<<'SQL'
                UPDATE users u
                SET u.roles = JSON_ARRAY('ROLE_USER')
                WHERE JSON_LENGTH(u.roles) = 0
                  AND NOT JSON_CONTAINS(u.roles, '"ROLE_SUPERADMIN"')
                SQL);

            $this->connection->commit();

            return ['skipped' => false, 'promotions' => $promotions, 'demotions' => $demotions];
        } catch (Throwable $exception) {
            if ($this->connection->isTransactionActive()) {
                $this->connection->rollBack();
            }

            throw $exception;
        } finally {
            $this->connection->executeStatement('SELECT RELEASE_LOCK(?)', [self::LOCK_NAME]);
        }
    }
}
