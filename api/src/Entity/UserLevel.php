<?php

namespace App\Entity;

use App\Repository\UserLevelRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserLevelRepository::class)]
#[ORM\Table(name: 'user_levels')]
class UserLevel
{
    #[ORM\Id]
    #[ORM\OneToOne(inversedBy: 'userLevel', targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id')]
    private User $user;

    #[ORM\Column(type: 'integer')]
    private int $xpTotal;

    #[ORM\Column(type: 'integer')]
    private int $level;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $seasonXpTotal = 0;

    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $seasonLevel = 1;

    #[ORM\Column(type: 'string', length: 9, nullable: true)]
    private ?string $season = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $updatedAt;

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getXpTotal(): int
    {
        return $this->xpTotal;
    }

    public function setXpTotal(int $xpTotal): self
    {
        $this->xpTotal = $xpTotal;

        return $this;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function setLevel(int $level): self
    {
        $this->level = $level;

        return $this;
    }

    public function getSeasonXpTotal(): int
    {
        return $this->seasonXpTotal;
    }

    public function setSeasonXpTotal(int $seasonXpTotal): self
    {
        $this->seasonXpTotal = $seasonXpTotal;

        return $this;
    }

    public function getSeasonLevel(): int
    {
        return $this->seasonLevel;
    }

    public function setSeasonLevel(int $seasonLevel): self
    {
        $this->seasonLevel = $seasonLevel;

        return $this;
    }

    public function getSeason(): ?string
    {
        return $this->season;
    }

    public function setSeason(?string $season): self
    {
        $this->season = $season;

        return $this;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTimeImmutable $updatedAt): self
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }
}
