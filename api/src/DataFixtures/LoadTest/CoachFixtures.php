<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\CoachTeamAssignmentTypeFixtures;
use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\CoachTeamAssignmentType;
use App\Entity\Team;
use DateTime;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: ~202 Trainer (2 pro Team, 101 Teams).
 * Beinhaltet 3-Jahres-History: frühere Team-Zuweisungen und Interimstrainer.
 * Einige Trainer sind in mehreren Klubs/Teams aktiv (Gasttrainer, Übungsleiter).
 *
 * Referenz-Keys: lt_coach_0 bis lt_coach_201
 * Gruppe: load_test
 */
class CoachFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const TOTAL_TEAMS = 101;
    private const COACHES_PER_TEAM = 2;
    private const BATCH_SIZE = 50;

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            ClubFixtures::class,
            CoachTeamAssignmentTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var CoachTeamAssignmentType $typeCheftrainer */
        $typeCheftrainer = $this->getReference('coach_team_assignment_type_cheftrainer', CoachTeamAssignmentType::class);
        /** @var CoachTeamAssignmentType $typeCoTrainer */
        $typeCoTrainer = $this->getReference('coach_team_assignment_type_co_trainer', CoachTeamAssignmentType::class);
        /** @var CoachTeamAssignmentType $typeInterim */
        $typeInterim = $this->getReference('coach_team_assignment_type_interimstrainer', CoachTeamAssignmentType::class);
        /** @var CoachTeamAssignmentType $typeTW */
        $typeTW = $this->getReference('coach_team_assignment_type_torwarttrainer', CoachTeamAssignmentType::class);

        $firstNames = [
            'Hans', 'Karl', 'Rudi', 'Peter', 'Walter', 'Klaus', 'Werner', 'Jürgen', 'Bernd', 'Horst',
            'Dieter', 'Manfred', 'Günter', 'Rainer', 'Uwe', 'Hartmut', 'Wilfried', 'Norbert', 'Arnold', 'Sigmar',
            'Jogi', 'Hansi', 'Otto', 'Herbert', 'Gerhard', 'Heinrich', 'Wilhelm', 'Lothar', 'Ernst', 'Franz',
            'Stephan', 'Jochen', 'Joachim', 'Eberhard', 'Reinhard', 'Friedhelm', 'Willi', 'Helmut', 'Konrad', 'Edmund',
        ];
        $lastNames = [
            'Löw', 'Flick', 'Hitzfeld', 'Rangnick', 'Klinsmann', 'Bierhoff', 'Matthäus', 'Beckenbauer', 'Netzer', 'Völler',
            'Rehhagel', 'Magath', 'Rutten', 'Favre', 'Tedesco', 'Nagelsmann', 'Rose', 'Tuchel', 'Klopp', 'Doll',
            'Krauss', 'Daum', 'Babbel', 'Skibbe', 'Preuß', 'Kirsten', 'Kobiela', 'Funkel', 'Schubert', 'Labbadia',
            'Weinzierl', 'Hecking', 'Stöger', 'Schmidt', 'Schuster', 'Tayfun', 'Köllner', 'Bierofka', 'Nouri', 'Glasner',
        ];

        $persistCount = 0;
        $globalCoachIdx = 0;

        for ($teamIdx = 0; $teamIdx < self::TOTAL_TEAMS; ++$teamIdx) {
            /** @var Team $team */
            $team = $this->getReference('lt_team_' . $teamIdx, Team::class);
            $clubs = $team->getClubs()->toArray();
            $primaryClub = $clubs[0];

            for ($localIdx = 0; $localIdx < self::COACHES_PER_TEAM; ++$localIdx) {
                $firstName = $firstNames[$globalCoachIdx % count($firstNames)];
                $lastName = $lastNames[($globalCoachIdx * 3) % count($lastNames)];
                $email = 'lt.coach.' . $globalCoachIdx . '@loadtest-coaches.de';

                $existing = $manager->getRepository(Coach::class)->findOneBy(['email' => $email]);
                if ($existing) {
                    $this->addReference('lt_coach_' . $globalCoachIdx, $existing);
                    ++$globalCoachIdx;
                    continue;
                }

                $coach = new Coach();
                $coach->setFirstName($firstName);
                $coach->setLastName($lastName);
                $coach->setEmail($email);

                // Geburtsdatum (Trainer: 25-65 Jahre)
                $birthYear = rand(1965, 1999);
                $coach->setBirthdate(
                    new DateTime($birthYear . '-' . str_pad((string) rand(1, 12), 2, '0', STR_PAD_LEFT)
                        . '-' . str_pad((string) rand(1, 28), 2, '0', STR_PAD_LEFT))
                );

                $manager->persist($coach);

                // Club-Zuordnung (aktuell, offen)
                $clubAssignment = new CoachClubAssignment();
                $clubAssignment->setCoach($coach);
                $clubAssignment->setClub($primaryClub);
                $clubAssignment->setStartDate(new DateTimeImmutable('2023-07-01'));
                $clubAssignment->setActive(true);
                $manager->persist($clubAssignment);

                // Aktuelle Team-Zuordnung
                $assignmentType = (0 === $localIdx) ? $typeCheftrainer : $typeCoTrainer;
                $startDate = match ($teamIdx % 3) {
                    0 => '2023-07-01',
                    1 => '2024-07-01',
                    default => '2025-07-01',
                };

                $teamAssignment = new CoachTeamAssignment();
                $teamAssignment->setCoach($coach);
                $teamAssignment->setTeam($team);
                $teamAssignment->setCoachTeamAssignmentType($assignmentType);
                $teamAssignment->setStartDate(new DateTimeImmutable($startDate));
                // Kein Enddatum = aktuell aktiv
                $manager->persist($teamAssignment);

                // Frühere Team-Zuordnung für 30% der Trainer (zeigt Wechsel)
                if (0 !== $teamIdx % 3 && 0 === $localIdx && 0 === $globalCoachIdx % 3) {
                    $prevTeamIdx = ($teamIdx + 9) % self::TOTAL_TEAMS;
                    /** @var Team $prevTeam */
                    $prevTeam = $this->getReference('lt_team_' . $prevTeamIdx, Team::class);

                    $prevEndDate = (1 === $teamIdx % 3) ? '2024-06-30' : '2023-06-30';
                    $prevStartDate = (1 === $teamIdx % 3) ? '2021-07-01' : '2022-07-01';

                    $pastTeamAssignment = new CoachTeamAssignment();
                    $pastTeamAssignment->setCoach($coach);
                    $pastTeamAssignment->setTeam($prevTeam);
                    $pastTeamAssignment->setCoachTeamAssignmentType($typeInterim);
                    $pastTeamAssignment->setStartDate(new DateTimeImmutable($prevStartDate));
                    $pastTeamAssignment->setEndDate(new DateTimeImmutable($prevEndDate));
                    $manager->persist($pastTeamAssignment);
                }

                // Torwarttrainer für jeden 10. Cheftrainer (er übernimmt zusätzlich TW-Training)
                if (0 === $localIdx && 0 === $globalCoachIdx % 10) {
                    $twAssignment = new CoachTeamAssignment();
                    $twAssignment->setCoach($coach);
                    $twAssignment->setTeam($team);
                    $twAssignment->setCoachTeamAssignmentType($typeTW);
                    $twAssignment->setStartDate(new DateTimeImmutable($startDate));
                    $manager->persist($twAssignment);
                }

                // Gasttrainer (5% der Co-Trainer gleichzeitig in zweitem Team)
                if (1 === $localIdx && 0 === $globalCoachIdx % 20) {
                    $guestTeamIdx = ($teamIdx + 5) % self::TOTAL_TEAMS;
                    if ($guestTeamIdx !== $teamIdx) {
                        /** @var Team $guestTeam */
                        $guestTeam = $this->getReference('lt_team_' . $guestTeamIdx, Team::class);
                        $guestTeamAssignment = new CoachTeamAssignment();
                        $guestTeamAssignment->setCoach($coach);
                        $guestTeamAssignment->setTeam($guestTeam);
                        $guestTeamAssignment->setCoachTeamAssignmentType($typeCoTrainer);
                        $guestTeamAssignment->setStartDate(new DateTimeImmutable('2025-01-01'));
                        $manager->persist($guestTeamAssignment);
                    }
                }

                $this->addReference('lt_coach_' . $globalCoachIdx, $coach);
                ++$globalCoachIdx;
                ++$persistCount;

                if (0 === $persistCount % self::BATCH_SIZE) {
                    $manager->flush();
                }
            }
        }

        $manager->flush();
    }
}
