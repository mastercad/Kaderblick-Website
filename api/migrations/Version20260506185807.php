<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260506185807 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create demo_instances table for isolated per-requester demo environments';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('
            CREATE TABLE demo_instances (
                id                    INT AUTO_INCREMENT NOT NULL,
                demo_request_id       INT NOT NULL,
                demo_token            VARCHAR(64)  NOT NULL,
                frontend_url          VARCHAR(255) NOT NULL,
                api_url               VARCHAR(255) NOT NULL,
                db_name               VARCHAR(128) NOT NULL,
                db_user               VARCHAR(128) NOT NULL,
                db_password_encrypted LONGTEXT NOT NULL,
                status                VARCHAR(20)  NOT NULL,
                created_at            DATETIME NOT NULL,
                expires_at            DATETIME DEFAULT NULL,
                UNIQUE INDEX UNIQ_demo_instances_token (demo_token),
                INDEX idx_demo_instances_token (demo_token),
                INDEX idx_demo_instances_status (status),
                UNIQUE INDEX UNIQ_demo_instances_request (demo_request_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ');

        $this->addSql('
            ALTER TABLE demo_instances
                ADD CONSTRAINT FK_demo_instances_demo_request
                FOREIGN KEY (demo_request_id) REFERENCES demo_requests (id) ON DELETE CASCADE
        ');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demo_instances DROP FOREIGN KEY FK_demo_instances_demo_request');
        $this->addSql('DROP TABLE demo_instances');
    }
}
