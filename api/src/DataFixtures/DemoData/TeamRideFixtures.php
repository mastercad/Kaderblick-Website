<?php

namespace App\DataFixtures\DemoData;

use App\Entity\CalendarEvent;
use App\Entity\Team;
use App\Entity\TeamRide;
use App\Entity\TeamRidePassenger;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Fahrgemeinschaften für Auswärtsspiele der Senioren-I-Teams.
 *
 * Pro Ligaspiel (Auswärtsmannschaft):
 * - 1 TeamRide mit Trainer (localIdx 1) als Fahrer, 2-4 Spieler als Mitfahrer
 *
 * Gruppe: demo
 */
class TeamRideFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 50;

    /**
     * Alle Liga-Teams (teamIdx => clubIdx).
     * Umfasst Senioren I+II, A/B/C-Junioren — genau die Teams aus GameFixtures.
     */
    private const ALL_LIGA_TEAMS = [
        // Senioren I
        0 => 0,  9 => 1, 16 => 2, 21 => 3, 26 => 4, 31 => 5, 35 => 6, 39 => 7, 43 => 8, 46 => 9,
        // Senioren II
        1 => 0, 10 => 1, 17 => 2, 22 => 3, 27 => 4,
        // A-Junioren
        2 => 0, 11 => 1, 18 => 2, 23 => 3, 28 => 4, 32 => 5, 36 => 6, 40 => 7, 44 => 8,
        // B-Junioren
        3 => 0, 12 => 1, 19 => 2, 24 => 3, 29 => 4, 33 => 5, 37 => 6, 41 => 7, 47 => 9,
        // C-Junioren
        4 => 0, 13 => 1, 20 => 2, 25 => 3, 30 => 4, 34 => 5, 38 => 6, 42 => 7, 45 => 8, 48 => 9,
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            UserFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // Idempotenz
        $existing = $manager->getRepository(TeamRide::class)->findOneBy([]);
        if (null !== $existing) {
            return;
        }

        // ── User-ID-Map [clubIdx][localIdx] => userId ────────────────────────
        /** @var array<int, array<int, int>> $userIdMap */
        $userIdMap = [];
        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            for ($local = 0; $local < 10; ++$local) {
                $user = $this->getReference("demo_user_{$clubIdx}_{$local}", User::class);
                $id = $user->getId();
                if (null !== $id) {
                    $userIdMap[$clubIdx][$local] = $id;
                }
            }
        }

        // ── Alle Liga-Team-IDs → clubIdx Reverse-Map ─────────────────────────
        /** @var array<int, int> $teamIdToClubIdx */
        $teamIdToClubIdx = [];
        foreach (self::ALL_LIGA_TEAMS as $teamIdx => $clubIdx) {
            $team = $this->getReference("demo_team_{$teamIdx}", Team::class);
            $id = $team->getId();
            if (null !== $id) {
                $teamIdToClubIdx[$id] = $clubIdx;
            }
        }

        $allLigaTeamIds = array_keys($teamIdToClubIdx);

        if (empty($allLigaTeamIds)) {
            return;
        }

        // ── Alle Auswärtsspiele aller Liga-Teams laden ────────────────────────
        $gamesData = $manager->createQuery(
            'SELECT ce.id AS eventId,
                    IDENTITY(g.awayTeam) AS awayTeamId
             FROM App\Entity\CalendarEvent ce
             JOIN ce.game g
             WHERE IDENTITY(g.awayTeam) IN (:teamIds)
             ORDER BY ce.startDate ASC'
        )->setParameter('teamIds', $allLigaTeamIds)->getArrayResult();

        $count = 0;

        foreach ($gamesData as $row) {
            $eventId = (int) $row['eventId'];
            $awayTeamId = (int) $row['awayTeamId'];

            if (!isset($teamIdToClubIdx[$awayTeamId])) {
                continue;
            }
            $clubIdx = $teamIdToClubIdx[$awayTeamId];

            // Fahrer: Trainer localIdx 1
            $driverId = $userIdMap[$clubIdx][1] ?? null;
            if (null === $driverId) {
                continue;
            }

            $numPassengers = random_int(2, 4);
            // Mitfahrer aus Spielern (localIdx 3-8)
            $passengerLocalIdxs = range(3, 8);
            shuffle($passengerLocalIdxs);
            $passengerLocalIdxs = array_slice($passengerLocalIdxs, 0, $numPassengers);

            /** @var User $driver */
            $driver = $manager->getReference(User::class, $driverId);
            /** @var CalendarEvent $event */
            $event = $manager->getReference(CalendarEvent::class, $eventId);

            $ride = new TeamRide();
            $ride->setEvent($event);
            $ride->setDriver($driver);
            $ride->setSeats($numPassengers + 1); // Fahrer + Mitfahrer

            foreach ($passengerLocalIdxs as $local) {
                $passId = $userIdMap[$clubIdx][$local] ?? null;
                if (null === $passId) {
                    continue;
                }
                /** @var User $passengerUser */
                $passengerUser = $manager->getReference(User::class, $passId);

                $passenger = new TeamRidePassenger();
                $passenger->setUser($passengerUser);
                $ride->addPassenger($passenger);
            }

            $manager->persist($ride);
            ++$count;

            if (0 === $count % self::BATCH_SIZE) {
                $manager->flush();
                $manager->clear();
            }
        }

        $manager->flush();
    }
}
