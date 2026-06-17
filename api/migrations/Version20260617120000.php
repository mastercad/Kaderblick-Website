<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260617120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add staff/functionary assignment types and assignments linked to User; drop obsolete staff/functionary entities';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        // ── assignment type tables ───────────────────────────────────────────────
        $this->addSql('CREATE TABLE staff_team_assignment_types (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(255) DEFAULT NULL, active TINYINT(1) NOT NULL DEFAULT 1, UNIQUE INDEX uniq_staff_team_assignment_type_name (name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE staff_club_assignment_types (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(255) DEFAULT NULL, active TINYINT(1) NOT NULL DEFAULT 1, UNIQUE INDEX uniq_staff_club_assignment_type_name (name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE functionary_team_assignment_types (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(255) DEFAULT NULL, active TINYINT(1) NOT NULL DEFAULT 1, UNIQUE INDEX uniq_functionary_team_assignment_type_name (name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE functionary_club_assignment_types (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(255) DEFAULT NULL, active TINYINT(1) NOT NULL DEFAULT 1, UNIQUE INDEX uniq_functionary_club_assignment_type_name (name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // ── assignment tables (directly linked to users) ─────────────────────────
        $this->addSql('CREATE TABLE staff_team_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, team_id INT NOT NULL, staff_team_assignment_type_id INT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX idx_staff_team_assignment_user_id (user_id), INDEX idx_staff_team_assignment_team_id (team_id), INDEX idx_staff_team_assignment_type_id (staff_team_assignment_type_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE staff_team_assignments ADD CONSTRAINT fk_staff_team_assignment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE staff_team_assignments ADD CONSTRAINT fk_staff_team_assignment_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE staff_team_assignments ADD CONSTRAINT fk_staff_team_assignment_type FOREIGN KEY (staff_team_assignment_type_id) REFERENCES staff_team_assignment_types (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE staff_club_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, club_id INT NOT NULL, staff_club_assignment_type_id INT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX idx_staff_club_assignment_user_id (user_id), INDEX idx_staff_club_assignment_club_id (club_id), INDEX idx_staff_club_assignment_type_id (staff_club_assignment_type_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE staff_club_assignments ADD CONSTRAINT fk_staff_club_assignment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE staff_club_assignments ADD CONSTRAINT fk_staff_club_assignment_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE staff_club_assignments ADD CONSTRAINT fk_staff_club_assignment_type FOREIGN KEY (staff_club_assignment_type_id) REFERENCES staff_club_assignment_types (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE functionary_team_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, team_id INT NOT NULL, functionary_team_assignment_type_id INT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX idx_functionary_team_assignment_user_id (user_id), INDEX idx_functionary_team_assignment_team_id (team_id), INDEX idx_functionary_team_assignment_type_id (functionary_team_assignment_type_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE functionary_team_assignments ADD CONSTRAINT fk_functionary_team_assignment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE functionary_team_assignments ADD CONSTRAINT fk_functionary_team_assignment_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE functionary_team_assignments ADD CONSTRAINT fk_functionary_team_assignment_type FOREIGN KEY (functionary_team_assignment_type_id) REFERENCES functionary_team_assignment_types (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE functionary_club_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, club_id INT NOT NULL, functionary_club_assignment_type_id INT DEFAULT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX idx_functionary_club_assignment_user_id (user_id), INDEX idx_functionary_club_assignment_club_id (club_id), INDEX idx_functionary_club_assignment_type_id (functionary_club_assignment_type_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE functionary_club_assignments ADD CONSTRAINT fk_functionary_club_assignment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE functionary_club_assignments ADD CONSTRAINT fk_functionary_club_assignment_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE functionary_club_assignments ADD CONSTRAINT fk_functionary_club_assignment_type FOREIGN KEY (functionary_club_assignment_type_id) REFERENCES functionary_club_assignment_types (id) ON DELETE SET NULL');

        // ── user_relations: drop obsolete staff_id / functionary_id (if they exist) ──
        $schemaManager = $this->connection->createSchemaManager();
        $fks = array_map(
            static fn ($fk) => $fk->getName(),
            $schemaManager->listTableForeignKeys('user_relations')
        );

        if (\in_array('fk_user_relations_staff', $fks, true)) {
            $this->addSql('ALTER TABLE user_relations DROP FOREIGN KEY fk_user_relations_staff');
        }
        if (\in_array('fk_user_relations_functionary', $fks, true)) {
            $this->addSql('ALTER TABLE user_relations DROP FOREIGN KEY fk_user_relations_functionary');
        }

        $indexes = array_map(
            static fn ($idx) => $idx->getName(),
            $schemaManager->listTableIndexes('user_relations')
        );

        if (\in_array('idx_user_relations_staff_id', $indexes, true)) {
            $this->addSql('DROP INDEX idx_user_relations_staff_id ON user_relations');
        }
        if (\in_array('idx_user_relations_functionary_id', $indexes, true)) {
            $this->addSql('DROP INDEX idx_user_relations_functionary_id ON user_relations');
        }

        $columns = array_keys($schemaManager->listTableColumns('user_relations'));
        $dropCols = [];
        if (\in_array('staff_id', $columns, true)) {
            $dropCols[] = 'DROP COLUMN staff_id';
        }
        if (\in_array('functionary_id', $columns, true)) {
            $dropCols[] = 'DROP COLUMN functionary_id';
        }
        if (!empty($dropCols)) {
            $this->addSql('ALTER TABLE user_relations ' . implode(', ', $dropCols));
        }

        // ── drop obsolete abstract entity tables (if they exist) ─────────────────
        if ($schemaManager->tablesExist(['staff'])) {
            $this->addSql('DROP TABLE staff');
        }
        if ($schemaManager->tablesExist(['functionaries'])) {
            $this->addSql('DROP TABLE functionaries');
        }
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('CREATE TABLE staff (id INT AUTO_INCREMENT NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, birthdate DATE DEFAULT NULL, email VARCHAR(255) DEFAULT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB');
        $this->addSql('CREATE TABLE functionaries (id INT AUTO_INCREMENT NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, birthdate DATE DEFAULT NULL, email VARCHAR(255) DEFAULT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB');

        $this->addSql('ALTER TABLE user_relations ADD COLUMN staff_id INT DEFAULT NULL, ADD COLUMN functionary_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE user_relations ADD CONSTRAINT fk_user_relations_staff FOREIGN KEY (staff_id) REFERENCES staff (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE user_relations ADD CONSTRAINT fk_user_relations_functionary FOREIGN KEY (functionary_id) REFERENCES functionaries (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX idx_user_relations_staff_id ON user_relations (staff_id)');
        $this->addSql('CREATE INDEX idx_user_relations_functionary_id ON user_relations (functionary_id)');

        $this->addSql('DROP TABLE functionary_club_assignments');
        $this->addSql('DROP TABLE functionary_team_assignments');
        $this->addSql('DROP TABLE staff_club_assignments');
        $this->addSql('DROP TABLE staff_team_assignments');

        $this->addSql('DROP TABLE functionary_club_assignment_types');
        $this->addSql('DROP TABLE functionary_team_assignment_types');
        $this->addSql('DROP TABLE staff_club_assignment_types');
        $this->addSql('DROP TABLE staff_team_assignment_types');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
