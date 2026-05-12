<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\QuickEventConfig;
use App\Entity\User;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für die Entität QuickEventConfig.
 *
 * Prüft Konstruktor, Getter und setConfig().
 * Keine Datenbank notwendig — reine In-Memory-Tests.
 */
class QuickEventConfigTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        $this->user = $this->createStub(User::class);
    }

    // ── Konstruktor ────────────────────────────────────────────────────────

    public function testConstructorSetsUser(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $this->assertSame($this->user, $config->getUser());
    }

    public function testConstructorSetsConfig(): void
    {
        $data = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $config = new QuickEventConfig($this->user, $data);
        $this->assertSame($data, $config->getConfig());
    }

    public function testConstructorSetsEmptyConfig(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $this->assertSame([], $config->getConfig());
    }

    public function testConstructorSetsUpdatedAt(): void
    {
        $before = new DateTimeImmutable();
        $config = new QuickEventConfig($this->user, []);
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $config->getUpdatedAt());
        $this->assertLessThanOrEqual($after, $config->getUpdatedAt());
    }

    // ── getId ─────────────────────────────────────────────────────────────

    public function testGetIdReturnsNullBeforePersist(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $this->assertNull($config->getId());
    }

    // ── getConfig / setConfig ─────────────────────────────────────────────

    public function testSetConfigUpdatesConfig(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $newData = ['buttons' => [['eventTypeCode' => 'yellow_card', 'label' => 'Karte']]];

        $config->setConfig($newData);

        $this->assertSame($newData, $config->getConfig());
    }

    public function testSetConfigUpdatesUpdatedAt(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $original = $config->getUpdatedAt();

        // Kurze Pause sicherstellen: DateTimeImmutable hat Mikrosekunden-Präzision
        usleep(1000);
        $config->setConfig(['buttons' => []]);

        $this->assertGreaterThan($original, $config->getUpdatedAt());
    }

    public function testSetConfigReplacesOldConfig(): void
    {
        $initial = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $config = new QuickEventConfig($this->user, $initial);

        $replacement = ['buttons' => []];
        $config->setConfig($replacement);

        $this->assertSame($replacement, $config->getConfig());
    }

    // ── getUpdatedAt ──────────────────────────────────────────────────────

    public function testGetUpdatedAtReturnsDateTimeImmutable(): void
    {
        $config = new QuickEventConfig($this->user, []);
        $this->assertInstanceOf(DateTimeImmutable::class, $config->getUpdatedAt());
    }
}
