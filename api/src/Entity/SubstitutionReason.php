<?php

namespace App\Entity;

use App\Repository\SubstitutionReasonRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * tactical             Taktische Gründe (z. B. Systemwechsel, Zeitspiel, frischer Spieler)
 * injury               Spieler verletzt sich oder ist angeschlagen
 * performance          Schlechte Leistung, zu viele Fehler
 * resting / rotation   Schonung für andere Spiele
 * card_risk            Risiko auf Gelb-Rot oder Platzverweis
 * debut                Einwechslung für einen Jugend-/Debütspieler
 * comeback             Rückkehr nach Verletzung
 * time_wasting         Auswechslung in der Nachspielzeit zum Zeitspiel
 * fan_favor / farewell Spieler bekommt Applaus beim Abschied.
 */
#[ORM\Entity(repositoryClass: SubstitutionReasonRepository::class)]
#[ORM\Table(name: 'substitution_reasons')]
class SubstitutionReason
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['substitution_reason:read', 'substitution_reason:write', 'game:read', 'game_event:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[Groups(['substitution_reason:read', 'substitution_reason:write', 'game:read', 'game_event:read'])]
    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'boolean')]
    private bool $active = true;

    public function getId(): ?int
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

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): self
    {
        $this->active = $active;

        return $this;
    }

    public function __toString()
    {
        return $this->name ?? 'UNKNOWN SUSTITUTION REASON';
    }
}
