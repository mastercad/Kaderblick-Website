<?php

namespace App\Tests\Unit\Entity;

use App\Entity\Formation;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für die archive/unarchive-Logik der Formation-Entity.
 */
class FormationTest extends TestCase
{
    // ─── Standardzustand ──────────────────────────────────────────────────────

    public function testIsArchivedReturnsFalseByDefault(): void
    {
        $formation = new Formation();

        $this->assertFalse($formation->isArchived());
    }

    public function testGetArchivedAtReturnsNullByDefault(): void
    {
        $formation = new Formation();

        $this->assertNull($formation->getArchivedAt());
    }

    // ─── archive() ────────────────────────────────────────────────────────────

    public function testArchiveSetsArchivedAtToNow(): void
    {
        $before = new DateTimeImmutable();
        $formation = new Formation();
        $formation->archive();
        $after = new DateTimeImmutable();

        $archivedAt = $formation->getArchivedAt();
        $this->assertNotNull($archivedAt);
        $this->assertGreaterThanOrEqual($before, $archivedAt);
        $this->assertLessThanOrEqual($after, $archivedAt);
    }

    public function testArchiveSetsIsArchivedToTrue(): void
    {
        $formation = new Formation();
        $formation->archive();

        $this->assertTrue($formation->isArchived());
    }

    public function testArchiveReturnsSelf(): void
    {
        $formation = new Formation();
        $result = $formation->archive();

        $this->assertSame($formation, $result);
    }

    public function testArchiveStoresDateTimeImmutable(): void
    {
        $formation = new Formation();
        $formation->archive();

        $this->assertInstanceOf(DateTimeImmutable::class, $formation->getArchivedAt());
    }

    // ─── unarchive() ──────────────────────────────────────────────────────────

    public function testUnarchiveSetsArchivedAtToNull(): void
    {
        $formation = new Formation();
        $formation->archive();
        $formation->unarchive();

        $this->assertNull($formation->getArchivedAt());
    }

    public function testUnarchiveSetsIsArchivedToFalse(): void
    {
        $formation = new Formation();
        $formation->archive();
        $formation->unarchive();

        $this->assertFalse($formation->isArchived());
    }

    public function testUnarchiveReturnsSelf(): void
    {
        $formation = new Formation();
        $result = $formation->unarchive();

        $this->assertSame($formation, $result);
    }

    public function testUnarchiveOnFreshEntityLeavesArchivedAtNull(): void
    {
        $formation = new Formation();
        $formation->unarchive();

        $this->assertNull($formation->getArchivedAt());
        $this->assertFalse($formation->isArchived());
    }

    // ─── archive → unarchive Zyklus ───────────────────────────────────────────

    public function testArchiveThenUnarchiveIsIdempotent(): void
    {
        $formation = new Formation();

        $formation->archive();
        $this->assertTrue($formation->isArchived());

        $formation->unarchive();
        $this->assertFalse($formation->isArchived());
        $this->assertNull($formation->getArchivedAt());
    }

    public function testDoubleArchiveOverwritesPreviousTimestamp(): void
    {
        $formation = new Formation();

        $formation->archive();
        $first = $formation->getArchivedAt();

        // Kurz warten, damit die Timestamps sich unterscheiden können
        usleep(1000);
        $formation->archive();
        $second = $formation->getArchivedAt();

        $this->assertNotNull($first);
        $this->assertNotNull($second);
        // Zweiter Timestamp darf nicht kleiner als der erste sein
        $this->assertGreaterThanOrEqual($first, $second);
    }
}
