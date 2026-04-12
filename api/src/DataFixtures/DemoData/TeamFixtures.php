<?php

namespace App\DataFixtures\DemoData;

use App\Entity\AgeGroup;
use App\Entity\Club;
use App\Entity\League;
use App\Entity\Team;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Teams für alle 10 Vereine.
 *
 * Alle 10 Senioren-I-Teams spielen in der "Kreisliga A" gegeneinander (10er-Liga).
 * Senioren-II-Teams in "Kreisklasse A".
 * Jugendteams in entsprechenden Jugendligen.
 *
 * Gesamtanzahl Teams: 49
 * Referenzschlüssel: demo_team_{idx}  (0-48)
 * Referenzschlüssel: demo_team_{clubIdx}_{ageGroupCode}  (z.B. demo_team_0_senioren)
 *
 * Gruppe: demo
 */
class TeamFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            ClubFixtures::class,
            \App\DataFixtures\MasterData\AgeGroupFixtures::class,
            \App\DataFixtures\MasterData\LeagueFixtures::class,
        ];
    }

    /**
     * Team-Konfiguration: clubIdx => [ [ageGroupCode, teamNameSuffix, leagueRef], ... ].
     */
    private const CLUB_TEAMS = [
        // FC Sonnenberg (groß – 9 Teams)
        0 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['senioren',   'II',    'league_kreisklasse_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisliga_a'],
            ['d_junioren', 'U13',   'league_kreisklasse_a'],
            ['e_junioren', 'U11',   'league_kreisklasse_a'],
            ['f_junioren', 'U9',    'league_kreisklasse_a'],
            ['g_junioren', 'U7',    null],
        ],
        // TSV Waldkirchen (groß – 7 Teams)
        1 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['senioren',   'II',    'league_kreisklasse_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisliga_a'],
            ['d_junioren', 'U13',   'league_kreisklasse_a'],
            ['e_junioren', 'U11',   'league_kreisklasse_a'],
        ],
        // SV Bergheim (mittel – 5 Teams)
        2 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['senioren',   'II',    'league_kreisklasse_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // SC Rosenbach (mittel – 5 Teams)
        3 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['senioren',   'II',    'league_kreisklasse_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // VfB Mittelstadt (mittel – 5 Teams)
        4 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['senioren',   'II',    'league_kreisklasse_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // FC Rotbach (klein – 4 Teams)
        5 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // TSG Langental (klein – 4 Teams)
        6 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // SpVgg Grünhöhe (klein – 4 Teams)
        7 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // FV Birkenau (klein – 3 Teams)
        8 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['a_junioren', 'U19',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
        // SV Eintracht Weissach (klein – 3 Teams)
        9 => [
            ['senioren',   'I',     'league_kreisliga_a'],
            ['b_junioren', 'U17',   'league_kreisliga_a'],
            ['c_junioren', 'U15',   'league_kreisklasse_a'],
        ],
    ];

    /** Club short names for team name generation */
    private const CLUB_SHORT = [
        0 => 'FC Sonnenberg',
        1 => 'TSV Waldkirchen',
        2 => 'SV Bergheim',
        3 => 'SC Rosenbach',
        4 => 'VfB Mittelstadt',
        5 => 'FC Rotbach',
        6 => 'TSG Langental',
        7 => 'SpVgg Grünhöhe',
        8 => 'FV Birkenau',
        9 => 'SV Weissach',
    ];

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // Idempotency guard
        $existingTeam = $manager->getRepository(Team::class)->findOneBy(['name' => 'FC Sonnenberg Senioren I']);
        if ($existingTeam) {
            $this->reRegisterReferences($manager);

            return;
        }

        $idx = 0;
        foreach (self::CLUB_TEAMS as $clubIdx => $teams) {
            /** @var Club $club */
            $club = $this->getReference('demo_club_' . $clubIdx, Club::class);

            foreach ($teams as [$ageGroupCode, $suffix, $leagueRef]) {
                $ageGroupRefKey = 'age_group_' . $ageGroupCode;
                /** @var AgeGroup $ageGroup */
                $ageGroup = $this->getReference($ageGroupRefKey, AgeGroup::class);

                $team = new Team();
                $ageName = $this->ageGroupDisplayName($ageGroupCode, $suffix);
                $teamName = self::CLUB_SHORT[$clubIdx] . ' ' . $ageName;
                $team->setName($teamName);
                $team->setAgeGroup($ageGroup);
                $team->setDefaultHalfDuration($this->halfDuration($ageGroupCode));
                $team->setDefaultHalfTimeBreakDuration(15);
                $team->addClub($club);

                if (null !== $leagueRef) {
                    /** @var League $league */
                    $league = $this->getReference($leagueRef, League::class);
                    $team->setLeague($league);
                }

                $manager->persist($team);
                $this->addReference('demo_team_' . $idx, $team);
                // For Senioren: only register generic _senioren reference for Senioren I (suffix 'I')
                if ('senioren' !== $ageGroupCode || 'I' === $suffix) {
                    $this->addReference('demo_team_' . $clubIdx . '_' . $ageGroupCode, $team);
                }
                // For clubs with 2 Senioren teams, add explicit _senioren_ii reference
                if ('senioren' === $ageGroupCode && 'II' === $suffix) {
                    $this->addReference('demo_team_' . $clubIdx . '_senioren_ii', $team);
                }
                ++$idx;
            }
        }

        $manager->flush();
    }

    private function reRegisterReferences(ObjectManager $manager): void
    {
        $idx = 0;
        foreach (self::CLUB_TEAMS as $clubIdx => $teams) {
            foreach ($teams as [$ageGroupCode, $suffix, $leagueRef]) {
                $ageName = $this->ageGroupDisplayName($ageGroupCode, $suffix);
                $teamName = self::CLUB_SHORT[$clubIdx] . ' ' . $ageName;
                $team = $manager->getRepository(Team::class)->findOneBy(['name' => $teamName]);
                if ($team) {
                    $this->addReference('demo_team_' . $idx, $team);
                    if ('senioren' !== $ageGroupCode || 'I' === $suffix) {
                        $this->addReference('demo_team_' . $clubIdx . '_' . $ageGroupCode, $team);
                    }
                    if ('senioren' === $ageGroupCode && 'II' === $suffix) {
                        $this->addReference('demo_team_' . $clubIdx . '_senioren_ii', $team);
                    }
                }
                ++$idx;
            }
        }
    }

    private function ageGroupDisplayName(string $code, string $suffix): string
    {
        return match ($code) {
            'senioren' => 'Senioren ' . $suffix,
            'a_junioren' => 'A-Junioren (' . $suffix . ')',
            'b_junioren' => 'B-Junioren (' . $suffix . ')',
            'c_junioren' => 'C-Junioren (' . $suffix . ')',
            'd_junioren' => 'D-Junioren (' . $suffix . ')',
            'e_junioren' => 'E-Junioren (' . $suffix . ')',
            'f_junioren' => 'F-Junioren (' . $suffix . ')',
            'g_junioren' => 'G-Junioren (' . $suffix . ')',
            default => $suffix,
        };
    }

    /** Half duration in minutes depending on age group (DFB rules) */
    private function halfDuration(string $code): int
    {
        return match ($code) {
            'g_junioren' => 10,
            'f_junioren' => 15,
            'e_junioren' => 20,
            'd_junioren' => 25,
            'c_junioren' => 30,
            'b_junioren' => 35,
            'a_junioren' => 40,
            default => 45, // Senioren
        };
    }

    /**
     * Returns all team definitions as [clubIdx, ageGroupCode, suffix] for external use.
     *
     * @return array<int, array{0: int, 1: string, 2: string}>
     */
    public static function getTeamDefinitions(): array
    {
        $result = [];
        foreach (self::CLUB_TEAMS as $clubIdx => $teams) {
            foreach ($teams as [$ageGroupCode, $suffix, $leagueRef]) {
                $result[] = [$clubIdx, $ageGroupCode, $suffix];
            }
        }

        return $result;
    }

    /** @return list<list<array{0: int, 1: string, 2: string}>> */
    public static function getClubTeams(): array
    {
        return array_map(
            fn ($clubIdx, $teams) => array_map(
                fn ($t) => [$clubIdx, $t[0], $t[1]],
                $teams
            ),
            array_keys(self::CLUB_TEAMS),
            self::CLUB_TEAMS
        );
    }

    /** Total number of teams across all clubs */
    public static function getTotalTeams(): int
    {
        return array_sum(array_map('count', self::CLUB_TEAMS));
    }

    /**
     * Returns [teamGlobalIdx => [clubIdx, ageGroupCode, suffix]].
     *
     * @return array<int, array{clubIdx: int, ageGroupCode: string, suffix: string}>
     */
    public static function getTeamIndexMap(): array
    {
        $map = [];
        $idx = 0;
        foreach (self::CLUB_TEAMS as $clubIdx => $teams) {
            foreach ($teams as [$ageGroupCode, $suffix, $leagueRef]) {
                $map[$idx] = ['clubIdx' => $clubIdx, 'ageGroupCode' => $ageGroupCode, 'suffix' => $suffix];
                ++$idx;
            }
        }

        return $map;
    }
}
