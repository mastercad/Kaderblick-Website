<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\TournamentMatch;
use App\Service\TournamentPdfService;
use DateTime;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionProperty;
use Twig\Environment;

/**
 * Unit tests for the score-calculation logic embedded in
 * TournamentPdfService::buildTemplateData() (private).
 *
 * buildTemplateData() is called via ReflectionMethod. All entity objects are
 * created in-memory — no database, no Twig rendering, no PDF generation.
 */
#[AllowMockObjectsWithoutExpectations]
class TournamentPdfServiceScoreTest extends TestCase
{
    private TournamentPdfService $service;
    private ReflectionMethod $buildTemplateData;
    private Team $homeTeam;
    private Team $awayTeam;

    protected function setUp(): void
    {
        $this->service = new TournamentPdfService(
            $this->createMock(Environment::class),
            sys_get_temp_dir(), // projectDir — used only for logo file lookup
        );

        $this->buildTemplateData = new ReflectionMethod(TournamentPdfService::class, 'buildTemplateData');
        $this->buildTemplateData->setAccessible(true);

        $this->homeTeam = (new Team())->setName('Home');
        $this->awayTeam = (new Team())->setName('Away');
        // Teams need IDs because buildTemplateData calls getId() when deriving teams from matches
        $this->setId($this->homeTeam, 1);
        $this->setId($this->awayTeam, 2);
    }

    // Set an entity's $id property via reflection (simulates DB-assigned ID)
    private function setId(object $entity, int $id): void
    {
        $prop = new ReflectionProperty($entity, 'id');
        $prop->setValue($entity, $id);
    }

    // ── helper ────────────────────────────────────────────────────────────────

    /**
     * Build a minimal Tournament with one TournamentMatch linked to $game.
     */
    private function buildTournament(Game $game): Tournament
    {
        $ce = new CalendarEvent();
        $ce->setTitle('Test');
        $ce->setStartDate(new DateTime('-1 day'));
        $ce->setEndDate(new DateTime('+1 day'));

        $tournament = new Tournament();
        $tournament->setName('UnitTest');
        $tournament->setType('knockout');
        $tournament->setCalendarEvent($ce);

        $match = new TournamentMatch();
        $match->setHomeTeam($this->homeTeam);
        $match->setAwayTeam($this->awayTeam);
        $match->setGame($game);
        $match->setStage('Finale');

        $tournament->addMatch($match);

        return $tournament;
    }

    private function buildGame(): Game
    {
        return (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam);
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

    /** @return array<string, mixed> */
    private function invokeData(Tournament $tournament): array
    {
        return $this->buildTemplateData->invoke($this->service, $tournament, []);
    }

    /**
     * Extract the first match entry from the template data.
     *
     * @return array<string, mixed>
     */
    private function firstMatch(Tournament $tournament): array
    {
        $data = $this->invokeData($tournament);
        $byStage = $data['matches_by_stage'];

        self::assertNotEmpty($byStage, 'matches_by_stage must not be empty.');

        return reset($byStage)[0];
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
    public function testGoalVariantCountsForHomeTeamInScoreDisplay(string $code): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, $code, $this->homeTeam);

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertTrue($match['hasScore'], 'hasScore must be true when a game is present.');
        self::assertSame('1 : 0', $match['scoreDisplay'], "Code '$code' must appear as score 1:0 for home.");
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testGoalVariantCountsForAwayTeamInScoreDisplay(string $code): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, $code, $this->awayTeam);

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('0 : 1', $match['scoreDisplay'], "Code '$code' must appear as score 0:1 for away.");
    }

    // ── own_goal ──────────────────────────────────────────────────────────────

    public function testOwnGoalByHomeTeamCountsForAway(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'own_goal', $this->homeTeam);

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('0 : 1', $match['scoreDisplay']);
    }

    public function testOwnGoalByAwayTeamCountsForHome(): void
    {
        $game = $this->buildGame();
        $this->addEvent($game, 'own_goal', $this->awayTeam);

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('1 : 0', $match['scoreDisplay']);
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
        $this->addEvent($game, $code, $this->homeTeam);
        $this->addEvent($game, $code, $this->awayTeam);

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('0 : 0', $match['scoreDisplay'], "Code '$code' must not change the score.");
    }

    // ── edge cases ────────────────────────────────────────────────────────────

    public function testMatchWithoutGameHasNoScore(): void
    {
        $ce = new CalendarEvent();
        $ce->setTitle('T');
        $ce->setStartDate(new DateTime('-1 day'));
        $ce->setEndDate(new DateTime('+1 day'));

        $tournament = new Tournament();
        $tournament->setName('T');
        $tournament->setType('knockout');
        $tournament->setCalendarEvent($ce);

        $homeTeam = (new Team())->setName('HT');
        $awayTeam = (new Team())->setName('AT');
        $this->setId($homeTeam, 10);
        $this->setId($awayTeam, 11);

        $match = new TournamentMatch();
        $match->setHomeTeam($homeTeam);
        $match->setAwayTeam($awayTeam);
        // No game set
        $match->setStage('Finale');
        $tournament->addMatch($match);

        $data = $this->invokeData($tournament);
        $entry = reset($data['matches_by_stage'])[0];

        self::assertFalse($entry['hasScore']);
        self::assertSame('– : –', $entry['scoreDisplay']);
    }

    public function testEventWithNullTypeSilentlyIgnored(): void
    {
        $game = $this->buildGame();
        $event = (new GameEvent())
            ->setGameEventType(null)  // explicitly null
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        $game->addGameEvent($event); // type is null

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('0 : 0', $match['scoreDisplay']);
    }

    public function testMixedGoalVariantsProduceCorrectDisplay(): void
    {
        // home: penalty_goal + var_goal_confirmed + own_goal(by away) = 3
        // away: freekick_goal = 1
        // skipped: offside_goal, var_goal_denied
        $game = $this->buildGame();
        $this->addEvent($game, 'penalty_goal', $this->homeTeam);
        $this->addEvent($game, 'var_goal_confirmed', $this->homeTeam);
        $this->addEvent($game, 'freekick_goal', $this->awayTeam);
        $this->addEvent($game, 'own_goal', $this->awayTeam);  // +1 home
        $this->addEvent($game, 'offside_goal', $this->homeTeam);  // not counted
        $this->addEvent($game, 'var_goal_denied', $this->awayTeam);  // not counted

        $match = $this->firstMatch($this->buildTournament($game));

        self::assertSame('3 : 1', $match['scoreDisplay']);
    }
}
