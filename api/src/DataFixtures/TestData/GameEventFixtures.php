<?php

declare(strict_types=1);

namespace App\DataFixtures\TestData;

use App\DataFixtures\MasterData\GameEventTypeFixtures;
use App\Entity\Coach;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\Team;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Erstellt Test-GameEvents für die Gruppe „test".
 *
 * Szenarien für UnknownGameEvents-Tests:
 *   - 2 Ereignisse ohne Spieler UND ohne Coach → erscheinen als „unbekannte Ereignisse"
 *   - 1 Ereignis mit Coach gesetzt          → darf NICHT als unbekannt gelten
 *   - 1 Ereignis mit Spieler gesetzt        → darf NICHT als unbekannt gelten
 *
 * Alle Ereignisse sind am Spiel game_0 (Team 1 vs. Team 2) hinterlegt.
 * Beschreibungsfelder mit __test_*__-Marker ermöglichen zuverlässiges Auffinden im Test.
 */
class GameEventFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            GameEventTypeFixtures::class,
            PlayerFixtures::class,
            CoachFixtures::class,
        ];
    }

    /** @return list<string> */
    public static function getGroups(): array
    {
        return ['test'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var Game $game0 */
        $game0 = $this->getReference('game_0', Game::class);

        /** @var GameEventType $yellowCard */
        $yellowCard = $this->getReference('game_event_type_gelbe_karte', GameEventType::class);

        /** @var GameEventType $redCard */
        $redCard = $this->getReference('game_event_type_rote_karte', GameEventType::class);

        /** @var Team $team1 */
        $team1 = $this->getReference('Team 1', Team::class);

        /** @var Team $team2 */
        $team2 = $this->getReference('Team 2', Team::class);

        /** @var Player $player1Team1 */
        $player1Team1 = $this->getReference('player_1_1', Player::class);

        /** @var Coach $coach1 */
        $coach1 = $this->getReference('coach_1', Coach::class);

        // ── Unbekanntes Ereignis 1: Gelbe Karte, Team 1, kein Spieler, kein Coach ──
        $this->persistIfNew($manager, '__test_unknown_evt_1__', static function () use ($game0, $yellowCard, $team1): GameEvent {
            $event = new GameEvent();
            $event->setGame($game0);
            $event->setGameEventType($yellowCard);
            $event->setTeam($team1);
            $event->setTimestamp(new DateTime('2024-08-10 15:30:00'));
            $event->setDescription('__test_unknown_evt_1__');

            return $event;
        });

        // ── Unbekanntes Ereignis 2: Rote Karte, Team 2, kein Spieler, kein Coach ──
        $this->persistIfNew($manager, '__test_unknown_evt_2__', static function () use ($game0, $redCard, $team2): GameEvent {
            $event = new GameEvent();
            $event->setGame($game0);
            $event->setGameEventType($redCard);
            $event->setTeam($team2);
            $event->setTimestamp(new DateTime('2024-08-10 15:45:00'));
            $event->setDescription('__test_unknown_evt_2__');

            return $event;
        });

        // ── Ereignis mit Coach: darf NICHT in der Unbekannt-Liste erscheinen ──────
        $this->persistIfNew($manager, '__test_evt_with_coach__', static function () use ($game0, $yellowCard, $team1, $coach1): GameEvent {
            $event = new GameEvent();
            $event->setGame($game0);
            $event->setGameEventType($yellowCard);
            $event->setTeam($team1);
            $event->setCoach($coach1);
            $event->setTimestamp(new DateTime('2024-08-10 16:00:00'));
            $event->setDescription('__test_evt_with_coach__');

            return $event;
        });

        // ── Ereignis mit Spieler: darf NICHT in der Unbekannt-Liste erscheinen ────
        $this->persistIfNew($manager, '__test_evt_with_player__', static function () use ($game0, $yellowCard, $team1, $player1Team1): GameEvent {
            $event = new GameEvent();
            $event->setGame($game0);
            $event->setGameEventType($yellowCard);
            $event->setTeam($team1);
            $event->setPlayer($player1Team1);
            $event->setTimestamp(new DateTime('2024-08-10 16:15:00'));
            $event->setDescription('__test_evt_with_player__');

            return $event;
        });

        $manager->flush();
    }

    /**
     * Legt ein GameEvent nur dann an, wenn noch keines mit dieser Beschreibung existiert (Idempotenz).
     */
    private function persistIfNew(ObjectManager $manager, string $description, \Closure $factory): void
    {
        $existing = $manager->getRepository(GameEvent::class)->findOneBy(['description' => $description]);
        if ($existing !== null) {
            return;
        }

        $manager->persist($factory());
    }
}
