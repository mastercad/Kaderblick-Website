<?php

namespace App\Entity;

use App\Repository\TabEntryRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TabEntryRepository::class)]
#[ORM\Table(name: 'tab_entries')]
#[ORM\Index(name: 'IDX_tab_entries_user', columns: ['user_id'])]
#[ORM\Index(name: 'IDX_tab_entries_item', columns: ['catalog_item_id'])]
#[ORM\Index(name: 'IDX_tab_entries_created_by', columns: ['created_by_user_id'])]
#[ORM\Index(name: 'IDX_tab_entries_team', columns: ['team_id'])]
#[ORM\Index(name: 'IDX_tab_entries_club', columns: ['club_id'])]
#[ORM\Index(name: 'IDX_tab_entries_penalty_type', columns: ['penalty_type_id'])]
class TabEntry
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: TabCatalogItem::class, inversedBy: 'entries')]
    #[ORM\JoinColumn(name: 'catalog_item_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?TabCatalogItem $catalogItem = null;

    #[ORM\ManyToOne(targetEntity: PenaltyType::class)]
    #[ORM\JoinColumn(name: 'penalty_type_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?PenaltyType $penaltyType = null;

    #[ORM\Column(type: 'string', length: 100, nullable: true)]
    private ?string $customName = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, nullable: true)]
    private ?float $customPrice = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'integer')]
    private int $quantity = 1;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    private float $priceAtBooking;

    #[ORM\Column(type: 'date')]
    private DateTimeInterface $entryDate;

    #[ORM\Column(type: 'string', length: 200, nullable: true)]
    private ?string $note = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $createdByUser = null;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: Club::class)]
    #[ORM\JoinColumn(name: 'club_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Club $club = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCatalogItem(): ?TabCatalogItem
    {
        return $this->catalogItem;
    }

    public function setCatalogItem(?TabCatalogItem $catalogItem): self
    {
        $this->catalogItem = $catalogItem;

        return $this;
    }

    public function getCustomName(): ?string
    {
        return $this->customName;
    }

    public function setCustomName(?string $customName): self
    {
        $this->customName = $customName;

        return $this;
    }

    public function getCustomPrice(): ?float
    {
        return null !== $this->customPrice ? (float) $this->customPrice : null;
    }

    public function setCustomPrice(?float $customPrice): self
    {
        $this->customPrice = $customPrice;

        return $this;
    }

    public function getEffectiveName(): string
    {
        return $this->catalogItem?->getName() ?? $this->customName ?? '';
    }

    public function getEffectiveCategory(): ?string
    {
        return $this->catalogItem?->getCategory();
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): self
    {
        $this->quantity = $quantity;

        return $this;
    }

    public function getPriceAtBooking(): float
    {
        return (float) $this->priceAtBooking;
    }

    public function setPriceAtBooking(float $priceAtBooking): self
    {
        $this->priceAtBooking = $priceAtBooking;

        return $this;
    }

    public function getEntryDate(): DateTimeInterface
    {
        return $this->entryDate;
    }

    public function setEntryDate(DateTimeInterface $entryDate): self
    {
        $this->entryDate = $entryDate;

        return $this;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): self
    {
        $this->note = $note;

        return $this;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTimeImmutable $createdAt): self
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getCreatedByUser(): ?User
    {
        return $this->createdByUser;
    }

    public function setCreatedByUser(?User $createdByUser): self
    {
        $this->createdByUser = $createdByUser;

        return $this;
    }

    public function getTeam(): ?Team
    {
        return $this->team;
    }

    public function setTeam(?Team $team): self
    {
        $this->team = $team;

        return $this;
    }

    public function getClub(): ?Club
    {
        return $this->club;
    }

    public function setClub(?Club $club): self
    {
        $this->club = $club;

        return $this;
    }

    public function getPenaltyType(): ?PenaltyType
    {
        return $this->penaltyType;
    }

    public function setPenaltyType(?PenaltyType $penaltyType): self
    {
        $this->penaltyType = $penaltyType;

        return $this;
    }

    public function isPenalty(): bool
    {
        return null !== $this->penaltyType;
    }
}
