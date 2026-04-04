<?php

namespace App\Entity;

use App\Repository\GameRepository;
use App\Validator\DifferentTeams;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: GameRepository::class)]
#[ORM\Table(name: 'games')]
#[ORM\Index(name: 'idx_games_home_team_id', columns: ['home_team_id'])]
#[ORM\Index(name: 'idx_games_away_team_id', columns: ['away_team_id'])]
#[ORM\Index(name: 'idx_games_game_type_id', columns: ['game_type_id'])]
#[ORM\Index(name: 'idx_games_location_id', columns: ['location_id'])]
#[ORM\Index(name: 'idx_games_league_id', columns: ['league_id'])]
#[ORM\Index(name: 'idx_games_cup_id', columns: ['cup_id'])]
#[ORM\UniqueConstraint(name: 'uniq_games_calendar_event_id', columns: ['calendar_event_id'])]
#[ORM\HasLifecycleCallbacks]
#[DifferentTeams]
class Game
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['game:read', 'game:write', 'team:read', 'player:read', 'game_event:read', 'calendar_event:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[Groups(['game:read', 'game:write', 'game_event:read', 'calendar_event:read'])]
    #[ORM\ManyToOne(targetEntity: Team::class)]
    /* #[Assert\NotNull(message: 'Das Heimspiel-Team muss gesetzt sein.')] */
    #[ORM\JoinColumn(
        name: 'home_team_id',
        referencedColumnName: 'id',
        nullable: true,
        onDelete: 'RESTRICT'
    )]
    private ?Team $homeTeam = null;

    #[Groups(['game:read', 'game:write', 'game_event:read', 'calendar_event:read'])]
    #[ORM\ManyToOne(targetEntity: Team::class)]
    /* #[Assert\NotNull(message: 'Das Auswärts-Team muss gesetzt sein.')] */
    #[ORM\JoinColumn(
        name: 'away_team_id',
        referencedColumnName: 'id',
        nullable: true,
        onDelete: 'RESTRICT'
    )]
    private ?Team $awayTeam = null;

    #[Groups(['game:read', 'game:write', 'game_event:read', 'calendar_event:read'])]
    #[ORM\ManyToOne(targetEntity: GameType::class, inversedBy: 'games')]
    #[Assert\NotNull(message: 'Der Spieltyp muss gesetzt sein.')]
    #[ORM\JoinColumn(
        name: 'game_type_id',
        referencedColumnName: 'id',
        nullable: false,
        onDelete: 'CASCADE'
    )]
    private GameType $gameType;

    /** @var Collection<int, GameEvent> */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\OneToMany(targetEntity: GameEvent::class, mappedBy: 'game')]
    private Collection $gameEvents;

    /** @var Collection<int, Substitution> */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\OneToMany(targetEntity: Substitution::class, mappedBy: 'game')]
    private Collection $substitutions;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $homeScore = null;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $awayScore = null;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'boolean')]
    private bool $isFinished = false;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\ManyToOne(targetEntity: Location::class)]
    #[ORM\JoinColumn(name: 'location_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Location $location = null;

    #[Groups(['game:read', 'calendar_event:read'])]
    #[ORM\ManyToOne(targetEntity: League::class)]
    #[ORM\JoinColumn(name: 'league_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?League $league = null;

    #[Groups(['game:read', 'calendar_event:read'])]
    #[ORM\ManyToOne(targetEntity: Cup::class)]
    #[ORM\JoinColumn(name: 'cup_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Cup $cup = null;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\OneToOne(targetEntity: CalendarEvent::class, inversedBy: 'game', cascade: ['persist', 'remove'])]
    #[ORM\JoinColumn(name: 'calendar_event_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?CalendarEvent $calendarEvent;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\OneToOne(targetEntity: TournamentMatch::class, mappedBy: 'game', cascade: ['persist', 'remove'])]
    private ?TournamentMatch $tournamentMatch = null;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'string', nullable: true, unique: true, name: 'fussball_de_id')]
    private ?string $fussballDeId = null;

    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'string', length: 255, nullable: true, name: 'fussball_de_url')]
    private ?string $fussballDeUrl = null;

    /**
     * Reguläre Halbzeitdauer in Minuten (z.B. 45 bei Erwachsenen, 30/35 bei Jugend).
     */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'smallint', options: ['default' => 45])]
    private int $halfDuration = 45;

    /**
     * Nachspielzeit der 1. Halbzeit in Minuten (nullable = nicht erfasst).
     */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'smallint', nullable: true)]
    private ?int $firstHalfExtraTime = null;

    /**
     * Nachspielzeit der 2. Halbzeit in Minuten (nullable = nicht erfasst).
     */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'smallint', nullable: true)]
    private ?int $secondHalfExtraTime = null;

    /**
     * Dauer der Halbzeitpause in Minuten.
     * Wird für die Video-Timeline-Berechnung benötigt, da die Pause nicht in den
     * Video-Aufnahmen enthalten ist, aber in den absoluten Event-Timestamps schon.
     */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'smallint', options: ['default' => 15])]
    private int $halftimeBreakDuration = 15;

    /**
     * Spielgebundener Matchplan mit Startformation, geplanten Phasen und Live-Status.
     *
     * @var array<string, mixed>|null
     */
    #[Groups(['game:read', 'game:write'])]
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $matchPlan = null;

    /**
     * @var Collection<int, Video>
     */
    #[ORM\OneToMany(targetEntity: Video::class, mappedBy: 'game', orphanRemoval: true)]
    private Collection $videos;

    public function __construct()
    {
        $this->gameEvents = new ArrayCollection();
        $this->substitutions = new ArrayCollection();
        $this->videos = new ArrayCollection();
    }

    public function getFussballDeId(): ?string
    {
        return $this->fussballDeId;
    }

    public function setFussballDeId(?string $fussballDeId): self
    {
        $this->fussballDeId = $fussballDeId;

        return $this;
    }

    public function getFussballDeUrl(): ?string
    {
        return $this->fussballDeUrl;
    }

    public function setFussballDeUrl(?string $fussballDeUrl): self
    {
        $this->fussballDeUrl = $fussballDeUrl;

        return $this;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getCalendarEvent(): ?CalendarEvent
    {
        return $this->calendarEvent;
    }

    public function setCalendarEvent(?CalendarEvent $calendarEvent): self
    {
        $this->calendarEvent = $calendarEvent;

        // Setze die bidirektionale Relation
        if (null !== $calendarEvent && $calendarEvent->getGame() !== $this) {
            $calendarEvent->setGame($this);
        }

        return $this;
    }

    public function getTournamentMatch(): ?TournamentMatch
    {
        return $this->tournamentMatch;
    }

    public function setTournamentMatch(?TournamentMatch $tournamentMatch): self
    {
        $this->tournamentMatch = $tournamentMatch;

        // Setze die bidirektionale Relation
        if (null !== $tournamentMatch && $tournamentMatch->getGame() !== $this) {
            $tournamentMatch->setGame($this);
        }

        return $this;
    }

    public function getHomeTeam(): ?Team
    {
        return $this->homeTeam;
    }

    public function setHomeTeam(?Team $homeTeam): self
    {
        $this->homeTeam = $homeTeam;

        return $this;
    }

    public function getAwayTeam(): ?Team
    {
        return $this->awayTeam;
    }

    public function setAwayTeam(?Team $awayTeam): self
    {
        $this->awayTeam = $awayTeam;

        return $this;
    }

    /** @return Collection<int, GameEvent> */
    public function getGameEvents(): Collection
    {
        return $this->gameEvents;
    }

    public function addGameEvent(GameEvent $gameEvent): self
    {
        if (!$this->gameEvents->contains($gameEvent)) {
            $this->gameEvents[] = $gameEvent;
            $gameEvent->setGame($this);
        }

        return $this;
    }

    public function removeGameEvent(GameEvent $gameEvent): self
    {
        if ($this->gameEvents->contains($gameEvent)) {
            $this->gameEvents->removeElement($gameEvent);
            // set the owning side to null (unless already changed)
            if ($gameEvent->getGame() === $this) {
                $gameEvent->setGame(null);
            }
        }

        return $this;
    }

    /** @return Collection<int, Substitution> */
    public function getSubstitutions(): Collection
    {
        return $this->substitutions;
    }

    public function addSubstitution(Substitution $substitution): self
    {
        if (!$this->substitutions->contains($substitution)) {
            $this->substitutions[] = $substitution;
            $substitution->setGame($this);
        }

        return $this;
    }

    public function removeSubstitution(Substitution $substitution): self
    {
        if ($this->substitutions->removeElement($substitution)) {
            // set the owning side to null (unless already changed)
            if ($substitution->getGame() === $this) {
                $substitution->setGame(null);
            }
        }

        return $this;
    }

    public function getGameType(): GameType
    {
        return $this->gameType;
    }

    public function setGameType(?GameType $gameType): self
    {
        $this->gameType = $gameType;

        return $this;
    }

    public function getHomeScore(): ?int
    {
        return $this->homeScore;
    }

    public function setHomeScore(?int $homeScore): self
    {
        $this->homeScore = $homeScore;

        return $this;
    }

    public function getAwayScore(): ?int
    {
        return $this->awayScore;
    }

    public function setAwayScore(?int $awayScore): self
    {
        $this->awayScore = $awayScore;

        return $this;
    }

    public function isFinished(): bool
    {
        return $this->isFinished;
    }

    public function setIsFinished(bool $isFinished): self
    {
        $this->isFinished = $isFinished;

        return $this;
    }

    public function getLocation(): ?Location
    {
        return $this->location;
    }

    public function setLocation(?Location $location): self
    {
        $this->location = $location;

        return $this;
    }

    /**
     * @return Collection<int, Video>
     */
    public function getVideos(): Collection
    {
        return $this->videos;
    }

    public function addVideo(Video $video): static
    {
        if (!$this->videos->contains($video)) {
            $this->videos->add($video);
            $video->setGame($this);
        }

        return $this;
    }

    public function removeVideo(Video $video): static
    {
        if ($this->videos->removeElement($video)) {
            // set the owning side to null (unless already changed)
            if ($video->getGame() === $this) {
                $video->setGame(null);
            }
        }

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

    public function getHalfDuration(): int
    {
        return $this->halfDuration;
    }

    public function setHalfDuration(int $halfDuration): self
    {
        $this->halfDuration = $halfDuration;

        return $this;
    }

    public function getFirstHalfExtraTime(): ?int
    {
        return $this->firstHalfExtraTime;
    }

    public function setFirstHalfExtraTime(?int $firstHalfExtraTime): self
    {
        $this->firstHalfExtraTime = $firstHalfExtraTime;

        return $this;
    }

    public function getSecondHalfExtraTime(): ?int
    {
        return $this->secondHalfExtraTime;
    }

    public function setSecondHalfExtraTime(?int $secondHalfExtraTime): self
    {
        $this->secondHalfExtraTime = $secondHalfExtraTime;

        return $this;
    }

    public function getHalftimeBreakDuration(): int
    {
        return $this->halftimeBreakDuration;
    }

    public function setHalftimeBreakDuration(int $halftimeBreakDuration): self
    {
        $this->halftimeBreakDuration = $halftimeBreakDuration;

        return $this;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getMatchPlan(): ?array
    {
        return $this->matchPlan;
    }

    /**
     * @param array<string, mixed>|null $matchPlan
     */
    public function setMatchPlan(?array $matchPlan): self
    {
        $this->matchPlan = $matchPlan;

        return $this;
    }

    /**
     * Gibt die tatsächliche Dauer der 1. Halbzeit inkl. Nachspielzeit in Sekunden zurück.
     */
    public function getFirstHalfTotalSeconds(): int
    {
        return ($this->halfDuration + ($this->firstHalfExtraTime ?? 0)) * 60;
    }

    public function __toString(): string
    {
        return $this->getHomeTeam()?->getName() . ' : ' . $this->getAwayTeam()?->getName();
    }
}
