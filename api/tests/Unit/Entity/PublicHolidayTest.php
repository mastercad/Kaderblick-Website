<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\PublicHoliday;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PublicHolidayTest extends TestCase
{
    private function makeHoliday(
        int $year = 2026,
        string $stateCode = 'BY',
        string $name = 'Neujahr',
        ?DateTimeImmutable $date = null,
    ): PublicHoliday {
        return new PublicHoliday(
            $year,
            $stateCode,
            $name,
            $date ?? new DateTimeImmutable('2026-01-01'),
        );
    }

    // ── Constructor / Getters ─────────────────────────────────────────────────

    public function testGetYearReturnsConstructorValue(): void
    {
        $holiday = $this->makeHoliday(year: 2027);

        $this->assertSame(2027, $holiday->getYear());
    }

    public function testGetStateCodeReturnsConstructorValue(): void
    {
        $holiday = $this->makeHoliday(stateCode: 'NW');

        $this->assertSame('NW', $holiday->getStateCode());
    }

    public function testGetNameReturnsConstructorValue(): void
    {
        $holiday = $this->makeHoliday(name: 'Tag der Deutschen Einheit');

        $this->assertSame('Tag der Deutschen Einheit', $holiday->getName());
    }

    public function testGetDateReturnsConstructorValue(): void
    {
        $date = new DateTimeImmutable('2026-10-03');
        $holiday = $this->makeHoliday(date: $date);

        $this->assertSame($date, $holiday->getDate());
    }

    public function testGetDateFormatsCorrectly(): void
    {
        $date = new DateTimeImmutable('2026-12-25');
        $holiday = $this->makeHoliday(date: $date);

        $this->assertSame('2026-12-25', $holiday->getDate()->format('Y-m-d'));
    }

    // ── fetchedAt ─────────────────────────────────────────────────────────────

    public function testFetchedAtIsSetInConstructor(): void
    {
        $before = new DateTimeImmutable();
        $holiday = $this->makeHoliday();
        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual(
            $before->getTimestamp(),
            $holiday->getFetchedAt()->getTimestamp(),
        );
        $this->assertLessThanOrEqual(
            $after->getTimestamp(),
            $holiday->getFetchedAt()->getTimestamp(),
        );
    }

    public function testFetchedAtIsDateTimeImmutable(): void
    {
        $holiday = $this->makeHoliday();

        $this->assertInstanceOf(DateTimeImmutable::class, $holiday->getFetchedAt());
    }

    // ── NATIONAL state code ───────────────────────────────────────────────────

    public function testNationalStateCodeIsStored(): void
    {
        $holiday = $this->makeHoliday(stateCode: 'NATIONAL');

        $this->assertSame('NATIONAL', $holiday->getStateCode());
    }

    // ── All 16 Bundesland codes are stored as-is ──────────────────────────────

    #[DataProvider('bundeslandProvider')]
    public function testBundeslandCodeStoredCorrectly(string $code): void
    {
        $holiday = $this->makeHoliday(stateCode: $code);

        $this->assertSame($code, $holiday->getStateCode());
    }

    /** @return array<string, array{string}> */
    public static function bundeslandProvider(): array
    {
        return [
            'BW' => ['BW'], 'BY' => ['BY'], 'BE' => ['BE'], 'BB' => ['BB'],
            'HB' => ['HB'], 'HH' => ['HH'], 'HE' => ['HE'], 'MV' => ['MV'],
            'NI' => ['NI'], 'NW' => ['NW'], 'RP' => ['RP'], 'SL' => ['SL'],
            'SN' => ['SN'], 'ST' => ['ST'], 'SH' => ['SH'], 'TH' => ['TH'],
        ];
    }

    // ── Different years ───────────────────────────────────────────────────────

    public function testPastYearIsStored(): void
    {
        $holiday = $this->makeHoliday(year: 2000);

        $this->assertSame(2000, $holiday->getYear());
    }

    public function testFutureYearIsStored(): void
    {
        $holiday = $this->makeHoliday(year: 2099);

        $this->assertSame(2099, $holiday->getYear());
    }
}
