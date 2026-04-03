<?php

namespace App\Tests\Unit\Controller;

use App\Controller\NewsController;
use PHPUnit\Framework\TestCase;

/**
 * Tests für NewsController::buildNotificationPreview().
 *
 * Die Methode wandelt HTML-News-Inhalte in einen sauberen Klartextausschnitt
 * für Push-Benachrichtigungen um.
 */
class NewsControllerPreviewTest extends TestCase
{
    // ──────────────────────────────────────────────────────────────────────
    //  Hilfsmethode
    // ──────────────────────────────────────────────────────────────────────

    private function preview(string $html): string
    {
        return NewsController::buildNotificationPreview($html);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  HTML-Tags entfernen
    // ──────────────────────────────────────────────────────────────────────

    public function testStripsAllHtmlTags(): void
    {
        $html = '<h1>Titel</h1><p>Beschreibung</p>';
        $this->assertStringNotContainsString('<', $this->preview($html));
        $this->assertStringNotContainsString('>', $this->preview($html));
    }

    public function testPreservesPlainText(): void
    {
        $result = $this->preview('<p>Hallo Welt</p>');
        $this->assertSame('Hallo Welt', $result);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Leerzeichen zwischen Block-Elementen
    // ──────────────────────────────────────────────────────────────────────

    public function testBlockClosingTagsInsertSpace(): void
    {
        // Ohne das Leerzeichen würde „TitelBeschreibung" entstehen
        $result = $this->preview('<h1>Titel</h1><p>Beschreibung</p>');
        $this->assertSame('Titel Beschreibung', $result);
    }

    public function testBlockquoteClosingTagInsertSpace(): void
    {
        $result = $this->preview('<blockquote><p>Zitat</p></blockquote><p>Danach</p>');
        $this->assertStringContainsString('Zitat', $result);
        $this->assertStringContainsString('Danach', $result);
        $this->assertStringNotContainsString('ZitatDanach', $result);
    }

    public function testListItemsInsertSpace(): void
    {
        $result = $this->preview('<ul><li><p>Punkt A</p></li><li><p>Punkt B</p></li></ul>');
        $this->assertStringContainsString('Punkt A', $result);
        $this->assertStringContainsString('Punkt B', $result);
        $this->assertStringNotContainsString('Punkt APunkt B', $result);
    }

    public function testLineBreakInsertSpace(): void
    {
        $result = $this->preview('<p>Erste Zeile<br>Zweite Zeile</p>');
        $this->assertStringNotContainsString('ZeileZweite', $result);
        $this->assertStringContainsString('Erste Zeile', $result);
        $this->assertStringContainsString('Zweite Zeile', $result);
    }

    public function testSelfClosingLineBreakInsertSpace(): void
    {
        $result = $this->preview('<p>A<br/>B</p>');
        $this->assertStringNotContainsString('AB', $result);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Whitespace-Normalisierung
    // ──────────────────────────────────────────────────────────────────────

    public function testCollapseMultipleSpaces(): void
    {
        $result = $this->preview('<p>Wort1</p>    <p>Wort2</p>');
        $this->assertStringNotContainsString('  ', $result);
    }

    public function testTrimLeadingAndTrailingWhitespace(): void
    {
        $result = $this->preview('  <p>Text</p>  ');
        $this->assertSame('Text', $result);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Längen-Abschneiden
    // ──────────────────────────────────────────────────────────────────────

    public function testShortTextIsReturnedUnchanged(): void
    {
        $text = 'Kurzer Text.';
        $this->assertSame($text, $this->preview('<p>' . $text . '</p>'));
    }

    public function testExactly120CharsNotTruncated(): void
    {
        $text = str_repeat('a', 120);
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertSame($text, $result);
        $this->assertStringNotContainsString('…', $result);
    }

    public function testOver120CharsGetsTruncatedWithEllipsis(): void
    {
        $text = str_repeat('a', 150);
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertStringEndsWith('…', $result);
        $this->assertLessThan(155, mb_strlen($result)); // deutlich kürzer als 150 + Ellipsis
    }

    public function testTruncationAtWordBoundary(): void
    {
        // 110 'a's + space + 20 'b's = 131 Zeichen → soll vor dem 'b'-Block enden
        $text = str_repeat('a', 110) . ' ' . str_repeat('b', 20);
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertStringEndsWith('…', $result);
        // Das Ergebnis darf keine 'b's enthalten, da der Schnitt vor dem Space liegt
        $this->assertStringNotContainsString('b', $result);
    }

    public function testTruncationKeepsWordIfNoGoodBreakpoint(): void
    {
        // Ein einziges Wort mit 130 Zeichen – kein Leerzeichen nach Position 80 vorhanden
        $text = str_repeat('x', 130);
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertStringEndsWith('…', $result);
        // Muss bei exakt 120 Zeichenn + '…' enden (kein günstige Wortgrenze)
        $this->assertSame(mb_substr($text, 0, 120) . '…', $result);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Multibyte-Zeichen (Umlaute, Emoji)
    // ──────────────────────────────────────────────────────────────────────

    public function testMultibyteUmlauteAreHandledCorrectly(): void
    {
        $text = 'Über die Änderungen in der Übergabe freuen wir uns außerordentlich.';
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertSame($text, $result);
    }

    public function testMultibyteEmojiDoNotCorruptOutput(): void
    {
        $text = '🚀 Update: Neue Features sind da! Wir haben hart gearbeitet.';
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertStringStartsWith('🚀', $result);
    }

    public function testLongMultibyteTextTruncatesCorrectly(): void
    {
        // Jedes Zeichen ist 2 Bytes in UTF-8, mb_strlen sollte trotzdem korrekt zählen
        $text = str_repeat('ä', 150);
        $result = $this->preview('<p>' . $text . '</p>');
        $this->assertStringEndsWith('…', $result);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Leere / Sonderfälle
    // ──────────────────────────────────────────────────────────────────────

    public function testEmptyStringReturnsEmpty(): void
    {
        $this->assertSame('', $this->preview(''));
    }

    public function testOnlyHtmlTagsReturnEmpty(): void
    {
        $this->assertSame('', $this->preview('<p></p><h1></h1>'));
    }

    public function testStrongAndEmTagsAreStripped(): void
    {
        $result = $this->preview('<p><strong>Fett</strong> und <em>kursiv</em></p>');
        $this->assertSame('Fett und kursiv', $result);
    }

    public function testAnchorTagTextIsPreserved(): void
    {
        $result = $this->preview('<p>Mehr unter <a href="https://example.com">Kaderblick</a>.</p>');
        $this->assertStringContainsString('Kaderblick', $result);
        $this->assertStringNotContainsString('href', $result);
    }
}
