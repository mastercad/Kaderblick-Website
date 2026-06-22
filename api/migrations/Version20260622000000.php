<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260622000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add opt-in public live ticker settings to games';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE games ADD public_live_ticker_enabled TINYINT(1) DEFAULT 0 NOT NULL, ADD public_live_ticker_token VARCHAR(64) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_GAMES_PUBLIC_LIVE_TICKER_TOKEN ON games (public_live_ticker_token)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_GAMES_PUBLIC_LIVE_TICKER_TOKEN ON games');
        $this->addSql('ALTER TABLE games DROP public_live_ticker_enabled, DROP public_live_ticker_token');
    }
}
