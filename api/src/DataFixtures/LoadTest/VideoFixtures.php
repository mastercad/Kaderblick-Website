<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\Game;
use App\Entity\User;
use App\Entity\Video;
use App\Entity\VideoType;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;

class VideoFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            UserFixtures::class,
        ];
    }

    public function load(EntityManagerInterface $manager): void
    {
        // ------------------------------------------------------------------
        // 1. Pre-load VideoType IDs by name
        // ------------------------------------------------------------------
        $videoTypeIds = [];
        /** @var VideoType[] $allVideoTypes */
        $allVideoTypes = $manager->getRepository(VideoType::class)->findAll();
        foreach ($allVideoTypes as $vt) {
            $videoTypeIds[$vt->getName()] = $vt->getId();
        }

        $needed = ['Vorbereitung', '1.Halbzeit', '2.Halbzeit', 'Nachbereitung'];
        foreach ($needed as $name) {
            if (!isset($videoTypeIds[$name])) {
                throw new RuntimeException("Missing VideoType '{$name}'. Run master fixtures first.");
            }
        }

        // ------------------------------------------------------------------
        // 2. Pre-load admin user ID
        // ------------------------------------------------------------------
        /** @var User $adminUser */
        $adminUser = $this->getReference('lt_admin_user', User::class);
        $adminUserId = $adminUser->getId();
        if (null === $adminUserId) {
            throw new RuntimeException('lt_admin_user has no ID. Run UserFixtures first.');
        }

        // ------------------------------------------------------------------
        // 3. Load all finished game metadata as scalars
        // ------------------------------------------------------------------
        /** @var array<array{id: int, homeTeamName: string, awayTeamName: string, startDate: DateTimeInterface}> $gamesData */
        $gamesData = $manager->createQuery(
            'SELECT g.id AS id,
                    ht.name AS homeTeamName,
                    at.name AS awayTeamName,
                    ce.startDate AS startDate
             FROM App\Entity\Game g
             JOIN g.homeTeam ht
             JOIN g.awayTeam at
             JOIN g.calendarEvent ce
             WHERE g.isFinished = true
             ORDER BY g.id ASC'
        )->getArrayResult();

        // ------------------------------------------------------------------
        // 4. Create videos for ~40 % of finished games (every 5th game skipped twice = 40 %)
        // ------------------------------------------------------------------
        $videoCount = 0;
        $batchSize = 100;
        $gameIndex = 0;

        foreach ($gamesData as $gameRow) {
            ++$gameIndex;
            // Keep 40 %: include when (gameIndex % 5) < 2
            if ($gameIndex % 5 >= 2) {
                continue;
            }

            $gameId = (int) $gameRow['id'];
            $homeTeamName = $gameRow['homeTeamName'];
            $awayTeamName = $gameRow['awayTeamName'];
            /** @var DateTimeInterface $startDate */
            $startDate = $gameRow['startDate'];
            $createdAt = DateTimeImmutable::createFromInterface($startDate);

            $gameProxy = $manager->getReference(Game::class, $gameId);
            $adminUserProxy = $manager->getReference(User::class, $adminUserId);
            $title = "{$homeTeamName} vs. {$awayTeamName}";

            // ---- 1. Halbzeit ----
            $half1Type = $manager->getReference(VideoType::class, $videoTypeIds['1.Halbzeit']);
            $video1 = new Video();
            $video1->setName("1. Halbzeit – {$title}");
            $video1->setFilePath("videos/lt/game_{$gameId}_half_1.mp4");
            $video1->setGame($gameProxy);
            $video1->setVideoType($half1Type);
            $video1->setCreatedFrom($adminUserProxy);
            $video1->setUpdatedFrom($adminUserProxy);
            $video1->setCreatedAt($createdAt);
            $video1->setUpdatedAt($createdAt);
            $video1->setLength(random_int(2400, 3000)); // 40–50 minutes in seconds
            $video1->setSort(1);
            $video1->setGameStart(0);
            $manager->persist($video1);
            ++$videoCount;

            // ---- 2. Halbzeit ----
            $half2Type = $manager->getReference(VideoType::class, $videoTypeIds['2.Halbzeit']);
            $video2 = new Video();
            $video2->setName("2. Halbzeit – {$title}");
            $video2->setFilePath("videos/lt/game_{$gameId}_half_2.mp4");
            $video2->setGame($gameProxy);
            $video2->setVideoType($half2Type);
            $video2->setCreatedFrom($adminUserProxy);
            $video2->setUpdatedFrom($adminUserProxy);
            $video2->setCreatedAt($createdAt);
            $video2->setUpdatedAt($createdAt);
            $video2->setLength(random_int(2400, 3200)); // 40–53 minutes in seconds
            $video2->setSort(2);
            $video2->setGameStart(2700); // roughly 45 minutes in
            $manager->persist($video2);
            ++$videoCount;

            // Add Vorbereitung video for every 10th selected game
            if (1 === $gameIndex % 50) {
                $prepType = $manager->getReference(VideoType::class, $videoTypeIds['Vorbereitung']);
                $videoPrep = new Video();
                $videoPrep->setName("Vorbereitung – {$title}");
                $videoPrep->setFilePath("videos/lt/game_{$gameId}_prep.mp4");
                $videoPrep->setGame($gameProxy);
                $videoPrep->setVideoType($prepType);
                $videoPrep->setCreatedFrom($adminUserProxy);
                $videoPrep->setUpdatedFrom($adminUserProxy);
                $videoPrep->setCreatedAt($createdAt);
                $videoPrep->setUpdatedAt($createdAt);
                $videoPrep->setLength(random_int(600, 1200));
                $videoPrep->setSort(3);
                $videoPrep->setGameStart(null);
                $manager->persist($videoPrep);
                ++$videoCount;
            }

            // Flush & clear every batchSize videos
            if (0 === $videoCount % $batchSize) {
                $manager->flush();
                $manager->clear();
            }
        }

        $manager->flush();
        $manager->clear();
    }
}
