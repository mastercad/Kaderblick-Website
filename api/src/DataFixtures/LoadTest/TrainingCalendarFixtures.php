<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\CalendarEventTypeFixtures;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Location;
use App\Entity\Team;
use App\Enum\CalendarEventPermissionType;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Load-Test Fixtures: 3 Jahre Trainingskalender (Di + Do, je Team und Woche).
 *
 * Zeitraum: 2023-01-03 bis 2026-03-12 = ~167 Wochen
 * Pro Team 2 Trainingseinheiten/Woche → ~334 Events/Team × 101 Teams = ~33.734 Cal.Events
 * Plus je 1 CalendarEventPermission (Team-Sichtbarkeit) = ~67.468 Datensätze gesamt.
 *
 * Memory-Optimierung: flush+clear alle 500 Datensätze, Teamreferenz via Proxy.
 * Gruppe: load_test
 */
class TrainingCalendarFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const TOTAL_TEAMS = 101;
    private const BATCH_SIZE = 500;

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            TeamFixtures::class,
            LocationFixtures::class,
            CalendarEventTypeFixtures::class,
        ];
    }

    public function load(EntityManagerInterface $manager): void
    {
        /** @var CalendarEventType $trainingType */
        $trainingType = $this->getReference('calendar_event_type_training', CalendarEventType::class);
        $trainingTypeId = $trainingType->getId();

        // Alle Team-IDs und Namen vorab sammeln (für Proxy-Nutzung nach clear)
        $teamMeta = [];
        for ($i = 0; $i < self::TOTAL_TEAMS; ++$i) {
            /** @var Team $team */
            $team = $this->getReference('lt_team_' . $i, Team::class);
            $teamMeta[$i] = [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'locationId' => $this->getReference('lt_location_' . ($i % 30), Location::class)->getId(),
            ];
        }

        $persistCount = 0;

        // Trainingszeitraum: erstes Dienstag ab 2023-01-03 bis 2026-03-12
        $firstTuesday = new DateTime('2023-01-03'); // erster Dienstag in 2023
        $endDate = new DateTime('2026-03-12');

        // Trainingszeiten nach Team-Index (verschiedene Uhrzeiten für realismus)
        // 3 Uhrzeiten zyklisch: 17:00, 18:00, 19:00
        $times = ['17:00', '18:00', '19:00', '18:30', '17:30', '19:30'];

        $week = 0;
        $currentTuesday = clone $firstTuesday;

        while ($currentTuesday <= $endDate) {
            $currentThursday = clone $currentTuesday;
            $currentThursday->modify('+2 days'); // Donnerstag

            foreach ($teamMeta as $teamIdx => $meta) {
                $teamId = $meta['id'];
                $teamName = $meta['name'];
                $locationId = $meta['locationId'];

                // Proxy-Referenzen (keine Datenbankabfrage, nur FK)
                /** @var Team $teamProxy */
                $teamProxy = $manager->getReference(Team::class, $teamId);
                /** @var Location $locationProxy */
                $locationProxy = $manager->getReference(Location::class, $locationId);
                /** @var CalendarEventType $calTypeProxy */
                $calTypeProxy = $manager->getReference(CalendarEventType::class, $trainingTypeId);

                // Dienstags-Training
                $tuesdayTime = $times[$teamIdx % count($times)];
                [$th, $tm] = explode(':', $tuesdayTime);
                $tuesdayStart = new DateTime($currentTuesday->format('Y-m-d') . ' ' . $tuesdayTime . ':00');
                $tuesdayEnd = clone $tuesdayStart;
                $tuesdayEnd->modify('+90 minutes');

                $tuesdayEvent = new CalendarEvent();
                $tuesdayEvent->setTitle('Training ' . $teamName);
                $tuesdayEvent->setStartDate($tuesdayStart);
                $tuesdayEvent->setEndDate($tuesdayEnd);
                $tuesdayEvent->setCalendarEventType($calTypeProxy);
                $tuesdayEvent->setLocation($locationProxy);
                $tuesdayEvent->setTrainingWeekdays([2]); // Dienstag = 2

                $tuesdayPerm = new CalendarEventPermission();
                $tuesdayPerm->setPermissionType(CalendarEventPermissionType::TEAM);
                $tuesdayPerm->setTeam($teamProxy);
                $tuesdayEvent->addPermission($tuesdayPerm);

                $manager->persist($tuesdayEvent);
                ++$persistCount;

                // Donnerstags-Training
                $thursdayTime = $times[($teamIdx + 3) % count($times)];
                $thursdayStart = new DateTime($currentThursday->format('Y-m-d') . ' ' . $thursdayTime . ':00');
                $thursdayEnd = clone $thursdayStart;
                $thursdayEnd->modify('+90 minutes');

                $thursdayEvent = new CalendarEvent();
                $thursdayEvent->setTitle('Training ' . $teamName);
                $thursdayEvent->setStartDate($thursdayStart);
                $thursdayEvent->setEndDate($thursdayEnd);
                $thursdayEvent->setCalendarEventType($calTypeProxy);
                $thursdayEvent->setLocation($locationProxy);
                $thursdayEvent->setTrainingWeekdays([4]); // Donnerstag = 4

                $thursdayPerm = new CalendarEventPermission();
                $thursdayPerm->setPermissionType(CalendarEventPermissionType::TEAM);
                $thursdayPerm->setTeam($teamProxy);
                $thursdayEvent->addPermission($thursdayPerm);

                $manager->persist($thursdayEvent);
                ++$persistCount;

                // Batch-flush mit entity-manager-clear für Speicheroptimierung
                if (0 === $persistCount % self::BATCH_SIZE) {
                    $manager->flush();
                    $manager->clear();
                    // Nach clear: CalendarEventType-Proxy neu holen
                    $calTypeProxy = $manager->getReference(CalendarEventType::class, $trainingTypeId);
                }
            }

            $currentTuesday->modify('+7 days');
            ++$week;
        }

        $manager->flush();
    }
}
