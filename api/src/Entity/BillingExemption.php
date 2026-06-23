<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'billing_exemptions')]
class BillingExemption
{
    public const SCOPE_PLATFORM = 'platform';
    public const SCOPE_CLUB = 'club';
    public const SCOPE_TEAM = 'team';

    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    /** @phpstan-ignore-next-line Set by Doctrine. */
    private ?int $id = null;

    #[ORM\Column(length: 20)]
    private string $scope;

    #[ORM\ManyToOne(targetEntity: Club::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Club $club = null;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $startsAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $endsAt = null;

    #[ORM\Column(type: 'text')]
    private string $reason;

    #[ORM\Column(type: 'boolean')]
    private bool $active = true;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $endedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    public function __construct(string $scope, string $reason, ?User $createdBy)
    {
        $this->scope = $scope;
        $this->reason = $reason;
        $this->createdBy = $createdBy;
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getScope(): string
    {
        return $this->scope;
    }

    public function getClub(): ?Club
    {
        return $this->club;
    }

    public function setClub(?Club $value): self
    {
        $this->club = $value;

        return $this;
    }

    public function getTeam(): ?Team
    {
        return $this->team;
    }

    public function setTeam(?Team $value): self
    {
        $this->team = $value;

        return $this;
    }

    public function getStartsAt(): ?DateTimeImmutable
    {
        return $this->startsAt;
    }

    public function setStartsAt(?DateTimeImmutable $value): self
    {
        $this->startsAt = $value;

        return $this;
    }

    public function getEndsAt(): ?DateTimeImmutable
    {
        return $this->endsAt;
    }

    public function setEndsAt(?DateTimeImmutable $value): self
    {
        $this->endsAt = $value;

        return $this;
    }

    public function getReason(): string
    {
        return $this->reason;
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $value): self
    {
        $this->active = $value;
        if ($value) {
            $this->endedAt = null;
        }

        return $this;
    }

    public function getEndedAt(): ?DateTimeImmutable
    {
        return $this->endedAt;
    }

    public function end(?DateTimeImmutable $at = null): self
    {
        $this->active = false;
        $this->endedAt = $at ?? new DateTimeImmutable();

        return $this;
    }

    public function appliesAt(DateTimeImmutable $at): bool
    {
        return $this->active && (null === $this->startsAt || $this->startsAt <= $at) && (null === $this->endsAt || $this->endsAt > $at);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'scope' => $this->scope,
            'club' => $this->club ? ['id' => $this->club->getId(), 'name' => $this->club->getName()] : null,
            'team' => $this->team ? ['id' => $this->team->getId(), 'name' => $this->team->getName()] : null,
            'startsAt' => $this->startsAt?->format(DATE_ATOM),
            'endsAt' => $this->endsAt?->format(DATE_ATOM),
            'endedAt' => $this->endedAt?->format(DATE_ATOM),
            'reason' => $this->reason,
            'active' => $this->active,
            'createdAt' => $this->createdAt->format(DATE_ATOM),
        ];
    }
}
