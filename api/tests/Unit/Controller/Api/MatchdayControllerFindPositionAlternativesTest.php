<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\MatchdayController;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Unit tests for the private MatchdayController::findPositionAlternatives() method.
 *
 * The method is tested via Reflection to keep it private while still verifying
 * its pure algorithmic behaviour. No DB or framework calls are involved.
 *
 * Rules under test:
 *  - Empty position string → always returns empty array.
 *  - Only 'attending' players are returned.
 *  - Players already in $plannedPlayerIds are excluded.
 *  - Match by mainPositionShort.
 *  - Match by mainPositionName.
 *  - Match by alternativePositionStrings.
 *  - isMainPosition flag is set correctly.
 *  - Multiple matching players are all returned.
 */
#[AllowMockObjectsWithoutExpectations]
class MatchdayControllerFindPositionAlternativesTest extends TestCase
{
    /** Calls the private method via Reflection. */
    /**
     * @param array<string|int, mixed> $squadByPlayerId
     * @param array<int>               $plannedPlayerIds
     *
     * @return array<mixed>
     */
    private function callFindPositionAlternatives(
        string $positionStr,
        array $squadByPlayerId,
        array $plannedPlayerIds
    ): array {
        $method = new ReflectionMethod(MatchdayController::class, 'findPositionAlternatives');
        $method->setAccessible(true);

        // MatchdayController constructor requires several dependencies; use a mock
        // so we can call the method without a real EntityManager.
        $controller = $this->getMockBuilder(MatchdayController::class)
            ->disableOriginalConstructor()
            ->getMock();

        return $method->invoke($controller, $positionStr, $squadByPlayerId, $plannedPlayerIds);
    }

    // ── Edge cases ─────────────────────────────────────────────────────────────

    public function testEmptyPositionStringReturnsEmptyArray(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('', $squad, []);

        $this->assertSame([], $result);
    }

    public function testEmptySquadReturnsEmptyArray(): void
    {
        $result = $this->callFindPositionAlternatives('ST', [], []);

        $this->assertSame([], $result);
    }

    // ── Status filtering ───────────────────────────────────────────────────────

    public function testNonAttendingPlayerIsExcluded(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'not_attending');

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertSame([], $result);
    }

    public function testPlayerWithStatusNoneIsExcluded(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'none');

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertSame([], $result);
    }

    public function testPlayerWithStatusMaybeIsExcluded(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'maybe');

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertSame([], $result);
    }

    // ── plannedPlayerIds exclusion ─────────────────────────────────────────────

    public function testPlayerInPlannedIdsIsExcluded(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('ST', $squad, [1]);

        $this->assertSame([], $result);
    }

    public function testPlayerNotInPlannedIdsIsIncluded(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('ST', $squad, [99]);

        $this->assertCount(1, $result);
    }

    // ── mainPositionShort matching ─────────────────────────────────────────────

    public function testMatchByMainPositionShort(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertCount(1, $result);
        $this->assertSame(1, $result[0]['playerId']);
        $this->assertTrue($result[0]['isMainPosition']);
    }

    // ── mainPositionName matching ──────────────────────────────────────────────

    public function testMatchByMainPositionName(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('Stürmer', $squad, []);

        $this->assertCount(1, $result);
        $this->assertTrue($result[0]['isMainPosition']);
    }

    // ── alternativePositionStrings matching ───────────────────────────────────

    public function testMatchByAlternativePosition(): void
    {
        $squad = $this->makePlayer(1, 'ZM', 'Zentrales Mittelfeld', 'attending', ['ST', 'LA']);

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertCount(1, $result);
        $this->assertFalse($result[0]['isMainPosition'], 'Alternative position match should have isMainPosition=false');
    }

    public function testNoMatchWhenPositionDoesNotFit(): void
    {
        $squad = $this->makePlayer(1, 'TW', 'Torwart', 'attending', []);

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertSame([], $result);
    }

    // ── Multiple players ───────────────────────────────────────────────────────

    public function testMultipleMatchingPlayersAreAllReturned(): void
    {
        // Use + operator to preserve integer keys (array_merge would re-index them starting at 0)
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending')
               + $this->makePlayer(2, 'ST', 'Stürmer', 'attending')
               + $this->makePlayer(3, 'TW', 'Torwart', 'attending')      // wrong position
               + $this->makePlayer(4, 'ST', 'Stürmer', 'not_attending'); // not attending

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertCount(2, $result);
        $playerIds = array_column($result, 'playerId');
        $this->assertContains(1, $playerIds);
        $this->assertContains(2, $playerIds);
    }

    // ── Result structure ───────────────────────────────────────────────────────

    public function testResultEntryHasRequiredKeys(): void
    {
        $squad = $this->makePlayer(1, 'ST', 'Stürmer', 'attending');

        $result = $this->callFindPositionAlternatives('ST', $squad, []);

        $this->assertArrayHasKey('playerId', $result[0]);
        $this->assertArrayHasKey('name', $result[0]);
        $this->assertArrayHasKey('positionShort', $result[0]);
        $this->assertArrayHasKey('isMainPosition', $result[0]);
    }

    public function testResultEntryContainsCorrectPlayerData(): void
    {
        $squad = $this->makePlayer(42, 'LA', 'Linker Außenstürmer', 'attending');
        $squad[42]['name'] = 'Karl Müller';

        $result = $this->callFindPositionAlternatives('LA', $squad, []);

        $this->assertCount(1, $result);
        $this->assertSame(42, $result[0]['playerId']);
        $this->assertSame('Karl Müller', $result[0]['name']);
        $this->assertSame('LA', $result[0]['positionShort']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Build a minimal $squadByPlayerId entry (array keyed by playerId) that
     * matches the structure produced by MatchdayController::show().
     *
     * @param string[] $altPositions
     *
     * @return array<int, array<string, mixed>>
     */
    private function makePlayer(
        int $id,
        string $shortName,
        string $fullName,
        string $statusCode,
        array $altPositions = []
    ): array {
        return [
            $id => [
                'playerId' => $id,
                'name' => 'Player ' . $id,
                'mainPositionName' => $fullName,
                'mainPositionShort' => $shortName,
                'alternativePositionStrings' => $altPositions,
                'userId' => null,
                'statusId' => null,
                'statusName' => null,
                'statusCode' => $statusCode,
                'statusColor' => null,
            ],
        ];
    }
}
