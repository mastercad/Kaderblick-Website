<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260621020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add validity periods to team and club administration scopes';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user_team_admin_assignments DROP INDEX uniq_user_team_admin, ADD start_date DATE DEFAULT NULL, ADD end_date DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE user_club_admin_assignments DROP INDEX uniq_user_club_admin, ADD start_date DATE DEFAULT NULL, ADD end_date DATE DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_team_admin_validity ON user_team_admin_assignments (start_date, end_date, user_id)');
        $this->addSql('CREATE INDEX idx_club_admin_validity ON user_club_admin_assignments (start_date, end_date, user_id)');
        $this->addSql('CREATE INDEX idx_users_scoped_admin_fallback ON users (role_before_scoped_admin)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_team_admin_validity ON user_team_admin_assignments');
        $this->addSql('DROP INDEX idx_club_admin_validity ON user_club_admin_assignments');
        $this->addSql('DROP INDEX idx_users_scoped_admin_fallback ON users');
        $this->addSql('DELETE a1 FROM user_team_admin_assignments a1 INNER JOIN user_team_admin_assignments a2 ON a1.user_id = a2.user_id AND a1.team_id = a2.team_id AND a1.id > a2.id');
        $this->addSql('DELETE a1 FROM user_club_admin_assignments a1 INNER JOIN user_club_admin_assignments a2 ON a1.user_id = a2.user_id AND a1.club_id = a2.club_id AND a1.id > a2.id');
        $this->addSql('ALTER TABLE user_team_admin_assignments DROP start_date, DROP end_date, ADD UNIQUE INDEX uniq_user_team_admin (user_id, team_id)');
        $this->addSql('ALTER TABLE user_club_admin_assignments DROP start_date, DROP end_date, ADD UNIQUE INDEX uniq_user_club_admin (user_id, club_id)');
    }
}
