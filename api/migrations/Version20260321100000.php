<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260321100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add banner_image column to teams table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE teams ADD banner_image VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE teams DROP COLUMN banner_image');
    }
}
