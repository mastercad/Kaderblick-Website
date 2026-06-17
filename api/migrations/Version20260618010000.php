<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create tab_catalog_items, tab_entries, and tab_payments tables for the Deckel (tab) feature';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('CREATE TABLE tab_catalog_items (id INT AUTO_INCREMENT NOT NULL, team_id INT DEFAULT NULL, club_id INT DEFAULT NULL, name VARCHAR(100) NOT NULL, price DECIMAL(10,2) NOT NULL, category VARCHAR(50) DEFAULT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, INDEX IDX_tab_catalog_team (team_id), INDEX IDX_tab_catalog_club (club_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE tab_catalog_items ADD CONSTRAINT FK_tab_catalog_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_catalog_items ADD CONSTRAINT FK_tab_catalog_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');

        $this->addSql('CREATE TABLE tab_entries (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, catalog_item_id INT NOT NULL, quantity INT NOT NULL DEFAULT 1, price_at_booking DECIMAL(10,2) NOT NULL, entry_date DATE NOT NULL, note VARCHAR(200) DEFAULT NULL, created_at DATETIME NOT NULL, created_by_user_id INT DEFAULT NULL, INDEX IDX_tab_entries_user (user_id), INDEX IDX_tab_entries_item (catalog_item_id), INDEX IDX_tab_entries_created_by (created_by_user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_item FOREIGN KEY (catalog_item_id) REFERENCES tab_catalog_items (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_created_by FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE tab_payments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, team_id INT DEFAULT NULL, club_id INT DEFAULT NULL, amount DECIMAL(10,2) NOT NULL, note VARCHAR(200) DEFAULT NULL, payment_date DATE NOT NULL, recorded_by_user_id INT DEFAULT NULL, created_at DATETIME NOT NULL, INDEX IDX_tab_payments_user (user_id), INDEX IDX_tab_payments_team (team_id), INDEX IDX_tab_payments_club (club_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE tab_payments ADD CONSTRAINT FK_tab_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_payments ADD CONSTRAINT FK_tab_payments_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_payments ADD CONSTRAINT FK_tab_payments_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_payments ADD CONSTRAINT FK_tab_payments_recorded_by FOREIGN KEY (recorded_by_user_id) REFERENCES users (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_payments DROP FOREIGN KEY FK_tab_payments_user');
        $this->addSql('ALTER TABLE tab_payments DROP FOREIGN KEY FK_tab_payments_team');
        $this->addSql('ALTER TABLE tab_payments DROP FOREIGN KEY FK_tab_payments_club');
        $this->addSql('ALTER TABLE tab_payments DROP FOREIGN KEY FK_tab_payments_recorded_by');
        $this->addSql('DROP TABLE tab_payments');

        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_user');
        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_item');
        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_created_by');
        $this->addSql('DROP TABLE tab_entries');

        $this->addSql('ALTER TABLE tab_catalog_items DROP FOREIGN KEY FK_tab_catalog_team');
        $this->addSql('ALTER TABLE tab_catalog_items DROP FOREIGN KEY FK_tab_catalog_club');
        $this->addSql('DROP TABLE tab_catalog_items');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
