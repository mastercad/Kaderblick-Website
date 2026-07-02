<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260702090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Adds scoped supporter assignments and team scope to supporter requests; removes ROLE_CLUB usage.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE user_team_supporter_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, team_id INT NOT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX IDX_TEAM_SUPPORTER_USER (user_id), INDEX IDX_TEAM_SUPPORTER_TEAM (team_id), INDEX idx_team_supporter_validity (start_date, end_date, user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE user_club_supporter_assignments (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, club_id INT NOT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, INDEX IDX_CLUB_SUPPORTER_USER (user_id), INDEX IDX_CLUB_SUPPORTER_CLUB (club_id), INDEX idx_club_supporter_validity (start_date, end_date, user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE user_team_supporter_assignments ADD CONSTRAINT FK_TEAM_SUPPORTER_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_team_supporter_assignments ADD CONSTRAINT FK_TEAM_SUPPORTER_TEAM FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_club_supporter_assignments ADD CONSTRAINT FK_CLUB_SUPPORTER_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE user_club_supporter_assignments ADD CONSTRAINT FK_CLUB_SUPPORTER_CLUB FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE supporter_requests ADD team_id INT DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_SUPPORTER_REQUEST_TEAM ON supporter_requests (team_id)');
        $this->addSql('ALTER TABLE supporter_requests ADD CONSTRAINT FK_SUPPORTER_REQUEST_TEAM FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL');
        $this->addSql('UPDATE users SET roles = JSON_ARRAY(\'ROLE_USER\') WHERE JSON_CONTAINS(roles, \'"ROLE_CLUB"\') AND JSON_LENGTH(roles) = 1');
        $this->addSql('UPDATE users SET roles = JSON_REMOVE(roles, JSON_UNQUOTE(JSON_SEARCH(roles, \'one\', \'ROLE_CLUB\'))) WHERE JSON_CONTAINS(roles, \'"ROLE_CLUB"\')');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE supporter_requests DROP FOREIGN KEY FK_SUPPORTER_REQUEST_TEAM');
        $this->addSql('DROP INDEX IDX_SUPPORTER_REQUEST_TEAM ON supporter_requests');
        $this->addSql('ALTER TABLE supporter_requests DROP team_id');
        $this->addSql('DROP TABLE user_team_supporter_assignments');
        $this->addSql('DROP TABLE user_club_supporter_assignments');
    }
}
