<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\CronHeartbeatRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CronHeartbeatRepository::class)]
#[ORM\Table(name: 'cron_heartbeats')]
#[ORM\Index(columns: ['command'], name: 'idx_cron_heartbeats_command')]
class CronHeartbeat
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    /** @phpstan-ignore-next-line */
    private ?int $id = null;

    /** Vollständiger Symfony-Befehlsname, z. B. "app:notifications:push" */
    #[ORM\Column(type: 'string', length: 255, unique: true)]
    private string $command;

    /** Zeitpunkt des letzten erfolgreichen Laufs */
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $lastRunAt = null;

    /** Fehlermeldung des letzten fehlgeschlagenen Laufs; null = kein Fehler */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastError = null;

    /** PID des aktuell laufenden Prozesses; null = nicht laufend */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $runningPid = null;

    /** Unix-Timestamp, wann der laufende Prozess gestartet wurde */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $runningStartedAt = null;

    public function __construct(string $command)
    {
        $this->command = $command;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCommand(): string
    {
        return $this->command;
    }

    public function getLastRunAt(): ?DateTimeImmutable
    {
        return $this->lastRunAt;
    }

    public function setLastRunAt(?DateTimeImmutable $lastRunAt): static
    {
        $this->lastRunAt = $lastRunAt;

        return $this;
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    public function setLastError(?string $lastError): static
    {
        $this->lastError = $lastError;

        return $this;
    }

    public function getRunningPid(): ?int
    {
        return $this->runningPid;
    }

    public function setRunningPid(?int $pid): static
    {
        $this->runningPid = $pid;

        return $this;
    }

    public function getRunningStartedAt(): ?int
    {
        return $this->runningStartedAt;
    }

    public function setRunningStartedAt(?int $startedAt): static
    {
        $this->runningStartedAt = $startedAt;

        return $this;
    }

    public function isRunning(): bool
    {
        return null !== $this->runningPid;
    }
}
