<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'billing_payments')]
class BillingPayment
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    /** @phpstan-ignore-next-line Set by Doctrine. */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: BillingSubscription::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private BillingSubscription $subscription;

    #[ORM\Column(length: 100, unique: true)]
    private string $providerInvoiceId;

    #[ORM\Column(length: 30)]
    private string $status;

    #[ORM\Column]
    private int $amount;

    #[ORM\Column(length: 3)]
    private string $currency;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $invoiceUrl = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $invoicePdfUrl = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $paidAt = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    public function __construct(BillingSubscription $subscription, string $invoiceId, string $status, int $amount, string $currency)
    {
        $this->subscription = $subscription;
        $this->providerInvoiceId = $invoiceId;
        $this->status = $status;
        $this->amount = $amount;
        $this->currency = strtoupper($currency);
        $this->createdAt = new DateTimeImmutable();
    }

    public function setStatus(string $value): self
    {
        $this->status = $value;
        return $this;
    }
    public function getSubscription(): BillingSubscription
    {
        return $this->subscription;
    }
    public function getProviderInvoiceId(): string
    {
        return $this->providerInvoiceId;
    }
    public function setInvoiceUrl(?string $value): self
    {
        $this->invoiceUrl = $value;
        return $this;
    }
    public function setInvoicePdfUrl(?string $value): self
    {
        $this->invoicePdfUrl = $value;
        return $this;
    }
    public function setPaidAt(?DateTimeImmutable $value): self
    {
        $this->paidAt = $value;
        return $this;
    }
    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'invoiceUrl' => $this->invoiceUrl,
            'invoicePdfUrl' => $this->invoicePdfUrl,
            'paidAt' => $this->paidAt?->format(DATE_ATOM),
            'createdAt' => $this->createdAt->format(DATE_ATOM),
        ];
    }
}
