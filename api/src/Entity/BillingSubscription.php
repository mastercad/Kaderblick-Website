<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'billing_subscriptions')]
#[ORM\Index(name: 'idx_billing_subscription_status', columns: ['status'])]
class BillingSubscription
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_PAST_DUE = 'past_due';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_CANCELED = 'canceled';

    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    /** @phpstan-ignore-next-line Set by Doctrine. */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'RESTRICT')]
    private User $payer;

    #[ORM\Column(length: 30)]
    private string $provider = 'stripe';

    #[ORM\Column(length: 100, nullable: true, unique: true)]
    private ?string $providerCheckoutSessionId = null;

    #[ORM\Column(length: 100, nullable: true, unique: true)]
    private ?string $providerCustomerId = null;

    #[ORM\Column(length: 100, nullable: true, unique: true)]
    private ?string $providerSubscriptionId = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $providerSubscriptionItemId = null;

    #[ORM\Column(length: 30)]
    private string $status = self::STATUS_PENDING;

    #[ORM\Column]
    private int $unitAmount = 1000;

    #[ORM\Column(length: 3)]
    private string $currency = 'EUR';

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $currentPeriodStart = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $currentPeriodEnd = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $unpaidSince = null;

    #[ORM\Column(type: 'smallint')]
    private int $missedBillingCycles = 0;

    #[ORM\Column(type: 'boolean')]
    private bool $collectionPausedByTrial = false;

    /** @var list<string> */
    #[ORM\Column(type: 'json')]
    private array $teamNames = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $updatedAt;

    /** @var Collection<int, BillingSubscriptionTeam> */
    #[ORM\OneToMany(mappedBy: 'subscription', targetEntity: BillingSubscriptionTeam::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $teamLinks;

    public function __construct(User $payer)
    {
        $this->payer = $payer;
        $this->teamLinks = new ArrayCollection();
        $this->createdAt = $this->updatedAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPayer(): User
    {
        return $this->payer;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function getProviderCustomerId(): ?string
    {
        return $this->providerCustomerId;
    }

    public function getProviderCheckoutSessionId(): ?string
    {
        return $this->providerCheckoutSessionId;
    }

    public function setProviderCheckoutSessionId(?string $value): self
    {
        $this->providerCheckoutSessionId = $value;

        return $this->touch();
    }

    public function setProviderCustomerId(?string $value): self
    {
        $this->providerCustomerId = $value;

        return $this->touch();
    }

    public function getProviderSubscriptionId(): ?string
    {
        return $this->providerSubscriptionId;
    }

    public function setProviderSubscriptionId(?string $value): self
    {
        $this->providerSubscriptionId = $value;

        return $this->touch();
    }

    public function getProviderSubscriptionItemId(): ?string
    {
        return $this->providerSubscriptionItemId;
    }

    public function setProviderSubscriptionItemId(?string $value): self
    {
        $this->providerSubscriptionItemId = $value;

        return $this->touch();
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $value): self
    {
        $this->status = $value;

        return $this->touch();
    }

    public function getUnitAmount(): int
    {
        return $this->unitAmount;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function getCurrentPeriodStart(): ?DateTimeImmutable
    {
        return $this->currentPeriodStart;
    }

    public function setCurrentPeriodStart(?DateTimeImmutable $value): self
    {
        $this->currentPeriodStart = $value;

        return $this->touch();
    }

    public function getCurrentPeriodEnd(): ?DateTimeImmutable
    {
        return $this->currentPeriodEnd;
    }

    public function setCurrentPeriodEnd(?DateTimeImmutable $value): self
    {
        $this->currentPeriodEnd = $value;

        return $this->touch();
    }

    public function getUnpaidSince(): ?DateTimeImmutable
    {
        return $this->unpaidSince;
    }

    public function setUnpaidSince(?DateTimeImmutable $value): self
    {
        $this->unpaidSince = $value;

        return $this->touch();
    }

    public function getMissedBillingCycles(): int
    {
        return $this->missedBillingCycles;
    }

    public function setMissedBillingCycles(int $value): self
    {
        $this->missedBillingCycles = max(0, $value);

        return $this->touch();
    }

    public function isCollectionPausedByTrial(): bool
    {
        return $this->collectionPausedByTrial;
    }

    public function setCollectionPausedByTrial(bool $value): self
    {
        $this->collectionPausedByTrial = $value;

        return $this->touch();
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /** @return Collection<int, BillingSubscriptionTeam> */
    public function getTeamLinks(): Collection
    {
        return $this->teamLinks;
    }

    public function addTeam(Team $team): self
    {
        foreach ($this->teamLinks as $link) {
            if ($link->getTeam() === $team) {
                return $this;
            }
        }
        $this->teamLinks->add(new BillingSubscriptionTeam($this, $team));
        if (!in_array($team->getName(), $this->teamNames, true)) {
            $this->teamNames[] = $team->getName();
        }

        return $this->touch();
    }

    /** @return list<Team> */
    public function getTeams(): array
    {
        return array_values(array_map(static fn (BillingSubscriptionTeam $link) => $link->getTeam(), $this->teamLinks->toArray()));
    }

    /** @return list<string> */
    public function getTeamNames(): array
    {
        return $this->teamNames;
    }

    private function touch(): self
    {
        $this->updatedAt = new DateTimeImmutable();

        return $this;
    }
}
