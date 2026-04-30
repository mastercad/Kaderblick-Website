<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\CronHeartbeatRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Tracking-Dienst für Cron-Job-Heartbeats.
 *
 * Jeder Cron-Job ruft beat() am Ende einer erfolgreichen Ausführung auf.
 * AppHealthMonitorCommand prüft mittels isFresh(), ob Jobs regelmäßig laufen.
 *
 * Die Daten werden in der Tabelle `cron_heartbeats` persistiert und überleben
 * Deployments, Cache-Clears und Container-Neustarts zuverlässig.
 */
class HeartbeatService
{
    public function __construct(
        private readonly CronHeartbeatRepository $repository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Registriert eine erfolgreiche Ausführung des Cron-Jobs.
     * Löscht dabei einen vorhandenen Fehler-Eintrag und den Running-State.
     */
    public function beat(string $commandName): void
    {
        $entry = $this->repository->findOrCreate($commandName);
        $entry->setLastRunAt(new DateTimeImmutable());
        $entry->setLastError(null);
        $entry->setRunningPid(null);
        $entry->setRunningStartedAt(null);
        $this->em->flush();
    }

    /**
     * Speichert die Fehlermeldung der letzten fehlgeschlagenen Ausführung.
     * Löscht auch den Running-State.
     */
    public function beatError(string $commandName, string $errorMessage): void
    {
        $entry = $this->repository->findOrCreate($commandName);
        $entry->setLastError($errorMessage);
        $entry->setRunningPid(null);
        $entry->setRunningStartedAt(null);
        $this->em->flush();
    }

    /**
     * Gibt die letzte gespeicherte Fehlermeldung zurück, oder null wenn keiner vorhanden.
     */
    public function getLastError(string $commandName): ?string
    {
        return $this->repository->findByCommand($commandName)?->getLastError();
    }

    /**
     * Gibt den Zeitpunkt der letzten erfolgreichen Ausführung zurück.
     * Null, wenn der Job noch nie gelaufen ist.
     */
    public function getLastBeat(string $commandName): ?DateTimeImmutable
    {
        return $this->repository->findByCommand($commandName)?->getLastRunAt();
    }

    /**
     * Gibt true zurück, wenn der Job innerhalb der letzten $maxAgeMinutes Minuten gelaufen ist.
     */
    public function isFresh(string $commandName, int $maxAgeMinutes): bool
    {
        $last = $this->getLastBeat($commandName);

        if (null === $last) {
            return false;
        }

        $ageSeconds = time() - $last->getTimestamp();

        return $ageSeconds <= $maxAgeMinutes * 60;
    }

    // ─── Running-State ────────────────────────────────────────────────────────

    /**
     * Markiert einen Cron-Job als aktuell laufend und speichert seine PID.
     */
    public function setRunning(string $commandName, int $pid): void
    {
        $entry = $this->repository->findOrCreate($commandName);
        $entry->setRunningPid($pid);
        $entry->setRunningStartedAt(time());
        $this->em->flush();
    }

    /**
     * Löscht den Running-State eines Cron-Jobs.
     * Wird vom AbstractCronCommand im finally-Block und von beat()/beatError() aufgerufen.
     */
    public function clearRunning(string $commandName): void
    {
        $entry = $this->repository->findByCommand($commandName);

        if (null === $entry) {
            return;
        }

        $entry->setRunningPid(null);
        $entry->setRunningStartedAt(null);
        $this->em->flush();
    }

    /**
     * Gibt den Running-State zurück, wenn der Prozess noch aktiv ist.
     * Bereinigt veraltete Einträge automatisch (z. B. nach Container-Neustart).
     *
     * @return array{pid: int, startedAt: int}|null
     */
    public function getRunningState(string $commandName): ?array
    {
        $entry = $this->repository->findByCommand($commandName);

        if (null === $entry || null === $entry->getRunningPid()) {
            return null;
        }

        $pid = $entry->getRunningPid();
        $startedAt = $entry->getRunningStartedAt() ?? 0;

        // Prüfen, ob der Prozess noch lebt (Signal 0 = nur Existenz-Check, kein echtes Signal)
        // pid_t ist ein vorzeichenbehafteter 32-Bit-Integer; größere Werte würden bei der
        // C-Übergabe überlaufen (PHP_INT_MAX → -1 → kill(-1,0) gibt true zurück).
        if ($pid <= 0 || $pid > 2_147_483_647 || !function_exists('posix_kill') || !posix_kill($pid, 0)) {
            $entry->setRunningPid(null);
            $entry->setRunningStartedAt(null);
            $this->em->flush();

            return null;
        }

        return ['pid' => $pid, 'startedAt' => $startedAt];
    }
}
