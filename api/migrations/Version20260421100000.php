<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260421100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add team_id to formations table so formations are strictly scoped to one team';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE formations ADD COLUMN team_id INT NULL DEFAULT NULL AFTER user_id');
        $this->addSql('ALTER TABLE formations ADD CONSTRAINT fk_formations_team_id FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX idx_formation_team_id ON formations (team_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE formations DROP FOREIGN KEY fk_formations_team_id');
        $this->addSql('DROP INDEX idx_formation_team_id ON formations');
        $this->addSql('ALTER TABLE formations DROP COLUMN team_id');
    }
}
