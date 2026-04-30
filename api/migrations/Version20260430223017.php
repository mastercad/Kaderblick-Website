<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260430223017 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Adds cron_heartbeats table – persists cron job status in DB instead of volatile cache.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE cron_heartbeats (id INT AUTO_INCREMENT NOT NULL, command VARCHAR(255) NOT NULL, last_run_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', last_error LONGTEXT DEFAULT NULL, running_pid INT DEFAULT NULL, running_started_at INT DEFAULT NULL, UNIQUE INDEX UNIQ_8BB672EA8ECAEAD4 (command), INDEX idx_cron_heartbeats_command (command), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE cron_heartbeats');
    }
}
