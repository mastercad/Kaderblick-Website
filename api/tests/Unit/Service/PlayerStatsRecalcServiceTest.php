<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerGameStats;
use App\Entity\Substitution;
use App\Repository\PlayerRepository;
use App\Service\PlayerStatsRecalcService;
use Doctrine\Common\Collections\ArrayCollection;
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
    private PlayerStatsRecalcService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->playerRepository = $this->createMock(PlayerRepository::class);
        $this->service = new PlayerStatsRecalcService($this->em, $this->playerRepository);
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * @param array<mixed>|null        $matchPlan
     * @param array<int, Substitution> $substitutions
     *
     * @return Game&MockObject
     */
    private function makeGame(
        int $halfDuration = 45,
        ?int $firstExtraTime = null,
        ?int $secondExtraTime = null,
        ?array $matchPlan = null,
        array $substitutions = [],
    ): Game {
        $game = $this->createMock(Game::class);
        $game->method('getHalfDuration')->willReturn($halfDuration);
        $game->method('getFirstHalfExtraTime')->willReturn($firstExtraTime);
        $game->method('getSecondHalfExtraTime')->willReturn($secondExtraTime);
        $game->method('getMatchPlan')->willReturn($matchPlan);
        $game->method('getSubstitutions')->willReturn(new ArrayCollection($substitutions));

        return $game;
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
        $game = $this->makeGame(matchPlan: null, substitutions: []);
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

        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertCount(2, $stats);
    }

    public function testTotalMinutesIsHalfDurationTimesTwo(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 30, matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(60, $stats[1]); // 2 * 30 = 60
    }

    public function testExtraTimeIsAddedToTotalMinutes(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 45, firstExtraTime: 3, secondExtraTime: 5, matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(98, $stats[1]); // 45 + 45 + 3 + 5 = 98
    }

    public function testFallbackTo90WhenHalfDurationIsZero(): void
    {
        $player1 = $this->makePlayer(1);
        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];

        $game = $this->makeGame(halfDuration: 0, matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->willReturn([$player1]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(90, $stats[1]);
    }

    public function testSubstitutionSplitsMinutesCorrectly(): void
    {
        // Player 1 wird in Minute 60 durch Player 2 ersetzt
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);

        $sub = $this->createMock(Substitution::class);
        $sub->method('getMinute')->willReturn(60);
        $sub->method('getPlayerOut')->willReturn($player1);
        $sub->method('getPlayerIn')->willReturn($player2);

        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [['playerId' => 1, 'isRealPlayer' => true]]]]];
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, substitutions: [$sub]);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(60, $stats[1]); // Minute 0–60
        self::assertSame(30, $stats[2]); // Minute 60–90
    }

    public function testSubstitutedOutPlayerNotInStartElfGetsFromZero(): void
    {
        // Player 1 wird ausgewechselt, war aber NICHT in der Startelf (fehlender matchPlan)
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);

        $sub = $this->createMock(Substitution::class);
        $sub->method('getMinute')->willReturn(45);
        $sub->method('getPlayerOut')->willReturn($player1);
        $sub->method('getPlayerIn')->willReturn($player2);

        $game = $this->makeGame(halfDuration: 45, matchPlan: null, substitutions: [$sub]);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->with(['id' => [1, 2]])->willReturn([$player1, $player2]);

        $stats = $this->capturePersistedStats($game);

        self::assertSame(45, $stats[1]); // from=0, to=45
        self::assertSame(45, $stats[2]); // from=45, to=90
    }

    public function testSubstitutionsAreSortedByMinuteBeforeProcessing(): void
    {
        // Substitutions werden ungeordnet übergeben: zuerst Minute 70, dann Minute 45
        $player1 = $this->makePlayer(1);
        $player2 = $this->makePlayer(2);
        $player3 = $this->makePlayer(3);

        $sub70 = $this->createMock(Substitution::class);
        $sub70->method('getMinute')->willReturn(70);
        $sub70->method('getPlayerOut')->willReturn($player2);
        $sub70->method('getPlayerIn')->willReturn($player3);

        $sub45 = $this->createMock(Substitution::class);
        $sub45->method('getMinute')->willReturn(45);
        $sub45->method('getPlayerOut')->willReturn($player1);
        $sub45->method('getPlayerIn')->willReturn($player2);

        $matchPlan = [
            'phases' => [['sourceType' => 'start', 'players' => [
                ['playerId' => 1, 'isRealPlayer' => true],
                ['playerId' => 2, 'isRealPlayer' => true],
            ]]],
        ];

        // sub70 kommt zuerst im Array – Sortierung muss trotzdem korrekt sein
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, substitutions: [$sub70, $sub45]);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->willReturn([$player1, $player2, $player3]);

        $stats = $this->capturePersistedStats($game);

        // Nach Sortierung: sub45 zuerst, dann sub70
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

        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
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

        $game = $this->makeGame(matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();

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

        $game = $this->makeGame(matchPlan: $matchPlan, substitutions: []);
        $this->setupDeleteQuery();
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
        $sub1 = $this->createMock(Substitution::class);
        $sub1->method('getMinute')->willReturn(60);
        $sub1->method('getPlayerOut')->willReturn($player2);
        $sub1->method('getPlayerIn')->willReturn($player3);

        $sub2 = $this->createMock(Substitution::class);
        $sub2->method('getMinute')->willReturn(60);
        $sub2->method('getPlayerOut')->willReturn($player3); // direkt wieder raus
        $sub2->method('getPlayerIn')->willReturn($player1);

        $matchPlan = ['phases' => [['sourceType' => 'start', 'players' => [
            ['playerId' => 2, 'isRealPlayer' => true],
        ]]]];
        $game = $this->makeGame(halfDuration: 45, matchPlan: $matchPlan, substitutions: [$sub1, $sub2]);
        $this->setupDeleteQuery();
        $this->playerRepository->method('findBy')->willReturn([$player1, $player2, $player3]);

        $stats = $this->capturePersistedStats($game);

        // player3: from=60, to=60 → 0 Minuten → wird nicht persistiert
        self::assertArrayNotHasKey(3, $stats);
        // player2: 0–60 = 60 Min; player1: 60–90 = 30 Min
        self::assertSame(60, $stats[2]);
        self::assertSame(30, $stats[1]);
    }
}
