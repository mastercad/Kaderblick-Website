<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260624030000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Remove the redundant StaffClubAssignmentType "Kassenwart"';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DELETE sca
            FROM staff_club_assignments sca
            INNER JOIN staff_club_assignment_types scat
                ON scat.id = sca.staff_club_assignment_type_id
            WHERE scat.name = 'Kassenwart'
            SQL);

        $this->addSql(<<<'SQL'
            DELETE FROM staff_club_assignment_types
            WHERE name = 'Kassenwart'
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            INSERT INTO staff_club_assignment_types (name, description, active)
            SELECT 'Kassenwart', 'Finanzverwaltung des Vereins.', 1
            WHERE NOT EXISTS (
                SELECT 1
                FROM staff_club_assignment_types
                WHERE name = 'Kassenwart'
            )
            SQL);
    }
}
