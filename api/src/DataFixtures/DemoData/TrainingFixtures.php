<?php

namespace App\DataFixtures\DemoData;

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
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Trainingstermine für alle 49 Demo-Teams.
 *
 * Erstellt 20 Wochen Trainingseinheiten (2×/Woche) für Saison 2024/25 und 2025/26.
 * Passende Zeiten und Wochentage je nach Altersgruppe.
 * Gruppe: demo
 */
class TrainingFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 100;

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
        ];
    }

    /**
     * Trainingsplan je Team-Globalindex:
     * [weekday1(1=Mon..7=Sun), hour1, weekday2, hour2, durationMinutes, locationSuffix]
     * weekday verwendet PHP date('N') Konvention: 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So.
     *
     * @var array<int, array{0: int, 1: int, 2: int, 3: int, 4: int}>
     */
    private const TEAM_TRAINING_CONFIGS = [
        // Club 0 (offset 0-8)
        0 => [2, 19, 4, 19, 90],   // Senioren I: Di+Do 19:00
        1 => [2, 17, 4, 17, 90],   // Senioren II: Di+Do 17:30
        2 => [1, 18, 3, 18, 90],   // A-Junioren: Mo+Mi 18:00
        3 => [1, 17, 3, 17, 90],   // B-Junioren: Mo+Mi 17:00
        4 => [2, 17, 4, 17, 60],   // C-Junioren: Di+Do 17:00
        5 => [3, 16, 6, 10, 60],   // D-Junioren: Mi 16:00 + Sa 10:00
        6 => [3, 15, 6, 10, 60],   // E-Junioren: Mi 15:00 + Sa 10:00
        7 => [3, 15, 6, 10, 60],   // F-Junioren: Mi 15:00 + Sa 10:00
        8 => [6, 10, 6, 10, 60],   // G-Junioren: Sa 10:00
        // Club 1 (offset 9-15)
        9 => [2, 19, 4, 19, 90],
        10 => [2, 17, 4, 17, 90],
        11 => [1, 18, 3, 18, 90],
        12 => [1, 17, 3, 17, 90],
        13 => [2, 17, 4, 17, 60],
        14 => [3, 16, 6, 10, 60],
        15 => [3, 15, 6, 10, 60],
        // Club 2 (offset 16-20)
        16 => [2, 19, 4, 19, 90],
        17 => [2, 17, 4, 17, 90],
        18 => [1, 18, 3, 18, 90],
        19 => [1, 17, 3, 17, 90],
        20 => [2, 17, 4, 17, 60],
        // Club 3 (offset 21-25)
        21 => [2, 19, 4, 19, 90],
        22 => [2, 17, 4, 17, 90],
        23 => [1, 18, 3, 18, 90],
        24 => [1, 17, 3, 17, 90],
        25 => [2, 17, 4, 17, 60],
        // Club 4 (offset 26-30)
        26 => [2, 19, 4, 19, 90],
        27 => [2, 17, 4, 17, 90],
        28 => [1, 18, 3, 18, 90],
        29 => [1, 17, 3, 17, 90],
        30 => [2, 17, 4, 17, 60],
        // Club 5 (offset 31-34)
        31 => [2, 19, 4, 19, 90],
        32 => [1, 18, 3, 18, 90],
        33 => [1, 17, 3, 17, 90],
        34 => [2, 17, 4, 17, 60],
        // Club 6 (offset 35-38)
        35 => [2, 19, 4, 19, 90],
        36 => [1, 18, 3, 18, 90],
        37 => [1, 17, 3, 17, 90],
        38 => [2, 17, 4, 17, 60],
        // Club 7 (offset 39-42)
        39 => [2, 19, 4, 19, 90],
        40 => [1, 18, 3, 18, 90],
        41 => [1, 17, 3, 17, 90],
        42 => [2, 17, 4, 17, 60],
        // Club 8 (offset 43-45)
        43 => [2, 19, 4, 19, 90],
        44 => [1, 18, 3, 18, 90],
        45 => [2, 17, 4, 17, 60],
        // Club 9 (offset 46-48)
        46 => [2, 19, 4, 19, 90],
        47 => [1, 17, 3, 17, 90],
        48 => [2, 17, 4, 17, 60],
    ];

    /** Welchem Verein (0-9) gehört jedes Team. */
    private const TEAM_CLUB_IDX = [
        0, 0, 0, 0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2,
        3, 3, 3, 3, 3,
        4, 4, 4, 4, 4,
        5, 5, 5, 5,
        6, 6, 6, 6,
        7, 7, 7, 7,
        8, 8, 8,
        9, 9, 9,
    ];

    public function load(ObjectManager $manager): void
    {
        // Idempotency: check if training events already exist
        $trainingType = $this->getReference('calendar_event_type_training', CalendarEventType::class);
        $existing = $manager->getRepository(CalendarEvent::class)->findOneBy(['calendarEventType' => $trainingType]);
        if (null !== $existing) {
            return;
        }

        $persistCount = 0;

        // Zwei Saisons: 2024/25 und 2025/26 (je 20 Wochen ab September)
        $seasonStarts = [
            new DateTime('2024-09-02'), // Sa
            new DateTime('2025-09-01'),
        ];

        $today = new DateTime();

        for ($teamIdx = 0; $teamIdx < 49; ++$teamIdx) {
            $config = self::TEAM_TRAINING_CONFIGS[$teamIdx];
            [$wd1, $h1, $wd2, $h2, $durationMin] = $config;

            $clubIdx = self::TEAM_CLUB_IDX[$teamIdx];

            /** @var Team $team */
            $team = $this->getReference('demo_team_' . $teamIdx, Team::class);
            /** @var Location $location */
            $location = $this->getReference('demo_location_' . $clubIdx, Location::class);

            foreach ($seasonStarts as $seasonStart) {
                for ($week = 0; $week < 20; ++$week) {
                    foreach ([[$wd1, $h1], [$wd2, $h2]] as [$weekday, $hour]) {
                        if ($wd1 === $wd2 && $h1 === $h2 && $weekday === $wd2) {
                            // G-Junioren: Wochentag gleich, nur einmal erstellen
                            if (0 !== $week % 2) {
                                continue;
                            }
                        }

                        $startDate = clone $seasonStart;
                        $startDate->modify('+' . ($week * 7) . ' days');

                        // Zum gewünschten Wochentag navigieren
                        $currentDow = (int) $startDate->format('N'); // 1=Mo..7=So
                        $diff = $weekday - $currentDow;
                        if ($diff < 0) {
                            $diff += 7;
                        }
                        $startDate->modify('+' . $diff . ' days');
                        $startDate->setTime($hour, 0);

                        $endDate = clone $startDate;
                        $endDate->modify('+' . $durationMin . ' minutes');

                        $event = new CalendarEvent();
                        $event->setTitle('Training');
                        $event->setStartDate(clone $startDate);
                        $event->setEndDate(clone $endDate);
                        $event->setCalendarEventType($trainingType);
                        $event->setLocation($location);

                        $perm = new CalendarEventPermission();
                        $perm->setPermissionType(CalendarEventPermissionType::TEAM);
                        $perm->setTeam($team);
                        $event->addPermission($perm);

                        $manager->persist($event);
                        ++$persistCount;

                        if (0 === $persistCount % self::BATCH_SIZE) {
                            $manager->flush();
                        }
                    }
                }
            }
        }

        $manager->flush();
    }
}
