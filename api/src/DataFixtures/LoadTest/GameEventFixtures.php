<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\Team;
use DateTime;
use DateTimeInterface;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;

class GameEventFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            PlayerFixtures::class,
        ];
    }

    public function load(EntityManagerInterface $manager): void
    {
        // ------------------------------------------------------------------
        // 1. Pre-load game event type IDs (by code) – use getReference later
        // ------------------------------------------------------------------
        $eventTypeIds = [];
        /** @var GameEventType[] $allTypes */
        $allTypes = $manager->getRepository(GameEventType::class)->findAll();
        foreach ($allTypes as $type) {
            $eventTypeIds[$type->getCode()] = $type->getId();
        }

        $codesUsed = [
            'goal', 'header_goal', 'freekick_goal', 'penalty_goal',
            'yellow_card', 'red_card',
            'substitution_in', 'substitution_out',
            'corner', 'shot_on_target', 'foul',
            'assist', 'shot_off_target',
        ];
        // Validate all needed codes exist
        foreach ($codesUsed as $code) {
            if (!isset($eventTypeIds[$code])) {
                throw new RuntimeException("Missing GameEventType with code '{$code}'. Run master fixtures first.");
            }
        }

        // ------------------------------------------------------------------
        // 2. Pre-load playerIds grouped by teamId (active assignments only)
        // ------------------------------------------------------------------
        /** @var array<array{playerId: int, teamId: int}> $ptaRows */
        $ptaRows = $manager->createQuery(
            'SELECT IDENTITY(pta.player) AS playerId, IDENTITY(pta.team) AS teamId
             FROM App\Entity\PlayerTeamAssignment pta
             WHERE pta.endDate IS NULL'
        )->getArrayResult();

        /** @var array<int, int[]> $teamPlayerMap teamId => [playerId, ...] */
        $teamPlayerMap = [];
        foreach ($ptaRows as $row) {
            $teamPlayerMap[(int) $row['teamId']][] = (int) $row['playerId'];
        }
        unset($ptaRows);

        // ------------------------------------------------------------------
        // 3. Load all finished game data as scalar arrays (no entity objects)
        // ------------------------------------------------------------------
        /** @var array<array{id: int, homeTeamId: int, awayTeamId: int, homeScore: int, awayScore: int, startDate: DateTimeInterface}> $gamesData */
        $gamesData = $manager->createQuery(
            'SELECT g.id AS id,
                    IDENTITY(g.homeTeam) AS homeTeamId,
                    IDENTITY(g.awayTeam) AS awayTeamId,
                    g.homeScore,
                    g.awayScore,
                    ce.startDate AS startDate
             FROM App\Entity\Game g
             JOIN g.calendarEvent ce
             WHERE g.isFinished = true
             ORDER BY g.id ASC'
        )->getArrayResult();

        // ------------------------------------------------------------------
        // 4. Main loop – create events per finished game
        // ------------------------------------------------------------------
        $eventCount = 0;
        $batchSize = 200;

        foreach ($gamesData as $gameRow) {
            $gameId = (int) $gameRow['id'];
            $homeTeamId = (int) $gameRow['homeTeamId'];
            $awayTeamId = (int) $gameRow['awayTeamId'];
            $homeScore = (int) ($gameRow['homeScore'] ?? 0);
            $awayScore = (int) ($gameRow['awayScore'] ?? 0);
            /** @var DateTimeInterface $startDate */
            $startDate = $gameRow['startDate'];
            $baseTime = new DateTime($startDate->format('Y-m-d H:i:s'));

            $homePlayers = $teamPlayerMap[$homeTeamId] ?? [];
            $awayPlayers = $teamPlayerMap[$awayTeamId] ?? [];

            // Helper: random player proxy from a team
            $pickPlayer = static function (array $playerIds, ObjectManager $mgr): ?Player {
                if (empty($playerIds)) {
                    return null;
                }
                $id = $playerIds[array_rand($playerIds)];

                return $mgr->getReference(Player::class, $id);
            };

            // Helper: event timestamp (minute within 0-93)
            $makeTimestamp = static function (int $minute) use ($baseTime): DateTime {
                return (clone $baseTime)->modify("+{$minute} minutes");
            };

            $gameProxy = $manager->getReference(Game::class, $gameId);
            $homeProxy = $manager->getReference(Team::class, $homeTeamId);
            $awayProxy = $manager->getReference(Team::class, $awayTeamId);

            // ---- Goals ----
            $goalCodes = ['goal', 'header_goal', 'freekick_goal', 'penalty_goal'];
            $minute = 1;
            for ($i = 0; $i < $homeScore; ++$i) {
                $minute = min($minute + random_int(3, 18), 90);
                $half = $minute <= 45 ? $minute : $minute;
                $typeId = $eventTypeIds[$goalCodes[$i % 4]];
                $event = $this->makeEvent(
                    $gameProxy,
                    $homeProxy,
                    $manager->getReference(GameEventType::class, $typeId),
                    $pickPlayer($homePlayers, $manager),
                    $makeTimestamp($half)
                );
                $manager->persist($event);
                ++$eventCount;

                // Assist for non-penalty goals
                if (0 !== $minute % 3 && 'penalty_goal' !== $goalCodes[$i % 4]) {
                    $assistTypeId = $eventTypeIds['assist'];
                    $assister = $pickPlayer($homePlayers, $manager);
                    if (null !== $assister) {
                        $assist = $this->makeEvent(
                            $gameProxy,
                            $homeProxy,
                            $manager->getReference(GameEventType::class, $assistTypeId),
                            $assister,
                            $makeTimestamp($half)
                        );
                        $manager->persist($assist);
                        ++$eventCount;
                    }
                }
            }

            $minute = 1;
            for ($i = 0; $i < $awayScore; ++$i) {
                $minute = min($minute + random_int(4, 17), 90);
                $half = $minute <= 45 ? $minute : $minute;
                $typeId = $eventTypeIds[$goalCodes[$i % 4]];
                $event = $this->makeEvent(
                    $gameProxy,
                    $awayProxy,
                    $manager->getReference(GameEventType::class, $typeId),
                    $pickPlayer($awayPlayers, $manager),
                    $makeTimestamp($half)
                );
                $manager->persist($event);
                ++$eventCount;
            }

            // ---- Yellow cards (0-3 per game) ----
            $yellowCount = random_int(0, 3);
            for ($i = 0; $i < $yellowCount; ++$i) {
                $teamPick = (0 === $i % 2) ? $homeProxy : $awayProxy;
                $playerPick = (0 === $i % 2) ? $homePlayers : $awayPlayers;
                $event = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['yellow_card']),
                    $pickPlayer($playerPick, $manager),
                    $makeTimestamp(random_int(20, 88))
                );
                $manager->persist($event);
                ++$eventCount;
            }

            // ---- Red card (1 in 10 games) ----
            if (0 === $gameId % 10) {
                $teamPick = ($gameId % 20 < 10) ? $homeProxy : $awayProxy;
                $playerPick = ($gameId % 20 < 10) ? $homePlayers : $awayPlayers;
                $event = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['red_card']),
                    $pickPlayer($playerPick, $manager),
                    $makeTimestamp(random_int(55, 90))
                );
                $manager->persist($event);
                ++$eventCount;
            }

            // ---- Substitutions (2-4 per game, in pairs in/out) ----
            $subCount = random_int(2, 4);
            $subMinutes = [46, 55, 62, 70, 78];
            for ($i = 0; $i < $subCount; ++$i) {
                $teamPick = (0 === $i % 2) ? $homeProxy : $awayProxy;
                $playerPick = (0 === $i % 2) ? $homePlayers : $awayPlayers;
                $minIdx = min($i, count($subMinutes) - 1);
                $subMin = $subMinutes[$minIdx] + random_int(0, 4);

                $playerOut = $pickPlayer($playerPick, $manager);
                $playerIn = $pickPlayer($playerPick, $manager);

                // substitution_out
                $outEvent = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['substitution_out']),
                    $playerOut,
                    $makeTimestamp($subMin)
                );
                $manager->persist($outEvent);
                ++$eventCount;

                // substitution_in
                $inEvent = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['substitution_in']),
                    $playerIn,
                    $makeTimestamp($subMin)
                );
                $manager->persist($inEvent);
                ++$eventCount;
            }

            // ---- Corners (1-5 per game) ----
            $cornerCount = random_int(1, 5);
            for ($i = 0; $i < $cornerCount; ++$i) {
                $teamPick = (0 === $i % 2) ? $homeProxy : $awayProxy;
                $event = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['corner']),
                    null,
                    $makeTimestamp(random_int(5, 90))
                );
                $manager->persist($event);
                ++$eventCount;
            }

            // ---- Shots on target (1-4 per game) ----
            $shotCount = random_int(1, 4);
            for ($i = 0; $i < $shotCount; ++$i) {
                $teamPick = (0 === $i % 2) ? $homeProxy : $awayProxy;
                $playerPick = (0 === $i % 2) ? $homePlayers : $awayPlayers;
                $event = $this->makeEvent(
                    $gameProxy,
                    $teamPick,
                    $manager->getReference(GameEventType::class, $eventTypeIds['shot_on_target']),
                    $pickPlayer($playerPick, $manager),
                    $makeTimestamp(random_int(5, 90))
                );
                $manager->persist($event);
                ++$eventCount;
            }

            // ---- Flush & clear every batchSize events ----
            if (0 === $eventCount % $batchSize) {
                $manager->flush();
                $manager->clear();
            }
        }

        // Final flush
        $manager->flush();
        $manager->clear();
    }

    private function makeEvent(
        object $game,
        object $team,
        GameEventType $type,
        ?Player $player,
        DateTime $timestamp,
        ?string $description = null
    ): GameEvent {
        $event = new GameEvent();
        $event->setGame($game);
        $event->setTeam($team);
        $event->setGameEventType($type);
        $event->setPlayer($player);
        $event->setTimestamp($timestamp);
        if (null !== $description) {
            $event->setDescription($description);
        }

        return $event;
    }
}
