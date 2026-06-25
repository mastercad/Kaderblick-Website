<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260624020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add reliable dispatch marker for the player-document outbox';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE player_documents ADD processing_dispatched_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('CREATE INDEX IDX_PLAYER_DOCUMENT_OUTBOX ON player_documents (processing_status, processing_dispatched_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IDX_PLAYER_DOCUMENT_OUTBOX ON player_documents');
        $this->addSql('ALTER TABLE player_documents DROP processing_dispatched_at');
    }
}
