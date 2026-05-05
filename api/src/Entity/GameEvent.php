<?php

namespace App\Entity;

use App\Repository\GameEventRepository;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Context;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Attribute\MaxDepth;

#[ORM\Entity(repositoryClass: GameEventRepository::class)]
#[ORM\Table(name: 'game_events')]
#[ORM\Index(columns: ['timestamp'], name: 'idx_game_event_timestamp')]
class GameEvent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['game_event:read', 'game_event:write', 'team:read', 'game:read', 'calendar_event:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Game::class, inversedBy: 'gameEvents')]
    #[ORM\JoinColumn(name: 'game_id', referencedColumnName: 'id', nullable: false)]
    #[Groups(['game_event:read', 'game_event:write', 'calendar_event:read'])]
    #[MaxDepth(1)]
    private Game $game;

    #[ORM\ManyToOne(targetEntity: GameEventType::class, inversedBy: 'gameEvents')]
    #[ORM\JoinColumn(name: 'game_event_type_id', referencedColumnName: 'id', nullable: false)]
    #[Groups(['game_event:read', 'game_event:write', 'game:read', 'calendar_event:read'])]
    #[MaxDepth(1)]
    private ?GameEventType $gameEventType = null;

    #[ORM\ManyToOne(targetEntity: Player::class, inversedBy: 'gameEvents')]
    #[ORM\JoinColumn(name: 'player_id', referencedColumnName: 'id', nullable: true)]
    #[Groups(['game_event:read', 'game_event:write'])]
    #[MaxDepth(1)]
    private ?Player $player = null;

    #[ORM\ManyToOne(targetEntity: Team::class, inversedBy: 'gameEvents')]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: false)]
    #[Groups(['game_event:read', 'game_event:write'])]
    #[MaxDepth(1)]
    private Team $team;

    #[ORM\Column(type: 'datetime')]
    #[Groups(['game_event:read', 'game_event:write'])]
    #[Context(normalizationContext: ['datetime_format' => 'd.m.Y H:i:s'])]
    private DateTimeInterface $timestamp;

    #[Groups(['game_event:read', 'game_event:write'])]
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[Groups(['game_event:read', 'game_event:write'])]
    #[ORM\ManyToOne(targetEntity: Player::class)]
    #[ORM\JoinColumn(name: 'related_player_id', referencedColumnName: 'id', nullable: true)]
    #[MaxDepth(1)]
    private ?Player $relatedPlayer = null;

    #[Groups(['game_event:read', 'game_event:write'])]
    #[ORM\ManyToOne(targetEntity: SubstitutionReason::class)]
    #[ORM\JoinColumn(name: 'substitution_reason_id', referencedColumnName: 'id', nullable: true)]
    #[MaxDepth(1)]
    private ?SubstitutionReason $substitutionReason = null;

    #[Groups(['game_event:read', 'game_event:write'])]
    #[ORM\ManyToOne(targetEntity: Coach::class)]
    #[ORM\JoinColumn(name: 'coach_id', referencedColumnName: 'id', nullable: true)]
    #[MaxDepth(1)]
    private ?Coach $coach = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGame(): Game
    {
        return $this->game;
    }

    public function setGame(?Game $game): self
    {
        $this->game = $game;

        return $this;
    }

    public function getGameEventType(): ?GameEventType
    {
        return $this->gameEventType;
    }

    public function setGameEventType(?GameEventType $gameEventType): self
    {
        $this->gameEventType = $gameEventType;

        return $this;
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

    public function getTeam(): Team
    {
        return $this->team;
    }

    public function setTeam(?Team $team): self
    {
        $this->team = $team;

        return $this;
    }

    public function getTimestamp(): DateTimeInterface
    {
        return $this->timestamp;
    }

    public function setTimestamp(DateTimeInterface $timestamp): self
    {
        $this->timestamp = $timestamp;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function getRelatedPlayer(): ?Player
    {
        return $this->relatedPlayer;
    }

    public function setRelatedPlayer(?Player $relatedPlayer): self
    {
        $this->relatedPlayer = $relatedPlayer;

        return $this;
    }

    public function getSubstitutionReason(): ?SubstitutionReason
    {
        return $this->substitutionReason;
    }

    public function setSubstitutionReason(?SubstitutionReason $reason): self
    {
        $this->substitutionReason = $reason;

        return $this;
    }

    public function getCoach(): ?Coach
    {
        return $this->coach;
    }

    public function setCoach(?Coach $coach): self
    {
        $this->coach = $coach;

        return $this;
    }

    // Hilfsmethoden für Ein-/Auswechslungen
    public function isSubstitution(): bool
    {
        return 'substitution' === $this->getGameEventType()->getCode();
    }

    public function isSubstitutionIn(): bool
    {
        return 'substitution_in' === $this->getGameEventType()->getCode();
    }

    public function isSubstitutionOut(): bool
    {
        return 'substitution_out' === $this->getGameEventType()->getCode();
    }

    public function __toString(): string
    {
        $output = $this->gameEventType?->getName() ?? 'Unbekanntes Ereignis';

        if ($this->player) {
            $output .= ' - ' . $this->player->__toString();
        } elseif ($this->coach) {
            $output .= ' - Trainer: ' . $this->coach->getFullName();
        }

        $output .= ' (' . $this->timestamp->format('H:i') . ' Uhr)';

        return $output;
    }
}
