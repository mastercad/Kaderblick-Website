<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\PosterTemplateRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

/**
 * Eine Poster-Vorlage, die im Admin-Bereich über den visuellen Editor erstellt wird.
 *
 * background und elements werden als JSON gespeichert:
 *   background: { type: 'solid'|'gradient'|'image', color?, gradientColors?, gradientAngle?, imageUrl?, overlayColor?, overlayOpacity? }
 *   elements:   Array<PosterElement>  (position in %, Schrift, Animation, Typ, Platzhalter/Text)
 */
#[ORM\Entity(repositoryClass: PosterTemplateRepository::class)]
#[ORM\Table(name: 'poster_templates')]
#[ORM\HasLifecycleCallbacks]
class PosterTemplate
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private int $id;

    #[ORM\Column(type: 'string', length: 255)]
    private string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    /**
     * Typ des Posters: game_announcement | game_result | event_announcement | player_highlight | universal
     */
    #[ORM\Column(type: 'string', length: 50)]
    private string $posterType = 'universal';

    /**
     * Welche Formate diese Vorlage unterstützt: ['1:1', '9:16', '16:9']
     */
    #[ORM\Column(type: 'json')]
    private array $supportedFormats = ['1:1'];

    /**
     * Hintergrunddefinition als JSON.
     */
    #[ORM\Column(type: 'json')]
    private array $background = ['type' => 'solid', 'color' => '#111111'];

    /**
     * Array von PosterElement-Objekten als JSON.
     */
    #[ORM\Column(type: 'json')]
    private array $elements = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
        $this->updatedAt = new DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new DateTimeImmutable();
    }

    public function getId(): int
    {
        return $this->id;
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

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function getPosterType(): string
    {
        return $this->posterType;
    }

    public function setPosterType(string $posterType): self
    {
        $this->posterType = $posterType;

        return $this;
    }

    public function getSupportedFormats(): array
    {
        return $this->supportedFormats;
    }

    public function setSupportedFormats(array $supportedFormats): self
    {
        $this->supportedFormats = $supportedFormats;

        return $this;
    }

    public function getBackground(): array
    {
        return $this->background;
    }

    public function setBackground(array $background): self
    {
        $this->background = $background;

        return $this;
    }

    public function getElements(): array
    {
        return $this->elements;
    }

    public function setElements(array $elements): self
    {
        $this->elements = $elements;

        return $this;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function toArray(): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'description'      => $this->description,
            'posterType'       => $this->posterType,
            'supportedFormats' => $this->supportedFormats,
            'background'       => $this->background,
            'elements'         => $this->elements,
            'createdAt'        => $this->createdAt->format('c'),
            'updatedAt'        => $this->updatedAt->format('c'),
        ];
    }
}
