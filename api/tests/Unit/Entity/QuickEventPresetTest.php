<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\QuickEventPreset;
use App\Entity\User;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für die Entität QuickEventPreset.
 *
 * Prüft Konstruktor, Getter/Setter, Sharing-Methoden und toArray().
 * Keine Datenbank notwendig — reine In-Memory-Tests.
 */
class QuickEventPresetTest extends TestCase
{
    private User $owner;

    protected function setUp(): void
    {
        $this->owner = $this->createStub(User::class);
    }

    // ── Konstruktor ────────────────────────────────────────────────────────

    public function testConstructorSetsOwner(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Mein Preset', []);
        $this->assertSame($this->owner, $preset->getOwner());
    }

    public function testConstructorSetsName(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Torschuss', []);
        $this->assertSame('Torschuss', $preset->getName());
    }

    public function testConstructorSetsConfig(): void
    {
        $config = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $preset = new QuickEventPreset($this->owner, 'Preset', $config);
        $this->assertSame($config, $preset->getConfig());
    }

    public function testConstructorSetsEmptyConfig(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertSame([], $preset->getConfig());
    }

    public function testConstructorSetsIsActiveFalse(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertFalse($preset->isActive());
    }

    public function testConstructorInitializesEmptySharedWith(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertCount(0, $preset->getSharedWith());
    }

    public function testConstructorSetsCreatedAt(): void
    {
        $before = new DateTimeImmutable();
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $preset->getCreatedAt());
        $this->assertLessThanOrEqual($after, $preset->getCreatedAt());
    }

    public function testConstructorSetsUpdatedAt(): void
    {
        $before = new DateTimeImmutable();
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $preset->getUpdatedAt());
        $this->assertLessThanOrEqual($after, $preset->getUpdatedAt());
    }

    // ── getId ─────────────────────────────────────────────────────────────

    public function testGetIdReturnsNullBeforePersist(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertNull($preset->getId());
    }

    // ── getName / setName ─────────────────────────────────────────────────

    public function testSetNameUpdatesName(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Alt', []);
        $preset->setName('Neu');
        $this->assertSame('Neu', $preset->getName());
    }

    public function testSetNameUpdatesUpdatedAt(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Alt', []);
        $original = $preset->getUpdatedAt();

        usleep(1000);
        $preset->setName('Neu');

        $this->assertGreaterThan($original, $preset->getUpdatedAt());
    }

    // ── getConfig / setConfig ─────────────────────────────────────────────

    public function testSetConfigUpdatesConfig(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $newConfig = ['buttons' => [['eventTypeCode' => 'foul', 'label' => 'Foul']]];
        $preset->setConfig($newConfig);
        $this->assertSame($newConfig, $preset->getConfig());
    }

    public function testSetConfigUpdatesUpdatedAt(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $original = $preset->getUpdatedAt();

        usleep(1000);
        $preset->setConfig(['buttons' => []]);

        $this->assertGreaterThan($original, $preset->getUpdatedAt());
    }

    public function testSetConfigReplacesOldConfig(): void
    {
        $initial = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $preset = new QuickEventPreset($this->owner, 'Preset', $initial);

        $replacement = ['buttons' => []];
        $preset->setConfig($replacement);

        $this->assertSame($replacement, $preset->getConfig());
    }

    // ── isActive / setActive ──────────────────────────────────────────────

    public function testSetActiveTrue(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $preset->setActive(true);
        $this->assertTrue($preset->isActive());
    }

    public function testSetActiveFalseAfterTrue(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $preset->setActive(true);
        $preset->setActive(false);
        $this->assertFalse($preset->isActive());
    }

    // ── sharedWith ────────────────────────────────────────────────────────

    public function testAddSharedWithAddsUser(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $user = $this->createStub(User::class);

        $preset->addSharedWith($user);

        $this->assertCount(1, $preset->getSharedWith());
        $this->assertTrue($preset->getSharedWith()->contains($user));
    }

    public function testAddSharedWithDoesNotAddDuplicate(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $user = $this->createStub(User::class);

        $preset->addSharedWith($user);
        $preset->addSharedWith($user);

        $this->assertCount(1, $preset->getSharedWith());
    }

    public function testRemoveSharedWithRemovesUser(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $user = $this->createStub(User::class);

        $preset->addSharedWith($user);
        $preset->removeSharedWith($user);

        $this->assertCount(0, $preset->getSharedWith());
    }

    public function testRemoveSharedWithOnNonExistingUserDoesNotFail(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $user = $this->createStub(User::class);

        // Should not throw
        $preset->removeSharedWith($user);
        $this->assertCount(0, $preset->getSharedWith());
    }

    public function testClearSharedWithRemovesAll(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $preset->addSharedWith($this->createStub(User::class));
        $preset->addSharedWith($this->createStub(User::class));

        $preset->clearSharedWith();

        $this->assertCount(0, $preset->getSharedWith());
    }

    public function testAddMultipleSharedWithUsers(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $userA = $this->createStub(User::class);
        $userB = $this->createStub(User::class);

        $preset->addSharedWith($userA);
        $preset->addSharedWith($userB);

        $this->assertCount(2, $preset->getSharedWith());
    }

    // ── toArray ───────────────────────────────────────────────────────────

    public function testToArrayContainsExpectedKeys(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Test', []);
        $array = $preset->toArray();

        foreach (['id', 'name', 'config', 'isActive', 'ownerId', 'sharedWithUserIds', 'createdAt', 'updatedAt'] as $key) {
            $this->assertArrayHasKey($key, $array, "Key '{$key}' missing from toArray()");
        }
    }

    public function testToArrayName(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Mein Preset', []);
        $this->assertSame('Mein Preset', $preset->toArray()['name']);
    }

    public function testToArrayConfig(): void
    {
        $config = ['buttons' => [['eventTypeCode' => 'goal']]];
        $preset = new QuickEventPreset($this->owner, 'Preset', $config);
        $this->assertSame($config, $preset->toArray()['config']);
    }

    public function testToArrayIsActiveDefaultFalse(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertFalse($preset->toArray()['isActive']);
    }

    public function testToArraySharedWithUserIdsEmptyByDefault(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertSame([], $preset->toArray()['sharedWithUserIds']);
    }

    public function testToArraySharedWithUserIdsContainsSharedUserId(): void
    {
        $sharedUser = $this->createStub(User::class);
        $sharedUser->method('getId')->willReturn(42);

        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $preset->addSharedWith($sharedUser);

        $array = $preset->toArray();
        $this->assertContains(42, $array['sharedWithUserIds']);
    }

    public function testToArrayOwnerIdComesFromOwner(): void
    {
        $owner = $this->createStub(User::class);
        $owner->method('getId')->willReturn(7);

        $preset = new QuickEventPreset($owner, 'Preset', []);
        $this->assertSame(7, $preset->toArray()['ownerId']);
    }

    public function testToArrayCreatedAtIsAtomString(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $createdAt = $preset->toArray()['createdAt'];

        $this->assertIsString($createdAt);
        // DateTimeInterface::ATOM format: 2026-05-12T09:00:00+00:00
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]/', $createdAt);
    }

    // ── getCreatedAt / getUpdatedAt ───────────────────────────────────────

    public function testGetCreatedAtReturnsDateTimeImmutable(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertInstanceOf(DateTimeImmutable::class, $preset->getCreatedAt());
    }

    public function testGetUpdatedAtReturnsDateTimeImmutable(): void
    {
        $preset = new QuickEventPreset($this->owner, 'Preset', []);
        $this->assertInstanceOf(DateTimeImmutable::class, $preset->getUpdatedAt());
    }
}
