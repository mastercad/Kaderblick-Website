<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Adds meeting_location_id FK to calendar_event so a structured location
 * can be referenced for the meeting point (enables Google Maps navigation).
 */
final class Version20260417160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add meeting_location_id (FK → location) to calendar_event.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE calendar_events ADD COLUMN meeting_location_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE calendar_events ADD CONSTRAINT FK_calendar_events_meeting_location FOREIGN KEY (meeting_location_id) REFERENCES locations(id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_CE_meeting_location ON calendar_events (meeting_location_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE calendar_events DROP FOREIGN KEY FK_calendar_events_meeting_location');
        $this->addSql('DROP INDEX IDX_CE_meeting_location ON calendar_events');
        $this->addSql('ALTER TABLE calendar_events DROP COLUMN meeting_location_id');
    }
}
