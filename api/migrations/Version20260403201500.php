<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Hotfix: Version20260403100000 added totp_backup_codes JSON NOT NULL with no DEFAULT.
 * MariaDB fills new columns in existing rows with '' (empty string), which fails the
 * implicit json_valid() CHECK constraint → SQLSTATE[23000] / error 4025 on every flush.
 *
 * This migration:
 *  1. Repairs existing rows that contain invalid JSON.
 *  2. Sets a proper DEFAULT '[]' so future ALTERs never cause this again.
 */
final class Version20260403201500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Hotfix: set totp_backup_codes DEFAULT \'[]\' and repair rows with invalid JSON';
    }

    public function up(Schema $schema): void
    {
        // Step 1: repair stale rows ('' or any non-JSON value written by the previous ALTER)
        $this->addSql(<<<'SQL'
            UPDATE users
            SET totp_backup_codes = '[]'
            WHERE totp_backup_codes IS NULL
               OR NOT JSON_VALID(totp_backup_codes)
        SQL);

        // Step 2: add the missing DEFAULT so the column is safe for future schema changes
        $this->addSql(<<<'SQL'
            ALTER TABLE users
                MODIFY totp_backup_codes JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '(DC2Type:json)'
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE users
                MODIFY totp_backup_codes JSON NOT NULL COMMENT '(DC2Type:json)'
        SQL);
    }
}
