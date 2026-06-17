<?php

namespace App\Entity;

use App\Repository\TabPaymentRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TabPaymentRepository::class)]
#[ORM\Table(name: 'tab_payments')]
#[ORM\Index(name: 'IDX_tab_payments_user', columns: ['user_id'])]
#[ORM\Index(name: 'IDX_tab_payments_team', columns: ['team_id'])]
#[ORM\Index(name: 'IDX_tab_payments_club', columns: ['club_id'])]
class TabPayment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: Club::class)]
    #[ORM\JoinColumn(name: 'club_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Club $club = null;

    #[ORM\Column(type: 'decimal', precision: 10, scale: 2)]
    private float $amount;

    #[ORM\Column(type: 'string', length: 200, nullable: true)]
    private ?string $note = null;

    #[ORM\Column(type: 'date')]
    private DateTimeInterface $paymentDate;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'recorded_by_user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $recordedByUser = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getAmount(): float
    {
        return (float) $this->amount;
    }

    public function setAmount(float $amount): self
    {
        $this->amount = $amount;

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

    public function getPaymentDate(): DateTimeInterface
    {
        return $this->paymentDate;
    }

    public function setPaymentDate(DateTimeInterface $paymentDate): self
    {
        $this->paymentDate = $paymentDate;

        return $this;
    }

    public function getRecordedByUser(): ?User
    {
        return $this->recordedByUser;
    }

    public function setRecordedByUser(?User $recordedByUser): self
    {
        $this->recordedByUser = $recordedByUser;

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
}
