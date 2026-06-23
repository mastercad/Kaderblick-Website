<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'billing_webhook_events')]
class BillingWebhookEvent
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    /** @phpstan-ignore-next-line Set by Doctrine. */
    private ?int $id = null;
    #[ORM\Column(length: 100, unique: true)]
    private string $providerEventId;
    #[ORM\Column(length: 100)]
    private string $type;
    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $processedAt;

    public function __construct(string $eventId, string $type)
    {
        $this->providerEventId = $eventId;
        $this->type = $type;
        $this->processedAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getProviderEventId(): string
    {
        return $this->providerEventId;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getProcessedAt(): DateTimeImmutable
    {
        return $this->processedAt;
    }
}
