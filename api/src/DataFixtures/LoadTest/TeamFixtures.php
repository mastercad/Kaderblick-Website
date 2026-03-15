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
 * Load-Test Fixtures: 101 Mannschaften für 25 Vereine inkl. 3 Spielgemeinschaften.
 * - Große Klubs (0-7): je 6 Teams (Senioren I+II, A-Jug, B-Jug, C-Jug, Frauen) → Teams 0-47
 * - Mittlere Klubs (8-15): je 4 Teams (Senioren I+II, A-Jug, B-Jug) → Teams 48-79
 * - Kleine Klubs (16-24): je 2 Teams (Senioren I, A-Jug) → Teams 80-97
 * - 3 Spielgemeinschaften → Teams 98-100
 * Gruppe: load_test.
 */
class TeamFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
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
        // Große Klubs: je 6 Teams
        $bigClubData = [
            // Club 0: FC Bayern München → Teams 0-5
            ['FC Bayern München I', 'senioren', 'bundesliga', [0]],
            ['FC Bayern München II', 'senioren', 'regionalliga_nord', [0]],
            ['FC Bayern A-Junioren', 'a_junioren', 'bundesliga', [0]],
            ['FC Bayern B-Junioren', 'b_junioren', 'bundesliga', [0]],
            ['FC Bayern C-Junioren', 'c_junioren', 'kreisliga', [0]],
            ['FC Bayern Frauen', 'senioren', 'frauen_bundesliga', [0]],
            // Club 1: Borussia Dortmund → Teams 6-11
            ['BVB Dortmund I', 'senioren', 'bundesliga', [1]],
            ['BVB Dortmund II', 'senioren', 'regionalliga_west', [1]],
            ['BVB A-Junioren', 'a_junioren', 'bundesliga', [1]],
            ['BVB B-Junioren', 'b_junioren', 'bundesliga', [1]],
            ['BVB C-Junioren', 'c_junioren', 'kreisliga', [1]],
            ['BVB Frauen', 'senioren', 'frauen_bundesliga', [1]],
            // Club 2: Bayer 04 Leverkusen → Teams 12-17
            ['Bayer 04 Leverkusen I', 'senioren', 'bundesliga', [2]],
            ['Bayer 04 Leverkusen II', 'senioren', 'regionalliga_west', [2]],
            ['Bayer 04 A-Junioren', 'a_junioren', 'bundesliga', [2]],
            ['Bayer 04 B-Junioren', 'b_junioren', 'bundesliga', [2]],
            ['Bayer 04 C-Junioren', 'c_junioren', 'bezirksliga', [2]],
            ['Bayer 04 Frauen', 'senioren', 'frauen_regionalliga', [2]],
            // Club 3: RB Leipzig → Teams 18-23
            ['RB Leipzig I', 'senioren', 'bundesliga', [3]],
            ['RB Leipzig II', 'senioren', 'regionalliga', [3]],
            ['RB Leipzig A-Junioren', 'a_junioren', 'bundesliga', [3]],
            ['RB Leipzig B-Junioren', 'b_junioren', 'bundesliga', [3]],
            ['RB Leipzig C-Junioren', 'c_junioren', 'bezirksliga', [3]],
            ['RB Leipzig Frauen', 'senioren', 'frauen_regionalliga', [3]],
            // Club 4: Borussia Mönchengladbach → Teams 24-29
            ['Borussia MG I', 'senioren', 'bundesliga', [4]],
            ['Borussia MG II', 'senioren', 'regionalliga_west', [4]],
            ['Borussia MG A-Junioren', 'a_junioren', 'regionalliga', [4]],
            ['Borussia MG B-Junioren', 'b_junioren', 'verbandsliga', [4]],
            ['Borussia MG C-Junioren', 'c_junioren', 'kreisliga', [4]],
            ['Borussia MG Frauen', 'senioren', 'frauen_regionalliga', [4]],
            // Club 5: Eintracht Frankfurt → Teams 30-35
            ['Eintracht Frankfurt I', 'senioren', 'bundesliga', [5]],
            ['Eintracht Frankfurt II', 'senioren', 'regionalliga', [5]],
            ['Eintracht Frankfurt A-Junioren', 'a_junioren', 'bundesliga', [5]],
            ['Eintracht Frankfurt B-Junioren', 'b_junioren', 'verbandsliga', [5]],
            ['Eintracht Frankfurt C-Junioren', 'c_junioren', 'kreisliga', [5]],
            ['Eintracht Frankfurt Frauen', 'senioren', 'frauen_bundesliga', [5]],
            // Club 6: SC Freiburg → Teams 36-41
            ['SC Freiburg I', 'senioren', 'bundesliga', [6]],
            ['SC Freiburg II', 'senioren', 'regionalliga', [6]],
            ['SC Freiburg A-Junioren', 'a_junioren', 'regionalliga', [6]],
            ['SC Freiburg B-Junioren', 'b_junioren', 'verbandsliga', [6]],
            ['SC Freiburg C-Junioren', 'c_junioren', 'bezirksliga', [6]],
            ['SC Freiburg Frauen', 'senioren', 'frauen_regionalliga', [6]],
            // Club 7: TSG 1899 Hoffenheim → Teams 42-47
            ['TSG Hoffenheim I', 'senioren', 'bundesliga', [7]],
            ['TSG Hoffenheim II', 'senioren', 'regionalliga', [7]],
            ['TSG Hoffenheim A-Junioren', 'a_junioren', 'bundesliga', [7]],
            ['TSG Hoffenheim B-Junioren', 'b_junioren', 'bundesliga', [7]],
            ['TSG Hoffenheim C-Junioren', 'c_junioren', 'kreisliga', [7]],
            ['TSG Hoffenheim Frauen', 'senioren', 'frauen_regionalliga', [7]],
        ];

        // Mittlere Klubs: je 4 Teams
        $mediumClubData = [
            // Club 8: VfL Wolfsburg → Teams 48-51
            ['VfL Wolfsburg I', 'senioren', '2_bundesliga', [8]],
            ['VfL Wolfsburg II', 'senioren', 'landesliga', [8]],
            ['VfL Wolfsburg A-Junioren', 'a_junioren', 'regionalliga', [8]],
            ['VfL Wolfsburg B-Junioren', 'b_junioren', 'verbandsliga', [8]],
            // Club 9: FC Augsburg → Teams 52-55
            ['FC Augsburg I', 'senioren', '2_bundesliga', [9]],
            ['FC Augsburg II', 'senioren', 'landesliga', [9]],
            ['FC Augsburg A-Junioren', 'a_junioren', 'regionalliga', [9]],
            ['FC Augsburg B-Junioren', 'b_junioren', 'verbandsliga', [9]],
            // Club 10: VfB Stuttgart → Teams 56-59
            ['VfB Stuttgart I', 'senioren', '2_bundesliga', [10]],
            ['VfB Stuttgart II', 'senioren', 'landesliga', [10]],
            ['VfB Stuttgart A-Junioren', 'a_junioren', 'regionalliga', [10]],
            ['VfB Stuttgart B-Junioren', 'b_junioren', 'verbandsliga', [10]],
            // Club 11: Hertha BSC Berlin → Teams 60-63
            ['Hertha BSC I', 'senioren', '2_bundesliga', [11]],
            ['Hertha BSC II', 'senioren', 'regionalliga_nord', [11]],
            ['Hertha BSC A-Junioren', 'a_junioren', 'regionalliga', [11]],
            ['Hertha BSC B-Junioren', 'b_junioren', 'verbandsliga', [11]],
            // Club 12: SV Werder Bremen → Teams 64-67
            ['Werder Bremen I', 'senioren', '2_bundesliga', [12]],
            ['Werder Bremen II', 'senioren', 'regionalliga_nord', [12]],
            ['Werder Bremen A-Junioren', 'a_junioren', 'regionalliga', [12]],
            ['Werder Bremen B-Junioren', 'b_junioren', 'verbandsliga', [12]],
            // Club 13: Hamburger SV → Teams 68-71
            ['Hamburger SV I', 'senioren', '2_bundesliga', [13]],
            ['Hamburger SV II', 'senioren', 'regionalliga_nord', [13]],
            ['Hamburger SV A-Junioren', 'a_junioren', 'regionalliga', [13]],
            ['Hamburger SV B-Junioren', 'b_junioren', 'verbandsliga', [13]],
            // Club 14: FC Schalke 04 → Teams 72-75
            ['FC Schalke 04 I', 'senioren', '2_bundesliga', [14]],
            ['FC Schalke 04 II', 'senioren', 'regionalliga_west', [14]],
            ['FC Schalke 04 A-Junioren', 'a_junioren', 'regionalliga', [14]],
            ['FC Schalke 04 B-Junioren', 'b_junioren', 'verbandsliga', [14]],
            // Club 15: 1. FC Köln → Teams 76-79
            ['1. FC Köln I', 'senioren', '2_bundesliga', [15]],
            ['1. FC Köln II', 'senioren', 'regionalliga_west', [15]],
            ['1. FC Köln A-Junioren', 'a_junioren', 'bundesliga', [15]],
            ['1. FC Köln B-Junioren', 'b_junioren', 'verbandsliga', [15]],
        ];

        // Kleine Klubs: je 2 Teams
        $smallClubData = [
            // Club 16: Hannover 96 → Teams 80-81
            ['Hannover 96 I', 'senioren', '3_liga', [16]],
            ['Hannover 96 A-Junioren', 'a_junioren', 'verbandsliga', [16]],
            // Club 17: 1. FC Nürnberg → Teams 82-83
            ['1. FC Nürnberg I', 'senioren', '3_liga', [17]],
            ['1. FC Nürnberg A-Junioren', 'a_junioren', 'verbandsliga', [17]],
            // Club 18: Hansa Rostock → Teams 84-85
            ['Hansa Rostock I', 'senioren', '3_liga', [18]],
            ['Hansa Rostock A-Junioren', 'a_junioren', 'verbandsliga', [18]],
            // Club 19: SpVgg Greuther Fürth → Teams 86-87
            ['SpVgg Greuther Fürth I', 'senioren', '3_liga', [19]],
            ['SpVgg Greuther Fürth A-Junioren', 'a_junioren', 'verbandsliga', [19]],
            // Club 20: SV Sandhausen → Teams 88-89
            ['SV Sandhausen I', 'senioren', 'regionalliga', [20]],
            ['SV Sandhausen A-Junioren', 'a_junioren', 'verbandsliga', [20]],
            // Club 21: SpVgg Unterhaching → Teams 90-91
            ['SpVgg Unterhaching I', 'senioren', 'regionalliga', [21]],
            ['SpVgg Unterhaching A-Junioren', 'a_junioren', 'bezirksliga', [21]],
            // Club 22: KFC Uerdingen 05 → Teams 92-93
            ['KFC Uerdingen I', 'senioren', 'regionalliga_west', [22]],
            ['KFC Uerdingen A-Junioren', 'a_junioren', 'bezirksliga', [22]],
            // Club 23: FC Erzgebirge Aue → Teams 94-95
            ['FC Erzgebirge Aue I', 'senioren', '3_liga', [23]],
            ['FC Erzgebirge Aue A-Junioren', 'a_junioren', 'verbandsliga', [23]],
            // Club 24: TSV 1860 München → Teams 96-97
            ['TSV 1860 München I', 'senioren', '3_liga', [24]],
            ['TSV 1860 München A-Junioren', 'a_junioren', 'bezirksliga', [24]],
        ];

        // Spielgemeinschaften: je 1 Team mit 2 Klubs → Teams 98-100
        $sgTeamData = [
            // SG Fürth/Sandhausen A-Junioren → Team 98 (clubs 19+20)
            ['SG Fürth/Sandhausen A-Junioren', 'a_junioren', 'kreisliga', [19, 20]],
            // SG Unterhaching/Uerdingen B-Junioren → Team 99 (clubs 21+22)
            ['SG Unterhaching/Uerdingen B-Junioren', 'b_junioren', 'kreisliga', [21, 22]],
            // SG Aue/1860 D-Junioren → Team 100 (clubs 23+24)
            ['SG Aue/1860 D-Junioren', 'd_junioren', 'kreisliga', [23, 24]],
        ];

        $allTeamData = array_merge($bigClubData, $mediumClubData, $smallClubData, $sgTeamData);

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

            // Weise Klubs zu
            foreach ($clubIndices as $clubIdx) {
                /** @var Club $club */
                $club = $this->getReference('lt_club_' . $clubIdx, Club::class);
                $team->addClub($club);
            }

            $manager->persist($team);
            $this->addReference('lt_team_' . $idx, $team);
        }

        $manager->flush();
    }
}
