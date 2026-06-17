<?php

namespace App\Entity;

use App\Repository\CashBookRepository;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CashBookRepository::class)]
#[ORM\Table(name: 'cash_books')]
#[ORM\Index(name: 'idx_cash_books_team_id', columns: ['team_id'])]
#[ORM\Index(name: 'idx_cash_books_club_id', columns: ['club_id'])]
class CashBook
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: Club::class)]
    #[ORM\JoinColumn(name: 'club_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Club $club = null;

    #[ORM\Column(type: 'string', length: 100)]
    private string $name;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2, options: ['default' => '0.00'])]
    private float $openingBalance = 0.0;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    /** @var Collection<int, CashBookEntry> */
    #[ORM\OneToMany(mappedBy: 'cashBook', targetEntity: CashBookEntry::class, cascade: ['remove'])]
    private Collection $entries;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
        $this->entries = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    public function getOpeningBalance(): float
    {
        return (float) $this->openingBalance;
    }

    public function setOpeningBalance(float $openingBalance): self
    {
        $this->openingBalance = $openingBalance;

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

    /** @return Collection<int, CashBookEntry> */
    public function getEntries(): Collection
    {
        return $this->entries;
    }

    public function addEntry(CashBookEntry $entry): self
    {
        if (!$this->entries->contains($entry)) {
            $this->entries->add($entry);
            $entry->setCashBook($this);
        }

        return $this;
    }

    public function removeEntry(CashBookEntry $entry): self
    {
        if ($this->entries->removeElement($entry)) {
            if ($entry->getCashBook() === $this) {
                $entry->setCashBook($this);
            }
        }

        return $this;
    }
}
