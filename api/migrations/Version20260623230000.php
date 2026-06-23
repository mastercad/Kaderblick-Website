<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260623230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Store Stripe Checkout session IDs so pending billing checkouts can be resumed safely';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE billing_subscriptions ADD provider_checkout_session_id VARCHAR(100) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_BILLING_CHECKOUT_SESSION ON billing_subscriptions (provider_checkout_session_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_BILLING_CHECKOUT_SESSION ON billing_subscriptions');
        $this->addSql('ALTER TABLE billing_subscriptions DROP provider_checkout_session_id');
    }
}
