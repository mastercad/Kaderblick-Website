<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260521152313 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Erstellt die Tabelle public_holidays für Deutschland-Feiertage';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE public_holidays (id INT AUTO_INCREMENT NOT NULL, year SMALLINT UNSIGNED NOT NULL, state_code VARCHAR(20) NOT NULL, name VARCHAR(100) NOT NULL, date DATE NOT NULL COMMENT \'(DC2Type:date_immutable)\', fetched_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', UNIQUE INDEX uq_public_holiday (year, state_code, name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE public_holidays');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
