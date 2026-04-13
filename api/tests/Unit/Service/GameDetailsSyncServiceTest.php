<?php

namespace App\Tests\Unit\Service;

use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Repository\GameEventRepository;
use App\Repository\PlayerRepository;
use App\Repository\PlayerTeamAssignmentRepository;
use App\Repository\TeamRepository;
use App\Service\GameDetailsSyncService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class GameDetailsSyncServiceTest extends TestCase
{
    public function testSyncGameDetailsUpdatesDatabaseCorrectly(): void
    {
        $gameDetails = [
            'home_team' => [
                'name' => 'SpG SG Wurgwitz/​SG 90 Braunsdorf',
                'id' => '00ES8GNBSK00004BVV0AG08LVUPGND5I',
                'url' => 'https://www.fussball.de/verein/sg-wurgwitz-sachsen/-/id/00ES8GNBSK00004BVV0AG08LVUPGND5I',
                'logo' => 'https://www.fussball.de/export.media/-/action/getLogo/format/0/id/00ES8GNBSK00004BVV0AG08LVUPGND5I/verband/0123456789ABCDEF0123456700004270',
            ],
            'away_team' => [
                'name' => 'SpG SG Motor Wilsdruff /​ SG Freital-Weißig 1861 /​ SG Kesselsdorf',
                'id' => '00ES8GNBSK000048VV0AG08LVUPGND5I',
                'url' => 'https://www.fussball.de/verein/sg-motor-wilsdruff-sachsen/-/id/00ES8GNBSK000048VV0AG08LVUPGND5I',
                'logo' => 'https://www.fussball.de/export.media/-/action/getLogo/format/0/id/00ES8GNBSK000048VV0AG08LVUPGND5I/verband/0123456789ABCDEF0123456700004270',
            ],
            'competition' => 'Kreispokal',
            'date' => '2025-08-16',
            'time' => '14:00',
            'location' => 'Rasenplatz, SpA Braunsdorf Rasenplatz, Ernst-Thälmann-Str. 29, 01737 Braunsdorf',
            'result' => '0:0',
            'half_time_result' => '1:0',
            'events' => [
                [
                    'minute' => '4',
                    'type' => 'goal',
                    'team' => 'home',
                    'player' => 'Max Mustermann',
                    'player_id' => '01LDQC6PFO000000VV0AG80NVV99VK9U',
                    'player_url' => 'https://www.fussball.de/spielerprofil/-/player-id/01LDQC6PFO000000VV0AG80NVV99VK9U',
                ],
                [
                    'minute' => '25',
                    'type' => 'substitute',
                    'team' => 'away',
                    'player' => null,
                    'player_id' => null,
                    'player_url' => null,
                    'sub_in' => 'John Doe',
                    'sub_in_id' => '01S3TIRSAG000000VS548984VTJ68QLL',
                    'sub_in_url' => 'https://www.fussball.de/spielerprofil/-/player-id/01S3TIRSAG000000VS548984VTJ68QLL',
                    'sub_out' => 'Jane Doe',
                    'sub_out_id' => '022J53MM8K000000VS54898FVV3EA06D',
                    'sub_out_url' => 'https://www.fussball.de/spielerprofil/-/player-id/022J53MM8K000000VS54898FVV3EA06D',
                ],
            ],
            'ids' => [
                'staffel' => '730090',
                'spiel' => '730090003',
            ],
        ];

        // Mocks
        $teamRepo = $this->createMock(TeamRepository::class);
        $playerRepo = $this->createMock(PlayerRepository::class);
        $ptaRepo = $this->createMock(PlayerTeamAssignmentRepository::class);
        $gameEventRepo = $this->createMock(GameEventRepository::class);

        // Team-Mock: Finde Team anhand Name
        $homeTeamEntity = $this->createMock(Team::class);
        $awayTeamEntity = $this->createMock(Team::class);
        $teamRepo->method('findOneBy')->willReturnMap([
            [['name' => $gameDetails['home_team']['name']], null, $homeTeamEntity],
            [['name' => $gameDetails['away_team']['name']], null, $awayTeamEntity],
        ]);

        // Player-Mock: Finde Spieler anhand Name und Team
        $playerEntity = $this->createMock(Player::class);
        $playerRepo->method('findOneBy')->willReturnMap([
            [['name' => 'Max Mustermann'], null, $playerEntity],
            [['name' => 'John Doe'], null, $playerEntity],
            [['name' => 'Jane Doe'], null, $playerEntity],
        ]);

        // PTA-Mock: Finde Trikotnummer
        $ptaEntity = $this->createMock(PlayerTeamAssignment::class);
        $ptaEntity->method('getShirtNumber')->willReturn(10);
        $ptaRepo->method('findOneBy')->willReturn($ptaEntity);

        // GameEventRepo: Erwartet update oder create (ersatzweise: Callback für jeden Aufruf prüfen)
        $calls = [];
        $gameEventRepo->method('updateOrCreateFromCrawler')->willReturnCallback(function ($data) use (&$calls) {
            $calls[] = $data;
        });

        $service = new GameDetailsSyncService($teamRepo, $playerRepo, $ptaRepo, $gameEventRepo);
        $service->syncGameDetails($gameDetails);

        $this->assertCount(2, $calls);
        $this->assertTrue(
            '4' === $calls[0]['minute']
            && 'goal' === $calls[0]['type']
            && 'Max Mustermann' === $calls[0]['player']
            && 10 === $calls[0]['shirt_number']
        );
        $this->assertTrue(
            '25' === $calls[1]['minute']
            && 'substitute' === $calls[1]['type']
            && 'John Doe' === $calls[1]['sub_in']
            && 'Jane Doe' === $calls[1]['sub_out']
        );
    }
}
