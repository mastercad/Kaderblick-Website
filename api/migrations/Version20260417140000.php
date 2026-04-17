<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Adds nullable `rounds` JSON column to `cups`.
 * Stores an ordered list of round names (e.g. ["Finale","Halbfinale"]) per cup.
 */
final class Version20260417140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add rounds JSON column to cups table.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE cups ADD COLUMN rounds JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE cups DROP COLUMN rounds');
    }
}
