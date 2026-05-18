<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260518145729 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Remove "(generisch)" suffix from game_event XP rule label';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("UPDATE xp_rules SET label = 'Spielereignis hinterlegt' WHERE action_type = 'game_event' AND label = 'Spielereignis hinterlegt (generisch)'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("UPDATE xp_rules SET label = 'Spielereignis hinterlegt (generisch)' WHERE action_type = 'game_event' AND label = 'Spielereignis hinterlegt'");
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
