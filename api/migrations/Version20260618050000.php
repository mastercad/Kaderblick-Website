<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618050000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create penalty_types table and add penalty_type_id FK to tab_entries';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('CREATE TABLE penalty_types (
            id INT AUTO_INCREMENT NOT NULL,
            team_id INT DEFAULT NULL,
            club_id INT DEFAULT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) DEFAULT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            is_positive TINYINT(1) NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            valid_from DATE DEFAULT NULL,
            valid_until DATE DEFAULT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX IDX_penalty_types_team (team_id),
            INDEX IDX_penalty_types_club (club_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('ALTER TABLE penalty_types ADD CONSTRAINT FK_penalty_types_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE penalty_types ADD CONSTRAINT FK_penalty_types_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');

        $this->addSql('ALTER TABLE tab_entries ADD penalty_type_id INT DEFAULT NULL AFTER club_id');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_penalty_type FOREIGN KEY (penalty_type_id) REFERENCES penalty_types (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_tab_entries_penalty_type ON tab_entries (penalty_type_id)');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_penalty_type');
        $this->addSql('DROP INDEX IDX_tab_entries_penalty_type ON tab_entries');
        $this->addSql('ALTER TABLE tab_entries DROP COLUMN penalty_type_id');

        $this->addSql('ALTER TABLE penalty_types DROP FOREIGN KEY FK_penalty_types_team');
        $this->addSql('ALTER TABLE penalty_types DROP FOREIGN KEY FK_penalty_types_club');
        $this->addSql('DROP TABLE penalty_types');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
