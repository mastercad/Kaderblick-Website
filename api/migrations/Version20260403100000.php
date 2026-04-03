<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260403100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add 2FA (TOTP + Email OTP) and login-security fields to users table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE users
                ADD totp_secret VARCHAR(255) DEFAULT NULL,
                ADD totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
                ADD totp_backup_codes JSON NOT NULL COMMENT '(DC2Type:json)',
                ADD two_factor_pending_token VARCHAR(64) DEFAULT NULL,
                ADD two_factor_pending_token_expires_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                ADD email_otp_enabled TINYINT(1) NOT NULL DEFAULT 0,
                ADD email_otp_code VARCHAR(255) DEFAULT NULL,
                ADD email_otp_expires_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                ADD known_login_ips JSON DEFAULT NULL COMMENT '(DC2Type:json)',
                ADD locked_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                ADD lock_reason VARCHAR(255) DEFAULT NULL,
                ADD account_lock_token VARCHAR(64) DEFAULT NULL,
                ADD account_lock_token_expires_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                CHANGE use_google_avatar use_google_avatar TINYINT(1) NOT NULL
        SQL);
        $this->addSql('CREATE UNIQUE INDEX UNIQ_users_account_lock_token ON users (account_lock_token)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_users_account_lock_token ON users');
        $this->addSql(<<<'SQL'
            ALTER TABLE users
                DROP totp_secret,
                DROP totp_enabled,
                DROP totp_backup_codes,
                DROP two_factor_pending_token,
                DROP two_factor_pending_token_expires_at,
                DROP email_otp_enabled,
                DROP email_otp_code,
                DROP email_otp_expires_at,
                DROP known_login_ips,
                DROP locked_at,
                DROP lock_reason,
                DROP account_lock_token,
                DROP account_lock_token_expires_at,
                CHANGE use_google_avatar use_google_avatar TINYINT(1) DEFAULT 0 NOT NULL
        SQL);
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
