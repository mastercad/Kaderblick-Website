<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260518101000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add cup_id to player_titles and update unique constraint';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_player_title_active ON player_titles');
        $this->addSql('ALTER TABLE player_titles ADD cup_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE player_titles ADD CONSTRAINT FK_player_titles_cup_id FOREIGN KEY (cup_id) REFERENCES cups (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX idx_player_titles_cup_id ON player_titles (cup_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_player_title_active ON player_titles (player_id, title_category, title_scope, team_id, league_id, cup_id, is_active)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_player_title_active ON player_titles');
        $this->addSql('ALTER TABLE player_titles DROP FOREIGN KEY FK_player_titles_cup_id');
        $this->addSql('DROP INDEX idx_player_titles_cup_id ON player_titles');
        $this->addSql('ALTER TABLE player_titles DROP COLUMN cup_id');
        $this->addSql('CREATE UNIQUE INDEX uniq_player_title_active ON player_titles (player_id, title_category, title_scope, team_id, league_id, is_active)');
    }
}
