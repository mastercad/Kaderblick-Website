<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260517100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'FK user_xp_events.user_id: RESTRICT → CASCADE (user deletion must cascade to XP events)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user_xp_events DROP FOREIGN KEY fk_user_xp_events_users_user_id');
        $this->addSql('ALTER TABLE user_xp_events ADD CONSTRAINT fk_user_xp_events_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user_xp_events DROP FOREIGN KEY fk_user_xp_events_users_user_id');
        $this->addSql('ALTER TABLE user_xp_events ADD CONSTRAINT fk_user_xp_events_users_user_id FOREIGN KEY (user_id) REFERENCES users (id)');
    }
}
