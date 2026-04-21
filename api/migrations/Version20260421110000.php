<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Users who registered with email/password but later logged in via Google SSO
 * never verified their email address and therefore kept ROLE_GUEST permanently.
 * A successful Google SSO login proves ownership of the email address, so we
 * retroactively verify all such accounts.
 */
final class Version20260421110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Verify all existing accounts that already have a google_id but are still marked as unverified';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(
            'UPDATE `users`
             SET is_verified                      = 1,
                 verification_token               = NULL,
                 verification_expires             = NULL,
                 email_verification_token         = NULL,
                 email_verification_token_expires_at = NULL
             WHERE google_id IS NOT NULL
               AND is_verified = 0'
        );
    }

    public function down(Schema $schema): void
    {
        // Intentionally left empty: we cannot know the original verification state per row.
    }
}
