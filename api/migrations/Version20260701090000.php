<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260701090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Bind XP events and current XP leaderboard state to football seasons.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user_xp_events ADD season VARCHAR(9) DEFAULT NULL');
        $this->addSql('ALTER TABLE user_levels ADD season_xp_total INT DEFAULT 0 NOT NULL, ADD season_level INT DEFAULT 1 NOT NULL, ADD season VARCHAR(9) DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_user_xp_events_season ON user_xp_events (season)');
        $this->addSql('CREATE INDEX idx_user_levels_season ON user_levels (season)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_user_xp_events_season ON user_xp_events');
        $this->addSql('DROP INDEX idx_user_levels_season ON user_levels');
        $this->addSql('ALTER TABLE user_xp_events DROP season');
        $this->addSql('ALTER TABLE user_levels DROP season_xp_total, DROP season_level, DROP season');
    }
}
