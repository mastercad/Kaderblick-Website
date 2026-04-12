<?php

namespace App\DataFixtures\DemoData;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Club;
use App\Entity\Location;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Vereinsveranstaltungen für alle 10 Clubs über 3 Saisons.
 *
 * Pro Saison und Club:
 * - Trainingsauftakt (Vereinstreffen, Juli)
 * - Sommerfest (Event, August)
 * - Jahreshauptversammlung (Vereinstreffen, November)
 * - Weihnachtsfeier (Event, Dezember)
 * - Saisonabschlussfeier (Event, Juni)
 *
 * Gruppe: demo
 */
class ClubEventFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 50;

    /**
     * Saison-Basisdaten: Veranstaltungsdatum je Schlüssel.
     * Format: 'Y-m-d'.
     */
    private const SEASON_DATES = [
        0 => [ // Saison 2023/24
            'trainingsauftakt' => '2023-07-10',
            'sommerfest' => '2023-08-05',
            'jahreshauptv' => '2023-11-15',
            'weihnachtsfeier' => '2023-12-09',
            'saisonabschluss' => '2024-06-15',
        ],
        1 => [ // Saison 2024/25
            'trainingsauftakt' => '2024-07-08',
            'sommerfest' => '2024-08-03',
            'jahreshauptv' => '2024-11-20',
            'weihnachtsfeier' => '2024-12-07',
            'saisonabschluss' => '2025-06-14',
        ],
        2 => [ // Saison 2025/26
            'trainingsauftakt' => '2025-07-07',
            'sommerfest' => '2025-08-02',
            'jahreshauptv' => '2025-11-19',
            'weihnachtsfeier' => '2025-12-06',
            'saisonabschluss' => '2026-06-20',
        ],
    ];

    /**
     * Konfiguration der Veranstaltungstypen.
     * [dateKey, title, calendarEventTypeRef, startHour, startMin, durationHours, description].
     */
    private const EVENTS = [
        [
            'dateKey' => 'trainingsauftakt',
            'title' => 'Trainingsauftakt',
            'typeRef' => 'calendar_event_type_vereinstreffen',
            'startHour' => 19,
            'startMin' => 0,
            'durationH' => 2,
            'description' => 'Offizieller Trainingsauftakt für die neue Saison. Alle Spieler, Trainer und Betreuer sind herzlich eingeladen.',
        ],
        [
            'dateKey' => 'sommerfest',
            'title' => 'Sommerfest',
            'typeRef' => 'calendar_event_type_event',
            'startHour' => 15,
            'startMin' => 0,
            'durationH' => 4,
            'description' => 'Das jährliche Sommerfest des Vereins. Für Essen, Trinken und gute Stimmung ist gesorgt!',
        ],
        [
            'dateKey' => 'jahreshauptv',
            'title' => 'Jahreshauptversammlung',
            'typeRef' => 'calendar_event_type_vereinstreffen',
            'startHour' => 19,
            'startMin' => 30,
            'durationH' => 2,
            'description' => 'Jahreshauptversammlung des Vereins. Themen: Jahresabschluss, Wahlen, Ausblick auf die neue Saison.',
        ],
        [
            'dateKey' => 'weihnachtsfeier',
            'title' => 'Weihnachtsfeier',
            'typeRef' => 'calendar_event_type_event',
            'startHour' => 18,
            'startMin' => 0,
            'durationH' => 4,
            'description' => 'Die alljährliche Weihnachtsfeier des Vereins. Eine schöne Gelegenheit zum gemeinsamen Feiern!',
        ],
        [
            'dateKey' => 'saisonabschluss',
            'title' => 'Saisonabschlussfeier',
            'typeRef' => 'calendar_event_type_event',
            'startHour' => 15,
            'startMin' => 0,
            'durationH' => 5,
            'description' => 'Gemeinsamer Ausklang der Saison. Aktive, Trainer und Mitglieder sind herzlich eingeladen.',
        ],
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            ClubFixtures::class,
            UserFixtures::class,
            \App\DataFixtures\MasterData\CalendarEventTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // Idempotenz: bereits geladene Vereinsevents erkennen
        $vereinstrefType = $this->getReference('calendar_event_type_vereinstreffen', CalendarEventType::class);
        $existing = $manager->getRepository(CalendarEvent::class)->findOneBy([
            'calendarEventType' => $vereinstrefType,
        ]);
        if (null !== $existing) {
            return;
        }

        $persistCount = 0;

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            /** @var Club $club */
            $club = $this->getReference('demo_club_' . $clubIdx, Club::class);
            /** @var Location $location */
            $location = $this->getReference('demo_location_' . $clubIdx, Location::class);
            /** @var User $adminUser */
            $adminUser = $this->getReference('demo_user_' . $clubIdx . '_0', User::class);

            foreach (self::SEASON_DATES as $eventDates) {
                foreach (self::EVENTS as $eventConfig) {
                    $baseDate = new DateTime($eventDates[$eventConfig['dateKey']]);

                    // Vereine leicht versetzt (Club 0: +0, Club 1: +1, ... Club 9: +2 Tage wiederholt)
                    $dayOffset = $clubIdx % 5;
                    if ($dayOffset > 0) {
                        $baseDate->modify("+{$dayOffset} days");
                    }

                    $startDate = clone $baseDate;
                    $startDate->setTime($eventConfig['startHour'], $eventConfig['startMin']);

                    $endDate = clone $startDate;
                    $endDate->modify('+' . $eventConfig['durationH'] . ' hours');

                    /** @var CalendarEventType $eventType */
                    $eventType = $this->getReference($eventConfig['typeRef'], CalendarEventType::class);

                    $event = new CalendarEvent();
                    $event->setTitle($eventConfig['title']);
                    $event->setDescription($eventConfig['description']);
                    $event->setStartDate($startDate);
                    $event->setEndDate($endDate);
                    $event->setCalendarEventType($eventType);
                    $event->setLocation($location);
                    $event->setCreatedBy($adminUser);

                    $perm = new CalendarEventPermission();
                    $perm->setPermissionType(CalendarEventPermissionType::CLUB);
                    $perm->setClub($club);
                    $event->addPermission($perm);

                    $manager->persist($event);
                    ++$persistCount;

                    if (0 === $persistCount % self::BATCH_SIZE) {
                        $manager->flush();
                    }
                }
            }
        }

        $manager->flush();
    }
}
