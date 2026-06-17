<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create cash_books and cash_book_entries tables for the Kassenbuch feature';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('CREATE TABLE cash_books (id INT AUTO_INCREMENT NOT NULL, team_id INT DEFAULT NULL, club_id INT DEFAULT NULL, name VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL, INDEX idx_cash_books_team_id (team_id), INDEX idx_cash_books_club_id (club_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE cash_books ADD CONSTRAINT fk_cash_books_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE cash_books ADD CONSTRAINT fk_cash_books_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');

        $this->addSql('CREATE TABLE cash_book_entries (id INT AUTO_INCREMENT NOT NULL, cash_book_id INT NOT NULL, amount DECIMAL(10,2) NOT NULL, type VARCHAR(10) NOT NULL, category VARCHAR(100) DEFAULT NULL, description VARCHAR(500) NOT NULL, entry_date DATE NOT NULL, created_by_user_id INT DEFAULT NULL, created_at DATETIME NOT NULL, reference_type VARCHAR(50) DEFAULT NULL, reference_id INT DEFAULT NULL, INDEX idx_cash_book_entries_cash_book_id (cash_book_id), INDEX idx_cash_book_entries_entry_date (entry_date), INDEX idx_cash_book_entries_created_by_user_id (created_by_user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE cash_book_entries ADD CONSTRAINT fk_cash_book_entries_cash_book FOREIGN KEY (cash_book_id) REFERENCES cash_books (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE cash_book_entries ADD CONSTRAINT fk_cash_book_entries_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE cash_book_entries DROP FOREIGN KEY fk_cash_book_entries_cash_book');
        $this->addSql('ALTER TABLE cash_book_entries DROP FOREIGN KEY fk_cash_book_entries_created_by_user');
        $this->addSql('DROP TABLE cash_book_entries');

        $this->addSql('ALTER TABLE cash_books DROP FOREIGN KEY fk_cash_books_team');
        $this->addSql('ALTER TABLE cash_books DROP FOREIGN KEY fk_cash_books_club');
        $this->addSql('DROP TABLE cash_books');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
