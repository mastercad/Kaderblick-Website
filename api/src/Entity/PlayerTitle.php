<?php

namespace App\Entity;

use App\Repository\PlayerTitleRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PlayerTitleRepository::class)]
#[ORM\Table(name: 'player_titles')]
#[ORM\Index(name: 'idx_player_titles_player_id', columns: ['player_id'])]
#[ORM\Index(name: 'idx_player_titles_team_id', columns: ['team_id'])]
#[ORM\Index(name: 'idx_player_titles_league_id', columns: ['league_id'])]
#[ORM\Index(name: 'idx_player_titles_cup_id', columns: ['cup_id'])]
#[ORM\Index(name: 'idx_player_titles_is_active', columns: ['is_active'])]
#[ORM\UniqueConstraint(
    name: 'uniq_player_title_active',
    columns: ['player_id', 'title_category', 'title_scope', 'team_id', 'league_id', 'cup_id', 'is_active']
)]
class PlayerTitle
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Player::class)]
    #[ORM\JoinColumn(name: 'player_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Player $player;

    #[ORM\Column(type: 'string', length: 50)]
    private string $titleCategory; // 'top_scorer', 'top_assist', etc.

    #[ORM\Column(type: 'string', length: 20)]
    private string $titleScope; // 'platform' or 'team'

    #[ORM\Column(type: 'string', length: 20)]
    private string $titleRank; // 'gold', 'silver', 'bronze'

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: League::class)]
    #[ORM\JoinColumn(name: 'league_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?League $league = null;

    #[ORM\ManyToOne(targetEntity: Cup::class)]
    #[ORM\JoinColumn(name: 'cup_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Cup $cup = null;

    #[ORM\Column(type: 'integer')]
    private int $value; // Number of goals, assists, etc.

    #[ORM\Column(type: 'boolean')]
    private bool $isActive = true;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $awardedAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $revokedAt = null;

    #[ORM\Column(type: 'string', length: 50, nullable: true)]
    private ?string $season = null; // e.g., '2024/2025'

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPlayer(): ?Player
    {
        return $this->player;
    }

    public function setPlayer(?Player $player): self
    {
        $this->player = $player;

        return $this;
    }

    public function getTitleCategory(): string
    {
        return $this->titleCategory;
    }

    public function setTitleCategory(string $titleCategory): self
    {
        $this->titleCategory = $titleCategory;

        return $this;
    }

    public function getTitleScope(): string
    {
        return $this->titleScope;
    }

    public function setTitleScope(string $titleScope): self
    {
        $this->titleScope = $titleScope;

        return $this;
    }

    public function getTitleRank(): string
    {
        return $this->titleRank;
    }

    public function setTitleRank(string $titleRank): self
    {
        $this->titleRank = $titleRank;

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

    public function getLeague(): ?League
    {
        return $this->league;
    }

    public function setLeague(?League $league): self
    {
        $this->league = $league;

        return $this;
    }

    public function getCup(): ?Cup
    {
        return $this->cup;
    }

    public function setCup(?Cup $cup): self
    {
        $this->cup = $cup;

        return $this;
    }

    public function getValue(): int
    {
        return $this->value;
    }

    public function setValue(int $value): self
    {
        $this->value = $value;

        return $this;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): self
    {
        $this->isActive = $isActive;

        return $this;
    }

    public function getAwardedAt(): DateTimeImmutable
    {
        return $this->awardedAt;
    }

    public function setAwardedAt(DateTimeImmutable $awardedAt): self
    {
        $this->awardedAt = $awardedAt;

        return $this;
    }

    public function getRevokedAt(): ?DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function setRevokedAt(?DateTimeImmutable $revokedAt): self
    {
        $this->revokedAt = $revokedAt;

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

    /**
     * Get priority for sorting (lower = higher priority).
     */
    public function getPriority(): int
    {
        $scopePriority = match ($this->titleScope) {
            'platform' => 0,
            'cup' => 25,
            'league' => 50,
            'team' => 100,
            default => 200,
        };

        $rankPriority = match ($this->titleRank) {
            'gold' => 0,
            'silver' => 10,
            'bronze' => 20,
            default => 30,
        };

        return $scopePriority + $rankPriority;
    }
}
