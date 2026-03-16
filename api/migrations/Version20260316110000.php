<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260316110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add google_avatar_url and use_google_avatar columns to users table';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            ALTER TABLE users
                ADD google_avatar_url VARCHAR(500) DEFAULT NULL,
                ADD use_google_avatar TINYINT(1) NOT NULL DEFAULT 0
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
                DROP COLUMN google_avatar_url,
                DROP COLUMN use_google_avatar
        SQL);
    }
}
