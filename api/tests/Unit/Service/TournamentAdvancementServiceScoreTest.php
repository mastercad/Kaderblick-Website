<?php

namespace App\Tests\Unit\Service;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Team;
use App\Entity\TournamentMatch;
use App\Service\TournamentAdvancementService;
use App\Service\TournamentMatchGameService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for TournamentAdvancementService::calculateScores() (private) via
 * the public determineWinner() method.
 *
 * All assertions use in-memory entity objects — no database required.
 */
#[AllowMockObjectsWithoutExpectations]
class TournamentAdvancementServiceScoreTest extends TestCase
{
    private TournamentAdvancementService $service;
    private Team $homeTeam;
    private Team $awayTeam;

    protected function setUp(): void
    {
        $this->service = new TournamentAdvancementService(
            $this->createMock(EntityManagerInterface::class),
            $this->createMock(TournamentMatchGameService::class),
        );

        $this->homeTeam = (new Team())->setName('Home');
        $this->awayTeam = (new Team())->setName('Away');
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private function buildMatch(Game $game): TournamentMatch
    {
        $match = new TournamentMatch();
        $match->setGame($game);

        return $match;
    }

    private function buildGame(): Game
    {
        return (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setIsFinished(true);
    }

    private function addEvent(Game $game, string $code, Team $team): void
    {
        $type = (new GameEventType())->setCode($code);
        $event = (new GameEvent())
            ->setGameEventType($type)
            ->setTeam($team)
            ->setTimestamp(new DateTime());
        $game->addGameEvent($event);
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
    public function testHomeTeamWinsWithGoalVariant(string $code): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, $code, $this->homeTeam);

        $winner = $this->service->determineWinner($this->buildMatch($game));

        self::assertSame(
            $this->homeTeam,
            $winner,
            "Goal variant '$code' by home team must make home team the winner.",
        );
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testAwayTeamWinsWithGoalVariant(string $code): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, $code, $this->awayTeam);

        $winner = $this->service->determineWinner($this->buildMatch($game));

        self::assertSame(
            $this->awayTeam,
            $winner,
            "Goal variant '$code' by away team must make away team the winner.",
        );
    }

    // ── own_goal ──────────────────────────────────────────────────────────────

    public function testOwnGoalByHomeTeamMakesAwayTeamWin(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'own_goal', $this->homeTeam);

        self::assertSame($this->awayTeam, $this->service->determineWinner($this->buildMatch($game)));
    }

    public function testOwnGoalByAwayTeamMakesHomeTeamWin(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'own_goal', $this->awayTeam);

        self::assertSame($this->homeTeam, $this->service->determineWinner($this->buildMatch($game)));
    }

    // ── non-counting codes ────────────────────────────────────────────────────

    public function testOffsideGoalIsNotCounted(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'offside_goal', $this->homeTeam);
        $this->addEvent($game, 'offside_goal', $this->awayTeam);

        // 0-0 → no winner
        self::assertNull(
            $this->service->determineWinner($this->buildMatch($game)),
            'offside_goal must not be counted, resulting in a 0-0 tie.',
        );
    }

    public function testVarGoalDeniedIsNotCounted(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'var_goal_denied', $this->homeTeam);
        $this->addEvent($game, 'var_goal_denied', $this->awayTeam);

        self::assertNull(
            $this->service->determineWinner($this->buildMatch($game)),
            'var_goal_denied must not be counted, resulting in a 0-0 tie.',
        );
    }

    // ── edge cases ────────────────────────────────────────────────────────────

    public function testEventWithNullTypeSilentlyIgnored(): void
    {
        $game = $this->buildGame();
        $event = (new GameEvent())
            ->setGameEventType(null)  // explicitly set to null
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        $game->addGameEvent($event); // null GameEventType

        // Still 0-0 → null
        self::assertNull($this->service->determineWinner($this->buildMatch($game)));
    }

    public function testTieReturnsNull(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'goal', $this->homeTeam);
        $this->addEvent($game, 'penalty_goal', $this->awayTeam);

        self::assertNull(
            $this->service->determineWinner($this->buildMatch($game)),
            '1-1 tie must return null.',
        );
    }

    public function testMixedGoalVariantsAccumulate(): void
    {
        // home: goal + penalty_goal + var_goal_confirmed = 3
        // away: freekick_goal + own_goal (home scores own goal) = 1 + 1 = 2
        // non-counting: offside_goal, var_goal_denied
        $game = $this->buildGame();
        $this->addEvent($game, 'goal', $this->homeTeam);
        $this->addEvent($game, 'penalty_goal', $this->homeTeam);
        $this->addEvent($game, 'var_goal_confirmed', $this->homeTeam);
        $this->addEvent($game, 'freekick_goal', $this->awayTeam);
        $this->addEvent($game, 'own_goal', $this->awayTeam); // home +1
        $this->addEvent($game, 'offside_goal', $this->homeTeam); // not counted
        $this->addEvent($game, 'var_goal_denied', $this->awayTeam); // not counted

        // home=4, away=1 → home wins
        self::assertSame($this->homeTeam, $this->service->determineWinner($this->buildMatch($game)));
    }

    public function testUnfinishedGameReturnsNull(): void
    {
        $game = (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setIsFinished(false);
        $this->addEvent($game, 'goal', $this->homeTeam);

        self::assertNull($this->service->determineWinner($this->buildMatch($game)));
    }

    public function testNoGameReturnsNull(): void
    {
        $match = new TournamentMatch();
        // no game set

        self::assertNull($this->service->determineWinner($match));
    }
}
