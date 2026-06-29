<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryClubAssignmentType;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\StaffClubAssignment;
use App\Entity\StaffClubAssignmentType;
use App\Entity\StaffTeamAssignment;
use App\Entity\StaffTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Demo-Fixtures: Verknüpft Staff-/Funktionärs-Login-Accounts mit Verein oder Team.
 *
 * Erstellt pro fachlich sinnvoll vorhandenem Master-Typ einen Login und eine passende Zuordnung.
 * Suffixe "-team" und "-verein" unterscheiden gleichnamige Rollen nach Scope.
 *
 * Gruppe: demo
 */
class StaffFunctionaryAssignmentFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const CLUB_SLUGS = [
        0 => 'sonnenberg',
        1 => 'waldkirchen',
        2 => 'bergheim',
        3 => 'rosenbach',
        4 => 'mittelstadt',
        5 => 'rotbach',
        6 => 'langental',
        7 => 'gruenhoehe',
        8 => 'birkenau',
        9 => 'weissach',
    ];

    private const FUNCTIONARY_TEAM_ASSIGNMENTS = [
        'functionary_team_mannschaftskapitaen' => 'Mannschaftskapitän',
        'functionary_team_spielfuehrer' => 'Spielführer',
        'functionary_team_jugendwart' => 'Jugendwart',
        'functionary_team_elternbeirat' => 'Elternbeirat',
        'functionary_team_kassenwart' => 'Kassenwart',
    ];

    private const FUNCTIONARY_CLUB_ASSIGNMENTS = [
        'functionary_club_vereinspraesident' => 'Vereinspräsident',
        'functionary_club_vizepraesident' => 'Vizepräsident',
        'functionary_club_sportwart' => 'Sportwart',
        'functionary_club_schriftfuehrer' => 'Schriftführer',
        'functionary_club_beisitzer' => 'Beisitzer',
        'functionary_club_kassenwart' => 'Kassenwart',
    ];

    private const STAFF_TEAM_ASSIGNMENTS = [
        'staff_team_physiotherapeut' => 'Physiotherapeut',
        'staff_team_teammanager' => 'Teammanager',
        'staff_team_zeugwart' => 'Zeugwart',
        'staff_team_busfahrer' => 'Busfahrer',
        'staff_team_medienbeauftragter' => 'Medienbeauftragter',
    ];

    private const STAFF_CLUB_ASSIGNMENTS = [
        'staff_club_vereinsarzt' => 'Vereinsarzt',
        'staff_club_geschaeftsfuehrer' => 'Geschäftsführer',
        'staff_club_platzwart' => 'Platzwart',
        'staff_club_pressesprecher' => 'Pressesprecher',
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            UserFixtures::class,
            TeamFixtures::class,
            ClubFixtures::class,
            \App\DataFixtures\MasterData\FunctionaryTeamAssignmentTypeFixtures::class,
            \App\DataFixtures\MasterData\FunctionaryClubAssignmentTypeFixtures::class,
            \App\DataFixtures\MasterData\StaffTeamAssignmentTypeFixtures::class,
            \App\DataFixtures\MasterData\StaffClubAssignmentTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        $functionaryTeamTypes = $this->requireTypes(
            $manager,
            FunctionaryTeamAssignmentType::class,
            self::FUNCTIONARY_TEAM_ASSIGNMENTS
        );
        $functionaryClubTypes = $this->requireTypes(
            $manager,
            FunctionaryClubAssignmentType::class,
            self::FUNCTIONARY_CLUB_ASSIGNMENTS
        );
        $staffTeamTypes = $this->requireTypes(
            $manager,
            StaffTeamAssignmentType::class,
            self::STAFF_TEAM_ASSIGNMENTS
        );
        $staffClubTypes = $this->requireTypes(
            $manager,
            StaffClubAssignmentType::class,
            self::STAFF_CLUB_ASSIGNMENTS
        );
        $startDate = new DateTimeImmutable('2024-07-01');

        foreach (array_keys(self::CLUB_SLUGS) as $clubIdx) {
            /** @var Club $club */
            $club = $this->getReference('demo_club_' . $clubIdx, Club::class);
            /** @var Team $seniorTeam */
            $seniorTeam = $this->getReference('demo_team_' . $clubIdx . '_senioren', Team::class);

            foreach ($functionaryTeamTypes as $key => $type) {
                /** @var User $user */
                $user = $this->getReference('demo_staff_functionary_user_' . $clubIdx . '_' . $key, User::class);
                $this->upsertFunctionaryTeamAssignment($manager, $user, $seniorTeam, $type, $startDate);
            }

            foreach ($functionaryClubTypes as $key => $type) {
                /** @var User $user */
                $user = $this->getReference('demo_staff_functionary_user_' . $clubIdx . '_' . $key, User::class);
                $this->upsertFunctionaryClubAssignment($manager, $user, $club, $type, $startDate);
            }

            foreach ($staffTeamTypes as $key => $type) {
                /** @var User $user */
                $user = $this->getReference('demo_staff_functionary_user_' . $clubIdx . '_' . $key, User::class);
                $this->upsertStaffTeamAssignment($manager, $user, $seniorTeam, $type, $startDate);
            }

            foreach ($staffClubTypes as $key => $type) {
                /** @var User $user */
                $user = $this->getReference('demo_staff_functionary_user_' . $clubIdx . '_' . $key, User::class);
                $this->upsertStaffClubAssignment($manager, $user, $club, $type, $startDate);
            }
        }

        $manager->flush();
    }

    /**
     * @template T of object
     *
     * @param class-string<T>       $className
     * @param array<string, string> $assignments
     *
     * @return array<string, T>
     */
    private function requireTypes(ObjectManager $manager, string $className, array $assignments): array
    {
        $types = [];
        foreach ($assignments as $key => $name) {
            $type = $manager->getRepository($className)->findOneBy(['name' => $name]);
            if (!$type) {
                throw new RuntimeException(sprintf('Missing assignment type "%s" for %s.', $name, $className));
            }

            $types[$key] = $type;
        }

        return $types;
    }

    private function upsertFunctionaryTeamAssignment(
        ObjectManager $manager,
        User $user,
        Team $team,
        FunctionaryTeamAssignmentType $type,
        DateTimeImmutable $startDate,
    ): void {
        $assignment = $manager->getRepository(FunctionaryTeamAssignment::class)->findOneBy([
            'user' => $user,
            'team' => $team,
            'functionaryTeamAssignmentType' => $type,
        ]) ?? new FunctionaryTeamAssignment();

        $assignment->setUser($user);
        $assignment->setTeam($team);
        $assignment->setFunctionaryTeamAssignmentType($type);
        $assignment->setStartDate($startDate);
        $assignment->setEndDate(null);

        $manager->persist($assignment);
    }

    private function upsertFunctionaryClubAssignment(
        ObjectManager $manager,
        User $user,
        Club $club,
        FunctionaryClubAssignmentType $type,
        DateTimeImmutable $startDate,
    ): void {
        $assignment = $manager->getRepository(FunctionaryClubAssignment::class)->findOneBy([
            'user' => $user,
            'club' => $club,
            'functionaryClubAssignmentType' => $type,
        ]) ?? new FunctionaryClubAssignment();

        $assignment->setUser($user);
        $assignment->setClub($club);
        $assignment->setFunctionaryClubAssignmentType($type);
        $assignment->setStartDate($startDate);
        $assignment->setEndDate(null);

        $manager->persist($assignment);
    }

    private function upsertStaffTeamAssignment(
        ObjectManager $manager,
        User $user,
        Team $team,
        StaffTeamAssignmentType $type,
        DateTimeImmutable $startDate,
    ): void {
        $assignment = $manager->getRepository(StaffTeamAssignment::class)->findOneBy([
            'user' => $user,
            'team' => $team,
            'staffTeamAssignmentType' => $type,
        ]) ?? new StaffTeamAssignment();

        $assignment->setUser($user);
        $assignment->setTeam($team);
        $assignment->setStaffTeamAssignmentType($type);
        $assignment->setStartDate($startDate);
        $assignment->setEndDate(null);

        $manager->persist($assignment);
    }

    private function upsertStaffClubAssignment(
        ObjectManager $manager,
        User $user,
        Club $club,
        StaffClubAssignmentType $type,
        DateTimeImmutable $startDate,
    ): void {
        $assignment = $manager->getRepository(StaffClubAssignment::class)->findOneBy([
            'user' => $user,
            'club' => $club,
            'staffClubAssignmentType' => $type,
        ]) ?? new StaffClubAssignment();

        $assignment->setUser($user);
        $assignment->setClub($club);
        $assignment->setStaffClubAssignmentType($type);
        $assignment->setStartDate($startDate);
        $assignment->setEndDate(null);

        $manager->persist($assignment);
    }
}
