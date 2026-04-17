<?php

namespace App\Entity;

use App\Repository\CalendarEventRepository;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CalendarEventRepository::class)]
#[ORM\Table(name: 'calendar_events')]
#[ORM\Index(name: 'idx_calendar_events_calendar_event_type_id', columns: ['calendar_event_type_id'])]
#[ORM\Index(name: 'idx_calendar_events_location_id', columns: ['location_id'])]
#[ORM\Index(name: 'idx_calendar_events_meeting_location_id', columns: ['meeting_location_id'])]
class CalendarEvent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['calendar_event:read', 'game:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['calendar_event:read'])]
    private ?string $title = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['calendar_event:read'])]
    private ?string $description = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['calendar_event:read'])]
    private ?DateTimeInterface $startDate = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['calendar_event:read'])]
    private ?DateTimeInterface $endDate = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(
        name: 'calendar_event_type_id',
        referencedColumnName: 'id',
        nullable: true,
        onDelete: 'SET NULL'
    )]
    #[Groups(['calendar_event:read'])]
    private ?CalendarEventType $calendarEventType = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(
        name: 'location_id',
        referencedColumnName: 'id',
        nullable: true,
        onDelete: 'SET NULL'
    )]
    #[Groups(['calendar_event:read'])]
    private ?Location $location = null;

    #[ORM\OneToOne(targetEntity: WeatherData::class, mappedBy: 'calendarEvent', cascade: ['persist', 'remove'])]
    private ?WeatherData $weatherData = null;

    #[Groups(['calendar_event:read'])]
    #[ORM\OneToOne(targetEntity: Game::class, mappedBy: 'calendarEvent', cascade: ['persist', 'remove'])]
    private ?Game $game = null;

    #[Groups(['calendar_event:read'])]
    #[ORM\OneToOne(targetEntity: Tournament::class, mappedBy: 'calendarEvent', cascade: ['persist', 'remove'])]
    private ?Tournament $tournament = null;

    #[ORM\Column]
    private bool $notificationSent = false;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $cancelled = false;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $cancelReason = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'cancelled_by_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $cancelledBy = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    /**
     * Weekdays (0=Sun … 6=Sat) that define the training series this event belongs to.
     *
     * @var ?array<int>
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $trainingWeekdays = null;

    /** Series end date (Y-m-d) stored so we can restore it when editing */
    #[ORM\Column(type: Types::STRING, length: 10, nullable: true)]
    private ?string $trainingSeriesEndDate = null;

    /** Shared UUID that groups all CalendarEvents belonging to the same training series */
    #[ORM\Column(type: Types::STRING, length: 36, nullable: true)]
    private ?string $trainingSeriesId = null;

    /** Free-text description of the meeting point, e.g. "Parkplatz hinter der Halle" */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    #[Groups(['calendar_event:read'])]
    private ?string $meetingPoint = null;

    /** Structured location reference for the meeting point (enables navigation) */
    #[ORM\ManyToOne(targetEntity: Location::class)]
    #[ORM\JoinColumn(name: 'meeting_location_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['calendar_event:read'])]
    private ?Location $meetingLocation = null;

    /** Time the team gathers at the meeting point (may differ from event start) */
    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['calendar_event:read'])]
    private ?DateTimeInterface $meetingTime = null;

    /**
     * @var Collection<int, CalendarEventPermission>
     */
    #[ORM\OneToMany(targetEntity: CalendarEventPermission::class, mappedBy: 'calendarEvent', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $permissions;

    public function __construct()
    {
        $this->permissions = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;

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

    public function getStartDate(): ?DateTimeInterface
    {
        return $this->startDate;
    }

    public function setStartDate(DateTimeInterface $startDate): self
    {
        $this->startDate = $startDate;

        return $this;
    }

    public function getEndDate(): ?DateTimeInterface
    {
        return $this->endDate;
    }

    public function setEndDate(?DateTimeInterface $endDate): self
    {
        $this->endDate = $endDate;

        return $this;
    }

    public function getCalendarEventType(): ?CalendarEventType
    {
        return $this->calendarEventType;
    }

    public function getWeatherData(): ?WeatherData
    {
        return $this->weatherData;
    }

    public function setWeatherData(?WeatherData $weatherData): self
    {
        $this->weatherData = $weatherData;
        // set the owning side of the relation if necessary
        if ($weatherData && $weatherData->getCalendarEvent() !== $this) {
            $weatherData->setCalendarEvent($this);
        }

        return $this;
    }

    public function setCalendarEventType(?CalendarEventType $calendarEventType): self
    {
        $this->calendarEventType = $calendarEventType;

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

    public function isNotificationSent(): bool
    {
        return $this->notificationSent;
    }

    public function setNotificationSent(bool $notificationSent): self
    {
        $this->notificationSent = $notificationSent;

        return $this;
    }

    public function getGame(): ?Game
    {
        return $this->game;
    }

    public function setGame(?Game $game): self
    {
        $this->game = $game;

        return $this;
    }

    public function __toString(): string
    {
        return $this->title ?? 'UNKNOWN CALENDAR EVENT';
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(?User $createdBy): self
    {
        $this->createdBy = $createdBy;

        return $this;
    }

    /**
     * @return Collection<int, CalendarEventPermission>
     */
    public function getPermissions(): Collection
    {
        return $this->permissions;
    }

    public function addPermission(CalendarEventPermission $permission): self
    {
        if (!$this->permissions->contains($permission)) {
            $this->permissions->add($permission);
            $permission->setCalendarEvent($this);
        }

        return $this;
    }

    public function removePermission(CalendarEventPermission $permission): self
    {
        if ($this->permissions->removeElement($permission)) {
            if ($permission->getCalendarEvent() === $this) {
                $permission->setCalendarEvent(null);
            }
        }

        return $this;
    }

    public function getTournament(): ?Tournament
    {
        return $this->tournament;
    }

    public function setTournament(?Tournament $tournament): self
    {
        $this->tournament = $tournament;

        return $this;
    }

    public function isCancelled(): bool
    {
        return $this->cancelled;
    }

    public function setCancelled(bool $cancelled): self
    {
        $this->cancelled = $cancelled;

        return $this;
    }

    public function getCancelReason(): ?string
    {
        return $this->cancelReason;
    }

    public function setCancelReason(?string $cancelReason): self
    {
        $this->cancelReason = $cancelReason;

        return $this;
    }

    public function getCancelledBy(): ?User
    {
        return $this->cancelledBy;
    }

    public function setCancelledBy(?User $cancelledBy): self
    {
        $this->cancelledBy = $cancelledBy;

        return $this;
    }

    /**
     * @return ?array<int>
     */
    public function getTrainingWeekdays(): ?array
    {
        return $this->trainingWeekdays;
    }

    /**
     * @param ?array<int> $trainingWeekdays
     */
    public function setTrainingWeekdays(?array $trainingWeekdays): self
    {
        $this->trainingWeekdays = $trainingWeekdays;

        return $this;
    }

    public function getTrainingSeriesEndDate(): ?string
    {
        return $this->trainingSeriesEndDate;
    }

    public function setTrainingSeriesEndDate(?string $trainingSeriesEndDate): self
    {
        $this->trainingSeriesEndDate = $trainingSeriesEndDate;

        return $this;
    }

    public function getTrainingSeriesId(): ?string
    {
        return $this->trainingSeriesId;
    }

    public function setTrainingSeriesId(?string $trainingSeriesId): self
    {
        $this->trainingSeriesId = $trainingSeriesId;

        return $this;
    }

    public function getMeetingPoint(): ?string
    {
        return $this->meetingPoint;
    }

    public function setMeetingPoint(?string $meetingPoint): self
    {
        $this->meetingPoint = $meetingPoint;

        return $this;
    }

    public function getMeetingLocation(): ?Location
    {
        return $this->meetingLocation;
    }

    public function setMeetingLocation(?Location $meetingLocation): self
    {
        $this->meetingLocation = $meetingLocation;

        return $this;
    }

    public function getMeetingTime(): ?DateTimeInterface
    {
        return $this->meetingTime;
    }

    public function setMeetingTime(?DateTimeInterface $meetingTime): self
    {
        $this->meetingTime = $meetingTime;

        return $this;
    }
}
