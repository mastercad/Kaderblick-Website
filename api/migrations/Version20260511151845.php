<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260511151845 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Adds quick_event_configs, quick_event_presets (with owner) and quick_event_preset_shares tables';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE quick_event_configs (
            id         INT AUTO_INCREMENT NOT NULL,
            user_id    INT NOT NULL,
            config     JSON NOT NULL COMMENT \'(DC2Type:json)\',
            updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            UNIQUE INDEX uniq_quick_event_configs_user_id (user_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE quick_event_configs ADD CONSTRAINT FK_quick_event_configs_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

        $this->addSql('CREATE TABLE quick_event_presets (
            id         INT AUTO_INCREMENT NOT NULL,
            owner_id   INT NOT NULL,
            name       VARCHAR(120) NOT NULL,
            config     JSON NOT NULL COMMENT \'(DC2Type:json)\',
            is_active  TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE quick_event_presets ADD CONSTRAINT FK_quick_event_presets_owner_id FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_quick_event_presets_owner_id ON quick_event_presets (owner_id)');

        $this->addSql('CREATE TABLE quick_event_preset_shares (
            preset_id INT NOT NULL,
            user_id   INT NOT NULL,
            PRIMARY KEY(preset_id, user_id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE quick_event_preset_shares ADD CONSTRAINT FK_qeps_preset_id FOREIGN KEY (preset_id) REFERENCES quick_event_presets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE quick_event_preset_shares ADD CONSTRAINT FK_qeps_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE quick_event_preset_shares DROP FOREIGN KEY FK_qeps_preset_id');
        $this->addSql('ALTER TABLE quick_event_preset_shares DROP FOREIGN KEY FK_qeps_user_id');
        $this->addSql('DROP TABLE quick_event_preset_shares');

        $this->addSql('ALTER TABLE quick_event_presets DROP FOREIGN KEY FK_quick_event_presets_owner_id');
        $this->addSql('DROP INDEX IDX_quick_event_presets_owner_id ON quick_event_presets');
        $this->addSql('DROP TABLE quick_event_presets');

        $this->addSql('ALTER TABLE quick_event_configs DROP FOREIGN KEY FK_quick_event_configs_user_id');
        $this->addSql('DROP TABLE quick_event_configs');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
