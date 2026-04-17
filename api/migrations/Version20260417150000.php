<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Creates global `cup_rounds` table and removes the per-cup `rounds` JSON column.
 */
final class Version20260417150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create cup_rounds table; drop rounds column from cups.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE cup_rounds (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE cups DROP COLUMN rounds');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE cup_rounds');
        $this->addSql('ALTER TABLE cups ADD COLUMN rounds JSON DEFAULT NULL');
    }
}
