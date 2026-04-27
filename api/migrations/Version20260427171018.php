<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260427171018 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Remove substitutions table (data moved to game_events)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('DROP TABLE substitutions');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException();
    }
}
