<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618030000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add team_id and club_id to tab_entries so free-form entries keep their context';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_entries ADD team_id INT DEFAULT NULL AFTER created_by_user_id');
        $this->addSql('ALTER TABLE tab_entries ADD club_id INT DEFAULT NULL AFTER team_id');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_tab_entries_team ON tab_entries (team_id)');
        $this->addSql('CREATE INDEX IDX_tab_entries_club ON tab_entries (club_id)');

        // Backfill existing entries: derive context from catalog item
        $this->addSql('UPDATE tab_entries e JOIN tab_catalog_items i ON e.catalog_item_id = i.id SET e.team_id = i.team_id WHERE i.team_id IS NOT NULL');
        $this->addSql('UPDATE tab_entries e JOIN tab_catalog_items i ON e.catalog_item_id = i.id SET e.club_id = i.club_id WHERE i.club_id IS NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_team');
        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_club');
        $this->addSql('DROP INDEX IDX_tab_entries_team ON tab_entries');
        $this->addSql('DROP INDEX IDX_tab_entries_club ON tab_entries');
        $this->addSql('ALTER TABLE tab_entries DROP COLUMN club_id');
        $this->addSql('ALTER TABLE tab_entries DROP COLUMN team_id');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
