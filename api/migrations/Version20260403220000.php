<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260403220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add account_unlock_token and account_unlock_token_expires_at columns to users table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users
            ADD account_unlock_token VARCHAR(64) DEFAULT NULL,
            ADD account_unlock_token_expires_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\'
        ');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_users_account_unlock_token ON users (account_unlock_token)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_users_account_unlock_token ON users');
        $this->addSql('ALTER TABLE users
            DROP account_unlock_token,
            DROP account_unlock_token_expires_at
        ');
    }
}
