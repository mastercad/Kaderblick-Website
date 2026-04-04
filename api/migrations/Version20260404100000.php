<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260404100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add indexes on games.league_id and games.cup_id for performant competition-based queries';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE INDEX idx_games_league_id ON games (league_id)');
        $this->addSql('CREATE INDEX idx_games_cup_id ON games (cup_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_games_league_id ON games');
        $this->addSql('DROP INDEX idx_games_cup_id ON games');
    }
}
