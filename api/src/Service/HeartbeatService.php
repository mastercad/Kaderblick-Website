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
    private const TTL = 86400 * 7; // 7 Tage – überlebt Cache-Neustarts

    public function __construct(private readonly CacheInterface $cache)
    {
    }

    /**
     * Registriert eine erfolgreiche Ausführung des Cron-Jobs.
     * Überschreibt einen vorhandenen Eintrag (delete + get).
     */
    public function beat(string $commandName): void
    {
        $key = self::KEY_PREFIX . md5($commandName);
        $timestamp = time();

        $this->cache->delete($key);
        $this->cache->get($key, static function (ItemInterface $item) use ($timestamp): int {
            $item->expiresAfter(self::TTL);

            return $timestamp;
        });
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

        if ($isNew) {
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
}
