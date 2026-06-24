<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260624000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add private player documents with OCR and expiry reminders';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE player_documents (id INT AUTO_INCREMENT NOT NULL, player_id INT NOT NULL, club_id INT NOT NULL, uploaded_by_user_id INT DEFAULT NULL, category VARCHAR(40) NOT NULL, display_name VARCHAR(255) NOT NULL, storage_key VARCHAR(255) NOT NULL, original_filename VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL, file_size INT NOT NULL, checksum VARCHAR(64) NOT NULL, ocr_text LONGTEXT DEFAULT NULL, issued_at DATE DEFAULT NULL COMMENT '(DC2Type:date_immutable)', expires_at DATE DEFAULT NULL COMMENT '(DC2Type:date_immutable)', expiry_notifications_sent JSON NOT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', UNIQUE INDEX UNIQ_PLAYER_DOCUMENT_STORAGE (storage_key), INDEX idx_player_document_player (player_id), INDEX idx_player_document_club (club_id), INDEX idx_player_document_expiry (expires_at), INDEX IDX_DOCUMENT_UPLOADER (uploaded_by_user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql('ALTER TABLE player_documents ADD CONSTRAINT FK_DOCUMENT_PLAYER FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE player_documents ADD CONSTRAINT FK_DOCUMENT_CLUB FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE player_documents ADD CONSTRAINT FK_DOCUMENT_UPLOADER FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE player_documents');
    }
}
