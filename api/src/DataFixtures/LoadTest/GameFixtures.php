<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\CalendarEventTypeFixtures;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Location;
use App\Entity\Team;
use DateTime;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Load-Test Fixtures: 3 Jahre Spielplan (2023/24, 2024/25, 2025/26).
 *
 * Pro Team und Saison:
 * - 13 Ligaspiele (samstags)
 * - 1 Pokalspiel (dienstags in Herbst)
 * - 1 Freundschaftsspiel (dienstags in Frühjahr)
 * Gesamt: 101 Teams × 15 Spiele × 3 Saisons = ~4545 Spiele
 *
 * Bereits vergangene Spiele: isFinished=true mit Ergebnissen.
 * Noch nicht gespielte Spiele: isFinished=false.
 *
 * Gruppe: load_test
 */
class GameFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const TOTAL_TEAMS = 101;
    private const BATCH_SIZE = 50;

    // Saisonstart (erstes Spielwochenende)
    private const SEASON_STARTS = [
        0 => '2023-08-05',
        1 => '2024-08-03',
        2 => '2025-08-02',
    ];

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

    public function load(ObjectManager $manager): void
    {
        // Game-Typen aus Repository laden
        $gameTypes = $manager->getRepository(GameType::class)->findAll();
        if (empty($gameTypes)) {
            throw new RuntimeException('Keine GameTypes gefunden. Bitte master-Fixtures zuerst laden.');
        }

        // Spezifische GameTypes suchen
        $ligaspielType = null;
        $pokalType = null;
        $freundschaftType = null;
        foreach ($gameTypes as $gt) {
            if ('Ligaspiel' === $gt->getName()) {
                $ligaspielType = $gt;
            } elseif ('Pokalspiel' === $gt->getName()) {
                $pokalType = $gt;
            } elseif ('Freundschaftsspiel' === $gt->getName()) {
                $freundschaftType = $gt;
            }
        }
        if (!$ligaspielType || !$pokalType || !$freundschaftType) {
            // Fallback: ersten GameType verwenden
            $ligaspielType = $ligaspielType ?? $gameTypes[0];
            $pokalType = $pokalType ?? $gameTypes[0];
            $freundschaftType = $freundschaftType ?? $gameTypes[0];
        }

        // Early return if games already exist (idempotency guard)
        assert($manager instanceof EntityManagerInterface);
        $existingGameCount = (int) $manager->getRepository(Game::class)->count([]);
        if ($existingGameCount > 0) {
            return;
        }

        /** @var CalendarEventType $gameCalendarType */
        $gameCalendarType = $this->getReference('calendar_event_type_spiel', CalendarEventType::class);

        $today = new DateTime('2026-03-15');
        $persistCount = 0;

        for ($teamIdx = 0; $teamIdx < self::TOTAL_TEAMS; ++$teamIdx) {
            /** @var Team $homeTeam */
            $homeTeam = $this->getReference('lt_team_' . $teamIdx, Team::class);
            /** @var Location $location */
            $location = $this->getReference('lt_location_' . ($teamIdx % 30), Location::class);

            for ($season = 0; $season < 3; ++$season) {
                $seasonStart = new DateTime(self::SEASON_STARTS[$season]);

                // 13 Ligaspiele an Samstagen
                for ($round = 0; $round < 13; ++$round) {
                    $awayTeamIdx = ($teamIdx + $round * 7 + 1) % self::TOTAL_TEAMS;
                    if ($awayTeamIdx === $teamIdx) {
                        $awayTeamIdx = ($awayTeamIdx + 1) % self::TOTAL_TEAMS;
                    }
                    /** @var Team $awayTeam */
                    $awayTeam = $this->getReference('lt_team_' . $awayTeamIdx, Team::class);

                    $gameDate = clone $seasonStart;
                    $gameDate->modify('+' . ($round * 7) . ' days');
                    $gameDate->setTime(15, 0);

                    $game = $this->createGame(
                        $manager,
                        $homeTeam,
                        $awayTeam,
                        $ligaspielType,
                        $gameCalendarType,
                        $location,
                        $gameDate,
                        $today
                    );
                    $manager->persist($game);
                    ++$persistCount;

                    if (0 === $persistCount % self::BATCH_SIZE) {
                        $manager->flush();
                    }
                }

                // 1 Pokalspiel (Dienstag in Herbst, Runde 4 der Saison)
                $cupDate = clone $seasonStart;
                $cupDate->modify('+' . 30 . ' days'); // ~4 Wochen nach Saisonstart
                $cupDate->modify('next tuesday');
                $cupDate->setTime(19, 30);
                $cupAwayTeamIdx = ($teamIdx + 33) % self::TOTAL_TEAMS;
                if ($cupAwayTeamIdx === $teamIdx) {
                    $cupAwayTeamIdx = ($cupAwayTeamIdx + 1) % self::TOTAL_TEAMS;
                }
                /** @var Team $cupAwayTeam */
                $cupAwayTeam = $this->getReference('lt_team_' . $cupAwayTeamIdx, Team::class);

                $cupGame = $this->createGame(
                    $manager,
                    $homeTeam,
                    $cupAwayTeam,
                    $pokalType,
                    $gameCalendarType,
                    $location,
                    $cupDate,
                    $today
                );
                $manager->persist($cupGame);
                ++$persistCount;

                // 1 Freundschaftsspiel (Mittwoch im Frühjahr, nach Winter-Pause)
                $friendlyDate = clone $seasonStart;
                $friendlyDate->modify('+' . (21 * 7) . ' days'); // ~21 Wochen nach Saisonstart
                $friendlyDate->modify('next wednesday');
                $friendlyDate->setTime(18, 0);
                $friendlyAwayTeamIdx = ($teamIdx + 51) % self::TOTAL_TEAMS;
                if ($friendlyAwayTeamIdx === $teamIdx) {
                    $friendlyAwayTeamIdx = ($friendlyAwayTeamIdx + 1) % self::TOTAL_TEAMS;
                }
                /** @var Team $friendlyAwayTeam */
                $friendlyAwayTeam = $this->getReference('lt_team_' . $friendlyAwayTeamIdx, Team::class);

                $friendlyGame = $this->createGame(
                    $manager,
                    $homeTeam,
                    $friendlyAwayTeam,
                    $freundschaftType,
                    $gameCalendarType,
                    $location,
                    $friendlyDate,
                    $today
                );
                $manager->persist($friendlyGame);
                ++$persistCount;

                if (0 === $persistCount % self::BATCH_SIZE) {
                    $manager->flush();
                }
            }
        }

        $manager->flush();
    }

    private function createGame(
        ObjectManager $manager,
        Team $homeTeam,
        Team $awayTeam,
        GameType $gameType,
        CalendarEventType $calendarEventType,
        Location $location,
        DateTime $gameDate,
        DateTime $today
    ): Game {
        $isPast = $gameDate < $today;

        // Calendar-Event erstellen
        $calEvent = new CalendarEvent();
        $calEvent->setTitle($homeTeam->getName() . ' vs. ' . $awayTeam->getName());
        $calEvent->setStartDate(clone $gameDate);
        $endDate = clone $gameDate;
        $endDate->modify('+105 minutes');
        $calEvent->setEndDate($endDate);
        $calEvent->setCalendarEventType($calendarEventType);
        $calEvent->setLocation($location);

        // Spiel erstellen
        $game = new Game();
        $game->setHomeTeam($homeTeam);
        $game->setAwayTeam($awayTeam);
        $game->setGameType($gameType);
        $game->setLocation($location);
        $game->setCalendarEvent($calEvent);

        // Halbzeitdauer: Vereinfachung mit 45 Minuten Standardwert
        $game->setHalfDuration(45);
        $game->setHalftimeBreakDuration(15);

        if ($isPast) {
            // Zufälliges realistisches Ergebnis
            $homeScore = rand(0, 4);
            $awayScore = rand(0, 3);
            // Manchmal klare Siege
            if (rand(0, 10) < 2) {
                $homeScore += rand(1, 3);
            }
            $game->setHomeScore($homeScore);
            $game->setAwayScore($awayScore);
            $game->setIsFinished(true);
            // Nachspielzeit für vergangene Spiele
            $game->setFirstHalfExtraTime(rand(0, 5));
            $game->setSecondHalfExtraTime(rand(1, 7));
        } else {
            $game->setIsFinished(false);
        }

        return $game;
    }
}
