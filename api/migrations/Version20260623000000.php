<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260623000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add team billing, Stripe subscription history and configurable free trials';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE billing_subscriptions (id INT AUTO_INCREMENT NOT NULL, payer_id INT NOT NULL, provider VARCHAR(30) NOT NULL, provider_customer_id VARCHAR(100) DEFAULT NULL, provider_subscription_id VARCHAR(100) DEFAULT NULL, status VARCHAR(30) NOT NULL, unit_amount INT NOT NULL, currency VARCHAR(3) NOT NULL, current_period_start DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', current_period_end DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', unpaid_since DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', missed_billing_cycles SMALLINT NOT NULL, collection_paused_by_trial TINYINT(1) NOT NULL, created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', UNIQUE INDEX UNIQ_BILLING_PROVIDER_CUSTOMER (provider_customer_id), UNIQUE INDEX UNIQ_BILLING_PROVIDER_SUBSCRIPTION (provider_subscription_id), INDEX IDX_BILLING_PAYER (payer_id), INDEX idx_billing_subscription_status (status), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql('CREATE TABLE billing_subscription_teams (id INT AUTO_INCREMENT NOT NULL, subscription_id INT NOT NULL, team_id INT NOT NULL, INDEX IDX_BILLING_TEAM_SUBSCRIPTION (subscription_id), UNIQUE INDEX uniq_billing_team_coverage (team_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql("CREATE TABLE billing_payments (id INT AUTO_INCREMENT NOT NULL, subscription_id INT NOT NULL, provider_invoice_id VARCHAR(100) NOT NULL, status VARCHAR(30) NOT NULL, amount INT NOT NULL, currency VARCHAR(3) NOT NULL, invoice_url VARCHAR(500) DEFAULT NULL, invoice_pdf_url VARCHAR(500) DEFAULT NULL, paid_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', UNIQUE INDEX UNIQ_BILLING_INVOICE (provider_invoice_id), INDEX IDX_BILLING_PAYMENT_SUBSCRIPTION (subscription_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("CREATE TABLE billing_exemptions (id INT AUTO_INCREMENT NOT NULL, club_id INT DEFAULT NULL, team_id INT DEFAULT NULL, created_by_id INT DEFAULT NULL, scope VARCHAR(20) NOT NULL, starts_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', ends_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', reason LONGTEXT NOT NULL, active TINYINT(1) NOT NULL, created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', INDEX IDX_BILLING_EXEMPTION_CLUB (club_id), INDEX IDX_BILLING_EXEMPTION_TEAM (team_id), INDEX IDX_BILLING_EXEMPTION_CREATOR (created_by_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("CREATE TABLE billing_webhook_events (id INT AUTO_INCREMENT NOT NULL, provider_event_id VARCHAR(100) NOT NULL, type VARCHAR(100) NOT NULL, processed_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', UNIQUE INDEX UNIQ_BILLING_WEBHOOK_EVENT (provider_event_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql('ALTER TABLE billing_subscriptions ADD CONSTRAINT FK_BILLING_PAYER FOREIGN KEY (payer_id) REFERENCES users (id)');
        $this->addSql('ALTER TABLE billing_subscriptions ADD provider_subscription_item_id VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE billing_subscriptions ADD team_names JSON NOT NULL');
        $this->addSql('ALTER TABLE billing_subscription_teams ADD CONSTRAINT FK_BILLING_TEAM_SUBSCRIPTION FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions (id) ON DELETE CASCADE, ADD CONSTRAINT FK_BILLING_TEAM FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE billing_payments ADD CONSTRAINT FK_BILLING_PAYMENT_SUBSCRIPTION FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE billing_exemptions ADD CONSTRAINT FK_BILLING_EXEMPTION_CLUB FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE, ADD CONSTRAINT FK_BILLING_EXEMPTION_TEAM FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE, ADD CONSTRAINT FK_BILLING_EXEMPTION_CREATOR FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql("INSERT INTO billing_exemptions (scope, club_id, team_id, created_by_id, starts_at, ends_at, reason, active, created_at) VALUES ('platform', NULL, NULL, NULL, NOW(), NULL, 'Einführungs-Testphase vor Aktivierung des Live-Zahlungsbetriebs', 1, NOW())");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE billing_webhook_events');
        $this->addSql('DROP TABLE billing_payments');
        $this->addSql('DROP TABLE billing_subscription_teams');
        $this->addSql('DROP TABLE billing_exemptions');
        $this->addSql('DROP TABLE billing_subscriptions');
    }
}
