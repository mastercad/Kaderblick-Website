<?php

namespace App\DataFixtures\DemoData;

use App\DataFixtures\MasterData\CalendarEventTypeFixtures;
use App\DataFixtures\MasterData\LeagueFixtures;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\Location;
use App\Entity\Team;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Spiele für ALLE Demo-Teams über 3 Saisons.
 *
 * Ligen (je Hin-+Rückrunde × 3 Saisons):
 *   - Kreisliga A   Senioren I  : 10 Teams → 270 Spiele
 *   - Kreisklasse A Senioren II : 5 Teams (clubs 0-4) + 5 fiktive Gegner → 270 Spiele
 *   - Kreisliga A   A-Junioren  : 9 Teams → 216 Spiele
 *   - Kreisliga A   B-Junioren  : 9 Teams → 216 Spiele
 *   - Kreisklasse A C-Junioren  : 10 Teams → 270 Spiele
 *   Außerdem: Freundschaftsspiele + Pokalspiele pro Liga und Saison.
 *
 * Referenzschlüssel: demo_game_{n} für alle abgeschlossenen Ligaspiele (in Reihenfolge).
 * Gruppe: demo
 *
 * Team-Globalindizes (aus TeamFixtures::CLUB_TEAMS):
 *   Club 0: Sen-I=0,  Sen-II=1,  A-Jun=2,  B-Jun=3,  C-Jun=4,  D-Jun=5,  E-Jun=6,  F-Jun=7,  G-Jun=8
 *   Club 1: Sen-I=9,  Sen-II=10, A-Jun=11, B-Jun=12, C-Jun=13, D-Jun=14, E-Jun=15
 *   Club 2: Sen-I=16, Sen-II=17, A-Jun=18, B-Jun=19, C-Jun=20
 *   Club 3: Sen-I=21, Sen-II=22, A-Jun=23, B-Jun=24, C-Jun=25
 *   Club 4: Sen-I=26, Sen-II=27, A-Jun=28, B-Jun=29, C-Jun=30
 *   Club 5: Sen-I=31, A-Jun=32, B-Jun=33, C-Jun=34
 *   Club 6: Sen-I=35, A-Jun=36, B-Jun=37, C-Jun=38
 *   Club 7: Sen-I=39, A-Jun=40, B-Jun=41, C-Jun=42
 *   Club 8: Sen-I=43, A-Jun=44, C-Jun=45
 *   Club 9: Sen-I=46, B-Jun=47, C-Jun=48
 */
class GameFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 100;

    /**
     * Ligakonfigurationen.
     * Jeder Eintrag: [teamIndizes[], leagueRef, wochentag (0=So,6=Sa), uhrzeit, clubIdxFürLocation[]]
     * clubIdxFürLocation: parallel zu teamIndizes, gibt an welcher Verein (für Location-Referenz) zuständig ist.
     */

    // Senioren I (Kreisliga A): clubs 0-9, teamIdx = Sen-I-Idx, locationClubIdx = clubIdx
    private const SENIOREN_I = [
        'teamIdx' => [0, 9, 16, 21, 26, 31, 35, 39, 43, 46],
        'clubIdx' => [0, 1,  2,  3,  4,  5,  6,  7,  8,  9],
        'leagueRef' => 'league_kreisliga_a',
        'weekday' => 6, // Samstag
        'time' => '15:00',
        'halfDuration' => 45,
    ];

    // Senioren II (Kreisklasse A): clubs 0-4 haben Sen-II; clubs 5-9 haben keine → fiktive Gegner (idx 100-104)
    // Wir spielen eine 10er-Liga mit 5 echten + 5 "TBD"-Platzhaltern die wir NICHT anlegen,
    // sondern einfach nur unter sich spielen (5 Teams → Hin+Rück = 20 Spiele/Saison)
    private const SENIOREN_II = [
        'teamIdx' => [1, 10, 17, 22, 27], // nur die 5 echten Sen-II-Teams
        'clubIdx' => [0,  1,  2,  3,  4],
        'leagueRef' => 'league_kreisklasse_a',
        'weekday' => 0, // Sonntag
        'time' => '15:00',
        'halfDuration' => 45,
    ];

    // A-Junioren (Kreisliga A): 9 Teams (clubs 0-8 haben A-Jun, club 9 nicht)
    private const A_JUNIOREN = [
        'teamIdx' => [2, 11, 18, 23, 28, 32, 36, 40, 44],
        'clubIdx' => [0,  1,  2,  3,  4,  5,  6,  7,  8],
        'leagueRef' => 'league_kreisliga_a',
        'weekday' => 0, // Sonntag
        'time' => '11:00',
        'halfDuration' => 40,
    ];

    // B-Junioren (Kreisliga A): 9 Teams (clubs 0-4, 6-7, 9; club 5+8 nicht in B-Jun... warte)
    // Club 5 hat B-Jun (idx 33), Club 8 hat KEIN B-Jun, Club 9 hat B-Jun (idx 47)
    // Also: clubs 0,1,2,3,4,5,6,7,9 → 9 Teams
    private const B_JUNIOREN = [
        'teamIdx' => [3, 12, 19, 24, 29, 33, 37, 41, 47],
        'clubIdx' => [0,  1,  2,  3,  4,  5,  6,  7,  9],
        'leagueRef' => 'league_kreisliga_a',
        'weekday' => 0, // Sonntag
        'time' => '13:00',
        'halfDuration' => 40,
    ];

    // C-Junioren (Kreisklasse A): 10 Teams (alle clubs haben C-Jun)
    private const C_JUNIOREN = [
        'teamIdx' => [4, 13, 20, 25, 30, 34, 38, 42, 45, 48],
        'clubIdx' => [0,  1,  2,  3,  4,  5,  6,  7,  8,  9],
        'leagueRef' => 'league_kreisklasse_a',
        'weekday' => 6, // Samstag
        'time' => '11:00',
        'halfDuration' => 35,
    ];

    /** 3 Saisons mit Hin- und Rückrundenstart */
    private const SEASONS = [
        ['hinStart' => '2023-08-12', 'rueckStart' => '2024-03-02', 'label' => '2023/24'],
        ['hinStart' => '2024-08-10', 'rueckStart' => '2025-03-01', 'label' => '2024/25'],
        ['hinStart' => '2025-08-09', 'rueckStart' => '2026-02-28', 'label' => '2025/26'],
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            LocationFixtures::class,
            CalendarEventTypeFixtures::class,
            LeagueFixtures::class,
            \App\DataFixtures\MasterData\GameTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // Idempotency: if games already exist, just re-register references and return
        /** @var \App\Repository\GameRepository $gameRepo */
        $gameRepo = $manager->getRepository(Game::class);
        $firstGame = $gameRepo->findOneBy([]);
        if (null !== $firstGame) {
            $games = $gameRepo->findBy(['isFinished' => true], ['id' => 'ASC']);
            foreach ($games as $idx => $g) {
                $this->addReference('demo_game_' . $idx, $g);
            }

            return;
        }

        /** @var CalendarEventType $calType */
        $calType = $this->getReference('calendar_event_type_spiel', CalendarEventType::class);

        /** @var EntityManagerInterface $em */
        $em = $manager;
        $allGameTypes = $em->getRepository(GameType::class)->findAll();
        $gameTypeMap = [];
        foreach ($allGameTypes as $gt) {
            $gameTypeMap[$gt->getName()] = $gt;
        }
        $ligaType = $gameTypeMap['Ligaspiel'] ?? $allGameTypes[0];
        $pokalType = $gameTypeMap['Pokalspiel'] ?? $allGameTypes[0];
        $freundType = $gameTypeMap['Freundschaftsspiel'] ?? $allGameTypes[0];

        $today = new DateTime();
        $gameRef = 0;
        $persistCount = 0;

        $ligen = [
            self::SENIOREN_I,
            self::SENIOREN_II,
            self::A_JUNIOREN,
            self::B_JUNIOREN,
            self::C_JUNIOREN,
        ];

        foreach ($ligen as $ligaConfig) {
            $teamIdxList = $ligaConfig['teamIdx'];
            $clubIdxList = $ligaConfig['clubIdx'];
            $n = count($teamIdxList);
            /** @var League $league */
            $league = $this->getReference($ligaConfig['leagueRef'], League::class);
            $halfDuration = $ligaConfig['halfDuration'];
            [$hour, $minute] = explode(':', $ligaConfig['time']);

            // Pre-load team + location references
            $teams = [];
            $locations = [];
            foreach ($teamIdxList as $pos => $tIdx) {
                $teams[$pos] = $this->getReference('demo_team_' . $tIdx, Team::class);
                $locations[$pos] = $this->getReference('demo_location_' . $clubIdxList[$pos], Location::class);
            }

            $hinRounds = $this->generateRoundRobin($n);
            $rueckRounds = array_map(
                static fn ($round) => array_map(static fn ($p) => [$p[1], $p[0]], $round),
                $hinRounds
            );

            foreach (self::SEASONS as $season) {
                $hinStart = new DateTime($season['hinStart']);
                $rueckStart = new DateTime($season['rueckStart']);

                foreach ([$hinRounds, $rueckRounds] as $halfIdx => $rounds) {
                    $baseDate = clone (0 === $halfIdx ? $hinStart : $rueckStart);

                    foreach ($rounds as $roundNum => $pairs) {
                        $matchDate = clone $baseDate;
                        $matchDate->modify('+' . ($roundNum * 14) . ' days');

                        // Adjust to correct weekday
                        $targetDow = $ligaConfig['weekday']; // 0=Sun, 6=Sat
                        $currentDow = (int) $matchDate->format('w');
                        $diff = ($targetDow - $currentDow + 7) % 7;
                        if ($diff > 0) {
                            $matchDate->modify('+' . $diff . ' days');
                        }
                        $matchDate->setTime((int) $hour, (int) $minute);
                        $isPast = $matchDate < $today;

                        foreach ($pairs as [$homePos, $awayPos]) {
                            $game = $this->buildGame(
                                $teams[$homePos],
                                $teams[$awayPos],
                                $ligaType,
                                $calType,
                                $locations[$homePos],
                                clone $matchDate,
                                $isPast,
                                $league,
                                $halfDuration
                            );
                            $manager->persist($game);

                            if ($isPast) {
                                $this->addReference('demo_game_' . $gameRef, $game);
                                ++$gameRef;
                            }
                            ++$persistCount;
                            if (0 === $persistCount % self::BATCH_SIZE) {
                                $manager->flush();
                            }
                        }
                    }
                }

                // ── Freundschaftsspiele (3 Vorbereitungsspiele pro Liga pro Saison) ──
                for ($fi = 0; $fi < 3; ++$fi) {
                    $hp = $fi % $n;
                    $ap = ($fi + intdiv($n, 2)) % $n;
                    if ($hp === $ap) {
                        $ap = ($ap + 1) % $n;
                    }
                    $frDate = clone $hinStart;
                    $frDate->modify('-' . (21 - $fi * 7) . ' days');
                    $frDate->setTime((int) $hour, (int) $minute);
                    $isPast = $frDate < $today;

                    $game = $this->buildGame(
                        $teams[$hp],
                        $teams[$ap],
                        $freundType,
                        $calType,
                        $locations[$hp],
                        $frDate,
                        $isPast,
                        null,
                        $halfDuration
                    );
                    $manager->persist($game);
                    ++$persistCount;
                    if (0 === $persistCount % self::BATCH_SIZE) {
                        $manager->flush();
                    }
                }

                // ── Pokalspiele (4 pro Liga pro Saison: 2×R1 + HF + Finale) ──
                $pokalPairs = [[0, 1], [2, 3], [0, 2], [1, 3]];
                foreach ($pokalPairs as $pi => [$ph, $pa]) {
                    if (!isset($teams[$ph], $teams[$pa])) {
                        continue;
                    }
                    $pkDate = clone $hinStart;
                    $pkDate->modify('+' . (35 + $pi * 28) . ' days');
                    $pkDate->modify('next wednesday');
                    $pkDate->setTime(19, 0);
                    $isPast = $pkDate < $today;

                    $game = $this->buildGame(
                        $teams[$ph],
                        $teams[$pa],
                        $pokalType,
                        $calType,
                        $locations[$ph],
                        $pkDate,
                        $isPast,
                        null,
                        $halfDuration
                    );
                    $manager->persist($game);
                    ++$persistCount;
                    if (0 === $persistCount % self::BATCH_SIZE) {
                        $manager->flush();
                    }
                }
            }
        }

        $manager->flush();
    }

    /**
     * Circle-Algorithmus: Hin-Runde für $n Teams.
     * Gibt ($n-1) Runden × je floor($n/2) Paare [homePos, awayPos] zurück.
     * Funktioniert für gerades und ungerades $n (Freilos = -1 wird übersprungen).
     *
     * @return list<list<array{0:int,1:int}>>
     */
    private function generateRoundRobin(int $n): array
    {
        $teams = range(0, $n - 1);
        if (0 !== $n % 2) {
            $teams[] = -1; // Freilos-Platzhalter
            ++$n;
        }
        $half = $n / 2;
        $fixed = $teams[0];
        $rotatable = array_slice($teams, 1);
        $rounds = [];

        for ($r = 0; $r < $n - 1; ++$r) {
            $round = [];
            $all = array_merge([$fixed], $rotatable);
            for ($i = 0; $i < $half; ++$i) {
                $h = $all[$i];
                $a = $all[$n - 1 - $i];
                if (-1 !== $h && -1 !== $a) {
                    $round[] = [$h, $a];
                }
            }
            $rounds[] = $round;
            // rotate: last element moves to front
            array_unshift($rotatable, array_pop($rotatable));
        }

        return $rounds;
    }

    private function buildGame(
        Team $homeTeam,
        Team $awayTeam,
        GameType $gameType,
        CalendarEventType $calEventType,
        Location $location,
        DateTime $gameDate,
        bool $isPast,
        ?League $league = null,
        int $halfDuration = 45,
    ): Game {
        $calEvent = new CalendarEvent();
        $calEvent->setTitle($homeTeam->getName() . ' – ' . $awayTeam->getName());
        $calEvent->setStartDate(clone $gameDate);
        $endDate = clone $gameDate;
        $endDate->modify('+' . ($halfDuration * 2 + 20) . ' minutes');
        $calEvent->setEndDate($endDate);
        $calEvent->setCalendarEventType($calEventType);
        $calEvent->setLocation($location);

        $game = new Game();
        $game->setHomeTeam($homeTeam)
             ->setAwayTeam($awayTeam)
             ->setGameType($gameType)
             ->setLocation($location)
             ->setCalendarEvent($calEvent)
             ->setHalfDuration($halfDuration)
             ->setHalftimeBreakDuration(15);

        if (null !== $league) {
            $game->setLeague($league);
        }

        if ($isPast) {
            [$homeScore, $awayScore] = $this->realisticScore();
            $game->setHomeScore($homeScore)
                 ->setAwayScore($awayScore)
                 ->setIsFinished(true)
                 ->setFirstHalfExtraTime(random_int(0, 3))
                 ->setSecondHalfExtraTime(random_int(1, 5));
        }

        return $game;
    }

    /**
     * Realistisches Ergebnis: leichter Heimvorteil, ~2.7 Tore/Spiel, ~28% Unentschieden.
     *
     * @return array{int, int}
     */
    private function realisticScore(): array
    {
        static $results = [
            // Heimsiege (42%)
            [1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [4, 1], [4, 2], [3, 0], [5, 1], [2, 0],
            [1, 0], [2, 1], [3, 0], [2, 0], [4, 0], [3, 1], [2, 1], [1, 0], [3, 2], [2, 0],
            // Unentschieden (28%)
            [1, 1], [2, 2], [0, 0], [3, 3], [1, 1], [2, 2], [0, 0], [1, 1], [2, 2], [0, 0],
            [2, 2], [1, 1], [0, 0], [3, 3], [2, 2], [1, 1], [0, 0], [2, 2], [1, 1], [0, 0],
            // Auswärtssiege (30%)
            [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [0, 3], [1, 4], [2, 4], [0, 4], [1, 2],
            [0, 1], [1, 2], [0, 2], [1, 3], [0, 3], [2, 3], [1, 4], [0, 4], [1, 2], [0, 2],
        ];

        return $results[array_rand($results)];
    }
}
