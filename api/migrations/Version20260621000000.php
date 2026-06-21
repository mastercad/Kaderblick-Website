<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260621000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Normalize every user to exactly one stored role, keeping the highest existing role';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE users
            SET roles = JSON_ARRAY(
                CASE
                    WHEN JSON_CONTAINS(roles, '"ROLE_SUPERADMIN"') THEN 'ROLE_SUPERADMIN'
                    WHEN JSON_CONTAINS(roles, '"ROLE_ADMIN"') THEN 'ROLE_ADMIN'
                    WHEN JSON_CONTAINS(roles, '"ROLE_CLUB_ADMIN"') THEN 'ROLE_CLUB_ADMIN'
                    WHEN JSON_CONTAINS(roles, '"ROLE_TEAM_ADMIN"') THEN 'ROLE_TEAM_ADMIN'
                    WHEN JSON_CONTAINS(roles, '"ROLE_CLUB"') THEN 'ROLE_CLUB'
                    WHEN JSON_CONTAINS(roles, '"ROLE_SUPPORTER"') THEN 'ROLE_SUPPORTER'
                    WHEN JSON_CONTAINS(roles, '"ROLE_USER"') THEN 'ROLE_USER'
                    WHEN JSON_CONTAINS(roles, '"ROLE_GUEST"') THEN 'ROLE_GUEST'
                    WHEN is_verified = 1 THEN 'ROLE_USER'
                    ELSE 'ROLE_GUEST'
                END
            )
            SQL);
    }

    public function down(Schema $schema): void
    {
        // The previous role combinations cannot be reconstructed safely.
    }
}
