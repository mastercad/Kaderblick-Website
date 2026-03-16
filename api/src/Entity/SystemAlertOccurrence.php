<?php

namespace App\Entity;

use App\Enum\SystemAlertCategory;
use App\Repository\SystemAlertOccurrenceRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

/**
 * Jede einzelne Auslösung eines System-Alerts wird hier festgehalten.
 * Ermöglicht Zeitreihen-Auswertungen und Trend-Erkennung.
 */
#[ORM\Entity(repositoryClass: SystemAlertOccurrenceRepository::class)]
#[ORM\Table(name: 'system_alert_occurrences')]
#[ORM\Index(columns: ['occurred_at'], name: 'idx_sao_occurred_at')]
#[ORM\Index(columns: ['category'], name: 'idx_sao_category')]
class SystemAlertOccurrence
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    /** @phpstan-ignore-next-line */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: SystemAlert::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SystemAlert $alert;

    #[ORM\Column(type: 'string', length: 50, enumType: SystemAlertCategory::class)]
    private SystemAlertCategory $category;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $occurredAt;

    public function __construct(SystemAlert $alert)
    {
        $this->alert = $alert;
        $this->category = $alert->getCategory();
        $this->occurredAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAlert(): SystemAlert
    {
        return $this->alert;
    }

    public function getCategory(): SystemAlertCategory
    {
        return $this->category;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }
}
