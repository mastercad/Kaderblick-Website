<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260505100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add coach_id to game_events; create coach_suspensions table';
    }

    public function isTransactional(): bool
    {
        return false;
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE game_events ADD coach_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE game_events ADD CONSTRAINT FK_GAME_EVENTS_COACH FOREIGN KEY (coach_id) REFERENCES coaches (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_GAME_EVENTS_COACH ON game_events (coach_id)');

        $this->addSql('CREATE TABLE coach_suspensions (
            id INT AUTO_INCREMENT NOT NULL,
            coach_id INT NOT NULL,
            triggered_by_game_id INT DEFAULT NULL,
            competition_type VARCHAR(20) NOT NULL,
            competition_id INT DEFAULT NULL,
            reason VARCHAR(20) NOT NULL,
            games_suspended SMALLINT NOT NULL,
            games_served SMALLINT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            PRIMARY KEY(id),
            INDEX IDX_COACH_SUSPENSIONS_COACH (coach_id),
            INDEX IDX_COACH_SUSPENSIONS_ACTIVE (is_active),
            INDEX IDX_COACH_SUSPENSIONS_COMPETITION (competition_type, competition_id),
            CONSTRAINT FK_COACH_SUSPENSIONS_COACH FOREIGN KEY (coach_id) REFERENCES coaches (id) ON DELETE CASCADE,
            CONSTRAINT FK_COACH_SUSPENSIONS_GAME FOREIGN KEY (triggered_by_game_id) REFERENCES games (id) ON DELETE SET NULL
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE coach_suspensions');
        $this->addSql('ALTER TABLE game_events DROP FOREIGN KEY FK_GAME_EVENTS_COACH');
        $this->addSql('DROP INDEX IDX_GAME_EVENTS_COACH ON game_events');
        $this->addSql('ALTER TABLE game_events DROP COLUMN coach_id');
    }
}
