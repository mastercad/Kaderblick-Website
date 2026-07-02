<?php

namespace App\Tests\Unit\Service;

use App\Service\AdminScopeRoleSynchronizer;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;

class AdminScopeRoleSynchronizerTest extends TestCase
{
    public function testConcurrentRunIsSkippedWithoutExecutingUpdates(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::once())
            ->method('fetchOne')
            ->with('SELECT GET_LOCK(?, 0)', ['kaderblick_admin_scope_role_sync'])
            ->willReturn(0);
        $connection->expects(self::never())->method('executeStatement');

        $result = (new AdminScopeRoleSynchronizer($connection))->synchronizeAll();

        self::assertTrue($result['skipped']);
    }

    public function testSynchronizationUsesConstantNumberOfBulkUpdates(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::exactly(2))
            ->method('fetchOne')
            ->willReturnOnConsecutiveCalls(1, 1);
        $connection->expects(self::once())->method('beginTransaction');
        $connection->expects(self::once())->method('commit');
        $connection->expects(self::exactly(6))
            ->method('executeStatement')
            ->willReturnCallback(static function (string $sql): int {
                if (str_starts_with($sql, 'SET SESSION')) {
                    return 0;
                }
                if (str_contains($sql, "JSON_ARRAY_APPEND(u.roles, '$', 'ROLE_CLUB_ADMIN')")) {
                    return 2;
                }
                if (str_contains($sql, "JSON_ARRAY_APPEND(u.roles, '$', 'ROLE_TEAM_ADMIN')")) {
                    return 3;
                }
                if (str_contains($sql, "ROLE_TEAM_ADMIN'))")) {
                    return 1;
                }
                if (str_contains($sql, "ROLE_CLUB_ADMIN'))")) {
                    return 3;
                }
                if (str_contains($sql, 'JSON_LENGTH(u.roles) = 0')) {
                    return 0;
                }

                self::fail('Unexpected SQL statement: ' . $sql);
            });

        $result = (new AdminScopeRoleSynchronizer($connection))->synchronizeAll();

        self::assertSame([
            'skipped' => false,
            'clubPromotions' => 2,
            'teamPromotions' => 3,
            'demotions' => 4,
        ], $result);
    }
}
