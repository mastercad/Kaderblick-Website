<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260624010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Move player documents to asynchronous Google Drive processing';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE player_documents CHANGE storage_key storage_key VARCHAR(255) DEFAULT NULL, ADD drive_file_id VARCHAR(255) DEFAULT NULL, ADD processing_status VARCHAR(20) DEFAULT 'ready' NOT NULL, ADD processing_error LONGTEXT DEFAULT NULL, ADD automatic_classification TINYINT(1) DEFAULT 0 NOT NULL");
        $this->addSql('CREATE UNIQUE INDEX UNIQ_PLAYER_DOCUMENT_DRIVE_FILE ON player_documents (drive_file_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_PLAYER_DOCUMENT_DRIVE_FILE ON player_documents');
        $this->addSql('ALTER TABLE player_documents CHANGE storage_key storage_key VARCHAR(255) NOT NULL, DROP drive_file_id, DROP processing_status, DROP processing_error, DROP automatic_classification');
    }
}
