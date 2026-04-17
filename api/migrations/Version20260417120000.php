<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Migration:
 *  1. Adds nullable `round` column (VARCHAR 100) to `games`.
 *  2. Migrates existing games of type "Finale" → gameType=Pokalspiel, round='Finale'.
 *  3. Migrates existing games of type "Halbfinale" → gameType=Pokalspiel, round='Halbfinale'.
 *  4. Deletes the now-unused "Finale" and "Halbfinale" entries from `game_types`.
 *
 * New game-type master data (Hallenturnier, Pokalturnier, …) is managed via Fixtures.
 */
final class Version20260417120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add round column to games; migrate Finale/Halbfinale game types to Pokalspiel+round; delete obsolete game types.';
    }

    public function up(Schema $schema): void
    {
        // 1. Add round column
        $this->addSql('ALTER TABLE games ADD COLUMN round VARCHAR(100) DEFAULT NULL');

        // 2. Migrate "Finale" games → Pokalspiel + round='Finale'
        $this->addSql(
            "UPDATE games
             SET round = 'Finale',
                 game_type_id = (SELECT id FROM game_types WHERE name = 'Pokalspiel' LIMIT 1)
             WHERE game_type_id IN (SELECT id FROM game_types WHERE name = 'Finale')"
        );

        // 3. Migrate "Halbfinale" games → Pokalspiel + round='Halbfinale'
        $this->addSql(
            "UPDATE games
             SET round = 'Halbfinale',
                 game_type_id = (SELECT id FROM game_types WHERE name = 'Pokalspiel' LIMIT 1)
             WHERE game_type_id IN (SELECT id FROM game_types WHERE name = 'Halbfinale')"
        );

        // 4. Remove obsolete game types (only safe after migrating all references above)
        $this->addSql("DELETE FROM game_types WHERE name IN ('Finale', 'Halbfinale')");
    }

    public function down(Schema $schema): void
    {
        // 4. Re-insert Finale / Halbfinale (reverses the DELETE in up())
        $this->addSql(
            "INSERT IGNORE INTO game_types (name, description, half_duration)
             VALUES
             ('Finale',    'Endspiele in Pokalen oder Turnieren', NULL),
             ('Halbfinale','Vorletzte Runde in Pokalen oder Turnieren', NULL)"
        );

        // 3. Restore Halbfinale games
        $this->addSql(
            "UPDATE games
             SET game_type_id = (SELECT id FROM game_types WHERE name = 'Halbfinale' LIMIT 1),
                 round = NULL
             WHERE round = 'Halbfinale'
               AND game_type_id = (SELECT id FROM game_types WHERE name = 'Pokalspiel' LIMIT 1)"
        );

        // 2. Restore Finale games
        $this->addSql(
            "UPDATE games
             SET game_type_id = (SELECT id FROM game_types WHERE name = 'Finale' LIMIT 1),
                 round = NULL
             WHERE round = 'Finale'
               AND game_type_id = (SELECT id FROM game_types WHERE name = 'Pokalspiel' LIMIT 1)"
        );

        // 1. Drop round column
        $this->addSql('ALTER TABLE games DROP COLUMN round');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
