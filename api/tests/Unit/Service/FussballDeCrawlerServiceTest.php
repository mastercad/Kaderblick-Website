<?php

namespace App\Tests\Unit\Service;

use App\Service\FussballDeCrawlerService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class FussballDeCrawlerServiceTest extends TestCase
{
    protected function setUp(): void
    {
        if (!isset($_ENV['FUSSBALLDE_BASE_URL'])) {
            $_ENV['FUSSBALLDE_BASE_URL'] = 'https://www.fussball.de';
        }
    }

    public function testParseUpcomingGamesHtmlParsesGamesCorrectly(): void
    {
        $html = file_get_contents(__DIR__ . '/fixtures/fussballde_club_matchplan.html');
        $service = new FussballDeCrawlerService();
        $reflection = new ReflectionClass($service);
        $method = $reflection->getMethod('parseUpcomingGamesHtml');
        $method->setAccessible(true);
        $result = $method->invoke($service, $html);

        $this->assertIsArray($result);
        $this->assertNotEmpty($result);

        $spiel = $result[0];
        $this->assertArrayHasKey('date', $spiel);
        $this->assertArrayHasKey('time', $spiel);
        $this->assertArrayHasKey('spielklasse', $spiel);
        $this->assertArrayHasKey('homeTeam', $spiel);
        $this->assertArrayHasKey('awayTeam', $spiel);
        $this->assertArrayHasKey('gameUrl', $spiel);
        $this->assertArrayHasKey('gameId', $spiel);
        $this->assertArrayHasKey('score', $spiel);

        $this->assertIsArray($spiel['homeTeam']);
        $this->assertIsArray($spiel['awayTeam']);
        foreach (['name', 'url', 'id'] as $key) {
            $this->assertArrayHasKey($key, $spiel['homeTeam']);
            $this->assertArrayHasKey($key, $spiel['awayTeam']);
        }

        // Beispiel: Prüfe auf ein konkretes Spiel (zweites Spiel im Plan)
        $expected = [
            'date' => '24.08.2025',
            'time' => '13:00',
            'spielklasse' => 'Kreisoberliga',
            'homeTeam' => [
                'name' => 'SpG SG Wurgwitz/​SG 90 Braunsdorf',
                'url' => 'https://www.fussball.de/mannschaft/spg-sg-wurgwitz-sg-90-braunsdorf-sg-wurgwitz-sachsen/-/saison/2526/team-id/02TD2NSG0C000000VS5489BSVTA87VEB',
                'id' => '02TD2NSG0C000000VS5489BSVTA87VEB',
            ],
            'awayTeam' => [
                'name' => 'SV Chemie Dohna (9er NWM)',
                'url' => 'https://www.fussball.de/mannschaft/sv-chemie-dohna-9er-nwm-sv-chemie-dohna-sachsen/-/saison/2526/team-id/02TAGQ40A4000000VS5489BSVV9JRPRB',
                'id' => '02TAGQ40A4000000VS5489BSVV9JRPRB',
            ],
            'gameUrl' => 'https://www.fussball.de/spiel/spg-sg-wurgwitz-sg-90-braunsdorf-sv-chemie-dohna-9er-nwm/-/spiel/02TV2VHCAK000000VS5489BTVTHCTAHT',
            'gameId' => '02TV2VHCAK000000VS5489BTVTHCTAHT',
            'score' => 'Nichtantritt GAST',
        ];
        $this->assertTrue(
            in_array($expected, $result)
        );
    }

    public function testParseGameDetailsHtmlExtrahiertAlleEventsUndInfos(): void
    {
        $html = file_get_contents(__DIR__ . '/fixtures/fussballde_game_details.html');
        $service = new FussballDeCrawlerService();
        $result = $service->parseGameDetailsHtml($html);

        foreach (
            [
                'home_team', 'away_team', 'competition', 'date', 'time', 'location',
                'result', 'half_time_result', 'events', 'ids',
            ] as $key
        ) {
            $this->assertArrayHasKey($key, $result);
        }

        // Teams prüfen
        $this->assertEquals('SpG SG Wurgwitz/​SG 90 Braunsdorf', $result['home_team']['name']);
        $this->assertEquals('SpG SG Motor Wilsdruff /​ SG Freital-Weißig 1861 /​ SG Kesselsdorf', $result['away_team']['name']);

        // Wettbewerb, Datum, Uhrzeit, Ort
        $this->assertArrayHasKey('competition', $result);
        $this->assertEquals('Kreispokal', $result['competition']);
        $this->assertArrayHasKey('date', $result);
        $this->assertEquals('2025-08-16', $result['date']);
        $this->assertArrayHasKey('time', $result);
        $this->assertEquals('14:00', $result['time']);
        $this->assertArrayHasKey('location', $result);
        $this->assertStringContainsString('Ernst-Thälmann-Str.', $result['location']);

        // Ergebnis
        $this->assertArrayHasKey('result', $result);
        $this->assertEquals('0:0', $result['result']);
        $this->assertArrayHasKey('half_time_result', $result);
        $this->assertEquals('1:0', $result['half_time_result']);

        // IDs
        $this->assertArrayHasKey('ids', $result);
        $this->assertArrayHasKey('staffel', $result['ids']);
        $this->assertEquals('730090', $result['ids']['staffel']);
        $this->assertArrayHasKey('spiel', $result['ids']);
        $this->assertEquals('730090003', $result['ids']['spiel']);

        // Events prüfen (nur Struktur, Details im Parser-Test)
        $this->assertArrayHasKey('events', $result);
        $this->assertTrue(is_array($result['events']));
        $this->assertNotEmpty($result['events']);

        $event = $result['events'][0];
        $this->assertArrayHasKey('minute', $event);
        $this->assertArrayHasKey('type', $event);
        $this->assertArrayHasKey('team', $event);
        // Optional: Spieler, IDs, etc.
    }
}
