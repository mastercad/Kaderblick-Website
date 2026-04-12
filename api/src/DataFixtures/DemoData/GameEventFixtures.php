<?php

namespace App\DataFixtures\DemoData;

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
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Demo-Fixtures: Spielereignisse für alle abgeschlossenen Spiele.
 *
 * Erstellt pro abgeschlossenem Spiel:
 * - Tor-Events (exakt homeScore + awayScore Tore, mit Vorlage)
 * - Gelbe-Karten-Events (1-3 pro Spiel)
 * - Schuss-auf-Tor-Events (2-5 pro Mannschaft)
 * - Ecken (3-8 pro Spiel gesamt)
 *
 * Gruppe: demo
 */
class GameEventFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 200;

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            PlayerFixtures::class,
            \App\DataFixtures\MasterData\GameEventTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // ── Alle benötigten GameEventType-IDs laden ──────────────────────────
        $allTypes = $manager->getRepository(GameEventType::class)->findAll();
        $eventTypeIds = [];
        foreach ($allTypes as $type) {
            $eventTypeIds[$type->getCode()] = $type->getId();
        }

        $needed = ['goal', 'header_goal', 'freekick_goal', 'penalty_goal', 'corner_goal',
            'yellow_card', 'shot_on_target', 'shot_off_target', 'corner', 'assist'];
        foreach ($needed as $code) {
            if (!isset($eventTypeIds[$code])) {
                throw new RuntimeException("Fehlender GameEventType: '{$code}'. MasterData zuerst laden.");
            }
        }

        // ── Spieler pro Team aus DB laden ─────────────────────────────────────
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

        // ── Bereits verarbeitete Spiele überspringen (Idempotenz) ────────────
        $existingGameIds = [];
        $existing = $manager->createQuery(
            'SELECT DISTINCT IDENTITY(e.game) AS gameId FROM App\Entity\GameEvent e'
        )->getArrayResult();
        foreach ($existing as $row) {
            $existingGameIds[(int) $row['gameId']] = true;
        }
        unset($existing);

        // ── Alle abgeschlossenen Spiele laden ────────────────────────────────
        $gamesData = $manager->createQuery(
            'SELECT g.id, IDENTITY(g.homeTeam) AS homeTeamId, IDENTITY(g.awayTeam) AS awayTeamId,
                    g.homeScore, g.awayScore, ce.startDate AS startDate
             FROM App\Entity\Game g
             JOIN g.calendarEvent ce
             WHERE g.isFinished = true
             ORDER BY g.id ASC'
        )->getArrayResult();

        $eventCount = 0;

        foreach ($gamesData as $gameRow) {
            $gameId = (int) $gameRow['id'];
            if (isset($existingGameIds[$gameId])) {
                continue;
            }

            $homeTeamId = (int) $gameRow['homeTeamId'];
            $awayTeamId = (int) $gameRow['awayTeamId'];
            $homeScore = (int) ($gameRow['homeScore'] ?? 0);
            $awayScore = (int) ($gameRow['awayScore'] ?? 0);

            /** @var DateTimeInterface $kickoff */
            $kickoff = $gameRow['startDate'];
            $baseTime = new DateTime($kickoff->format('Y-m-d H:i:s'));

            $homePlayers = $teamPlayerMap[$homeTeamId] ?? [];
            $awayPlayers = $teamPlayerMap[$awayTeamId] ?? [];

            /** @var Game $gameProxy */
            $gameProxy = $manager->getReference(Game::class, $gameId);
            /** @var Team $homeProxy */
            $homeProxy = $manager->getReference(Team::class, $homeTeamId);
            /** @var Team $awayProxy */
            $awayProxy = $manager->getReference(Team::class, $awayTeamId);

            $pickPlayer = static function (array $ids) use ($manager): ?Player {
                if (empty($ids)) {
                    return null;
                }

                return $manager->getReference(Player::class, $ids[array_rand($ids)]);
            };

            $makeTs = static function (int $minute) use ($baseTime): DateTime {
                return (clone $baseTime)->modify("+{$minute} minutes");
            };

            $goalCodes = ['goal', 'header_goal', 'corner_goal', 'freekick_goal'];
            $minute = 3;

            // ── Heimtore ────────────────────────────────────────────────────
            for ($i = 0; $i < $homeScore; ++$i) {
                $minute = min($minute + random_int(4, 20), 90);
                $code = $goalCodes[$i % 4];
                $scorer = $pickPlayer($homePlayers);
                $assister = $pickPlayer(array_filter($homePlayers, fn ($id) => null === $scorer || $id !== $scorer->getId()));

                $goal = $this->makeEvent(
                    $gameProxy,
                    $homeProxy,
                    $manager->getReference(GameEventType::class, $eventTypeIds[$code]),
                    $makeTs($minute),
                    $scorer
                );
                $manager->persist($goal);
                ++$eventCount;

                // Vorlage (assist) – 70% Wahrscheinlichkeit
                if (null !== $assister && random_int(1, 10) <= 7) {
                    $assistEvent = $this->makeEvent(
                        $gameProxy,
                        $homeProxy,
                        $manager->getReference(GameEventType::class, $eventTypeIds['assist']),
                        $makeTs(max(1, $minute - 1)),
                        $assister
                    );
                    $manager->persist($assistEvent);
                    ++$eventCount;
                }
            }

            // ── Auswärtstore ─────────────────────────────────────────────────
            $minute = 5;
            for ($i = 0; $i < $awayScore; ++$i) {
                $minute = min($minute + random_int(4, 20), 90);
                $code = $goalCodes[$i % 4];
                $scorer = $pickPlayer($awayPlayers);
                $assister = $pickPlayer(array_filter($awayPlayers, fn ($id) => null === $scorer || $id !== $scorer->getId()));

                $goal = $this->makeEvent(
                    $gameProxy,
                    $awayProxy,
                    $manager->getReference(GameEventType::class, $eventTypeIds[$code]),
                    $makeTs($minute),
                    $scorer
                );
                $manager->persist($goal);
                ++$eventCount;

                if (null !== $assister && random_int(1, 10) <= 7) {
                    $assistEvent = $this->makeEvent(
                        $gameProxy,
                        $awayProxy,
                        $manager->getReference(GameEventType::class, $eventTypeIds['assist']),
                        $makeTs(max(1, $minute - 1)),
                        $assister
                    );
                    $manager->persist($assistEvent);
                    ++$eventCount;
                }
            }

            // ── Gelbe Karten (1-3) ───────────────────────────────────────────
            $yellowCount = random_int(1, 3);
            $allPlayers = array_merge(
                array_map(fn ($id) => [$id, $homeTeamId, $homeProxy], $homePlayers),
                array_map(fn ($id) => [$id, $awayTeamId, $awayProxy], $awayPlayers)
            );
            shuffle($allPlayers);
            $yellowed = array_slice($allPlayers, 0, $yellowCount);
            foreach ($yellowed as [$playerId, , $teamProxy]) {
                $cardMinute = random_int(20, 88);
                $card = $this->makeEvent(
                    $gameProxy,
                    $teamProxy,
                    $manager->getReference(GameEventType::class, $eventTypeIds['yellow_card']),
                    $makeTs($cardMinute),
                    $manager->getReference(Player::class, $playerId)
                );
                $manager->persist($card);
                ++$eventCount;
            }

            // ── Schüsse aufs Tor (2-5 je Mannschaft) ────────────────────────
            $shotsHome = random_int(2, 5);
            $shotsAway = random_int(2, 5);
            $shotOffTarget = $manager->getReference(GameEventType::class, $eventTypeIds['shot_on_target']);

            for ($s = 0; $s < $shotsHome; ++$s) {
                $shot = $this->makeEvent(
                    $gameProxy,
                    $homeProxy,
                    $shotOffTarget,
                    $makeTs(random_int(5, 90)),
                    $pickPlayer($homePlayers)
                );
                $manager->persist($shot);
                ++$eventCount;
            }
            for ($s = 0; $s < $shotsAway; ++$s) {
                $shot = $this->makeEvent(
                    $gameProxy,
                    $awayProxy,
                    $shotOffTarget,
                    $makeTs(random_int(5, 90)),
                    $pickPlayer($awayPlayers)
                );
                $manager->persist($shot);
                ++$eventCount;
            }

            // ── Ecken (3-8 gesamt) ───────────────────────────────────────────
            $cornerType = $manager->getReference(GameEventType::class, $eventTypeIds['corner']);
            $totalCorners = random_int(3, 8);
            for ($c = 0; $c < $totalCorners; ++$c) {
                $cornerTeam = (0 === $c % 2) ? $homeProxy : $awayProxy;
                $cornerPlayers = (0 === $c % 2) ? $homePlayers : $awayPlayers;
                $corner = $this->makeEvent(
                    $gameProxy,
                    $cornerTeam,
                    $cornerType,
                    $makeTs(random_int(5, 92)),
                    $pickPlayer($cornerPlayers)
                );
                $manager->persist($corner);
                ++$eventCount;
            }

            if (0 === $eventCount % self::BATCH_SIZE) {
                $manager->flush();
                $manager->clear();
                // Re-fetch proxies after clear (references are invalidated after clear)
            }
        }

        $manager->flush();
    }

    private function makeEvent(
        Game $game,
        Team $team,
        GameEventType $type,
        DateTime $timestamp,
        ?Player $player = null,
    ): GameEvent {
        $event = new GameEvent();
        $event->setGame($game);
        $event->setTeam($team);
        $event->setGameEventType($type);
        $event->setTimestamp($timestamp);
        $event->setPlayer($player);

        return $event;
    }
}
