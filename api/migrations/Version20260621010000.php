<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260621010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add direct team and club administration scopes for users';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users ADD role_before_scoped_admin VARCHAR(50) DEFAULT NULL');
        $this->addSql('CREATE TABLE user_team_admin_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, team_id INT NOT NULL, INDEX IDX_TEAM_ADMIN_USER (user_id), INDEX IDX_TEAM_ADMIN_TEAM (team_id), UNIQUE INDEX uniq_user_team_admin (user_id, team_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE user_club_admin_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, club_id INT NOT NULL, INDEX IDX_CLUB_ADMIN_USER (user_id), INDEX IDX_CLUB_ADMIN_CLUB (club_id), UNIQUE INDEX uniq_user_club_admin (user_id, club_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE user_team_admin_assignments ADD CONSTRAINT FK_TEAM_ADMIN_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_team_admin_assignments ADD CONSTRAINT FK_TEAM_ADMIN_TEAM FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_club_admin_assignments ADD CONSTRAINT FK_CLUB_ADMIN_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_club_admin_assignments ADD CONSTRAINT FK_CLUB_ADMIN_CLUB FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('UPDATE users SET roles = JSON_ARRAY(\'ROLE_USER\') WHERE JSON_CONTAINS(roles, \'"ROLE_TEAM_ADMIN"\') OR JSON_CONTAINS(roles, \'"ROLE_CLUB_ADMIN"\')');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE user_team_admin_assignments');
        $this->addSql('DROP TABLE user_club_admin_assignments');
        $this->addSql('ALTER TABLE users DROP role_before_scoped_admin');
    }
}
