<?php

namespace App\Tests\Unit\Entity;

use App\Entity\Club;
use App\Entity\TacticPreset;
use App\Entity\User;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class TacticPresetTest extends TestCase
{
    // -----------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------

    public function testConstructorInitializesCreatedAt(): void
    {
        $before = new DateTimeImmutable();
        $preset = new TacticPreset();
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $preset->getCreatedAt());
        $this->assertLessThanOrEqual($after, $preset->getCreatedAt());
    }

    public function testDefaultIdIsNull(): void
    {
        $preset = new TacticPreset();
        // Before Doctrine assigns an id it must be null
        $this->assertNull($preset->getId());
    }

    public function testDefaultIsSystemIsFalse(): void
    {
        $preset = new TacticPreset();
        $this->assertFalse($preset->isSystem());
    }

    public function testDefaultDataIsEmptyArray(): void
    {
        $preset = new TacticPreset();
        $this->assertSame([], $preset->getData());
    }

    public function testDefaultClubIsNull(): void
    {
        $preset = new TacticPreset();
        $this->assertNull($preset->getClub());
    }

    public function testDefaultCreatedByIsNull(): void
    {
        $preset = new TacticPreset();
        $this->assertNull($preset->getCreatedBy());
    }

    // -----------------------------------------------------------------
    // Fluent setters
    // -----------------------------------------------------------------

    public function testSetTitleReturnsSelf(): void
    {
        $preset = new TacticPreset();
        $result = $preset->setTitle('Gegenpressing');

        $this->assertSame($preset, $result);
        $this->assertSame('Gegenpressing', $preset->getTitle());
    }

    public function testSetCategoryReturnsSelf(): void
    {
        $preset = new TacticPreset();
        $result = $preset->setCategory(TacticPreset::CATEGORY_PRESSING);

        $this->assertSame($preset, $result);
        $this->assertSame(TacticPreset::CATEGORY_PRESSING, $preset->getCategory());
    }

    public function testSetDescriptionReturnsSelf(): void
    {
        $preset = new TacticPreset();
        $result = $preset->setDescription('Eine Beschreibung');

        $this->assertSame($preset, $result);
        $this->assertSame('Eine Beschreibung', $preset->getDescription());
    }

    public function testSetIsSystemReturnsSelf(): void
    {
        $preset = new TacticPreset();
        $result = $preset->setIsSystem(true);

        $this->assertSame($preset, $result);
        $this->assertTrue($preset->isSystem());
    }

    public function testSetDataReturnsSelf(): void
    {
        $data = ['name' => 'Test', 'elements' => [], 'opponents' => []];
        $preset = new TacticPreset();
        $result = $preset->setData($data);

        $this->assertSame($preset, $result);
        $this->assertSame($data, $preset->getData());
    }

    public function testSetClubReturnsSelf(): void
    {
        $club = $this->createMock(Club::class);
        $preset = new TacticPreset();
        $result = $preset->setClub($club);

        $this->assertSame($preset, $result);
        $this->assertSame($club, $preset->getClub());
    }

    public function testSetClubAcceptsNull(): void
    {
        $preset = new TacticPreset();
        $preset->setClub($this->createMock(Club::class));
        $preset->setClub(null);

        $this->assertNull($preset->getClub());
    }

    public function testSetCreatedByReturnsSelf(): void
    {
        $user = $this->createMock(User::class);
        $preset = new TacticPreset();
        $result = $preset->setCreatedBy($user);

        $this->assertSame($preset, $result);
        $this->assertSame($user, $preset->getCreatedBy());
    }

    // -----------------------------------------------------------------
    // Category constants
    // -----------------------------------------------------------------

    public function testAllCategoriesAreUnique(): void
    {
        $unique = array_unique(TacticPreset::CATEGORIES);
        $this->assertCount(count(TacticPreset::CATEGORIES), $unique);
    }

    public function testCategoriesContainsAllConstantValues(): void
    {
        $this->assertContains(TacticPreset::CATEGORY_PRESSING, TacticPreset::CATEGORIES);
        $this->assertContains(TacticPreset::CATEGORY_ATTACK, TacticPreset::CATEGORIES);
        $this->assertContains(TacticPreset::CATEGORY_STANDARDS, TacticPreset::CATEGORIES);
        $this->assertContains(TacticPreset::CATEGORY_BUILD_UP, TacticPreset::CATEGORIES);
        $this->assertContains(TacticPreset::CATEGORY_DEFENSIVE, TacticPreset::CATEGORIES);
    }

    // -----------------------------------------------------------------
    // toArray – structure
    // -----------------------------------------------------------------

    private function buildFullPreset(): TacticPreset
    {
        $preset = new TacticPreset();
        $preset->setTitle('Testvorlage');
        $preset->setCategory(TacticPreset::CATEGORY_ATTACK);
        $preset->setDescription('Eine Testbeschreibung');
        $preset->setData(['name' => 'Testvorlage', 'elements' => [], 'opponents' => []]);

        return $preset;
    }

    public function testToArrayContainsRequiredKeys(): void
    {
        $preset = $this->buildFullPreset();
        $arr = $preset->toArray(null);

        foreach (['id', 'title', 'category', 'description', 'isSystem', 'clubId', 'createdBy', 'canDelete', 'data', 'createdAt'] as $key) {
            $this->assertArrayHasKey($key, $arr, "Key '$key' missing from toArray()");
        }
    }

    public function testToArrayReturnsCorrectTitle(): void
    {
        $preset = $this->buildFullPreset();
        $this->assertSame('Testvorlage', $preset->toArray(null)['title']);
    }

    public function testToArrayReturnsIsSystemFalseByDefault(): void
    {
        $preset = $this->buildFullPreset();
        $this->assertFalse($preset->toArray(null)['isSystem']);
    }

    public function testToArrayReturnsIsSystemTrueWhenSet(): void
    {
        $preset = $this->buildFullPreset();
        $preset->setIsSystem(true);

        $this->assertTrue($preset->toArray(null)['isSystem']);
    }

    public function testToArrayReturnsNullClubIdWhenNoClub(): void
    {
        $preset = $this->buildFullPreset();
        $this->assertNull($preset->toArray(null)['clubId']);
    }

    public function testToArrayReturnsClubId(): void
    {
        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn(7);

        $preset = $this->buildFullPreset();
        $preset->setClub($club);

        $this->assertSame(7, $preset->toArray(null)['clubId']);
    }

    public function testToArrayCreatedAtIsAtomFormat(): void
    {
        $preset = $this->buildFullPreset();
        $createdAt = $preset->toArray(null)['createdAt'];

        // ATOM format: 2026-03-14T10:00:00+00:00
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/',
            $createdAt
        );
    }

    // -----------------------------------------------------------------
    // toArray – canDelete logic
    // -----------------------------------------------------------------

    public function testToArrayCanDeleteFalseWhenRequestingUserIsNull(): void
    {
        $preset = $this->buildFullPreset();
        $this->assertFalse($preset->toArray(null)['canDelete']);
    }

    public function testToArrayCanDeleteFalseForSystemPreset(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);

        $preset = $this->buildFullPreset();
        $preset->setIsSystem(true);
        $preset->setCreatedBy($user);

        $this->assertFalse($preset->toArray($user)['canDelete']);
    }

    public function testToArrayCanDeleteFalseWhenCreatedByOtherUser(): void
    {
        $creator = $this->createMock(User::class);
        $creator->method('getId')->willReturn(1);

        $requestor = $this->createMock(User::class);
        $requestor->method('getId')->willReturn(2);

        $preset = $this->buildFullPreset();
        $preset->setCreatedBy($creator);

        $this->assertFalse($preset->toArray($requestor)['canDelete']);
    }

    public function testToArrayCanDeleteTrueWhenCreatorRequests(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);

        $preset = $this->buildFullPreset();
        $preset->setCreatedBy($user);

        $this->assertTrue($preset->toArray($user)['canDelete']);
    }

    public function testToArrayCanDeleteFalseWhenCreatedByIsNull(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);

        $preset = $this->buildFullPreset();
        // createdBy is null by default → preset has no owner → cannot be deleted

        $this->assertFalse($preset->toArray($user)['canDelete']);
    }

    public function testToArrayCreatedByNullForSystemPreset(): void
    {
        $preset = $this->buildFullPreset();
        $preset->setIsSystem(true);

        $this->assertNull($preset->toArray(null)['createdBy']);
    }

    public function testToArrayCreatedByNameForPersonalPreset(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getFirstName')->willReturn('Max');
        $user->method('getLastName')->willReturn('Mustermann');
        $user->method('getId')->willReturn(1);

        $preset = $this->buildFullPreset();
        $preset->setCreatedBy($user);

        $this->assertSame('Max Mustermann', $preset->toArray($user)['createdBy']);
    }
}
