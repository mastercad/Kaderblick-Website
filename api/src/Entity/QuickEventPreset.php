<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\QuickEventPresetRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: QuickEventPresetRepository::class)]
#[ORM\Table(name: 'quick_event_presets')]
class QuickEventPreset
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 120)]
    private string $name;

    /**
     * JSON-Array mit der Button-Konfiguration der Fernbedienung.
     *
     * @var array<string, mixed>
     */
    #[ORM\Column(type: 'json')]
    private array $config = [];

    #[ORM\Column(name: 'is_active', type: 'boolean')]
    private bool $isActive = false;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'owner_id', nullable: false, onDelete: 'CASCADE')]
    private User $owner;

    /**
     * Benutzer, mit denen dieses Preset geteilt wurde.
     *
     * @var Collection<int, User>
     */
    #[ORM\ManyToMany(targetEntity: User::class)]
    #[ORM\JoinTable(
        name: 'quick_event_preset_shares',
        joinColumns: [new ORM\JoinColumn(name: 'preset_id', referencedColumnName: 'id', onDelete: 'CASCADE')],
        inverseJoinColumns: [new ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    )]
    private Collection $sharedWith;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private DateTimeImmutable $updatedAt;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(User $owner, string $name, array $config)
    {
        $this->owner = $owner;
        $this->name = $name;
        $this->config = $config;
        $this->isActive = false;
        $this->sharedWith = new ArrayCollection();
        $this->createdAt = new DateTimeImmutable();
        $this->updatedAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
        $this->updatedAt = new DateTimeImmutable();
    }

    /**
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        return $this->config;
    }

    /**
     * @param array<string, mixed> $config
     */
    public function setConfig(array $config): void
    {
        $this->config = $config;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setActive(bool $active): void
    {
        $this->isActive = $active;
    }

    /**
     * @return Collection<int, User>
     */
    public function getSharedWith(): Collection
    {
        return $this->sharedWith;
    }

    public function addSharedWith(User $user): void
    {
        if (!$this->sharedWith->contains($user)) {
            $this->sharedWith->add($user);
        }
    }

    public function removeSharedWith(User $user): void
    {
        $this->sharedWith->removeElement($user);
    }

    public function clearSharedWith(): void
    {
        $this->sharedWith->clear();
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'config' => $this->config,
            'isActive' => $this->isActive,
            'ownerId' => $this->owner->getId(),
            'sharedWithUserIds' => $this->sharedWith->map(static fn (User $u) => $u->getId())->toArray(),
            'createdAt' => $this->createdAt->format(DateTimeInterface::ATOM),
            'updatedAt' => $this->updatedAt->format(DateTimeInterface::ATOM),
        ];
    }
}
