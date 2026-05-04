<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Karten-Sperren-System: competition_card_rules + player_suspensions.
 *
 * competition_card_rules enthält:
 *  - Gelb-Karten-Schwellenwerte (yellow_warning_threshold, yellow_suspension_threshold)
 *  - Sperrdauer (suspension_games, red_card_suspension_games, yellow_red_card_suspension_games)
 *  - Reset-Verhalten nach Sperre (reset_after_suspension)
 *  - Gültigkeit (valid_from, valid_until)
 *  - Personentyp (person_type: player | coach | all)
 *
 * player_suspensions speichert aktive und abgelaufene Sperren von Spielern.
 */
final class Version20260504120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Karten-Sperren-System: competition_card_rules + player_suspensions';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            CREATE TABLE competition_card_rules (
                id                              INT AUTO_INCREMENT NOT NULL,
                competition_type                VARCHAR(20)   NOT NULL,
                competition_id                  INT           DEFAULT NULL,
                yellow_warning_threshold        SMALLINT      NOT NULL DEFAULT 4,
                yellow_suspension_threshold     SMALLINT      NOT NULL DEFAULT 5,
                suspension_games                SMALLINT      NOT NULL DEFAULT 1
                    COMMENT 'Spiele gesperrt bei Gelb-Sperre',
                red_card_suspension_games       SMALLINT      NOT NULL DEFAULT 1
                    COMMENT 'Spiele gesperrt bei Roter Karte',
                yellow_red_card_suspension_games SMALLINT     NOT NULL DEFAULT 1
                    COMMENT 'Spiele gesperrt bei Gelb-Roter Karte',
                person_type                     VARCHAR(10)   NOT NULL DEFAULT 'all'
                    COMMENT 'Gilt für: player | coach | all',
                reset_after_suspension          TINYINT(1)    NOT NULL DEFAULT 1,
                valid_from                      DATE          DEFAULT NULL
                    COMMENT 'Erster Gültigkeitstag (inklusive)',
                valid_until                     DATE          DEFAULT NULL
                    COMMENT 'Letzter Gültigkeitstag (inklusive)',
                INDEX idx_card_rule_competition  (competition_type, competition_id),
                INDEX idx_card_rule_person_type  (person_type),
                INDEX idx_card_rule_valid_from   (valid_from),
                INDEX idx_card_rule_valid_until  (valid_until),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE player_suspensions (
                id                      INT AUTO_INCREMENT NOT NULL,
                player_id               INT           NOT NULL,
                triggered_by_game_id    INT           DEFAULT NULL,
                competition_type        VARCHAR(20)   NOT NULL,
                competition_id          INT           DEFAULT NULL,
                reason                  VARCHAR(20)   NOT NULL,
                games_suspended         SMALLINT      NOT NULL,
                games_served            SMALLINT      NOT NULL DEFAULT 0,
                is_active               TINYINT(1)    NOT NULL DEFAULT 1,
                created_at              DATETIME      NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_player_suspensions_player_id    (player_id),
                INDEX idx_player_suspensions_active       (is_active),
                INDEX idx_player_suspensions_competition  (competition_type, competition_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE player_suspensions
                ADD CONSTRAINT fk_player_suspensions_player
                    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
                ADD CONSTRAINT fk_player_suspensions_game
                    FOREIGN KEY (triggered_by_game_id) REFERENCES games (id) ON DELETE SET NULL
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE player_suspensions DROP FOREIGN KEY fk_player_suspensions_player');
        $this->addSql('ALTER TABLE player_suspensions DROP FOREIGN KEY fk_player_suspensions_game');
        $this->addSql('DROP TABLE player_suspensions');
        $this->addSql('DROP TABLE competition_card_rules');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
