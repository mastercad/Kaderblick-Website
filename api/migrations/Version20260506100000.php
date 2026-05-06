<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260506100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create demo_requests table';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            CREATE TABLE demo_requests (
                id INT AUTO_INCREMENT NOT NULL,
                processed_by_id INT DEFAULT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                club_name VARCHAR(255) DEFAULT NULL,
                league VARCHAR(255) DEFAULT NULL,
                age_group VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                message LONGTEXT DEFAULT NULL,
                status VARCHAR(20) NOT NULL,
                created_at DATETIME NOT NULL,
                processed_at DATETIME DEFAULT NULL,
                admin_note LONGTEXT DEFAULT NULL,
                INDEX idx_demo_requests_status (status),
                INDEX idx_demo_requests_created_at (created_at),
                INDEX IDX_demo_requests_processed_by (processed_by_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE demo_requests
                ADD CONSTRAINT FK_demo_requests_processed_by
                FOREIGN KEY (processed_by_id) REFERENCES users (id) ON DELETE SET NULL
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE demo_requests DROP FOREIGN KEY FK_demo_requests_processed_by');
        $this->addSql('DROP TABLE demo_requests');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
