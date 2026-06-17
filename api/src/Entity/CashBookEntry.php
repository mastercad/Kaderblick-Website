<?php

namespace App\Entity;

use App\Repository\CashBookEntryRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CashBookEntryRepository::class)]
#[ORM\Table(name: 'cash_book_entries')]
#[ORM\Index(name: 'idx_cash_book_entries_cash_book_id', columns: ['cash_book_id'])]
#[ORM\Index(name: 'idx_cash_book_entries_entry_date', columns: ['entry_date'])]
#[ORM\Index(name: 'idx_cash_book_entries_created_by_user_id', columns: ['created_by_user_id'])]
class CashBookEntry
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CashBook::class, inversedBy: 'entries')]
    #[ORM\JoinColumn(name: 'cash_book_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private CashBook $cashBook;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    private float $amount;

    /** @var string 'income' or 'expense' */
    #[ORM\Column(type: 'string', length: 10)]
    private string $type;

    #[ORM\Column(type: 'string', length: 100, nullable: true)]
    private ?string $category = null;

    #[ORM\Column(type: 'string', length: 500)]
    private string $description;

    #[ORM\Column(type: 'date')]
    private DateTimeInterface $entryDate;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $createdByUser = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'string', length: 50, nullable: true)]
    private ?string $referenceType = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $referenceId = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCashBook(): CashBook
    {
        return $this->cashBook;
    }

    public function setCashBook(CashBook $cashBook): self
    {
        $this->cashBook = $cashBook;

        return $this;
    }

    public function getAmount(): float
    {
        return (float) $this->amount;
    }

    public function setAmount(float $amount): self
    {
        $this->amount = $amount;

        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;

        return $this;
    }

    public function getCategory(): ?string
    {
        return $this->category;
    }

    public function setCategory(?string $category): self
    {
        $this->category = $category;

        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): self
    {
        $this->description = $description;

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

    public function getCreatedByUser(): ?User
    {
        return $this->createdByUser;
    }

    public function setCreatedByUser(?User $createdByUser): self
    {
        $this->createdByUser = $createdByUser;

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

    public function getReferenceType(): ?string
    {
        return $this->referenceType;
    }

    public function setReferenceType(?string $referenceType): self
    {
        $this->referenceType = $referenceType;

        return $this;
    }

    public function getReferenceId(): ?int
    {
        return $this->referenceId;
    }

    public function setReferenceId(?int $referenceId): self
    {
        $this->referenceId = $referenceId;

        return $this;
    }
}
