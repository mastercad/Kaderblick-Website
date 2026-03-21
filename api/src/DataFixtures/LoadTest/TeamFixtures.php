<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\AgeGroupFixtures;
use App\DataFixtures\MasterData\LeagueFixtures;
use App\Entity\AgeGroup;
use App\Entity\Club;
use App\Entity\League;
use App\Entity\Team;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: 916 Teams für 100 Vereine.
 *
 * Realistisches deutsches Jugendfußball-Modell: JEDER Verein hat alle Jugendmannschaften.
 * Jüngere Jahrgänge (F/E/D) haben bei größeren Vereinen mehrere Teams.
 *
 * - Große Klubs (0-23):   je 13 Teams → 312 Teams total
 *   Herren I, Herren II, Frauen,
 *   A-Junioren 1+2, B-Junioren 1+2, C-Junioren 1+2, D-Junioren 1+2, E-Junioren 1, F-Junioren 1
 *
 * - Mittlere Klubs (24-59): je 9 Teams → 324 Teams total
 *   Herren I, Herren II,
 *   A-Junioren, B-Junioren, C-Junioren, D-Junioren 1+2, E-Junioren 1+2, F-Junioren
 *
 * - Kleine Klubs (60-99): je 7 Teams → 280 Teams total (kein Herren II, aber volle Jugend!)
 *   Herren I,
 *   A-Junioren, B-Junioren, C-Junioren, D-Junioren, E-Junioren, F-Junioren
 *
 * Gruppe: load_test
 * Gesamt: 312 + 324 + 280 = 916 Teams
 */
class TeamFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public const TOTAL_TEAMS = 916;

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            ClubFixtures::class,
            AgeGroupFixtures::class,
            LeagueFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // [name, ageGroupCode, leagueCode, [clubIndices...]]
        $allTeamData = $this->buildTeamData();

        foreach ($allTeamData as $idx => $data) {
            [$name, $ageGroupKey, $leagueKey, $clubIndices] = $data;

            /** @var AgeGroup $ageGroup */
            $ageGroup = $this->getReference('age_group_' . $ageGroupKey, AgeGroup::class);
            /** @var League $league */
            $league = $this->getReference('league_' . $leagueKey, League::class);

            $existing = $manager->getRepository(Team::class)->findOneBy(['name' => $name]);
            if ($existing) {
                $this->addReference('lt_team_' . $idx, $existing);
                continue;
            }

            $team = new Team();
            $team->setName($name);
            $team->setAgeGroup($ageGroup);
            $team->setLeague($league);

            foreach ($clubIndices as $clubIdx) {
                /** @var Club $club */
                $club = $this->getReference('lt_club_' . $clubIdx, Club::class);
                $team->addClub($club);
            }

            $manager->persist($team);
            $this->addReference('lt_team_' . $idx, $team);

            if (0 === $idx % 50) {
                $manager->flush();
            }
        }

        $manager->flush();
    }

    /** @return array<int, array{string, string, string, int[]}> */
    private function buildTeamData(): array
    {
        // League key reference (from LeagueFixtures):
        // bundesliga, 2_bundesliga, 3_liga
        // regionalliga, regionalliga_nord, regionalliga_nordost, regionalliga_west, regionalliga_sudwest, regionalliga_bayern
        // oberliga, verbandsliga, landesliga, bezirksoberliga, bezirksliga, kreisliga_a, kreisliga_b, kreisliga
        // frauen_bundesliga, 2_frauen_bundesliga, frauen_regionalliga, frauen_verbandsliga, frauen_landesliga, frauen_bezirksliga, frauen_kreisliga

        // Jugend-Ligen: Junioren spielen in normalen Ligen (Verbands-/Bezirks-/Kreisliga)
        // Jugendlichen-Staffeln orientieren sich an Vereinsgröße.

        // Format: [clubIdx, clubName, l_herren1, l_herren2, l_frauen, l_A, l_B, l_C, l_D, l_E, l_F]
        $bigClubs = [
            // [clubIdx, name, Herren I, Herren II, Frauen, A-Jug, B-Jug, C-Jug, D-Jug, E-Jug, F-Jug]
            [
                0,
                'FC Bayern München',
                'bundesliga',
                'regionalliga_bayern',
                'frauen_bundesliga',
                'bundesliga',
                'bundesliga',
                'verbandsliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga'
            ],
            [
                1,
                'Borussia Dortmund',
                'bundesliga',
                'regionalliga_west',
                'frauen_bundesliga',
                'bundesliga',
                'bundesliga',
                'verbandsliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga'
            ],
            [
                2,
                'Bayer 04 Leverkusen',
                'bundesliga',
                'regionalliga_west',
                'frauen_regionalliga',
                'bundesliga',
                'bundesliga',
                'verbandsliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga'
            ],
            [
                3,
                'RB Leipzig',
                'bundesliga',
                'regionalliga',
                'frauen_regionalliga',
                'bundesliga',
                'bundesliga',
                'verbandsliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga'
            ],
            [
                4,
                'Borussia Mönchengladbach',
                'bundesliga',
                'regionalliga_west',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                5,
                'Eintracht Frankfurt',
                'bundesliga',
                'regionalliga',
                'frauen_bundesliga',
                'bundesliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                6,
                'SC Freiburg',
                'bundesliga',
                'regionalliga_sudwest',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                7,
                'TSG 1899 Hoffenheim',
                'bundesliga',
                'regionalliga_sudwest',
                'frauen_regionalliga',
                'bundesliga',
                'bundesliga',
                'verbandsliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga'
            ],
            [
                8,
                'VfL Wolfsburg',
                '2_bundesliga',
                'oberliga',
                'frauen_bundesliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                9,
                'FC Augsburg',
                '2_bundesliga',
                'regionalliga_bayern',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                10,
                'VfB Stuttgart',
                '2_bundesliga',
                'regionalliga_sudwest',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                11,
                'Hertha BSC Berlin',
                '2_bundesliga',
                'regionalliga_nordost',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                12,
                'SV Werder Bremen',
                '2_bundesliga',
                'regionalliga_nord',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                13,
                'Hamburger SV',
                '2_bundesliga',
                'regionalliga_nord',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                14,
                'FC Schalke 04',
                '2_bundesliga',
                'regionalliga_west',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                15,
                '1. FC Köln',
                '2_bundesliga',
                'regionalliga_west',
                'frauen_regionalliga',
                'bundesliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                16,
                'Hannover 96',
                '3_liga',
                'regionalliga_nord',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                17,
                '1. FC Nürnberg',
                '3_liga',
                'regionalliga_bayern',
                'frauen_regionalliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'landesliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                18,
                'Hansa Rostock',
                '3_liga',
                'oberliga',
                'frauen_verbandsliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                19,
                'SpVgg Greuther Fürth',
                '3_liga',
                'regionalliga_bayern',
                'frauen_verbandsliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                20,
                'FC St. Pauli',
                '3_liga',
                'regionalliga_nord',
                'frauen_verbandsliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                21,
                'Werder Bremen II',
                'regionalliga_nord',
                'oberliga',
                'frauen_verbandsliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                22,
                '1. FC Magdeburg',
                '3_liga',
                'regionalliga_nordost',
                'frauen_verbandsliga',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                23,
                'SV Meppen',
                '3_liga',
                'oberliga',
                'frauen_verbandsliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
        ];

        // Format: [clubIdx, name, Herren I, Herren II, A-Jug, B-Jug, C-Jug, D-Jug, E-Jug, F-Jug]
        $mediumClubs = [
            [
                24,
                'FC Ingolstadt 04',
                '3_liga',
                'regionalliga_bayern',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                25,
                'SC Paderborn 07',
                '3_liga',
                'regionalliga_west',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                26,
                'SSV Jahn Regensburg',
                '3_liga',
                'regionalliga_bayern',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                27,
                'SV Wehen Wiesbaden',
                '3_liga',
                'regionalliga_sudwest',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                28,
                'SSV Ulm 1846',
                '3_liga',
                'regionalliga_sudwest',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                29,
                'SC Preußen Münster',
                '3_liga',
                'regionalliga_west',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                30,
                'SV Elversberg',
                '3_liga',
                'regionalliga_sudwest',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                31,
                'Eintracht Braunschweig',
                '3_liga',
                'regionalliga_nord',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                32,
                'Dynamo Dresden',
                '3_liga',
                'regionalliga_nordost',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                33,
                'Hallescher FC',
                'regionalliga',
                'oberliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                34,
                'FC Energie Cottbus',
                'regionalliga',
                'oberliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                35,
                'SV Waldhof Mannheim',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                36,
                'VfL Bochum 1848',
                '2_bundesliga',
                'regionalliga_west',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                37,
                'SV Darmstadt 98',
                'bundesliga',
                'regionalliga_sudwest',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                38,
                'FC Heidenheim',
                'bundesliga',
                'regionalliga_sudwest',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                39,
                'Rot-Weiß Essen',
                'regionalliga',
                'oberliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                40,
                'MSV Duisburg',
                'regionalliga',
                'oberliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                41,
                '1. FC Saarbrücken',
                '3_liga',
                'regionalliga_sudwest',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                42,
                'Sportfreunde Siegen',
                'regionalliga',
                'oberliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                43,
                'Alemannia Aachen',
                '3_liga',
                'regionalliga_west',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                44,
                'SC Verl',
                '3_liga',
                'regionalliga_west',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                45,
                'Wuppertaler SV',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                46,
                'Holstein Kiel',
                'bundesliga',
                'regionalliga_nord',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                47,
                'FC Rot-Weiß Koblenz',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                48,
                'VfB Oldenburg',
                'regionalliga',
                'oberliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                49,
                'FC Carl Zeiss Jena',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                50,
                'FC Plauen',
                'landesliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                51,
                'Babelsberg 03',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                52,
                'SV Sandhausen',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                53,
                'SpVgg Unterhaching',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                54,
                'KFC Uerdingen 05',
                'regionalliga',
                'landesliga',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                55,
                'FC Erzgebirge Aue',
                '3_liga',
                'regionalliga_nordost',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'bezirksliga',
                'kreisliga'
            ],
            [
                56,
                'TSV 1860 München',
                '3_liga',
                'regionalliga_bayern',
                'verbandsliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                57,
                'FC Bayern München II',
                'regionalliga',
                'landesliga',
                'kreisliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                58,
                'BVB Dortmund II',
                'regionalliga',
                'landesliga',
                'kreisliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                59,
                'Hamburger SV II',
                'regionalliga',
                'landesliga',
                'kreisliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
        ];

        // Format: [clubIdx, name, Herren I, A-Jug, B-Jug, C-Jug, D-Jug, E-Jug, F-Jug]
        // Kleine Klubs: kein Herren II, aber VOLLSTÄNDIGE Jugendabteilung (so ist es real!)
        $smallClubs = [
            [
                60,
                'Eintracht Frankfurt II',
                'regionalliga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                61,
                'SV Türkgücü München',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                62,
                'SV Rödinghausen',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                63,
                'Berliner AK 07',
                'regionalliga',
                'oberliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                64,
                'FC Gütersloh',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                65,
                'FC Viktoria Köln',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                66,
                'Fortuna Köln',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                67,
                'SG Wattenscheid 09',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                68,
                'TuS Koblenz',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                69,
                'SpVgg Bayreuth',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                70,
                'Würzburger Kickers',
                '3_liga',
                'verbandsliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                71,
                'FC Schweinfurt 05',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                72,
                'VfR Aalen',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                73,
                'Stuttgarter Kickers',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                74,
                'VfV Hildesheim',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                75,
                'TSV Havelse',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                76,
                'Eintracht Celle FC',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                77,
                'SV Atlas Delmenhorst',
                'oberliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                78,
                'SV Sparta Lichtenberg',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                79,
                'VfV Borussia 06 Hildesheim',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                80,
                'TuS RW Koblenz',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                81,
                'FC Astoria Walldorf',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                82,
                'FC Homburg',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                83,
                'SV Gonsenheim',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                84,
                'Sportfreunde Eisbachtal',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                85,
                'FC Trier',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                86,
                'FK Pirmasens',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                87,
                'TuS Mechtersheim',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                88,
                'FC Deidesheim',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                89,
                'SG Rehborn',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                90,
                'VfB Bodenheim',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                91,
                'SC 07 Idar-Oberstein',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                92,
                'SSV Ulm 1846 II',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                93,
                'SV Sandhausen II',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                94,
                'VfB Lübeck',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                95,
                'SC Teutonia 05',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                96,
                'TSV Schott Mainz',
                'verbandsliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                97,
                'Rot-Weiss Ahlen',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                98,
                'VfB Homberg',
                'regionalliga',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
            [
                99,
                'SC Union Nettetal',
                'landesliga',
                'bezirksliga',
                'bezirksliga',
                'kreisliga',
                'kreisliga',
                'kreisliga',
                'kreisliga'
            ],
        ];

        $teams = [];

        // ── Große Klubs: 13 Teams je ────────────────────────────────────────────
        // Herren I, Herren II, Frauen, A-Jug 1+2, B-Jug 1+2, C-Jug 1+2, D-Jug 1+2, E-Jug 1, F-Jug 1
        foreach ($bigClubs as $row) {
            [$clubIdx, $clubName, $l1, $l2, $lF, $lA, $lB, $lC, $lD, $lE, $lF2] = $row;
            $short = $this->abbreviate($clubName);
            $teams[] = ["{$clubName} I",              'senioren',    $l1,  [$clubIdx]];
            $teams[] = ["{$clubName} II",             'senioren',    $l2,  [$clubIdx]];
            $teams[] = ["{$short} Frauen",            'senioren',    $lF,  [$clubIdx]];
            $teams[] = ["{$short} A-Junioren 1",      'a_junioren',  $lA,  [$clubIdx]];
            $teams[] = ["{$short} A-Junioren 2",      'a_junioren',  $lA,  [$clubIdx]];
            $teams[] = ["{$short} B-Junioren 1",      'b_junioren',  $lB,  [$clubIdx]];
            $teams[] = ["{$short} B-Junioren 2",      'b_junioren',  $lB,  [$clubIdx]];
            $teams[] = ["{$short} C-Junioren 1",      'c_junioren',  $lC,  [$clubIdx]];
            $teams[] = ["{$short} C-Junioren 2",      'c_junioren',  $lC,  [$clubIdx]];
            $teams[] = ["{$short} D-Junioren 1",      'd_junioren',  $lD,  [$clubIdx]];
            $teams[] = ["{$short} D-Junioren 2",      'd_junioren',  $lD,  [$clubIdx]];
            $teams[] = ["{$short} E-Junioren 1",      'e_junioren',  $lE,  [$clubIdx]];
            $teams[] = ["{$short} F-Junioren 1",      'f_junioren',  $lF2, [$clubIdx]];
        }

        // ── Mittlere Klubs: 9 Teams je ──────────────────────────────────────────
        // Herren I, Herren II, A-Jug, B-Jug, C-Jug, D-Jug 1+2, E-Jug 1+2, F-Jug
        foreach ($mediumClubs as $row) {
            [$clubIdx, $clubName, $l1, $l2, $lA, $lB, $lC, $lD, $lF] = $row;
            $lE = $lD; // E-Junioren spielen dieselbe Staffel wie D-Junioren
            $short = $this->abbreviate($clubName);
            $teams[] = ["{$clubName} I",            'senioren',   $l1, [$clubIdx]];
            $teams[] = ["{$clubName} II",           'senioren',   $l2, [$clubIdx]];
            $teams[] = ["{$short} A-Junioren",      'a_junioren', $lA, [$clubIdx]];
            $teams[] = ["{$short} B-Junioren",      'b_junioren', $lB, [$clubIdx]];
            $teams[] = ["{$short} C-Junioren",      'c_junioren', $lC, [$clubIdx]];
            $teams[] = ["{$short} D-Junioren 1",    'd_junioren', $lD, [$clubIdx]];
            $teams[] = ["{$short} D-Junioren 2",    'd_junioren', $lD, [$clubIdx]];
            $teams[] = ["{$short} E-Junioren 1",    'e_junioren', $lE, [$clubIdx]];
            $teams[] = ["{$short} F-Junioren",      'f_junioren', $lF, [$clubIdx]];
        }

        // ── Kleine Klubs: 7 Teams je ────────────────────────────────────────────
        // Herren I (kein II), aber ALLE Jugendmannschaften A bis F existieren!
        // Nachwuchs ist das Herzstück eines jeden Vereins, egal wie klein.
        foreach ($smallClubs as $row) {
            [$clubIdx, $clubName, $l1, $lA, $lB, $lC, $lD, $lE, $lF] = $row;
            $short = $this->abbreviate($clubName);
            $teams[] = ["{$clubName} I",          'senioren',   $l1, [$clubIdx]];
            $teams[] = ["{$short} A-Junioren",    'a_junioren', $lA, [$clubIdx]];
            $teams[] = ["{$short} B-Junioren",    'b_junioren', $lB, [$clubIdx]];
            $teams[] = ["{$short} C-Junioren",    'c_junioren', $lC, [$clubIdx]];
            $teams[] = ["{$short} D-Junioren",    'd_junioren', $lD, [$clubIdx]];
            $teams[] = ["{$short} E-Junioren",    'e_junioren', $lE, [$clubIdx]];
            $teams[] = ["{$short} F-Junioren",    'f_junioren', $lF, [$clubIdx]];
        }

        return $teams;
    }

    private function abbreviate(string $name): string
    {
        // Remove common prefix words for short team names
        $remove = ['FC ', 'SV ', '1. FC ', 'TSG ', 'VfL ', 'VfB ', 'SpVgg ', 'SSV ', 'SC ',
            'FK ', 'TuS ', 'RB ', 'BVB ', 'TSV ', 'SG ', 'VfR ', 'KFC '];
        $short = $name;
        foreach ($remove as $prefix) {
            if (str_starts_with($short, $prefix)) {
                $short = substr($short, strlen($prefix));
                break;
            }
        }

        return $short;
    }
}
