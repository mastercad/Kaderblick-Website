<?php

namespace App\DataFixtures\DemoData;

use App\Entity\CalendarEvent;
use App\Entity\Club;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\Team;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Teilnahme-Antworten (Participations) für Demo-Benutzer.
 *
 * Erstellt Participations für:
 * 1. Vereinsveranstaltungen (CalendarEventPermission CLUB) → alle 10 Benutzer des Clubs
 * 2. Trainingseinheiten Senioren I (CalendarEventPermission TEAM) → Trainer + Spieler (localIdx 1-8)
 * 3. Ligaspiele / Pokal / Freundschaftsspiele Senioren I → Trainer + Spieler (localIdx 1-8)
 *
 * Status-Verteilung: 70% Zugesagt, 15% Abgesagt, 10% Vielleicht, 5% Verspätet
 *
 * Gruppe: demo
 */
class ParticipationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 500;

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
            UserFixtures::class,
            GameFixtures::class,
            TrainingFixtures::class,
            ClubEventFixtures::class,
            \App\DataFixtures\MasterData\ParticipationStatusFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // Idempotenz: existierende Demo-Participations erkennen
        $existingCount = (int) $manager->createQuery(
            'SELECT COUNT(p.id) FROM App\Entity\Participation p
             JOIN p.user u WHERE u.email LIKE :pattern'
        )->setParameter('pattern', '%@demo-kaderblick.de')->getSingleScalarResult();

        if ($existingCount > 0) {
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

        // ── Status-ID-Map [code] => statusId ─────────────────────────────────
        /** @var array<string, int> $statusIdMap */
        $statusIdMap = [];
        foreach (['attending', 'maybe', 'not_attending', 'late'] as $code) {
            $status = $this->getReference("participation-status-{$code}", ParticipationStatus::class);
            $id = $status->getId();
            if (null !== $id) {
                $statusIdMap[$code] = $id;
            }
        }

        // ── Club-ID → clubIdx Reverse-Map ────────────────────────────────────
        /** @var array<int, int> $clubIdToClubIdx */
        $clubIdToClubIdx = [];
        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            $club = $this->getReference("demo_club_{$clubIdx}", Club::class);
            $id = $club->getId();
            if (null !== $id) {
                $clubIdToClubIdx[$id] = $clubIdx;
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

        $count = 0;

        // ── Phase 1: Vereinsveranstaltungen (CLUB permission) ────────────────
        $clubEventRows = $manager->createQuery(
            'SELECT IDENTITY(perm.calendarEvent) AS eventId, IDENTITY(perm.club) AS clubId
             FROM App\Entity\CalendarEventPermission perm
             WHERE perm.permissionType = :type'
        )->setParameter('type', 'club')->getArrayResult();

        foreach ($clubEventRows as $row) {
            $clubId = (int) $row['clubId'];
            if (!isset($clubIdToClubIdx[$clubId])) {
                continue;
            }
            $clubIdx = $clubIdToClubIdx[$clubId];
            $eventId = (int) $row['eventId'];

            // Alle 10 Benutzer des Clubs
            for ($local = 0; $local < 10; ++$local) {
                $userId = $userIdMap[$clubIdx][$local] ?? null;
                $this->createParticipation($manager, $userId, $eventId, $statusIdMap, $count);
            }
        }

        // ── Phase 2: Trainingseinheiten aller Liga-Teams (TEAM permission) ───
        if (!empty($allLigaTeamIds)) {
            $trainingRows = $manager->createQuery(
                'SELECT IDENTITY(perm.calendarEvent) AS eventId, IDENTITY(perm.team) AS teamId
                 FROM App\Entity\CalendarEventPermission perm
                 WHERE perm.permissionType = :type
                 AND IDENTITY(perm.team) IN (:teamIds)'
            )->setParameter('type', 'team')
             ->setParameter('teamIds', $allLigaTeamIds)
             ->getArrayResult();

            foreach ($trainingRows as $row) {
                $teamId = (int) $row['teamId'];
                if (!isset($teamIdToClubIdx[$teamId])) {
                    continue;
                }
                $clubIdx = $teamIdToClubIdx[$teamId];
                $eventId = (int) $row['eventId'];

                // Trainer (localIdx 1, 2) und Spieler (localIdx 3-8)
                for ($local = 1; $local <= 8; ++$local) {
                    $userId = $userIdMap[$clubIdx][$local] ?? null;
                    $this->createParticipation($manager, $userId, $eventId, $statusIdMap, $count);
                }
            }
        }

        // ── Phase 3: Spieltermine aller Liga-Teams ────────────────────────────
        if (!empty($allLigaTeamIds)) {
            $gameRows = $manager->createQuery(
                'SELECT ce.id AS eventId,
                        IDENTITY(g.homeTeam) AS homeTeamId,
                        IDENTITY(g.awayTeam) AS awayTeamId
                 FROM App\Entity\CalendarEvent ce
                 JOIN ce.game g
                 WHERE IDENTITY(g.homeTeam) IN (:teamIds)
                    OR IDENTITY(g.awayTeam) IN (:teamIds)'
            )->setParameter('teamIds', $allLigaTeamIds)->getArrayResult();

            foreach ($gameRows as $row) {
                $eventId = (int) $row['eventId'];

                foreach ([(int) $row['homeTeamId'], (int) $row['awayTeamId']] as $teamId) {
                    if (!isset($teamIdToClubIdx[$teamId])) {
                        continue;
                    }
                    $clubIdx = $teamIdToClubIdx[$teamId];

                    // Trainer + Spieler
                    for ($local = 1; $local <= 8; ++$local) {
                        $userId = $userIdMap[$clubIdx][$local] ?? null;
                        $this->createParticipation($manager, $userId, $eventId, $statusIdMap, $count);
                    }
                }
            }
        }

        $manager->flush();
    }

    /**
     * Erstellt eine Participation und flusht bei Batch-Grenzen.
     *
     * @param array<string, int> $statusIdMap
     */
    private function createParticipation(
        EntityManagerInterface $manager,
        ?int $userId,
        int $eventId,
        array $statusIdMap,
        int &$count
    ): void {
        if (null === $userId) {
            return;
        }

        $part = new Participation();
        $part->setUser($manager->getReference(User::class, $userId));
        $part->setEvent($manager->getReference(CalendarEvent::class, $eventId));
        $part->setStatus($manager->getReference(ParticipationStatus::class, $statusIdMap[$this->pickStatusCode()]));

        $manager->persist($part);
        ++$count;

        if (0 === $count % self::BATCH_SIZE) {
            $manager->flush();
            $manager->clear();
        }
    }

    private function pickStatusCode(): string
    {
        $rand = random_int(1, 100);
        if ($rand <= 70) {
            return 'attending';
        }
        if ($rand <= 85) {
            return 'not_attending';
        }
        if ($rand <= 95) {
            return 'maybe';
        }

        return 'late';
    }
}
