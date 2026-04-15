<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Team;
use App\Service\GoalCountingService;
use DateTime;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for GoalCountingService.
 * No database or Symfony kernel required — all entities are constructed directly.
 */
class GoalCountingServiceTest extends TestCase
{
    private GoalCountingService $service;

    protected function setUp(): void
    {
        $this->service = new GoalCountingService();
    }

    // ── isGoalForScorer() ─────────────────────────────────────────────────

    public function testIsGoalForScorerReturnsTrueForPlainGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('goal'));
    }

    public function testIsGoalForScorerReturnsTrueForPenaltyGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('penalty_goal'));
    }

    public function testIsGoalForScorerReturnsTrueForFreeKickGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('free_kick_goal'));
    }

    public function testIsGoalForScorerReturnsTrueForHeaderGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('header_goal'));
    }

    public function testIsGoalForScorerReturnsTrueForCornerGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('corner_goal'));
    }

    public function testIsGoalForScorerReturnsTrueForCounterGoal(): void
    {
        self::assertTrue($this->service->isGoalForScorer('counter_goal'));
    }

    public function testIsGoalForScorerReturnsFalseForOwnGoal(): void
    {
        self::assertFalse($this->service->isGoalForScorer('own_goal'));
    }

    public function testIsGoalForScorerReturnsFalseForOffsideGoal(): void
    {
        self::assertFalse($this->service->isGoalForScorer('offside_goal'));
    }

    public function testIsGoalForScorerReturnsFalseForVarGoalDenied(): void
    {
        self::assertFalse($this->service->isGoalForScorer('var_goal_denied'));
    }

    public function testIsGoalForScorerReturnsFalseForOwnGoalAttempt(): void
    {
        self::assertFalse($this->service->isGoalForScorer('own_goal_attempt'));
    }

    public function testIsGoalForScorerReturnsFalseForNonGoalCode(): void
    {
        self::assertFalse($this->service->isGoalForScorer('yellow_card'));
        self::assertFalse($this->service->isGoalForScorer('substitution'));
        self::assertFalse($this->service->isGoalForScorer(''));
    }

    // ── isOwnGoal() ────────────────────────────────────────────────────────

    public function testIsOwnGoalReturnsTrueForOwnGoal(): void
    {
        self::assertTrue($this->service->isOwnGoal('own_goal'));
    }

    public function testIsOwnGoalReturnsFalseForRegularGoal(): void
    {
        self::assertFalse($this->service->isOwnGoal('goal'));
    }

    public function testIsOwnGoalReturnsFalseForOwnGoalAttempt(): void
    {
        self::assertFalse($this->service->isOwnGoal('own_goal_attempt'));
    }

    // ── collectScores() ───────────────────────────────────────────────────

    public function testCollectScoresReturnsZeroZeroForEmptyEvents(): void
    {
        $game = $this->makeGame();
        $scores = $this->service->collectScores([], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testCollectScoresCountsHomeGoal(): void
    {
        [$homeTeam, , $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('goal', $homeTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(1, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testCollectScoresCountsAwayGoal(): void
    {
        [, $awayTeam, $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('penalty_goal', $awayTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(1, $scores['away']);
    }

    public function testCollectScoresOwnGoalByHomeTeamCountsForAway(): void
    {
        [$homeTeam, , $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('own_goal', $homeTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(0, $scores['home'], 'Own goal by home team must not increase home score.');
        self::assertSame(1, $scores['away'], 'Own goal by home team must increase away score.');
    }

    public function testCollectScoresOwnGoalByAwayTeamCountsForHome(): void
    {
        [, $awayTeam, $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('own_goal', $awayTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(1, $scores['home'], 'Own goal by away team must increase home score.');
        self::assertSame(0, $scores['away'], 'Own goal by away team must not increase away score.');
    }

    public function testCollectScoresOffsideGoalNotCounted(): void
    {
        [$homeTeam, , $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('offside_goal', $homeTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(0, $scores['home'], 'offside_goal must not be counted.');
        self::assertSame(0, $scores['away'], 'offside_goal must not be counted.');
    }

    public function testCollectScoresVarGoalDeniedNotCounted(): void
    {
        [, $awayTeam, $game] = $this->makeGameWithTeams();

        $event = $this->makeEvent('var_goal_denied', $awayTeam);
        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testCollectScoresNullEventTypeIsSkipped(): void
    {
        [$homeTeam, , $game] = $this->makeGameWithTeams();

        $event = (new GameEvent())
            ->setTeam($homeTeam)
            ->setTimestamp(new DateTime());
        // intentionally no gameEventType set

        $scores = $this->service->collectScores([$event], $game);

        self::assertSame(0, $scores['home']);
        self::assertSame(0, $scores['away']);
    }

    public function testCollectScoresMixedScenario(): void
    {
        [$homeTeam, $awayTeam, $game] = $this->makeGameWithTeams();

        $events = [
            $this->makeEvent('goal', $homeTeam),           // home +1
            $this->makeEvent('penalty_goal', $homeTeam),   // home +1
            $this->makeEvent('header_goal', $awayTeam),    // away +1
            $this->makeEvent('offside_goal', $homeTeam),   // not counted
            $this->makeEvent('own_goal', $awayTeam),       // home +1 (away scores own goal)
            $this->makeEvent('var_goal_denied', $awayTeam), // not counted
        ];

        $scores = $this->service->collectScores($events, $game);

        self::assertSame(3, $scores['home'], 'Expected 3 home goals (2 regular + 1 away own goal).');
        self::assertSame(1, $scores['away'], 'Expected 1 away goal.');
    }

    // ── getScorerGoalDqlCondition() ────────────────────────────────────────

    public function testGetScorerGoalDqlConditionReturnsDqlWithLikePattern(): void
    {
        [$dql, $params] = $this->service->getScorerGoalDqlCondition('gt.code');

        self::assertStringContainsString("LIKE '%goal%'", $dql);
        self::assertStringContainsString('gt.code', $dql);
    }

    public function testGetScorerGoalDqlConditionExcludesGoalCodesInParams(): void
    {
        [, $params] = $this->service->getScorerGoalDqlCondition('gt.code');

        self::assertArrayHasKey('excludedGoalCodes', $params);
        $excluded = $params['excludedGoalCodes'];

        self::assertContains('offside_goal', $excluded);
        self::assertContains('var_goal_denied', $excluded);
        self::assertContains('own_goal_attempt', $excluded);
        self::assertContains('own_goal', $excluded);
    }

    public function testGetScorerGoalDqlConditionDoesNotExcludeValidGoalCodes(): void
    {
        [, $params] = $this->service->getScorerGoalDqlCondition('gt.code');

        $excluded = $params['excludedGoalCodes'];

        self::assertNotContains('goal', $excluded);
        self::assertNotContains('penalty_goal', $excluded);
        self::assertNotContains('header_goal', $excluded);
    }

    public function testGetScorerGoalDqlConditionUsesCustomCodeAlias(): void
    {
        [$dql] = $this->service->getScorerGoalDqlCondition('my_alias.code');

        self::assertStringContainsString('my_alias.code', $dql);
        self::assertStringNotContainsString('gt.code', $dql);
    }

    public function testGetScorerGoalDqlConditionContainsNotInClause(): void
    {
        [$dql] = $this->service->getScorerGoalDqlCondition('gt.code');

        self::assertStringContainsString('NOT IN', $dql);
        self::assertStringContainsString(':excludedGoalCodes', $dql);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function makeGame(): Game
    {
        $homeTeam = new Team();
        $awayTeam = new Team();

        return (new Game())
            ->setHomeTeam($homeTeam)
            ->setAwayTeam($awayTeam);
    }

    /**
     * @return array{0: Team, 1: Team, 2: Game}
     */
    private function makeGameWithTeams(): array
    {
        $homeTeam = new Team();
        $awayTeam = new Team();
        $game = (new Game())
            ->setHomeTeam($homeTeam)
            ->setAwayTeam($awayTeam);

        return [$homeTeam, $awayTeam, $game];
    }

    private function makeEvent(string $code, Team $team): GameEvent
    {
        $type = (new GameEventType())->setCode($code);

        return (new GameEvent())
            ->setGameEventType($type)
            ->setTeam($team)
            ->setTimestamp(new DateTime());
    }
}
