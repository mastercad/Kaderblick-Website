<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260316100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create system_alerts and system_alert_occurrences tables for admin health monitoring';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            CREATE TABLE system_alerts (
                id INT AUTO_INCREMENT NOT NULL,
                category VARCHAR(50) NOT NULL,
                fingerprint VARCHAR(32) NOT NULL,
                message LONGTEXT NOT NULL,
                request_uri VARCHAR(2048) DEFAULT NULL,
                http_method VARCHAR(10) DEFAULT NULL,
                client_ip VARCHAR(45) DEFAULT NULL,
                exception_class VARCHAR(255) DEFAULT NULL,
                stack_trace LONGTEXT DEFAULT NULL,
                context JSON DEFAULT NULL,
                occurrence_count INT NOT NULL DEFAULT 1,
                first_occurrence_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                last_occurrence_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                is_resolved TINYINT(1) NOT NULL DEFAULT 0,
                resolved_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                resolved_note LONGTEXT DEFAULT NULL,
                INDEX idx_system_alerts_fingerprint (fingerprint),
                INDEX idx_system_alerts_category (category),
                INDEX idx_system_alerts_resolved (is_resolved),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE system_alert_occurrences (
                id INT AUTO_INCREMENT NOT NULL,
                alert_id INT NOT NULL,
                category VARCHAR(50) NOT NULL,
                occurred_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_sao_occurred_at (occurred_at),
                INDEX idx_sao_category (category),
                INDEX IDX_sao_alert_id (alert_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE system_alert_occurrences
                ADD CONSTRAINT fk_sao_system_alerts_id
                FOREIGN KEY (alert_id) REFERENCES system_alerts (id) ON DELETE CASCADE
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE system_alert_occurrences DROP FOREIGN KEY fk_sao_system_alerts_id');
        $this->addSql('DROP TABLE system_alert_occurrences');
        $this->addSql('DROP TABLE system_alerts');
    }
}
