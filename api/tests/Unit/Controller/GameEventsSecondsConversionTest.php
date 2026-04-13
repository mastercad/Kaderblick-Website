<?php

namespace App\Tests\Unit\Controller;

use App\Controller\GameEventsController;
use DateTime;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * Unit-Tests für die private Hilfsmethode
 * GameEventsController::convertUserInputToSeconds().
 *
 * Das Frontend sendet die Spielzeit als absolute Sekunden-Zahl
 * (z.B. "2820" für 45+2', "4020" für 67').
 * Der Controller konvertiert diesen Wert zu einem Offset in Sekunden,
 * der dann auf das Spielstart-Datum addiert wird.
 */
#[AllowMockObjectsWithoutExpectations]
class GameEventsSecondsConversionTest extends TestCase
{
    private GameEventsController $controller;

    private ReflectionMethod $method;

    protected function setUp(): void
    {
        // Controller ohne echte Abhängigkeiten – wir testen nur die private Methode
        $this->controller = $this->getMockBuilder(GameEventsController::class)
            ->disableOriginalConstructor()
            ->getMock();

        $reflection = new ReflectionClass(GameEventsController::class);
        $this->method = $reflection->getMethod('convertUserInputToSeconds');
        $this->method->setAccessible(true);
    }

    private function convert(string $input): int
    {
        // gameStartDate ist für reine Sekunden-Strings irrelevant
        return (int) $this->method->invoke($this->controller, $input, new DateTime('2025-01-01 14:00:00'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Reines Sekunden-Format (Frontend-Standardformat)
    // ─────────────────────────────────────────────────────────────────────────

    public function testPureSecondsZero(): void
    {
        $this->assertSame(0, $this->convert('0'));
    }

    public function testPureSecondsOneMinute(): void
    {
        // 1' → 60s
        $this->assertSame(60, $this->convert('60'));
    }

    public function testPureSecondsRegularMinute(): void
    {
        // 67' → 4020s
        $this->assertSame(4020, $this->convert('4020'));
    }

    public function testPureSecondsFirstHalfEnd(): void
    {
        // 45' → 2700s
        $this->assertSame(2700, $this->convert('2700'));
    }

    public function testPureSecondsFirstHalfStoppage(): void
    {
        // 45+2' → (45+2)*60 = 2820s
        $this->assertSame(2820, $this->convert('2820'));
    }

    public function testPureSecondsSecondHalfEnd(): void
    {
        // 90' → 5400s
        $this->assertSame(5400, $this->convert('5400'));
    }

    public function testPureSecondsSecondHalfStoppage(): void
    {
        // 90+3' → (90+3)*60 = 5580s
        $this->assertSame(5580, $this->convert('5580'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MM:SS-Format (Legacy / Direkteingabe)
    // ─────────────────────────────────────────────────────────────────────────

    public function testMmSsFormat(): void
    {
        // "45:00" → 45*60 + 0 = 2700s
        $this->assertSame(2700, $this->convert('45:00'));
    }

    public function testMmSsFormatWithSeconds(): void
    {
        // "67:30" → 67*60 + 30 = 4050s
        $this->assertSame(4050, $this->convert('67:30'));
    }
}
