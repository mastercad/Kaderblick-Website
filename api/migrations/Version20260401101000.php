<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260401101000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add last push delivery timestamps to users table';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            ALTER TABLE users
                ADD last_push_success_at DATETIME DEFAULT NULL,
                ADD last_push_failure_at DATETIME DEFAULT NULL
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            ALTER TABLE users
                DROP COLUMN last_push_success_at,
                DROP COLUMN last_push_failure_at
        SQL);
    }
}
