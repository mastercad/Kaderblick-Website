<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618060000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add composite index on user_xp_events for deduplication lookups (user_id, action_type, action_id)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE INDEX idx_user_xp_events_dedup ON user_xp_events (user_id, action_type, action_id)');
        $this->addSql('CREATE INDEX idx_user_xp_events_processed ON user_xp_events (is_processed)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_user_xp_events_dedup ON user_xp_events');
        $this->addSql('DROP INDEX idx_user_xp_events_processed ON user_xp_events');
    }
}
