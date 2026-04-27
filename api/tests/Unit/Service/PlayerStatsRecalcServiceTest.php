<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\PlayerGameStats;
use App\Repository\GameEventRepository;
use App\Repository\PlayerRepository;
use App\Service\PlayerStatsRecalcService;
use DateTime;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests für PlayerStatsRecalcService.
 *
 * Alle Branches der recalcForGame-Methode werden abgedeckt:
 * - Leerer matchPlan + keine Substitutions → früher return
 * - Startelf ohne Auswechslungen → volle Spielzeit
 * - Berechnung der Gesamtspieldauer (halfDuration * 2 + extra times)
 * - Fallback auf 90 Min wenn halfDuration = 0
 * - Auswechslungen splitten Spielzeiten korrekt
 * - Ausgewechselter Spieler nicht in Startelf → from=0 bis Auswechselminute
 * - Substitutions werden vor Verarbeitung chronologisch sortiert
 * - Spieler nicht in Repository → wird übersprungen
 * - Nicht-echte Spieler (isRealPlayer=false/null/fehlt) werden ignoriert
 * - Nur die erste 'start'-Phase wird ausgewertet
 */
#[AllowMockObjectsWithoutExpectations]
class PlayerStatsRecalcServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private PlayerRepository&MockObject $playerRepository;
    private GameEventRepository&MockObject $gameEventRepository;
    private PlayerStatsRecalcService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->playerRepository = $this->createMock(PlayerRepository::class);
        $this->gameEventRepository = $this->createMock(GameEventRepository::class);
        $this->service = new PlayerStatsRecalcService($this->em, $this->playerRepository, $this->gameEventRepository);
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * @param array<mixed>|null      $matchPlan
     * @param DateTimeInterface|null $startDate startDate des CalendarEvent (null = kein CalendarEvent)
     *
     * @return Game&MockObject
     */
    private function makeGame(
        int $halfDuration = 45,
        ?int $firstExtraTime = null,
        ?int $secondExtraTime = null,
        ?array $matchPlan = null,
        ?DateTimeInterface $startDate = null,
    ): Game {
        $game = $this->createMock(Game::class);
        $game->method('getHalfDuration')->willReturn($halfDuration);
        $game->method('getFirstHalfExtraTime')->willReturn($firstExtraTime);
        $game->method('getSecondHalfExtraTime')->willReturn($secondExtraTime);
        $game->method('getMatchPlan')->willReturn($matchPlan);
        $game->method('isFinished')->willReturn(true);

        if (null !== $startDate) {
            $calendarEvent = $this->createMock(CalendarEvent::class);
            $calendarEvent->method('getStartDate')->willReturn($startDate);
            $game->method('getCalendarEvent')->willReturn($calendarEvent);
        } else {
            $game->method('getCalendarEvent')->willReturn(null);
        }

        return $game;
    }

    /**
     * Erstellt ein GameEvent-Mock für Auswechslungen.
     * startDate ist Epoch 0, daher gilt: Minute X = Timestamp X*60.
     *
     * @param string $code 'substitution'|'substitution_in'|'substitution_out'|'substitution_injury'
     *
     * @return GameEvent&MockObject
     */
    private function makeGameEvent(
        int $minute,
        ?Player $player,
        ?Player $relatedPlayer = null,
        string $code = 'substitution',
    ): GameEvent {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn($code);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($type);
        $event->method('getPlayer')->willReturn($player);
        $event->method('getRelatedPlayer')->willReturn($relatedPlayer);
        $event->method('getTimestamp')->willReturn(new DateTime('@' . ($minute * 60)));

        return $event;
    }

    /** @return Player&MockObject */
    private function makePlayer(int $id): Player
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn($id);

        return $player;
    }

    /** @return Query&MockObject */
    private function makeDeleteQuery(): Query
    {
        $query = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->getMock();
        $query->method('setParameter')->willReturnSelf();
        $query->method('execute')->willReturn(0);

        return $query;
    }

    private function setupDeleteQuery(): void
    {
        $query = $this->makeDeleteQuery();
        $this->em->expects(self::once())
            ->method('createQuery')
            ->with(self::stringContains('DELETE FROM App\Entity\PlayerGameStats'))
            ->willReturn($query);
    }

    /**
     * Führt recalcForGame aus und sammelt alle an em->persist() übergebenen
     * PlayerGameStats-Objekte in einem assoziativen Array [playerId => minutesPlayed].
     *
     * @return array<int, int>
     */
    private function capturePersistedStats(Game $game): array
    {
        $persistedStats = [];
        $this->em->method('persist')
            ->willReturnCallback(function (object $stat) use (&$persistedStats): void {
                if ($stat instanceof PlayerGameStats) {
                    $persistedStats[$stat->getPlayer()->getId()] = $stat->getMinutesPlayed();
                }
            });
        $this->em->method('flush');

        $this->service->recalcForGame($game);

        return $persistedStats;
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    public function testEmptyMatchPlanAndNoSubstitutionsDoesNotPersistAnything(): void
    {
        $game = $this->makeGame(matchPlan: null);
        $this->setupDeleteQuery();

        $this->playerRepository->expects(self::never())->method('findBy');
        $this->em->expects(self::never())->method('persist');
        $this->em->expects(self::never())->method('flush');

        $this->service->recalcForGame($game);
    }

    public function testStartElfWithoutSubstitutionsCreatesOneStatPerPlayer(): void
    {
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);
        $matchPlan = [
            'phases' => [[
                'sourceType' => 'start',
                'players' => [
                    ['playerId' => 1, 'isRealPlayer' => true],
                    ['playerId' => 2, 'isRealPlayer' => true],
                ],
            ]],
        ];

        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertCount(2, $stats);
    }

    public function testTotalMinutesIsHalfDurationTimesTwo(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 30, matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(60, $stats[1]); // 2 * 30 = 60
    }

    public function testExtraTimeIsAddedToTotalMinutes(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 45, firstExtraTime: 3, secondExtraTime: 5, matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(98, $stats[1]); // 45 + 45 + 3 + 5 = 98
    }

    public function testFallbackTo90WhenHalfDurationIsZero(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 0, matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(90, $stats[1]);
    }

    public function testSubstitutionSplitsMinutesCorrectly(): void
    {
        // Player 1 wird in Minute 60 durch Player 2 ersetzt
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);

        // startDate = Epoch 0; Minute 60 = Timestamp 3600
        $event = $this->makeGameEvent(60, $player1, $player2, 'substitution');

        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, startDate: new DateTime('@0'));
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([$event]);
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(60, $stats[1]); // Minute 0–60
        self::assertSame(30, $stats[2]); // Minute 60–90
    }

    public function testSubstitutedOutPlayerNotInStartElfGetsFromZero(): void
    {
        // Player 1 wird ausgewechselt, war aber NICHT in der Startelf (leere start-Phase)
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);

        // startDate = Epoch 0; Minute 45 = Timestamp 2700
        $event = $this->makeGameEvent(45, $player1, $player2, 'substitution');

        // matchPlan mit leerer start-Phase: kein Spieler in der Startelf
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => []]]];
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, startDate: new DateTime('@0'));
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([$event]);
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(45, $stats[1]); // from=0, to=45
        self::assertSame(45, $stats[2]); // from=45, to=90
    }

    public function testSubstitutionsAreSortedByMinuteBeforeProcessing(): void
    {
        // findSubstitutions() liefert Events chronologisch sortiert (ORDER BY timestamp ASC)
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);
        $player3 = $this->makePlayer(3);

        // startDate = Epoch 0; Minute 45 = @2700, Minute 70 = @4200
        $event45 = $this->makeGameEvent(45, $player1, $player2, 'substitution');
        $event70 = $this->makeGameEvent(70, $player2, $player3, 'substitution');

        $matchPlan = [
            'phases' => [['sourceType' => 'start', 'players' => [
                ['playerId' => 1, 'isRealPlayer' => true],
            ]]],
        ];

        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, startDate: new DateTime('@0'));
        $this->setupDeleteQuery();
        // Repository liefert bereits korrekt sortierte Events
        $this->gameEventRepository->method('findSubstitutions')->willReturn([$event45, $event70]);
        $this->playerRepository->method('findBy')->willReturn([$player1, $player2, $player3]);

        $stats = $this->capturePersistedStats($game);

        // Player1: 0–45 = 45 Min
        // Player2: kam rein bei 45, geht raus bei 70 → 45–70 = 25 Min
        // Player3: kam rein bei 70, bleibt bis 90 → 70–90 = 20 Min
        self::assertSame(45, $stats[1]);
        self::assertSame(25, $stats[2]);
        self::assertSame(20, $stats[3]);
    }

    public function testPlayerNotInRepositoryIsSkipped(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = [
            'phases' => [['sourceType' => 'start', 'players' => [
                ['playerId' => 1, 'isRealPlayer' => true],
                ['playerId' => 99, 'isRealPlayer' => true], // existiert nicht in DB
            ]]],
        ];

        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->willReturn([$player1]); // player 99 fehlt

        $stats = $this->capturePersistedStats($game);

        self::assertCount(1, $stats);
        self::assertArrayHasKey(1, $stats);
        self::assertArrayNotHasKey(99, $stats);
    }

    public function testNonRealPlayersAreIgnored(): void
    {
        $matchPlan = [
            'phases' => [['sourceType' => 'start', 'players' => [
                ['playerId' => 1, 'isRealPlayer' => false],
                ['playerId' => 2, 'isRealPlayer' => null],
                ['playerId' => 3], // kein isRealPlayer-Key
            ]]],
        ];

        $game = $this->makeGame(matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);

        $this->playerRepository->expects(self::never())->method('findBy');
        $this->em->expects(self::never())->method('persist');
        $this->em->expects(self::never())->method('flush');

        $this->service->recalcForGame($game);
    }

    public function testOnlyFirstStartPhaseIsUsed(): void
    {
        // shape_change-Phase vor der start-Phase soll ignoriert werden
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);
        $matchPlan = [
            'phases' => [
                ['sourceType' => 'shape_change', 'players' => [['playerId' => 2, 'isRealPlayer' => true]]],
                ['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]],
            ],
        ];

        $game = $this->makeGame(matchPlan: $matchPlan);
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([]);
        $this->playerRepository->method('findBy')->with(['id' => [1]])->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertCount(1, $stats);
        self::assertArrayHasKey(1, $stats);
        self::assertArrayNotHasKey(2, $stats);
    }

    public function testPlayerWithZeroMinutesIsNotPersisted(): void
    {
        // Spieler kommt rein UND geht sofort wieder raus (gleiche Minute) → 0 Minuten
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);
        $player3 = $this->makePlayer(3);

        // player2 geht raus bei 60, player3 kommt rein – player3 geht direkt wieder raus bei 60
        // startDate = Epoch 0; beide Events haben Minute 60 = Timestamp 3600
        $event1 = $this->makeGameEvent(60, $player2, $player3, 'substitution');
        $event2 = $this->makeGameEvent(60, $player3, $player1, 'substitution'); // player3 direkt wieder raus

        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [
            ['playerId' => 2, 'isRealPlayer' => true],
        ]]]];
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, startDate: new DateTime('@0'));
        $this->setupDeleteQuery();
        $this->gameEventRepository->method('findSubstitutions')->willReturn([$event1, $event2]);
        $this->playerRepository->method('findBy')->willReturn([$player1, $player2, $player3]);

        $stats = $this->capturePersistedStats($game);

        // player3: from=60, to=60 → 0 Minuten → wird nicht persistiert
        self::assertArrayNotHasKey(3, $stats);
        // player2: 0–60 = 60 Min; player1: 60–90 = 30 Min
        self::assertSame(60, $stats[2]);
        self::assertSame(30, $stats[1]);
    }
}
