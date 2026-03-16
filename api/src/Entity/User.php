<?php

namespace App\Entity;

use App\Repository\UserRepository;
use DateTime;
use Deprecated;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
#[ORM\UniqueConstraint(name: 'uniq_users_email', columns: ['email'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\Column(type: 'string', unique: true)]
    private string $email;

    #[ORM\Column(name: 'first_name', type: 'string', length: 255)]
    private string $firstName;

    #[ORM\Column(type: 'string', length: 255)]
    private string $lastName;

    /** @var array<string> */
    #[ORM\Column(type: 'json')]
    private array $roles = [];

    #[ORM\Column(type: 'string')]
    private string $password;

    #[ORM\Column(type: 'boolean')]
    private bool $isVerified = false;

    #[ORM\Column(type: 'boolean')]
    private bool $isEnabled = false;

    #[ORM\Column(type: 'string', length: 255, nullable: true, unique: true)]
    private ?string $googleId = null;

    #[ORM\Column(type: 'string', nullable: true)]
    private ?string $verificationToken = null;

    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $avatarFilename = null;

    #[ORM\Column(type: 'string', length: 500, nullable: true)]
    private ?string $googleAvatarUrl = null;

    #[ORM\Column(type: 'boolean')]
    private bool $useGoogleAvatar = false;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTime $verificationExpires = null;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $height = null;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $weight = null;

    #[ORM\Column(type: 'float', nullable: true)]
    private ?float $shoeSize = null;

    #[ORM\Column(length: 3, nullable: true)]
    private ?string $shirtSize = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $pantsSize = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $socksSize = null;

    #[ORM\Column(length: 3, nullable: true)]
    private ?string $jacketSize = null;

    /** @var array<string, bool>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $notificationPreferences = null;

    #[ORM\Column(length: 180, nullable: true)]
    private ?string $newEmail = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $emailVerificationToken = null;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTime $emailVerificationTokenExpiresAt = null;

    #[ORM\Column(length: 64, nullable: true, unique: true)]
    private ?string $apiToken = null;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTime $apiTokenCreatedAt = null;

    /** Token für öffentliche iCal-Feeds (persönlich / Verein / Plattform) */
    #[ORM\Column(length: 64, nullable: true, unique: true)]
    private ?string $calendarToken = null;

    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTime $calendarTokenCreatedAt = null;

    /**
     * @var Collection<int, ExternalCalendar>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: ExternalCalendar::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $externalCalendars;

    /**
     * Zeitstempel der letzten API-Aktivität des Benutzers.
     * Wird vom UserActivitySubscriber bei jedem authentifizierten Request (max. alle 5 Min.) aktualisiert.
     */
    #[ORM\Column(type: 'datetime', nullable: true)]
    private ?DateTime $lastActivityAt = null;

    #[ORM\OneToOne(mappedBy: 'user', targetEntity: UserLevel::class, cascade: ['persist', 'remove'])]
    private ?UserLevel $userLevel = null;

    /**
     * @var Collection<int, UserXpEvent>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: UserXpEvent::class, cascade: ['persist', 'remove'])]
    private Collection $userXpEvents;

    /**
     * @var Collection<int, DashboardWidget>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: DashboardWidget::class)]
    private Collection $widgets;

    /**
     * @var Collection<int, UserRelation>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: UserRelation::class)]
    private Collection $userRelations;

    /**
     * @var Collection<int, PushSubscription>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: PushSubscription::class, orphanRemoval: true)]
    private Collection $pushSubscriptions;

    /**
     * @var Collection<int, Video>
     */
    #[ORM\OneToMany(targetEntity: Video::class, mappedBy: 'createdFrom')]
    private Collection $videosCreatedFrom;

    /**
     * @var Collection<int, Video>
     */
    #[ORM\OneToMany(targetEntity: Video::class, mappedBy: 'updatedFrom')]
    private Collection $videosUpdatedFrom;

    /**
     * @var Collection<int, VideoSegment>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: VideoSegment::class, orphanRemoval: true)]
    private Collection $videoSegments;

    /**
     * @var Collection<int, VideoType>
     */
    #[ORM\OneToMany(targetEntity: VideoType::class, mappedBy: 'createdFrom')]
    private Collection $videoTypesCreatedFrom;

    /**
     * @var Collection<int, VideoType>
     */
    #[ORM\OneToMany(targetEntity: VideoType::class, mappedBy: 'updatedFrom')]
    private Collection $videoTypesUpdatedFrom;

    /**
     * @var Collection<int, Camera>
     */
    #[ORM\OneToMany(targetEntity: Camera::class, mappedBy: 'created_from')]
    private Collection $camerasCreated;

    /**
     * @var Collection<int, Camera>
     */
    #[ORM\OneToMany(targetEntity: Camera::class, mappedBy: 'updated_from')]
    private Collection $camerasUpdated;

    public function __construct()
    {
        $this->widgets = new ArrayCollection();
        $this->userRelations = new ArrayCollection();
        $this->pushSubscriptions = new ArrayCollection();
        $this->videosCreatedFrom = new ArrayCollection();
        $this->videosUpdatedFrom = new ArrayCollection();
        $this->videoTypesCreatedFrom = new ArrayCollection();
        $this->videoTypesUpdatedFrom = new ArrayCollection();
        $this->camerasCreated = new ArrayCollection();
        $this->camerasUpdated = new ArrayCollection();
        $this->videoSegments = new ArrayCollection();
        $this->videoSegments = new ArrayCollection();
        $this->userXpEvents = new ArrayCollection();
        $this->externalCalendars = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): self
    {
        $this->firstName = $firstName;

        return $this;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): self
    {
        $this->lastName = $lastName;

        return $this;
    }

    public function getFullName(): ?string
    {
        return $this->firstName . ' ' . $this->lastName;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        $roles = $this->roles;

        if ($this->isVerified) {
            $roles[] = 'ROLE_USER';
        } else {
            $roles[] = 'ROLE_GUEST';
        }

        if ($this->userRelations->count() > 0) {
            $roles[] = 'ROLE_RELATED_USER';
        }

        return array_unique($roles);
    }

    /**
     * @param array<string> $roles
     */
    public function setRoles(array $roles): self
    {
        $this->roles = $roles;

        return $this;
    }

    public function addRole(string $role): self
    {
        $this->roles[] = $role;

        $this->roles = array_unique($this->roles);

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    public function isVerified(): bool
    {
        return $this->isVerified;
    }

    public function setIsVerified(bool $isVerified): self
    {
        $this->isVerified = $isVerified;

        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->isEnabled;
    }

    public function setIsEnabled(bool $isEnabled): self
    {
        $this->isEnabled = $isEnabled;

        return $this;
    }

    public function getVerificationToken(): ?string
    {
        return $this->verificationToken;
    }

    public function setVerificationToken(?string $verificationToken): self
    {
        $this->verificationToken = $verificationToken;

        return $this;
    }

    public function getVerificationExpires(): ?DateTime
    {
        return $this->verificationExpires;
    }

    public function setVerificationExpires(?DateTime $verificationExpires): self
    {
        $this->verificationExpires = $verificationExpires;

        return $this;
    }

    public function getHeight(): ?float
    {
        return $this->height;
    }

    public function setHeight(?float $height): self
    {
        $this->height = $height;

        return $this;
    }

    public function getWeight(): ?float
    {
        return $this->weight;
    }

    public function setWeight(?float $weight): self
    {
        $this->weight = $weight;

        return $this;
    }

    public function getShoeSize(): ?float
    {
        return $this->shoeSize;
    }

    public function setShoeSize(?float $shoeSize): self
    {
        $this->shoeSize = $shoeSize;

        return $this;
    }

    public function getShirtSize(): ?string
    {
        return $this->shirtSize;
    }

    public function setShirtSize(?string $shirtSize): self
    {
        $this->shirtSize = $shirtSize;

        return $this;
    }

    public function getPantsSize(): ?string
    {
        return $this->pantsSize;
    }

    public function setPantsSize(?string $pantsSize): self
    {
        $this->pantsSize = $pantsSize;

        return $this;
    }

    public function getSocksSize(): ?string
    {
        return $this->socksSize;
    }

    public function setSocksSize(?string $socksSize): self
    {
        $this->socksSize = $socksSize;

        return $this;
    }

    public function getJacketSize(): ?string
    {
        return $this->jacketSize;
    }

    public function setJacketSize(?string $jacketSize): self
    {
        $this->jacketSize = $jacketSize;

        return $this;
    }

    /**
     * @return array<string, bool>|null
     */
    public function getNotificationPreferences(): ?array
    {
        return $this->notificationPreferences;
    }

    /**
     * @param array<string, bool>|null $notificationPreferences
     */
    public function setNotificationPreferences(?array $notificationPreferences): self
    {
        $this->notificationPreferences = $notificationPreferences;

        return $this;
    }

    public function getNewEmail(): ?string
    {
        return $this->newEmail;
    }

    public function setNewEmail(?string $newEmail): self
    {
        $this->newEmail = $newEmail;

        return $this;
    }

    public function getEmailVerificationToken(): ?string
    {
        return $this->emailVerificationToken;
    }

    public function setEmailVerificationToken(?string $token): self
    {
        $this->emailVerificationToken = $token;

        return $this;
    }

    public function getEmailVerificationTokenExpiresAt(): ?DateTime
    {
        return $this->emailVerificationTokenExpiresAt;
    }

    public function setEmailVerificationTokenExpiresAt(?DateTime $expiresAt): self
    {
        $this->emailVerificationTokenExpiresAt = $expiresAt;

        return $this;
    }

    public function getApiToken(): ?string
    {
        return $this->apiToken;
    }

    public function setApiToken(?string $apiToken): self
    {
        $this->apiToken = $apiToken;

        return $this;
    }

    public function getApiTokenCreatedAt(): ?DateTime
    {
        return $this->apiTokenCreatedAt;
    }

    public function setApiTokenCreatedAt(?DateTime $apiTokenCreatedAt): self
    {
        $this->apiTokenCreatedAt = $apiTokenCreatedAt;

        return $this;
    }

    public function getCalendarToken(): ?string
    {
        return $this->calendarToken;
    }

    public function setCalendarToken(?string $calendarToken): self
    {
        $this->calendarToken = $calendarToken;

        return $this;
    }

    public function getCalendarTokenCreatedAt(): ?DateTime
    {
        return $this->calendarTokenCreatedAt;
    }

    public function setCalendarTokenCreatedAt(?DateTime $calendarTokenCreatedAt): self
    {
        $this->calendarTokenCreatedAt = $calendarTokenCreatedAt;

        return $this;
    }

    /** @return Collection<int, ExternalCalendar> */
    public function getExternalCalendars(): Collection
    {
        return $this->externalCalendars;
    }

    public function getLastActivityAt(): ?DateTime
    {
        return $this->lastActivityAt;
    }

    public function setLastActivityAt(?DateTime $lastActivityAt): self
    {
        $this->lastActivityAt = $lastActivityAt;

        return $this;
    }

    /**
     * @return Collection<int, DashboardWidget>
     */
    public function getWidgets(): Collection
    {
        return $this->widgets;
    }

    public function addWidget(DashboardWidget $widget): self
    {
        if (!$this->widgets->contains($widget)) {
            $this->widgets->add($widget);
            $widget->setUser($this);
        }

        return $this;
    }

    public function removeWidget(DashboardWidget $widget): self
    {
        if ($this->widgets->removeElement($widget)) {
            // set the owning side to null (unless already changed)
            if ($widget->getUser() === $this) {
                $widget->setUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, UserRelation>
     */
    public function getUserRelations(): Collection
    {
        return $this->userRelations;
    }

    public function addUserRelation(UserRelation $userRelation): self
    {
        if (!$this->userRelations->contains($userRelation)) {
            $this->userRelations->add($userRelation);
            $userRelation->setUser($this);
        }

        return $this;
    }

    public function removeUserRelation(UserRelation $userRelation): self
    {
        if ($this->userRelations->removeElement($userRelation)) {
            if ($userRelation->getUser() === $this) {
                $userRelation->setUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, PushSubscription>
     */
    public function getPushSubscriptions(): Collection
    {
        return $this->pushSubscriptions;
    }

    public function addPushSubscription(PushSubscription $subscription): self
    {
        if (!$this->pushSubscriptions->contains($subscription)) {
            $this->pushSubscriptions->add($subscription);
            $subscription->setUser($this);
        }

        return $this;
    }

    public function removePushSubscription(PushSubscription $subscription): self
    {
        if ($this->pushSubscriptions->removeElement($subscription)) {
            if ($subscription->getUser() === $this) {
                $subscription->setUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Video>
     */
    public function getCreatedVideos(): Collection
    {
        return $this->videosCreatedFrom;
    }

    public function addVideo(Video $video): static
    {
        if (!$this->videosCreatedFrom->contains($video)) {
            $this->videosCreatedFrom->add($video);
            $video->setCreatedFrom($this);
            $this->videosUpdatedFrom->add($video);
            $video->setUpdatedFrom($this);
        }

        return $this;
    }

    public function removeVideo(Video $video): static
    {
        if ($this->videosCreatedFrom->removeElement($video)) {
            // set the owning side to null (unless already changed)
            if ($video->getCreatedFrom() === $this) {
                $video->setCreatedFrom(null);
            }
            if ($video->getUpdatedFrom() === $this) {
                $video->setUpdatedFrom(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Video>
     */
    public function getUpdatedideos(): Collection
    {
        return $this->videosUpdatedFrom;
    }

    /**
     * @return Collection<int, VideoType>
     */
    public function getVideoTypesCreatedFrom(): Collection
    {
        return $this->videoTypesCreatedFrom;
    }

    public function addVideoTypeCreatedFrom(VideoType $videoType): static
    {
        if (!$this->videoTypesCreatedFrom->contains($videoType)) {
            $this->videoTypesCreatedFrom->add($videoType);
            $videoType->setCreatedFrom($this);
        }

        return $this;
    }

    public function removeVideoTypeCreatedFrom(VideoType $videoType): static
    {
        if ($this->videoTypesCreatedFrom->removeElement($videoType)) {
            // set the owning side to null (unless already changed)
            if ($videoType->getCreatedFrom() === $this) {
                $videoType->setCreatedFrom(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, VideoType>
     */
    public function getVideoTypesUpdatedFrom(): Collection
    {
        return $this->videoTypesUpdatedFrom;
    }

    public function addVideoTypeUpdatedFrom(VideoType $videoType): static
    {
        if (!$this->videoTypesUpdatedFrom->contains($videoType)) {
            $this->videoTypesUpdatedFrom->add($videoType);
            $videoType->setUpdatedFrom($this);
        }

        return $this;
    }

    public function removeVideoTypeUpdatedFrom(VideoType $videoType): static
    {
        if ($this->videoTypesUpdatedFrom->removeElement($videoType)) {
            // set the owning side to null (unless already changed)
            if ($videoType->getUpdatedFrom() === $this) {
                $videoType->setUpdatedFrom(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Camera>
     */
    public function getCamerasCreated(): Collection
    {
        return $this->camerasCreated;
    }

    public function addCamerasCreated(Camera $camerasCreated): static
    {
        if (!$this->camerasCreated->contains($camerasCreated)) {
            $this->camerasCreated->add($camerasCreated);
            $camerasCreated->setCreatedFrom($this);
        }

        return $this;
    }

    public function removeCamerasCreated(Camera $camerasCreated): static
    {
        if ($this->camerasCreated->removeElement($camerasCreated)) {
            // set the owning side to null (unless already changed)
            if ($camerasCreated->getCreatedFrom() === $this) {
                $camerasCreated->setCreatedFrom(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Camera>
     */
    public function getCamerasUpdated(): Collection
    {
        return $this->camerasUpdated;
    }

    public function addCamerasUpdated(Camera $camerasUpdated): static
    {
        if (!$this->camerasUpdated->contains($camerasUpdated)) {
            $this->camerasUpdated->add($camerasUpdated);
            $camerasUpdated->setUpdatedFrom($this);
        }

        return $this;
    }

    public function removeCamerasUpdated(Camera $camerasUpdated): static
    {
        if ($this->camerasUpdated->removeElement($camerasUpdated)) {
            // set the owning side to null (unless already changed)
            if ($camerasUpdated->getUpdatedFrom() === $this) {
                $camerasUpdated->setUpdatedFrom(null);
            }
        }

        return $this;
    }

    public function getAvatarFilename(): ?string
    {
        return $this->avatarFilename;
    }

    public function setAvatarFilename(?string $avatarFilename): self
    {
        $this->avatarFilename = $avatarFilename;

        return $this;
    }

    public function getGoogleAvatarUrl(): ?string
    {
        return $this->googleAvatarUrl;
    }

    public function setGoogleAvatarUrl(?string $googleAvatarUrl): self
    {
        $this->googleAvatarUrl = $googleAvatarUrl;

        return $this;
    }

    public function isUseGoogleAvatar(): bool
    {
        return $this->useGoogleAvatar;
    }

    public function setUseGoogleAvatar(bool $useGoogleAvatar): self
    {
        $this->useGoogleAvatar = $useGoogleAvatar;

        return $this;
    }

    public function getGoogleId(): ?string
    {
        return $this->googleId;
    }

    public function setGoogleId(?string $googleId): self
    {
        $this->googleId = $googleId;

        return $this;
    }

    /**
     * @return Collection<int, UserXpEvent>
     */
    public function getUserXpEvents(): Collection
    {
        return $this->userXpEvents;
    }

    /**
     * @param Collection<int, UserXpEvent> $userXpEvents
     */
    public function setUserXpEvents(Collection $userXpEvents): self
    {
        $this->userXpEvents = $userXpEvents;

        return $this;
    }

    public function addUserXpEvent(UserXpEvent $userXpEvent): self
    {
        if (!$this->userXpEvents->contains($userXpEvent)) {
            $this->userXpEvents->add($userXpEvent);
            $userXpEvent->setUser($this);
        }

        return $this;
    }

    public function removeUserXpEvent(UserXpEvent $userXpEvent): self
    {
        if ($this->userXpEvents->removeElement($userXpEvent)) {
            // set the owning side to null (unless already changed)
            if ($userXpEvent->getUser() === $this) {
                $userXpEvent->setUser(null);
            }
        }

        return $this;
    }

    public function getUserLevel(): ?UserLevel
    {
        return $this->userLevel;
    }

    public function setUserLevel(UserLevel $userLevel): self
    {
        $this->userLevel = $userLevel;

        return $this;
    }

    #[Deprecated]
    public function eraseCredentials(): void
    {
    }

    /**
     * @return Collection<int, VideoSegment>
     */
    public function getVideoSegments(): Collection
    {
        return $this->videoSegments;
    }

    public function addVideoSegment(VideoSegment $videoSegment): static
    {
        if (!$this->videoSegments->contains($videoSegment)) {
            $this->videoSegments->add($videoSegment);
            $videoSegment->setUser($this);
        }

        return $this;
    }

    public function removeVideoSegment(VideoSegment $videoSegment): static
    {
        if ($this->videoSegments->removeElement($videoSegment)) {
            // set the owning side to null (unless already changed)
            if ($videoSegment->getUser() === $this) {
                $videoSegment->setUser(null);
            }
        }

        return $this;
    }

    public function __toString(): string
    {
        return $this->getFullName();
    }
}
