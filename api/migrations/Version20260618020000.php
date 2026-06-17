<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260618020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Allow free-form tab entries without a catalog item (catalog_item_id nullable, add custom_name / custom_price)';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_item');
        $this->addSql('ALTER TABLE tab_entries MODIFY catalog_item_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_item FOREIGN KEY (catalog_item_id) REFERENCES tab_catalog_items (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE tab_entries ADD custom_name VARCHAR(100) DEFAULT NULL AFTER note');
        $this->addSql('ALTER TABLE tab_entries ADD custom_price DECIMAL(10,2) DEFAULT NULL AFTER custom_name');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on '\Doctrine\DBAL\Platforms\MariaDb1010Platform'."
        );

        $this->addSql('ALTER TABLE tab_entries DROP COLUMN custom_price');
        $this->addSql('ALTER TABLE tab_entries DROP COLUMN custom_name');
        $this->addSql('ALTER TABLE tab_entries DROP FOREIGN KEY FK_tab_entries_item');
        $this->addSql('DELETE FROM tab_entries WHERE catalog_item_id IS NULL');
        $this->addSql('ALTER TABLE tab_entries MODIFY catalog_item_id INT NOT NULL');
        $this->addSql('ALTER TABLE tab_entries ADD CONSTRAINT FK_tab_entries_item FOREIGN KEY (catalog_item_id) REFERENCES tab_catalog_items (id) ON DELETE CASCADE');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
