<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260509100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Erstellt die Tabelle poster_templates für den visuellen Poster-Vorlagen-Editor';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'.",
        );

        $this->addSql(<<<'SQL'
            CREATE TABLE poster_templates (
                id               INT NOT NULL AUTO_INCREMENT,
                name             VARCHAR(255) NOT NULL,
                description      TEXT DEFAULT NULL,
                poster_type      VARCHAR(50) NOT NULL DEFAULT 'universal',
                supported_formats JSON NOT NULL,
                background       JSON NOT NULL,
                elements         JSON NOT NULL,
                created_at       DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                updated_at       DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(
            !$this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\MariaDb1010Platform,
            "Migration can only be executed safely on 'MariaDb1010Platform'.",
        );

        $this->addSql('DROP TABLE poster_templates');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
