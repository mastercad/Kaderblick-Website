<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260701120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Convert legacy ROLE_ADMIN users to ROLE_USER and allow teamless game events.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('UPDATE users SET roles = JSON_ARRAY(\'ROLE_USER\') WHERE JSON_CONTAINS(roles, \'"ROLE_ADMIN"\')');
        $this->addSql('ALTER TABLE game_events MODIFY team_id INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM game_events WHERE team_id IS NULL');
        $this->addSql('ALTER TABLE game_events MODIFY team_id INT NOT NULL');
        // Role conversion is intentionally not reversible: after conversion we
        // cannot distinguish former ROLE_ADMIN users from regular ROLE_USER accounts.
    }
}
