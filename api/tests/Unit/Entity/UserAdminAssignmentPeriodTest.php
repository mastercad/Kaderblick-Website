<?php

namespace App\Tests\Unit\Entity;

use App\Entity\UserClubAdminAssignment;
use App\Entity\UserTeamAdminAssignment;
use DateTimeImmutable;
use Generator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class UserAdminAssignmentPeriodTest extends TestCase
{
    #[DataProvider('periodProvider')]
    public function testTeamAssignmentValidity(?string $start, ?string $end, string $day, bool $expected): void
    {
        $assignment = (new UserTeamAdminAssignment())
            ->setStartDate(null === $start ? null : new DateTimeImmutable($start))
            ->setEndDate(null === $end ? null : new DateTimeImmutable($end));

        self::assertSame($expected, $assignment->isActiveOn(new DateTimeImmutable($day)));
    }

    #[DataProvider('periodProvider')]
    public function testClubAssignmentValidity(?string $start, ?string $end, string $day, bool $expected): void
    {
        $assignment = (new UserClubAdminAssignment())
            ->setStartDate(null === $start ? null : new DateTimeImmutable($start))
            ->setEndDate(null === $end ? null : new DateTimeImmutable($end));

        self::assertSame($expected, $assignment->isActiveOn(new DateTimeImmutable($day)));
    }

    public static function periodProvider(): Generator
    {
        yield 'unlimited' => [null, null, '2026-06-21', true];
        yield 'starts today' => ['2026-06-21', null, '2026-06-21', true];
        yield 'starts later' => ['2026-06-22', null, '2026-06-21', false];
        yield 'ends today' => [null, '2026-06-21', '2026-06-21', true];
        yield 'already ended' => [null, '2026-06-20', '2026-06-21', false];
        yield 'inside period' => ['2026-01-01', '2026-12-31', '2026-06-21', true];
    }
}
