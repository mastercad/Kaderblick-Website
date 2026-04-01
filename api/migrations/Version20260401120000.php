<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260401120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Creates supporter_requests table';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            CREATE TABLE supporter_requests (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, processed_by_id INT DEFAULT NULL, status VARCHAR(20) NOT NULL, note LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, processed_at DATETIME DEFAULT NULL, INDEX idx_supporter_requests_user_id (user_id), INDEX idx_supporter_requests_status (status), INDEX idx_supporter_requests_processed_by_id (processed_by_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE supporter_requests ADD CONSTRAINT FK_D9B594E0A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE supporter_requests ADD CONSTRAINT FK_D9B594E094CF1B14 FOREIGN KEY (processed_by_id) REFERENCES users (id) ON DELETE SET NULL
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql(<<<'SQL'
            ALTER TABLE supporter_requests DROP FOREIGN KEY FK_D9B594E0A76ED395
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE supporter_requests DROP FOREIGN KEY FK_D9B594E094CF1B14
        SQL);
        $this->addSql(<<<'SQL'
            DROP TABLE supporter_requests
        SQL);
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
