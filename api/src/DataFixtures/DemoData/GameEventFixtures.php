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
            'yellow_card', 'shot_on_target', 'shot_off_target', 'corner', 'assist',
            'substitution_in', 'substitution_out', 'substitution_injury'];
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

        // Torwart-IDs ermitteln, damit Torwarte nicht für Torschüsse/Vorlagen/Ecken ausgewählt werden
        $gkRows = $manager->createQuery(
            'SELECT p.id FROM App\Entity\Player p JOIN p.mainPosition pos WHERE pos.shortName = :tw'
        )->setParameter('tw', 'TW')->getArrayResult();
        $gkIds = array_flip(array_column($gkRows, 'id'));
        unset($gkRows);

        /** @var array<int, int[]> $teamPlayerMap teamId => [playerId, ...] */
        $teamPlayerMap = [];
        /** @var array<int, int[]> $teamFieldPlayerMap teamId => [Feldspieler-IDs ohne Torwarte] */
        $teamFieldPlayerMap = [];
        foreach ($ptaRows as $row) {
            $pid = (int) $row['playerId'];
            $tid = (int) $row['teamId'];
            $teamPlayerMap[$tid][] = $pid;
            if (!isset($gkIds[$pid])) {
                $teamFieldPlayerMap[$tid][] = $pid;
            }
        }
        unset($ptaRows, $gkIds);

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
            // Feldspieler-Pool ohne Torwarte (für Tore, Vorlagen, Ecken, Torschüsse)
            $homeFieldPlayers = $teamFieldPlayerMap[$homeTeamId] ?? $homePlayers;
            $awayFieldPlayers = $teamFieldPlayerMap[$awayTeamId] ?? $awayPlayers;

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
                $scorer = $pickPlayer($homeFieldPlayers);
                $assister = $pickPlayer(array_filter($homeFieldPlayers, fn ($id) => null === $scorer || $id !== $scorer->getId()));

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
                $scorer = $pickPlayer($awayFieldPlayers);
                $assister = $pickPlayer(array_filter($awayFieldPlayers, fn ($id) => null === $scorer || $id !== $scorer->getId()));

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
                    $pickPlayer($homeFieldPlayers)
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
                    $pickPlayer($awayFieldPlayers)
                );
                $manager->persist($shot);
                ++$eventCount;
            }

            // ── Ecken (3-8 gesamt) ───────────────────────────────────────────
            $cornerType = $manager->getReference(GameEventType::class, $eventTypeIds['corner']);
            $totalCorners = random_int(3, 8);
            for ($c = 0; $c < $totalCorners; ++$c) {
                $cornerTeam = (0 === $c % 2) ? $homeProxy : $awayProxy;
                $cornerPlayers = (0 === $c % 2) ? $homeFieldPlayers : $awayFieldPlayers;
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

            // ── Auswechslungen (2-3 je Mannschaft) ──────────────────────────
            // Typen: substitution_out (normal), substitution_injury (verletzungsbedingt, ~25%)
            // Jede Auswechslung = Paar aus _out/_injury + _in mit relatedPlayer
            $subInType = $manager->getReference(GameEventType::class, $eventTypeIds['substitution_in']);
            $subOutType = $manager->getReference(GameEventType::class, $eventTypeIds['substitution_out']);
            $subInjType = $manager->getReference(GameEventType::class, $eventTypeIds['substitution_injury']);

            foreach ([$homeProxy, $awayProxy] as $subTeam) {
                $subPool = ($subTeam === $homeProxy) ? $homeFieldPlayers : $awayFieldPlayers;
                if (count($subPool) < 2) {
                    continue;
                }
                $used = [];
                $subCount = random_int(2, 3);
                $available = $subPool;
                shuffle($available);
                $subMinutes = [46, 60, 70, 80, 85];

                for ($sub = 0; $sub < $subCount; ++$sub) {
                    $remaining = array_values(array_diff($available, $used));
                    if (count($remaining) < 2) {
                        break;
                    }
                    $playerOutId = $remaining[0];
                    $playerInId = $remaining[1];
                    $used[] = $playerOutId;
                    $used[] = $playerInId;

                    $playerOut = $manager->getReference(Player::class, $playerOutId);
                    $playerIn = $manager->getReference(Player::class, $playerInId);
                    $subMinute = $subMinutes[$sub];
                    $ts = $makeTs($subMinute);

                    // ~25% der Auswechslungen sind verletzungsbedingt
                    $outType = (1 === random_int(1, 4)) ? $subInjType : $subOutType;

                    $evOut = new GameEvent();
                    $evOut->setGame($gameProxy);
                    $evOut->setTeam($subTeam);
                    $evOut->setGameEventType($outType);
                    $evOut->setTimestamp($ts);
                    $evOut->setPlayer($playerOut);
                    $evOut->setRelatedPlayer($playerIn);
                    $manager->persist($evOut);
                    ++$eventCount;

                    $evIn = new GameEvent();
                    $evIn->setGame($gameProxy);
                    $evIn->setTeam($subTeam);
                    $evIn->setGameEventType($subInType);
                    $evIn->setTimestamp($ts);
                    $evIn->setPlayer($playerIn);
                    $evIn->setRelatedPlayer($playerOut);
                    $manager->persist($evIn);
                    ++$eventCount;
                }
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
