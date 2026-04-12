<?php

namespace App\Tests\Unit\Controller;

use App\Controller\GamesController;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Team;
use DateTime;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Unit tests for the private collectScores() method in the legacy Twig
 * GamesController (App\Controller\GamesController).
 *
 * The method is accessed via reflection so no HTTP requests are needed.
 * All entity objects are created in-memory (no database).
 */
class GamesControllerScoreTest extends TestCase
{
    private GamesController $controller;
    private ReflectionMethod $collectScores;
    private Team $homeTeam;
    private Team $awayTeam;

    protected function setUp(): void
    {
        $this->controller = new GamesController();

        $this->collectScores = new ReflectionMethod(GamesController::class, 'collectScores');
        $this->collectScores->setAccessible(true);

        $this->homeTeam = (new Team())->setName('Home');
        $this->awayTeam = (new Team())->setName('Away');
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private function buildGame(): Game
    {
        return (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam);
    }

    private function makeEvent(string $code, Team $team): GameEvent
    {
        return (new GameEvent())
            ->setGameEventType((new GameEventType())->setCode($code))
            ->setTeam($team)
            ->setTimestamp(new DateTime());
    }

    /**
     * @param GameEvent[] $events
     *
     * @return array{home: int, away: int}
     */
    private function invoke(array $events, Game $game): array
    {
        return $this->collectScores->invoke($this->controller, $events, $game);
    }

    // ── goal variant codes that must count for the scoring team ───────────────

    /**
     * @return array<string, array{string}>
     */
    public static function goalVariantCodesProvider(): array
    {
        return [
            'goal' => ['goal'],
            'penalty_goal' => ['penalty_goal'],
            'freekick_goal' => ['freekick_goal'],
            'header_goal' => ['header_goal'],
            'corner_goal' => ['corner_goal'],
            'cross_goal' => ['cross_goal'],
            'counter_goal' => ['counter_goal'],
            'pressing_goal' => ['pressing_goal'],
            'sub_goal' => ['sub_goal'],
            'var_goal_confirmed' => ['var_goal_confirmed'],
        ];
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testGoalVariantCountsForHomeTeam(string $code): void
    {
        $game = $this->buildGame();
        $scores = $this->invoke([$this->makeEvent($code, $this->homeTeam)], $game);

        self::assertSame(1, $scores['home'], "Code '$code' must count as 1 home goal.");
        self::assertSame(0, $scores['away']);
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testGoalVariantCountsForAwayTeam(string $code): void
    {
        $game = $this->buildGame();
        $scores = $this->invoke([$this->makeEvent($code, $this->awayTeam)], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(1, $scores['away'], "Code '$code' must count as 1 away goal.");
    }

    // ── own_goal ──────────────────────────────────────────────────────────────

    public function testOwnGoalByHomeTeamCountsForAway(): void
    {
        $game = $this->buildGame();
        $scores = $this->invoke([$this->makeEvent('own_goal', $this->homeTeam)], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(1, $scores['away']);
    }

    public function testOwnGoalByAwayTeamCountsForHome(): void
    {
        $game = $this->buildGame();
        $scores = $this->invoke([$this->makeEvent('own_goal', $this->awayTeam)], $game);

        self::assertSame(1, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    // ── non-counting codes ────────────────────────────────────────────────────

    /**
     * @return array<string, array{string}>
     */
    public static function nonCountingCodesProvider(): array
    {
        return [
            'offside_goal' => ['offside_goal'],
            'var_goal_denied' => ['var_goal_denied'],
        ];
    }

    #[DataProvider('nonCountingCodesProvider')]
    public function testNonCountingCodeDoesNotChangeScore(string $code): void
    {
        $game = $this->buildGame();
        $scores = $this->invoke([
            $this->makeEvent($code, $this->homeTeam),
            $this->makeEvent($code, $this->awayTeam),
        ], $game);

        self::assertSame(0, $scores['home'], "Code '$code' must not count as a goal.");
        self::assertSame(0, $scores['away'], "Code '$code' must not count as a goal.");
    }

    // ── edge cases ────────────────────────────────────────────────────────────

    public function testEventWithNullTypeSilentlyIgnored(): void
    {
        $game = $this->buildGame();
        $event = (new GameEvent())
            ->setGameEventType(null)  // explicitly set to null
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        // No GameEventType set

        $scores = $this->invoke([$event], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testEmptyEventsReturnsZeroZero(): void
    {
        $scores = $this->invoke([], $this->buildGame());

        self::assertSame(0, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testMixedGoalVariantsAccumulateCorrectly(): void
    {
        // home: goal + header_goal + own_goal(by away) = 3
        // away: cross_goal + counter_goal = 2
        // skipped: offside_goal (home), var_goal_denied (away)
        $game = $this->buildGame();
        $events = [
            $this->makeEvent('goal', $this->homeTeam),
            $this->makeEvent('header_goal', $this->homeTeam),
            $this->makeEvent('cross_goal', $this->awayTeam),
            $this->makeEvent('counter_goal', $this->awayTeam),
            $this->makeEvent('own_goal', $this->awayTeam),  // +1 home
            $this->makeEvent('offside_goal', $this->homeTeam),  // not counted
            $this->makeEvent('var_goal_denied', $this->awayTeam),  // not counted
        ];

        $scores = $this->invoke($events, $game);

        self::assertSame(3, $scores['home']);
        self::assertSame(2, $scores['away']);
    }
}
