<?php

namespace App\Tests\Unit\Service;

use App\Service\PlayerDocumentOcrService;
use PHPUnit\Framework\TestCase;

class PlayerDocumentOcrServiceTest extends TestCase
{
    public function testDetectsMedicalDocumentAndDates(): void
    {
        $service = new PlayerDocumentOcrService();
        self::assertSame('medical', $service->detectCategory('Ärztliches Attest für den Trainingsbetrieb'));
        [$issued, $expires] = $service->detectDates('Ausgestellt: 12.06.2026 – gültig bis: 30.06.2027');
        self::assertSame('2026-06-12', $issued?->format('Y-m-d'));
        self::assertSame('2027-06-30', $expires?->format('Y-m-d'));
    }

    public function testUnknownTextFallsBackToOther(): void
    {
        self::assertSame('other', (new PlayerDocumentOcrService())->detectCategory('Allgemeine Notiz ohne Schlüsselwörter'));
    }
}
