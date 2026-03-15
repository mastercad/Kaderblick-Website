<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\PlayerTeamAssignmentTypeFixtures;
use App\DataFixtures\MasterData\PositionFixtures;
use App\DataFixtures\MasterData\StrongFootFixtures;
use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\PlayerTeamAssignmentType;
use App\Entity\Position;
use App\Entity\StrongFoot;
use App\Entity\Team;
use DateTime;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: ~1818 Spieler (18 pro Team, 101 Teams).
 * Beinhaltet 3-Jahres-History durch frühere Team-Zuweisungen, Transfers und Leihgaben.
 *
 * Konventionen:
 * - teamIdx % 3 == 0: Spieler seit 2023-07-01 im Team (3 Saisons)
 * - teamIdx % 3 == 1: Spieler seit 2024-07-01 im Team (2 Saisons), + früheres Team
 * - teamIdx % 3 == 2: Spieler seit 2025-07-01 im Team (1 Saison), + früheres Team
 * - playerLocalIdx % 15 == 0: Leihspieler (auch temp. Zuordnung zu Fremd-Team)
 * - Erste 400 globale Spieler bekommen Referenzen lt_player_0..lt_player_399 für UserRelation
 *
 * Gruppe: load_test
 */
class PlayerFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const TOTAL_TEAMS = 101;
    private const PLAYERS_PER_TEAM = 18;
    private const BATCH_SIZE = 100;

    /** @var array<string, Position> */
    private array $positions = [];

    /** @var array<string, StrongFoot> */
    private array $strongFeet = [];

    /** @var array<string, PlayerTeamAssignmentType> */
    private array $assignmentTypes = [];

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            ClubFixtures::class,
            StrongFootFixtures::class,
            PositionFixtures::class,
            PlayerTeamAssignmentTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        $this->loadMasterData();

        $firstNames = [
            'Lukas', 'Max', 'Felix', 'Jonas', 'Leon', 'Erik', 'Niklas', 'Tim', 'Tobias', 'Sebastian',
            'David', 'Jan', 'Stefan', 'Michael', 'Andreas', 'Christian', 'Florian', 'Kevin', 'Patrick', 'Thomas',
            'Finn', 'Noah', 'Elias', 'Ben', 'Luca', 'Paul', 'Moritz', 'Jannik', 'Marcel', 'Dominic',
            'Oliver', 'Mathias', 'Robert', 'Peter', 'Jens', 'Carsten', 'Markus', 'Philippe', 'Marco', 'Lars',
            'Mohamed', 'Karim', 'Aleksandar', 'Lucas', 'Rafael', 'Diego', 'Ivan', 'Alexei', 'Tomáš', 'Zlatan',
        ];
        $lastNames = [
            'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
            'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Krüger', 'Werner',
            'Hartmann', 'Lange', 'Schmitt', 'König', 'Bauer', 'Zimmermann', 'Kramer', 'Huber', 'Friedrich', 'Maier',
            'Novak', 'Horvat', 'Özkan', 'Silva', 'Santos', 'Pereira', 'Fernandez', 'Garcia', 'Rossi', 'Müller',
            'Frank', 'Walter', 'Lehmann', 'Günter', 'Peters', 'Berger', 'Sommer', 'Jung', 'Brandt', 'Vogel',
        ];

        // Position-Zuweisung nach Trikotnummer innerhalb eines Teams
        $positionMap = [
            0 => 'tw', 1 => 'iv', 2 => 'iv', 3 => 'rv', 4 => 'lv',
            5 => 'dm', 6 => 'zm', 7 => 'zm', 8 => 'rm', 9 => 'lm',
            10 => 'om', 11 => 'ra', 12 => 'la', 13 => 'st', 14 => 'st',
            15 => 'tw', 16 => 'iv', 17 => 'zm',
        ];

        $globalIdx = 0;
        $persistCount = 0;

        for ($teamIdx = 0; $teamIdx < self::TOTAL_TEAMS; ++$teamIdx) {
            /** @var Team $currentTeam */
            $currentTeam = $this->getReference('lt_team_' . $teamIdx, Team::class);
            $clubs = $currentTeam->getClubs()->toArray();
            $primaryClub = $clubs[0];
            $ageGroup = $currentTeam->getAgeGroup();

            // Bestimme Startdatum der aktuellen Zuordnung (Saison-Rotation)
            $currentStartDates = [
                0 => '2023-07-01',
                1 => '2024-07-01',
                2 => '2025-07-01',
            ];
            $currentStartDate = $currentStartDates[$teamIdx % 3];

            for ($localIdx = 0; $localIdx < self::PLAYERS_PER_TEAM; ++$localIdx) {
                $firstName = $firstNames[($globalIdx + $localIdx) % count($firstNames)];
                $lastName = $lastNames[($globalIdx * 3 + $localIdx * 7) % count($lastNames)];
                $email = 'lt.player.' . $globalIdx . '@loadtest-players.de';

                $existing = $manager->getRepository(Player::class)->findOneBy(['email' => $email]);
                if ($existing) {
                    if ($globalIdx < 400) {
                        $this->addReference('lt_player_' . $globalIdx, $existing);
                    }
                    ++$globalIdx;
                    continue;
                }

                $player = new Player();
                $player->setFirstName($firstName);
                $player->setLastName($lastName);
                $player->setEmail($email);

                $posKey = $positionMap[$localIdx];
                /** @var Position $position */
                $position = $this->positions[$posKey];
                $player->setMainPosition($position);

                $footKeys = ['left', 'right', 'right', 'right', 'both'];
                /** @var StrongFoot $strongFoot */
                $strongFoot = $this->strongFeet[$footKeys[$globalIdx % 5]];
                $player->setStrongFoot($strongFoot);

                // Geburtsdatum basierend auf Altersgruppe
                $player->setBirthdate($this->generateBirthdate($ageGroup->getCode()));

                $manager->persist($player);

                // Club-Zuordnung (aktuell, ohne Enddatum)
                $clubAssignment = new PlayerClubAssignment();
                $clubAssignment->setPlayer($player);
                $clubAssignment->setClub($primaryClub);
                $clubAssignment->setStartDate(new DateTimeImmutable($currentStartDate));
                $manager->persist($clubAssignment);

                // Aktuelle Team-Zuordnung
                $assignmentType = $this->getAssignmentTypeByIndex($localIdx);
                $currentTeamAssignment = new PlayerTeamAssignment();
                $currentTeamAssignment->setPlayer($player);
                $currentTeamAssignment->setTeam($currentTeam);
                $currentTeamAssignment->setPlayerTeamAssignmentType($assignmentType);
                $currentTeamAssignment->setShirtNumber($localIdx + 1);
                $currentTeamAssignment->setStartDate(new DateTimeImmutable($currentStartDate));
                // Spieler ohne Enddatum = aktuell aktiv
                $manager->persist($currentTeamAssignment);

                // Frühere Team-Zuordnung für 25% der Spieler (zeigt 3-Jahres-History)
                if (0 !== $teamIdx % 3 && 0 === $localIdx % 4) {
                    $prevTeamIdx = ($teamIdx + 13) % self::TOTAL_TEAMS;
                    /** @var Team $prevTeam */
                    $prevTeam = $this->getReference('lt_team_' . $prevTeamIdx, Team::class);

                    $prevEndDate = (1 === $teamIdx % 3) ? '2024-06-30' : '2025-06-30';
                    $prevStartDate = (1 === $teamIdx % 3) ? '2022-07-01' : '2023-07-01';

                    $pastAssignment = new PlayerTeamAssignment();
                    $pastAssignment->setPlayer($player);
                    $pastAssignment->setTeam($prevTeam);
                    $pastAssignment->setPlayerTeamAssignmentType($this->assignmentTypes['vertragsspieler']);
                    $pastAssignment->setStartDate(new DateTimeImmutable($prevStartDate));
                    $pastAssignment->setEndDate(new DateTimeImmutable($prevEndDate));
                    $manager->persist($pastAssignment);

                    // Frühere Club-Zuordnung (falls anderer Klub)
                    $prevClubs = $prevTeam->getClubs()->toArray();
                    if (!empty($prevClubs) && $prevClubs[0]->getId() !== $primaryClub->getId()) {
                        $prevClubAssignment = new PlayerClubAssignment();
                        $prevClubAssignment->setPlayer($player);
                        $prevClubAssignment->setClub($prevClubs[0]);
                        $prevClubAssignment->setStartDate(new DateTimeImmutable($prevStartDate));
                        $prevClubAssignment->setEndDate(new DateTimeImmutable($prevEndDate));
                        $manager->persist($prevClubAssignment);
                    }
                }

                // Leihgabe: 5% der Spieler (localIdx % 15 == 0)
                if (0 === $localIdx % 15 && $globalIdx > 20) {
                    $loanTeamIdx = ($teamIdx + 7) % self::TOTAL_TEAMS;
                    /** @var Team $loanTeam */
                    $loanTeam = $this->getReference('lt_team_' . $loanTeamIdx, Team::class);

                    $loanStartDate = '2024-01-15';
                    // Einige Leihen sind noch aktiv, andere beendet
                    $loanEndDate = (0 === $teamIdx % 2) ? '2024-06-30' : null;

                    $loanAssignment = new PlayerTeamAssignment();
                    $loanAssignment->setPlayer($player);
                    $loanAssignment->setTeam($loanTeam);
                    $loanAssignment->setPlayerTeamAssignmentType($this->assignmentTypes['leihgabe']);
                    $loanAssignment->setStartDate(new DateTimeImmutable($loanStartDate));
                    if (null !== $loanEndDate) {
                        $loanAssignment->setEndDate(new DateTimeImmutable($loanEndDate));
                    }
                    $manager->persist($loanAssignment);
                }

                // Spieler mit Doppelter Spielberechtigung (Jugend-/Seniorenkombi)
                if (0 === $localIdx % 20 && $globalIdx > 50 && 'A_JUNIOREN' === $ageGroup->getCode()) {
                    $seniorTeamIdx = ($teamIdx + 1) % self::TOTAL_TEAMS;
                    /** @var Team $seniorTeam */
                    $seniorTeam = $this->getReference('lt_team_' . $seniorTeamIdx, Team::class);

                    $doppelAssignment = new PlayerTeamAssignment();
                    $doppelAssignment->setPlayer($player);
                    $doppelAssignment->setTeam($seniorTeam);
                    $doppelAssignment->setPlayerTeamAssignmentType($this->assignmentTypes['doppelte_spielberechtigung']);
                    $doppelAssignment->setStartDate(new DateTimeImmutable('2025-07-01'));
                    $manager->persist($doppelAssignment);
                }

                if ($globalIdx < 400) {
                    $this->addReference('lt_player_' . $globalIdx, $player);
                }

                ++$globalIdx;
                ++$persistCount;

                if (0 === $persistCount % self::BATCH_SIZE) {
                    $manager->flush();
                }
            }
        }

        $manager->flush();
    }

    private function loadMasterData(): void
    {
        $positionCodes = ['tw', 'iv', 'rv', 'lv', 'dm', 'zm', 'om', 'rm', 'lm', 'ra', 'la', 'st'];
        foreach ($positionCodes as $code) {
            $this->positions[$code] = $this->getReference('position_' . $code, Position::class);
        }

        foreach (['left', 'right', 'both'] as $code) {
            $this->strongFeet[$code] = $this->getReference('strong_foot_' . $code, StrongFoot::class);
        }

        $typeKeys = [
            'vertragsspieler', 'leihgabe', 'gastspieler', 'testspieler',
            'jugendspieler', 'doppelte_spielberechtigung', 'kooperationsspieler',
        ];
        foreach ($typeKeys as $key) {
            $this->assignmentTypes[$key] = $this->getReference(
                'player_team_assignment_type_' . $key,
                PlayerTeamAssignmentType::class
            );
        }
    }

    private function getAssignmentTypeByIndex(int $localIdx): PlayerTeamAssignmentType
    {
        return match (true) {
            $localIdx < 12 => $this->assignmentTypes['vertragsspieler'],
            $localIdx < 14 => $this->assignmentTypes['gastspieler'],
            $localIdx < 16 => $this->assignmentTypes['testspieler'],
            $localIdx < 17 => $this->assignmentTypes['jugendspieler'],
            default => $this->assignmentTypes['kooperationsspieler'],
        };
    }

    private function generateBirthdate(string $ageGroupCode): DateTime
    {
        // Geburtsjahre basierend auf Altersgruppe (Bezugsjahr 2026)
        $ranges = [
            'SENIOREN' => [1988, 2007],
            'A_JUNIOREN' => [2006, 2009],
            'B_JUNIOREN' => [2008, 2011],
            'C_JUNIOREN' => [2010, 2013],
            'D_JUNIOREN' => [2012, 2015],
            'E_JUNIOREN' => [2014, 2017],
            'F_JUNIOREN' => [2015, 2019],
            'G_JUNIOREN' => [2018, 2022],
        ];

        [$minYear, $maxYear] = $ranges[$ageGroupCode] ?? [1990, 2005];
        $year = rand($minYear, $maxYear);
        $month = rand(1, 12);
        $day = rand(1, 28);

        return new DateTime($year . '-' . str_pad((string) $month, 2, '0', STR_PAD_LEFT) . '-' . str_pad((string) $day, 2, '0', STR_PAD_LEFT));
    }
}
