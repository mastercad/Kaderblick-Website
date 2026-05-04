<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\PlayerSuspensionRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

/**
 * Speichert aktive und vergangene Sperren eines Spielers in einem Wettbewerb.
 *
 * Eine Sperre entsteht durch:
 * - Erreichen des Gelb-Karten-Schwellenwerts (reason = 'yellow_cards')
 * - Rote Karte (reason = 'red_card')
 * - Gelb-Rote Karte (reason = 'yellow_red_card')
 */
#[ORM\Entity(repositoryClass: PlayerSuspensionRepository::class)]
#[ORM\Table(name: 'player_suspensions')]
#[ORM\Index(name: 'idx_player_suspensions_player_id', columns: ['player_id'])]
#[ORM\Index(name: 'idx_player_suspensions_active', columns: ['is_active'])]
#[ORM\Index(name: 'idx_player_suspensions_competition', columns: ['competition_type', 'competition_id'])]
class PlayerSuspension
{
    public const REASON_YELLOW_CARDS = 'yellow_cards';
    public const REASON_RED_CARD = 'red_card';
    public const REASON_YELLOW_RED_CARD = 'yellow_red_card';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Player::class)]
    #[ORM\JoinColumn(name: 'player_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Player $player;

    /** @see CompetitionCardRule::TYPE_* */
    #[ORM\Column(length: 20)]
    private string $competitionType;

    /**
     * ID der Liga / des Pokals / des Turniers (je nach competitionType).
     * NULL wenn unbekannt oder wettbewerbsübergreifend.
     */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $competitionId;

    /** @see self::REASON_* */
    #[ORM\Column(length: 20)]
    private string $reason;

    /** Das Spiel, in dem der Sperr-Schwellenwert erreicht wurde. */
    #[ORM\ManyToOne(targetEntity: Game::class)]
    #[ORM\JoinColumn(name: 'triggered_by_game_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Game $triggeredByGame;

    /** Anzahl der Spiele, für die die Sperre gilt. */
    #[ORM\Column(type: 'smallint')]
    private int $gamesSuspended;

    /** Anzahl der bereits abgesessenen Sperre-Spiele. */
    #[ORM\Column(type: 'smallint')]
    private int $gamesServed = 0;

    /** Sperre noch aktiv? Wird auf false gesetzt wenn gamesServed >= gamesSuspended. */
    #[ORM\Column(type: 'boolean')]
    private bool $isActive = true;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    public function __construct(
        Player $player,
        string $competitionType,
        ?int $competitionId,
        string $reason,
        int $gamesSuspended,
        ?Game $triggeredByGame = null,
    ) {
        $this->player = $player;
        $this->competitionType = $competitionType;
        $this->competitionId = $competitionId;
        $this->reason = $reason;
        $this->gamesSuspended = $gamesSuspended;
        $this->triggeredByGame = $triggeredByGame;
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPlayer(): Player
    {
        return $this->player;
    }

    public function getCompetitionType(): string
    {
        return $this->competitionType;
    }

    public function getCompetitionId(): ?int
    {
        return $this->competitionId;
    }

    public function getReason(): string
    {
        return $this->reason;
    }

    public function getTriggeredByGame(): ?Game
    {
        return $this->triggeredByGame;
    }

    public function getGamesSuspended(): int
    {
        return $this->gamesSuspended;
    }

    public function getGamesServed(): int
    {
        return $this->gamesServed;
    }

    public function setGamesServed(int $gamesServed): self
    {
        $this->gamesServed = $gamesServed;

        if ($this->gamesServed >= $this->gamesSuspended) {
            $this->isActive = false;
        }

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

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getRemainingGames(): int
    {
        return max(0, $this->gamesSuspended - $this->gamesServed);
    }
}
