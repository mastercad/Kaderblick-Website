<?php

namespace App\Entity;

use App\Repository\InventoryCheckoutRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: InventoryCheckoutRepository::class)]
#[ORM\Table(name: 'inventory_checkouts')]
#[ORM\Index(name: 'idx_inventory_checkouts_item_id', columns: ['inventory_item_id'])]
#[ORM\Index(name: 'idx_inventory_checkouts_user_id', columns: ['user_id'])]
#[ORM\Index(name: 'idx_inventory_checkouts_returned_at', columns: ['returned_at'])]
class InventoryCheckout
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[ORM\ManyToOne(targetEntity: InventoryItem::class, inversedBy: 'checkouts')]
    #[ORM\JoinColumn(name: 'inventory_item_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?InventoryItem $inventoryItem = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $user = null;

    #[ORM\Column(type: 'string', length: 100, nullable: true)]
    private ?string $borrowerName = null;

    #[ORM\Column(type: 'integer')]
    private int $quantity = 1;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $checkedOutAt;

    #[ORM\Column(type: 'date', nullable: true)]
    private ?DateTimeInterface $dueDate = null;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTimeInterface $returnedAt = null;

    #[ORM\Column(type: 'string', length: 300, nullable: true)]
    private ?string $note = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'checked_out_by_user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $checkedOutByUser = null;

    public function __construct()
    {
        $this->checkedOutAt = new DateTimeImmutable();
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getInventoryItem(): ?InventoryItem
    {
        return $this->inventoryItem;
    }

    public function setInventoryItem(?InventoryItem $inventoryItem): void
    {
        $this->inventoryItem = $inventoryItem;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): void
    {
        $this->user = $user;
    }

    public function getBorrowerName(): ?string
    {
        return $this->borrowerName;
    }

    public function setBorrowerName(?string $borrowerName): void
    {
        $this->borrowerName = $borrowerName;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): void
    {
        $this->quantity = $quantity;
    }

    public function getCheckedOutAt(): DateTimeImmutable
    {
        return $this->checkedOutAt;
    }

    public function getDueDate(): ?DateTimeInterface
    {
        return $this->dueDate;
    }

    public function setDueDate(?DateTimeInterface $dueDate): void
    {
        $this->dueDate = $dueDate;
    }

    public function getReturnedAt(): ?DateTimeInterface
    {
        return $this->returnedAt;
    }

    public function setReturnedAt(?DateTimeInterface $returnedAt): void
    {
        $this->returnedAt = $returnedAt;
    }

    public function isReturned(): bool
    {
        return null !== $this->returnedAt;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): void
    {
        $this->note = $note;
    }

    public function getCheckedOutByUser(): ?User
    {
        return $this->checkedOutByUser;
    }

    public function setCheckedOutByUser(?User $checkedOutByUser): void
    {
        $this->checkedOutByUser = $checkedOutByUser;
    }

    public function getDisplayName(): string
    {
        if ($this->user) {
            return trim($this->user->getFirstName() . ' ' . $this->user->getLastName());
        }

        return $this->borrowerName ?? 'Unbekannt';
    }
}
