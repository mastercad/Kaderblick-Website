<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\BillingExemption;
use App\Entity\BillingPayment;
use App\Entity\BillingSubscription;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class BillingDomainTest extends TestCase
{
    public function testNewSubscriptionUsesExpectedDefaults(): void
    {
        $subscription = new BillingSubscription($this->user());

        self::assertSame(BillingSubscription::STATUS_PENDING, $subscription->getStatus());
        self::assertSame(1000, $subscription->getUnitAmount());
        self::assertSame('EUR', $subscription->getCurrency());
        self::assertSame(0, $subscription->getMissedBillingCycles());
        self::assertFalse($subscription->isCollectionPausedByTrial());
    }

    public function testAddingTeamIsIdempotentAndKeepsHistoryName(): void
    {
        $subscription = new BillingSubscription($this->user());
        $team = (new Team())->setName('Erste Mannschaft');

        $subscription->addTeam($team)->addTeam($team);

        self::assertCount(1, $subscription->getTeams());
        self::assertSame(['Erste Mannschaft'], $subscription->getTeamNames());
    }

    public function testMissedBillingCyclesCannotBecomeNegative(): void
    {
        $subscription = new BillingSubscription($this->user());
        $subscription->setMissedBillingCycles(-4);

        self::assertSame(0, $subscription->getMissedBillingCycles());
    }

    public function testExemptionRespectsStartAndEnd(): void
    {
        $exemption = (new BillingExemption(BillingExemption::SCOPE_PLATFORM, 'Kostenloser Zeitraum', null))
            ->setStartsAt(new DateTimeImmutable('2026-06-10 00:00:00'))
            ->setEndsAt(new DateTimeImmutable('2026-06-20 00:00:00'));

        self::assertFalse($exemption->appliesAt(new DateTimeImmutable('2026-06-09 23:59:59')));
        self::assertTrue($exemption->appliesAt(new DateTimeImmutable('2026-06-10 00:00:00')));
        self::assertTrue($exemption->appliesAt(new DateTimeImmutable('2026-06-19 23:59:59')));
        self::assertFalse($exemption->appliesAt(new DateTimeImmutable('2026-06-20 00:00:00')));
    }

    public function testEndingExemptionStoresActualEndAndDisablesIt(): void
    {
        $endedAt = new DateTimeImmutable('2026-06-23 14:30:00');
        $exemption = new BillingExemption(BillingExemption::SCOPE_PLATFORM, 'Testphase', null);

        $exemption->end($endedAt);

        self::assertFalse($exemption->isActive());
        self::assertSame($endedAt, $exemption->getEndedAt());
        self::assertSame($endedAt->format(DATE_ATOM), $exemption->toArray()['endedAt']);
        self::assertFalse($exemption->appliesAt($endedAt));
    }

    public function testReactivatingExemptionClearsPreviousEnd(): void
    {
        $exemption = new BillingExemption(BillingExemption::SCOPE_PLATFORM, 'Testphase', null);
        $exemption->end(new DateTimeImmutable())->setActive(true);

        self::assertTrue($exemption->isActive());
        self::assertNull($exemption->getEndedAt());
    }

    public function testPaymentArrayContainsInvoiceAndPaymentDetails(): void
    {
        $subscription = new BillingSubscription($this->user());
        $paidAt = new DateTimeImmutable('2026-06-23 12:00:00');
        $payment = (new BillingPayment($subscription, 'in_123', 'open', 2000, 'eur'))
            ->setStatus('paid')
            ->setInvoiceUrl('https://example.test/invoice')
            ->setInvoicePdfUrl('https://example.test/invoice.pdf')
            ->setPaidAt($paidAt);

        $data = $payment->toArray();
        self::assertSame('paid', $data['status']);
        self::assertSame(2000, $data['amount']);
        self::assertSame('EUR', $data['currency']);
        self::assertSame($paidAt->format(DATE_ATOM), $data['paidAt']);
        self::assertSame('https://example.test/invoice.pdf', $data['invoicePdfUrl']);
    }

    private function user(): User
    {
        return (new User())->setEmail('kasse@example.test')->setFirstName('Kim')->setLastName('Kasse');
    }
}
