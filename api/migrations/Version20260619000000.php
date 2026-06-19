<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260619000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add inventory_items and inventory_checkouts tables for Zeugwart equipment management';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE inventory_items (
            id INT AUTO_INCREMENT NOT NULL,
            team_id INT DEFAULT NULL,
            club_id INT DEFAULT NULL,
            created_by_user_id INT DEFAULT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(500) DEFAULT NULL,
            category VARCHAR(50) DEFAULT NULL,
            total_quantity INT NOT NULL DEFAULT 0,
            unit VARCHAR(20) NOT NULL DEFAULT \'Stück\',
            `condition` VARCHAR(20) DEFAULT NULL,
            notes VARCHAR(500) DEFAULT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            updated_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX idx_inventory_items_team_id (team_id),
            INDEX idx_inventory_items_club_id (club_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('CREATE TABLE inventory_checkouts (
            id INT AUTO_INCREMENT NOT NULL,
            inventory_item_id INT NOT NULL,
            user_id INT DEFAULT NULL,
            checked_out_by_user_id INT DEFAULT NULL,
            borrower_name VARCHAR(100) DEFAULT NULL,
            quantity INT NOT NULL DEFAULT 1,
            checked_out_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            due_date DATE DEFAULT NULL,
            returned_at DATETIME DEFAULT NULL,
            note VARCHAR(300) DEFAULT NULL,
            INDEX idx_inventory_checkouts_item_id (inventory_item_id),
            INDEX idx_inventory_checkouts_user_id (user_id),
            INDEX idx_inventory_checkouts_returned_at (returned_at),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('ALTER TABLE inventory_items
            ADD CONSTRAINT fk_inventory_items_team_id FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
            ADD CONSTRAINT fk_inventory_items_club_id FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE,
            ADD CONSTRAINT fk_inventory_items_created_by FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL');

        $this->addSql('ALTER TABLE inventory_checkouts
            ADD CONSTRAINT fk_inventory_checkouts_item_id FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id) ON DELETE CASCADE,
            ADD CONSTRAINT fk_inventory_checkouts_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
            ADD CONSTRAINT fk_inventory_checkouts_by_user_id FOREIGN KEY (checked_out_by_user_id) REFERENCES users (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE inventory_checkouts DROP FOREIGN KEY fk_inventory_checkouts_item_id');
        $this->addSql('ALTER TABLE inventory_checkouts DROP FOREIGN KEY fk_inventory_checkouts_user_id');
        $this->addSql('ALTER TABLE inventory_checkouts DROP FOREIGN KEY fk_inventory_checkouts_by_user_id');
        $this->addSql('ALTER TABLE inventory_items DROP FOREIGN KEY fk_inventory_items_team_id');
        $this->addSql('ALTER TABLE inventory_items DROP FOREIGN KEY fk_inventory_items_club_id');
        $this->addSql('ALTER TABLE inventory_items DROP FOREIGN KEY fk_inventory_items_created_by');
        $this->addSql('DROP TABLE inventory_checkouts');
        $this->addSql('DROP TABLE inventory_items');
    }
}
