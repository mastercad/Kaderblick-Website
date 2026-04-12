<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachLicense;
use App\Entity\CoachLicenseAssignment;
use App\Entity\CoachNationalityAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\CoachTeamAssignmentType;
use App\Entity\Nationality;
use App\Entity\Team;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use Exception;

/**
 * Demo-Fixtures: Trainer für alle 10 Vereine.
 *
 * Pro Verein 3-5 Trainer (Cheftrainer, Co-Trainer, Jugendtrainer).
 * Referenzschlüssel: demo_coach_{globalIdx}
 * Gruppe: demo
 */
class CoachFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            ClubFixtures::class,
            \App\DataFixtures\MasterData\CoachLicenseFixtures::class,
            \App\DataFixtures\MasterData\CoachTeamAssignmentTypeFixtures::class,
            \App\DataFixtures\MasterData\NationalityFixtures::class,
        ];
    }

    private const COACHES = [
        // Verein 0 – FC Sonnenberg
        ['firstName' => 'Markus',    'lastName' => 'Berger',     'clubIdx' => 0, 'age' => 44, 'license' => 'UEFA B-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Stefan',    'lastName' => 'Gruber',     'clubIdx' => 0, 'age' => 38, 'license' => 'DFB C-Lizenz', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        ['firstName' => 'Ralf',      'lastName' => 'Steinmann',  'clubIdx' => 0, 'age' => 35, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'a_junioren'],
        ['firstName' => 'Oliver',    'lastName' => 'Haupt',      'clubIdx' => 0, 'age' => 31, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'b_junioren'],
        ['firstName' => 'Thomas',    'lastName' => 'Kraft',      'clubIdx' => 0, 'age' => 28, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'c_junioren'],
        // Verein 1 – TSV Waldkirchen
        ['firstName' => 'Andreas',   'lastName' => 'Hofer',      'clubIdx' => 1, 'age' => 47, 'license' => 'UEFA B-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Jürgen',    'lastName' => 'Meier',      'clubIdx' => 1, 'age' => 32, 'license' => 'DFB C-Lizenz', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        ['firstName' => 'Christian', 'lastName' => 'Pfister',    'clubIdx' => 1, 'age' => 36, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'a_junioren'],
        ['firstName' => 'Rainer',    'lastName' => 'Weiss',      'clubIdx' => 1, 'age' => 29, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'b_junioren'],
        // Verein 2 – SV Bergheim
        ['firstName' => 'Klaus',     'lastName' => 'Adler',      'clubIdx' => 2, 'age' => 42, 'license' => 'DFB B-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Peter',     'lastName' => 'Fuchs',      'clubIdx' => 2, 'age' => 34, 'license' => 'DFB C-Lizenz', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        ['firstName' => 'Frank',     'lastName' => 'Kober',      'clubIdx' => 2, 'age' => 27, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'a_junioren'],
        // Verein 3 – SC Rosenbach
        ['firstName' => 'Bernd',     'lastName' => 'Lanzinger',  'clubIdx' => 3, 'age' => 49, 'license' => 'UEFA B-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Wolfgang',  'lastName' => 'Glaser',     'clubIdx' => 3, 'age' => 33, 'license' => 'DFB C-Lizenz', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        ['firstName' => 'Tobias',    'lastName' => 'Reuter',     'clubIdx' => 3, 'age' => 26, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'a_junioren'],
        // Verein 4 – VfB Mittelstadt
        ['firstName' => 'Michael',   'lastName' => 'Heck',       'clubIdx' => 4, 'age' => 45, 'license' => 'DFB B-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Carsten',   'lastName' => 'Böhm',       'clubIdx' => 4, 'age' => 36, 'license' => 'DFB C-Lizenz', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        ['firstName' => 'Daniel',    'lastName' => 'Aigner',     'clubIdx' => 4, 'age' => 30, 'license' => 'Übungsleiter', 'role' => 'Cheftrainer',    'ageGroup' => 'a_junioren'],
        // Verein 5 – FC Rotbach
        ['firstName' => 'Werner',    'lastName' => 'Schell',     'clubIdx' => 5, 'age' => 52, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Gerd',      'lastName' => 'Huber',      'clubIdx' => 5, 'age' => 30, 'license' => 'Übungsleiter', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        // Verein 6 – TSG Langental
        ['firstName' => 'Harald',    'lastName' => 'Baum',       'clubIdx' => 6, 'age' => 43, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Martin',    'lastName' => 'Vogt',       'clubIdx' => 6, 'age' => 28, 'license' => 'Übungsleiter', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        // Verein 7 – SpVgg Grünhöhe
        ['firstName' => 'Ingo',      'lastName' => 'Pfeiffer',   'clubIdx' => 7, 'age' => 40, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        ['firstName' => 'Roland',    'lastName' => 'Zink',       'clubIdx' => 7, 'age' => 31, 'license' => 'Übungsleiter', 'role' => 'Co-Trainer',     'ageGroup' => 'senioren'],
        // Verein 8 – FV Birkenau
        ['firstName' => 'Norbert',   'lastName' => 'Fröhlich',   'clubIdx' => 8, 'age' => 46, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
        // Verein 9 – SV Weissach
        ['firstName' => 'Helmut',    'lastName' => 'Siebert',    'clubIdx' => 9, 'age' => 51, 'license' => 'DFB C-Lizenz', 'role' => 'Cheftrainer',    'ageGroup' => 'senioren'],
    ];

    private const TEAM_IDX_OFFSETS = [0 => 0, 1 => 9, 2 => 16, 3 => 21, 4 => 26, 5 => 31, 6 => 35, 7 => 39, 8 => 43, 9 => 46];

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        $existingCoach = $manager->getRepository(Coach::class)->findOneBy(['email' => 'markus.berger.coach@demo-kaderblick.de']);
        if ($existingCoach) {
            foreach (self::COACHES as $idx => $data) {
                $coach = $manager->getRepository(Coach::class)->findOneBy(['email' => strtolower($data['firstName'] . '.' . $data['lastName']) . '.coach@demo-kaderblick.de']);
                if ($coach) {
                    $this->addReference('demo_coach_' . $idx, $coach);
                }
            }

            return;
        }

        /** @var Nationality|null $nationality_de */
        $nationality_de = $manager->getRepository(Nationality::class)->findOneBy(['isoCode' => 'DE']);

        // Pre-load assignment types
        $assignmentTypes = $manager->getRepository(CoachTeamAssignmentType::class)->findAll();
        $typeMap = [];
        foreach ($assignmentTypes as $at) {
            $typeMap[$at->getName()] = $at;
        }
        $cheftrainerType = $typeMap['Cheftrainer'] ?? $assignmentTypes[0];
        $coTrainerType = $typeMap['Co-Trainer'] ?? ($assignmentTypes[1] ?? $assignmentTypes[0]);

        // Pre-load licenses
        $allLicenses = $manager->getRepository(CoachLicense::class)->findAll();
        $licenseMap = [];
        foreach ($allLicenses as $lic) {
            $licenseMap[$lic->getName()] = $lic;
        }

        foreach (self::COACHES as $idx => $data) {
            $coach = new Coach();
            $coach->setFirstName($data['firstName']);
            $coach->setLastName($data['lastName']);

            $birthYear = (int) (new DateTime())->format('Y') - $data['age'];
            $coach->setBirthdate(new DateTime(sprintf('%04d-06-15', $birthYear)));
            $emailSlug = strtolower($data['firstName'] . '.' . $data['lastName']) . '.coach@demo-kaderblick.de';
            $coach->setEmail($emailSlug);

            $manager->persist($coach);
            $this->addReference('demo_coach_' . $idx, $coach);

            // Nationality
            if (null !== $nationality_de) {
                $natAssign = new CoachNationalityAssignment();
                $natAssign->setCoach($coach);
                $natAssign->setNationality($nationality_de);
                $natAssign->setStartDate(new DateTime($birthYear . '-01-01'));
                $natAssign->setActive(true);
                $manager->persist($natAssign);
            }

            // License
            $licName = $data['license'];
            // Try to find matching license (partial match)
            $license = null;
            foreach ($licenseMap as $name => $lic) {
                if (str_contains($name, $licName) || str_contains($licName, $name)) {
                    $license = $lic;
                    break;
                }
            }
            if (null === $license && !empty($licenseMap)) {
                $license = array_values($licenseMap)[0];
            }
            if (null !== $license) {
                $licAssign = new CoachLicenseAssignment();
                $licAssign->setCoach($coach);
                $licAssign->setLicense($license);
                $licAssign->setStartDate(new DateTime(sprintf('%04d-03-01', (int) (new DateTime())->format('Y') - 5)));
                $licAssign->setActive(true);
                $manager->persist($licAssign);
            }

            // Club assignment
            $clubIdx = $data['clubIdx'];
            /** @var Club $club */
            $club = $this->getReference('demo_club_' . $clubIdx, Club::class);
            $clubAssign = new CoachClubAssignment();
            $clubAssign->setCoach($coach);
            $clubAssign->setClub($club);
            $clubAssign->setStartDate(new DateTime('2020-07-01'));
            $manager->persist($clubAssign);

            // Team assignment
            $ageGroupCode = $data['ageGroup'];
            $teamRef = $this->resolveTeamRef($clubIdx, $ageGroupCode);
            if (null !== $teamRef) {
                try {
                    /** @var Team $team */
                    $team = $this->getReference($teamRef, Team::class);
                    $role = $data['role'];
                    $teamAssignType = (str_contains($role, 'Cheftrainer')) ? $cheftrainerType : $coTrainerType;
                    $teamAssign = new CoachTeamAssignment();
                    $teamAssign->setCoach($coach);
                    $teamAssign->setTeam($team);
                    $teamAssign->setCoachTeamAssignmentType($teamAssignType);
                    $teamAssign->setStartDate(new DateTime('2022-07-01'));
                    $manager->persist($teamAssign);
                } catch (Exception) {
                    // Reference not found – skip
                }
            }
        }

        $manager->flush();
    }

    private function resolveTeamRef(int $clubIdx, string $ageGroupCode): ?string
    {
        $offset = self::TEAM_IDX_OFFSETS[$clubIdx] ?? null;
        if (null === $offset) {
            return null;
        }
        // Map ageGroupCode to team sub-index within the club
        $subIdx = match ($ageGroupCode) {
            'senioren' => 0,
            'a_junioren' => match ($clubIdx) {
                0 => 2, 1 => 2, 2 => 2, 3 => 2, 4 => 2, 5 => 1, 6 => 1, 7 => 1, 8 => 1,
                default => null,
            },
            'b_junioren' => match ($clubIdx) {
                0 => 3, 1 => 3, 2 => 3, 3 => 3, 4 => 3, 5 => 2, 6 => 2, 7 => 2, 9 => 1,
                default => null,
            },
            'c_junioren' => match ($clubIdx) {
                0 => 4, 1 => 4, 2 => 4, 3 => 4, 4 => 4, 5 => 3, 6 => 3, 7 => 3, 8 => 2, 9 => 2,
                default => null,
            },
            default => null,
        };
        if (null === $subIdx) {
            return null;
        }

        return 'demo_team_' . ($offset + $subIdx);
    }
}
