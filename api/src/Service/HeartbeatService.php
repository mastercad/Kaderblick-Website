<?php

declare(strict_types=1);

namespace App\Service;

use DateTimeImmutable;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Tracking-Dienst für Cron-Job-Heartbeats.
 *
 * Jeder Cron-Job ruft beat() am Ende einer erfolgreichen Ausführung auf.
 * AppHealthMonitorCommand prüft mittels isFresh(), ob Jobs regelmäßig laufen.
 * Die Timestamps werden im Symfony-Cache mit 7-Tage-TTL gespeichert.
 */
class HeartbeatService
{
    private const KEY_PREFIX = 'cron_heartbeat_';
    private const ERROR_PREFIX = 'cron_error_';
    private const RUNNING_PREFIX = 'cron_running_';
    private const TTL = 86400 * 7; // 7 Tage – überlebt Cache-Neustarts
    private const RUNNING_TTL = 3600;      // 1 Stunde – Auto-Cleanup bei Hängern

    public function __construct(private readonly CacheInterface $cache)
    {
    }

    /**
     * Registriert eine erfolgreiche Ausführung des Cron-Jobs.
     * Löscht dabei einen vorhandenen Fehler-Eintrag und den Running-State.
     */
    public function beat(string $commandName): void
    {
        $hash = md5($commandName);
        $key = self::KEY_PREFIX . $hash;
        $errorKey = self::ERROR_PREFIX . $hash;
        $timestamp = time();

        $this->cache->delete($key);
        $this->cache->delete($errorKey);
        $this->cache->get($key, static function (ItemInterface $item) use ($timestamp): int {
            $item->expiresAfter(self::TTL);

            return $timestamp;
        });

        // Running-State sicherheitshalber löschen (falls clearRunning() nicht aufgerufen wurde)
        $this->clearRunning($commandName);
    }

    /**
     * Speichert die Fehlermeldung der letzten fehlgeschlagenen Ausführung.
     * Löscht auch den Running-State.
     */
    public function beatError(string $commandName, string $errorMessage): void
    {
        $key = self::ERROR_PREFIX . md5($commandName);
        $this->cache->delete($key);
        $this->cache->get($key, static function (ItemInterface $item) use ($errorMessage): string {
            $item->expiresAfter(self::TTL);

            return $errorMessage;
        });

        // Running-State sicherheitshalber löschen
        $this->clearRunning($commandName);
    }

    /**
     * Gibt die letzte gespeicherte Fehlermeldung zurück, oder null wenn keiner vorhanden.
     */
    public function getLastError(string $commandName): ?string
    {
        $key = self::ERROR_PREFIX . md5($commandName);
        $isNew = false;

        $error = $this->cache->get($key, static function (ItemInterface $item) use (&$isNew): string {
            $item->expiresAfter(1);
            $isNew = true;

            return '';
        });

        if ($isNew || '' === $error) {
            return null;
        }

        return $error;
    }

    /**
     * Gibt den Zeitpunkt der letzten erfolgreichen Ausführung zurück.
     * Null, wenn der Job noch nie gelaufen oder der Eintrag abgelaufen ist.
     */
    public function getLastBeat(string $commandName): ?DateTimeImmutable
    {
        $key = self::KEY_PREFIX . md5($commandName);
        $isNew = false;

        $timestamp = $this->cache->get($key, static function (ItemInterface $item) use (&$isNew): int {
            $item->expiresAfter(1); // sofort ablaufen lassen – kein dauerhaftes Caching
            $isNew = true;

            return 0;
        });

        if ($isNew || 0 === (int) $timestamp) {
            return null;
        }

        return (new DateTimeImmutable())->setTimestamp((int) $timestamp);
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
        $key = self::RUNNING_PREFIX . md5($commandName);
        $data = ['pid' => $pid, 'startedAt' => time()];

        $this->cache->delete($key);
        $this->cache->get($key, static function (ItemInterface $item) use ($data): array {
            $item->expiresAfter(self::RUNNING_TTL);

            return $data;
        });
    }

    /**
     * Löscht den Running-State eines Cron-Jobs.
     * Wird vom AbstractCronCommand im finally-Block und von beat()/beatError() aufgerufen.
     */
    public function clearRunning(string $commandName): void
    {
        $this->cache->delete(self::RUNNING_PREFIX . md5($commandName));
    }

    /**
     * Gibt den Running-State zurück, wenn der Prozess noch aktiv ist.
     * Bereinigt veraltete Cache-Einträge automatisch (z. B. nach Container-Neustart).
     *
     * @return array{pid: int, startedAt: int}|null
     */
    public function getRunningState(string $commandName): ?array
    {
        $key = self::RUNNING_PREFIX . md5($commandName);
        $isNew = false;

        /** @var array{pid: int, startedAt: int}|array{} $info */
        $info = $this->cache->get($key, static function (ItemInterface $item) use (&$isNew): array {
            $item->expiresAfter(1);
            $isNew = true;

            return [];
        });

        if ($isNew || [] === $info) {
            return null;
        }

        // Prüfen, ob der Prozess noch lebt (Signal 0 = nur Existenz-Check, kein echtes Signal)
        // pid_t ist ein vorzeichenbehafteter 32-Bit-Integer; größere Werte würden bei der
        // C-Übergabe überlaufen (PHP_INT_MAX → -1 → kill(-1,0) gibt true zurück).
        $pid = $info['pid'];
        if ($pid <= 0 || $pid > 2_147_483_647 || !function_exists('posix_kill') || !posix_kill($pid, 0)) {
            $this->cache->delete($key);

            return null;
        }

        return $info;
    }
}
