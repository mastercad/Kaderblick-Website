<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260623010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Store when a billing exemption was actually ended';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE billing_exemptions ADD ended_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('UPDATE billing_exemptions SET ended_at = COALESCE(ends_at, NOW()) WHERE active = 0');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE billing_exemptions DROP ended_at');
    }
}
