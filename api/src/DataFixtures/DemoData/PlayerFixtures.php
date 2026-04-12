<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Club;
use App\Entity\Nationality;
use App\Entity\Player;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerNationalityAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\PlayerTeamAssignmentType;
use App\Entity\Position;
use App\Entity\StrongFoot;
use App\Entity\Team;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Spieler für alle 49 Teams.
 *
 * Altersgerechte Geburtsjahre anhand der Altersgruppe des Teams.
 * Hauptposition + ggf. 1-2 alternative Positionen.
 * Ein-/Austrittsdaten für frühere Spieler; aktuelle Spieler ohne Austrittsdatum.
 *
 * Referenzschlüssel: demo_player_{globalIdx}
 * Gruppe: demo
 */
class PlayerFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 100;

    /** Realistische deutsche Vornamen (m) */
    private const FIRST_NAMES_M = [
        'Lukas', 'Maximilian', 'Jonas', 'Felix', 'Leon', 'Luca', 'Noah', 'Julian',
        'Tim', 'Finn', 'Jan', 'Moritz', 'Paul', 'Tobias', 'Florian', 'Sebastian',
        'Niklas', 'Philipp', 'Simon', 'Stefan', 'Matthias', 'Andreas', 'Thomas',
        'David', 'Marco', 'Kevin', 'Christian', 'Michael', 'Daniel', 'Alexander',
        'Benjamin', 'Fabian', 'Patrick', 'Dominik', 'Manuel', 'Sven', 'Kai',
        'Robin', 'Dennis', 'Marc',
    ];

    /** Realistische Nachnamen */
    private const LAST_NAMES = [
        'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
        'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter',
        'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann',
        'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner',
        'Krause', 'Meier', 'Lehmann', 'Schmid', 'Keller', 'Franke', 'Roth',
        'Beck', 'Lorenz', 'Baumann', 'Albrecht', 'Schubert', 'Maier',
        'Weiß', 'Friedrich', 'Krug', 'Voigt', 'Brandt', 'Ziegler', 'Fink',
        'Pohl', 'Engel', 'Horn',
    ];

    /**
     * Positionen nach Häufigkeit im Mannschaftskader.
     * Format: [positionCode, weight].
     */
    private const POSITION_WEIGHTS = [
        'TW' => 5,
        'IV' => 12,
        'RV' => 8,
        'LV' => 8,
        'DM' => 8,
        'ZM' => 10,
        'OM' => 6,
        'RM' => 6,
        'LM' => 6,
        'RA' => 6,
        'LA' => 6,
        'ST' => 9,
    ];

    /** Sinnvolle alternative Positionen pro Hauptposition */
    private const ALT_POSITIONS = [
        'TW' => [],
        'IV' => ['DM', 'RV', 'LV'],
        'RV' => ['IV', 'RM'],
        'LV' => ['IV', 'LM'],
        'DM' => ['ZM', 'IV'],
        'ZM' => ['DM', 'OM'],
        'OM' => ['ZM', 'RA', 'LA'],
        'RM' => ['RA', 'RV'],
        'LM' => ['LA', 'LV'],
        'RA' => ['RM', 'ST'],
        'LA' => ['LM', 'ST'],
        'ST' => ['RA', 'LA'],
    ];

    /**
     * Anzahl Spieler pro Team, pro Altersgruppe-Typ.
     * [min, max].
     */
    private const PLAYER_COUNT = [
        'senioren' => [18, 28],
        'a_junioren' => [16, 24],
        'b_junioren' => [16, 22],
        'c_junioren' => [14, 20],
        'd_junioren' => [12, 18],
        'e_junioren' => [12, 16],
        'f_junioren' => [10, 16],
        'g_junioren' => [10, 14],
    ];

    private const AGE_RANGE = [
        'senioren' => [19, 38],
        'a_junioren' => [17, 18],
        'b_junioren' => [15, 16],
        'c_junioren' => [13, 14],
        'd_junioren' => [11, 12],
        'e_junioren' => [9, 10],
        'f_junioren' => [7, 8],
        'g_junioren' => [5, 6],
    ];

    /** Club sizes mapped to team definitions (replicated from TeamFixtures) */
    private const CLUB_TEAMS = [
        0 => [
            ['senioren', 'I'], ['senioren', 'II'], ['a_junioren', 'U19'],
            ['b_junioren', 'U17'], ['c_junioren', 'U15'], ['d_junioren', 'U13'],
            ['e_junioren', 'U11'], ['f_junioren', 'U9'], ['g_junioren', 'U7'],
        ],
        1 => [['senioren', 'I'], ['senioren', 'II'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15'], ['d_junioren', 'U13'], ['e_junioren', 'U11']],
        2 => [['senioren', 'I'], ['senioren', 'II'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        3 => [['senioren', 'I'], ['senioren', 'II'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        4 => [['senioren', 'I'], ['senioren', 'II'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        5 => [['senioren', 'I'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        6 => [['senioren', 'I'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        7 => [['senioren', 'I'], ['a_junioren', 'U19'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
        8 => [['senioren', 'I'], ['a_junioren', 'U19'], ['c_junioren', 'U15']],
        9 => [['senioren', 'I'], ['b_junioren', 'U17'], ['c_junioren', 'U15']],
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            ClubFixtures::class,
            \App\DataFixtures\MasterData\PositionFixtures::class,
            \App\DataFixtures\MasterData\StrongFootFixtures::class,
            \App\DataFixtures\MasterData\PlayerTeamAssignmentTypeFixtures::class,
            \App\DataFixtures\MasterData\NationalityFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // Idempotency guard
        $existingPlayer = $manager->getRepository(Player::class)->findOneBy(['email' => 'lukas.mueller.fcs@demo-kaderblick.de']);
        if ($existingPlayer) {
            return;
        }

        // Pre-load master data
        $positions = [];
        foreach ($manager->getRepository(Position::class)->findAll() as $pos) {
            $positions[$pos->getShortName()] = $pos;
        }

        $strongFeetAll = $manager->getRepository(StrongFoot::class)->findAll();
        $strongFoot = [];
        foreach ($strongFeetAll as $sf) {
            $strongFoot[$sf->getCode()] = $sf;
        }

        $assignmentTypes = $manager->getRepository(PlayerTeamAssignmentType::class)->findAll();
        $assignTypeVertrag = null;
        $assignTypeAmatuer = null;
        foreach ($assignmentTypes as $at) {
            if (str_contains($at->getName(), 'Vertrag')) {
                $assignTypeVertrag = $at;
            }
            if (str_contains($at->getName(), 'Amateur') || str_contains($at->getName(), 'Stamm')) {
                $assignTypeAmatuer = $at;
            }
        }
        $defaultAssignType = $assignTypeAmatuer ?? $assignTypeVertrag ?? ($assignmentTypes[0] ?? null);

        $nationality_de = $manager->getRepository(Nationality::class)->findOneBy(['isoCode' => 'DE'])
            ?? $manager->getRepository(Nationality::class)->findAll()[0] ?? null;

        // Build weighted position pool
        $positionPool = [];
        foreach (self::POSITION_WEIGHTS as $code => $weight) {
            for ($i = 0; $i < $weight; ++$i) {
                $positionPool[] = $code;
            }
        }

        $globalIdx = 0;
        $persistCount = 0;
        $today = new DateTime();

        foreach (self::CLUB_TEAMS as $clubIdx => $teams) {
            /** @var Club $club */
            $club = $this->getReference('demo_club_' . $clubIdx, Club::class);

            // Determine global team index start for this club
            $teamIdxOffset = $this->getTeamIdxOffset($clubIdx);

            foreach ($teams as $teamLocalIdx => [$ageGroupCode, $suffix]) {
                $teamRef = 'demo_team_' . ($teamIdxOffset + $teamLocalIdx);
                /** @var Team $team */
                $team = $this->getReference($teamRef, Team::class);

                [$minAge, $maxAge] = self::AGE_RANGE[$ageGroupCode];
                [$minCount, $maxCount] = self::PLAYER_COUNT[$ageGroupCode];

                // Fixed seeded count for reproducibility — these are the ACTIVE players
                $playerCount = $minCount + (($clubIdx * 7 + $teamLocalIdx * 3) % ($maxCount - $minCount + 1));
                // Additional historical players on top (~15% extra)
                $historicalCount = max(1, (int) round($playerCount * 0.15));
                $totalCount = $playerCount + $historicalCount;

                $shirtNumbers = range(1, 40);
                shuffle($shirtNumbers);

                for ($p = 0; $p < $totalCount; ++$p) {
                    $firstNameIdx = ($globalIdx * 7 + $p * 3) % count(self::FIRST_NAMES_M);
                    $lastNameIdx = ($globalIdx * 11 + $p * 7) % count(self::LAST_NAMES);
                    $firstName = self::FIRST_NAMES_M[$firstNameIdx];
                    $lastName = self::LAST_NAMES[$lastNameIdx];

                    // Age-appropriate birthdate
                    $age = $minAge + (($globalIdx + $p) % max(1, $maxAge - $minAge + 1));
                    $birthYear = (int) (new DateTime())->format('Y') - $age;
                    $birthMonth = 1 + (($globalIdx * 3 + $p) % 12);
                    $birthDay = 1 + (($globalIdx * 5 + $p) % 28);
                    $birthdate = new DateTime(sprintf('%04d-%02d-%02d', $birthYear, $birthMonth, $birthDay));

                    /** @var Position $mainPos */
                    $mainPosCode = $positionPool[($globalIdx * 13 + $p * 5) % count($positionPool)];
                    $mainPos = $positions[$mainPosCode] ?? $positions['ZM'];

                    // Strong foot
                    $sfCodes = array_keys($strongFoot);
                    $sfCode = $sfCodes[($globalIdx + $p) % 3];
                    // Most players right-footed
                    if (($globalIdx + $p) % 5 < 3) {
                        $sfCode = 'right';
                    } elseif (($globalIdx + $p) % 5 === 3) {
                        $sfCode = 'left';
                    } else {
                        $sfCode = 'both';
                    }

                    $player = new Player();
                    $player->setFirstName($firstName);
                    $player->setLastName($lastName);
                    $player->setBirthdate($birthdate);
                    $player->setMainPosition($mainPos);
                    if (isset($strongFoot[$sfCode])) {
                        $player->setStrongFoot($strongFoot[$sfCode]);
                    }

                    // Alternative Positions (0-2)
                    $altPosCount = ($globalIdx + $p) % 3;
                    $altPossible = self::ALT_POSITIONS[$mainPosCode];
                    for ($a = 0; $a < min($altPosCount, count($altPossible)); ++$a) {
                        $altCode = $altPossible[$a];
                        if (isset($positions[$altCode])) {
                            $player->addAlternativePosition($positions[$altCode]);
                        }
                    }

                    // Email (unique per player for demo)
                    $emailSlug = strtolower(
                        preg_replace('/[^a-zA-Z0-9]/', '.', $firstName)
                        . '.'
                        . preg_replace('/[^a-zA-Z0-9]/', '.', $lastName)
                        . '.' . $globalIdx
                    );
                    $player->setEmail($emailSlug . '@demo-kaderblick.de');

                    $manager->persist($player);

                    // Nationality
                    if (null !== $nationality_de) {
                        $natAssign = new PlayerNationalityAssignment();
                        $natAssign->setPlayer($player);
                        $natAssign->setNationality($nationality_de);
                        $natAssign->setStartDate(new DateTime($birthYear . '-01-01'));
                        $natAssign->setActive(true);
                        $manager->persist($natAssign);
                    }

                    // PlayerClubAssignment — joined club at a plausible date
                    $joinYear = $birthYear + $minAge - (int) (($globalIdx + $p) % 3);
                    $clubJoinDate = new DateTime(sprintf('%04d-07-01', max($joinYear, 2015)));
                    $pca = new PlayerClubAssignment();
                    $pca->setPlayer($player);
                    $pca->setClub($club);
                    $pca->setStartDate($clubJoinDate);
                    $manager->persist($pca);

                    // PlayerTeamAssignment
                    // First $playerCount players are ACTIVE, remaining $historicalCount have left the team
                    $teamJoinDate = clone $clubJoinDate;
                    $endDate = null;
                    if ($p >= $playerCount) {
                        // Historical: left team 1-3 years ago
                        $yearsAgo = 1 + (($globalIdx + $p) % 3);
                        $endDate = new DateTime(sprintf('%04d-06-30', (int) $today->format('Y') - $yearsAgo));
                    }

                    $pta = new PlayerTeamAssignment();
                    $pta->setPlayer($player);
                    $pta->setTeam($team);
                    $pta->setStartDate($teamJoinDate);
                    $pta->setEndDate($endDate);
                    $pta->setShirtNumber($shirtNumbers[$p % count($shirtNumbers)] ?? ($p + 1));
                    if (null !== $defaultAssignType) {
                        $pta->setPlayerTeamAssignmentType($defaultAssignType);
                    }
                    $manager->persist($pta);

                    $this->addReference('demo_player_' . $globalIdx, $player);
                    ++$globalIdx;
                    ++$persistCount;

                    if (0 === $persistCount % self::BATCH_SIZE) {
                        $clubId = $club->getId();
                        $teamId = $team->getId();
                        $manager->flush();
                        $manager->clear();
                        // Re-fetch entities after clear
                        $club = $manager->find(Club::class, $clubId);
                        $team = $manager->find(Team::class, $teamId);
                        // Re-fetch master data
                        $positions = [];
                        foreach ($manager->getRepository(Position::class)->findAll() as $pos) {
                            $positions[$pos->getShortName()] = $pos;
                        }
                        $strongFeetAll = $manager->getRepository(StrongFoot::class)->findAll();
                        $strongFoot = [];
                        foreach ($strongFeetAll as $sf) {
                            $strongFoot[$sf->getCode()] = $sf;
                        }
                        $assignmentTypes = $manager->getRepository(PlayerTeamAssignmentType::class)->findAll();
                        $defaultAssignType = $assignmentTypes[0] ?? null;
                        $nationality_de = $manager->getRepository(Nationality::class)->findOneBy(['isoCode' => 'DE']);
                    }
                }
            }
        }

        $manager->flush();
    }

    /** Returns the global team index offset for a given club index */
    private function getTeamIdxOffset(int $clubIdx): int
    {
        $offset = 0;
        foreach (self::CLUB_TEAMS as $idx => $teams) {
            if ($idx >= $clubIdx) {
                break;
            }
            $offset += count($teams);
        }

        return $offset;
    }
}
