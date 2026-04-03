<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Replace IP-hash tracking with device-token tracking.
 *
 * The old `known_login_ips` column stored SHA-256 hashes of client IPs.
 * Because mobile users change IPs constantly that approach produced false
 * positives on every login.  The new `known_device_tokens` column stores
 * SHA-256 hashes of long-lived device-token cookies instead.
 *
 * Old IP hashes are not migrated – they are meaningless for the new scheme
 * and every user will simply receive one "new device" warning on their first
 * login after the migration, which is acceptable.
 */
final class Version20260403210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Replace known_login_ips (IP-based) with known_device_tokens (cookie-based device tracking)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE users ADD known_device_tokens JSON NOT NULL DEFAULT ('[]')");
        $this->addSql('ALTER TABLE users DROP COLUMN known_login_ips');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users ADD known_login_ips JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE users DROP COLUMN known_device_tokens');
    }
}
