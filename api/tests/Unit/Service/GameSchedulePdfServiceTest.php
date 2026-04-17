<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\Team;
use App\Service\GameSchedulePdfService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use Twig\Environment;

/**
 * Unit tests for GameSchedulePdfService::resolveRoundLabel() and
 * GameSchedulePdfService::buildTemplateData() helpers.
 *
 * No database, no Twig rendering, no PDF generation — entities are created
 * in-memory. resolveRoundLabel() is public so it is called directly.
 */
#[AllowMockObjectsWithoutExpectations]
class GameSchedulePdfServiceTest extends TestCase
{
    private GameSchedulePdfService $service;

    protected function setUp(): void
    {
        $this->service = new GameSchedulePdfService(
            $this->createMock(Environment::class),
            $this->createMock(EntityManagerInterface::class),
            sys_get_temp_dir(), // projectDir — logo lookup only
        );
    }

    /**
     * Create a partial mock of GameSchedulePdfService whose loadGames()
     * returns the given array instead of hitting the database.
     *
     * @param Game[] $games
     */
    private function serviceWithGames(array $games = []): GameSchedulePdfService
    {
        $stub = $this->getMockBuilder(GameSchedulePdfService::class)
            ->setConstructorArgs([
                $this->createMock(Environment::class),
                $this->createMock(EntityManagerInterface::class),
                sys_get_temp_dir(),
            ])
            ->onlyMethods(['loadGames'])
            ->getMock();

        $stub->method('loadGames')->willReturn($games);

        return $stub;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function setId(object $entity, int $id): void
    {
        $prop = new ReflectionProperty($entity, 'id');
        $prop->setValue($entity, $id);
    }

    private function makeGameType(string $name): GameType
    {
        return (new GameType())->setName($name);
    }

    private function makeLeague(int $id, string $name = 'Kreisliga'): League
    {
        $l = (new League())->setName($name);
        $this->setId($l, $id);

        return $l;
    }

    private function makeGame(string $typeName, ?string $round = null, ?League $league = null): Game
    {
        $game = new Game();
        $game->setGameType($this->makeGameType($typeName));
        if (null !== $round) {
            $game->setRound($round);
        }
        if (null !== $league) {
            $game->setLeague($league);
        }

        return $game;
    }

    // ── resolveRoundLabel — explicit round field ──────────────────────────────

    public function testExplicitRoundTakesPriority(): void
    {
        $game = $this->makeGame('Ligaspiel', 'Rückspieltag');
        $counters = [];

        self::assertSame('Rückspieltag', $this->service->resolveRoundLabel($game, $counters));
    }

    public function testExplicitRoundOnPokalspiel(): void
    {
        $game = $this->makeGame('Pokalspiel', 'Halbfinale');
        $counters = [];

        self::assertSame('Halbfinale', $this->service->resolveRoundLabel($game, $counters));
    }

    public function testExplicitRoundOnPokalspielFinale(): void
    {
        $game = $this->makeGame('Pokalspiel', 'Finale');
        $counters = [];

        self::assertSame('Finale', $this->service->resolveRoundLabel($game, $counters));
    }

    public function testEmptyStringRoundIsIgnored(): void
    {
        $league = $this->makeLeague(1);
        $game = $this->makeGame('Ligaspiel', '', $league);
        $counters = [];

        // empty string → treated like null → should fall through to Liga counter
        self::assertSame('1.', $this->service->resolveRoundLabel($game, $counters));
    }

    // ── resolveRoundLabel — Liga auto-counter ─────────────────────────────────

    public function testLigaAutoCounterStartsAtOne(): void
    {
        $league = $this->makeLeague(5);
        $game = $this->makeGame('Ligaspiel', null, $league);
        $counters = [];

        self::assertSame('1.', $this->service->resolveRoundLabel($game, $counters));
        self::assertSame(['liga_5' => 1], $counters);
    }

    public function testLigaAutoCounterIncrements(): void
    {
        $league = $this->makeLeague(5);
        $counters = [];

        self::assertSame('1.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $league), $counters));
        self::assertSame('2.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $league), $counters));
        self::assertSame('3.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $league), $counters));
    }

    public function testNachholspielCountsWithinSameLeague(): void
    {
        $league = $this->makeLeague(7);
        $counters = [];

        self::assertSame('1.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $league), $counters));
        self::assertSame('2.', $this->service->resolveRoundLabel($this->makeGame('Nachholspiel', null, $league), $counters));
    }

    public function testTwoLeaguesCountIndependently(): void
    {
        $leagueA = $this->makeLeague(1, 'Kreisliga');
        $leagueB = $this->makeLeague(2, 'Bezirksliga');
        $counters = [];

        self::assertSame('1.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $leagueA), $counters));
        self::assertSame('1.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $leagueB), $counters));
        self::assertSame('2.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $leagueA), $counters));
        self::assertSame('2.', $this->service->resolveRoundLabel($this->makeGame('Ligaspiel', null, $leagueB), $counters));
    }

    public function testLigaWithoutLeagueUsesNoLeagueKey(): void
    {
        $game = $this->makeGame('Ligaspiel');
        $counters = [];

        self::assertSame('1.', $this->service->resolveRoundLabel($game, $counters));
        self::assertArrayHasKey('liga_no_league', $counters);
    }

    // ── resolveRoundLabel — test / friendly types ─────────────────────────────

    /**
     * @return array<string, array{string}>
     */
    public static function noRoundTypeProvider(): array
    {
        return [
            'Testspiel' => ['Testspiel'],
            'Freundschaftsspiel' => ['Freundschaftsspiel'],
            'Trainingseinheit' => ['Trainingseinheit'],
            'Internes Spiel' => ['Internes Spiel'],
        ];
    }

    #[DataProvider('noRoundTypeProvider')]
    public function testNoRoundTypeReturnsTypeName(string $type): void
    {
        $game = $this->makeGame($type);
        $counters = [];

        self::assertSame($type, $this->service->resolveRoundLabel($game, $counters));
    }

    #[DataProvider('noRoundTypeProvider')]
    public function testNoRoundTypeDoesNotIncrementCounter(string $type): void
    {
        $game = $this->makeGame($type);
        $counters = [];

        $this->service->resolveRoundLabel($game, $counters);

        self::assertEmpty($counters);
    }

    // ── resolveRoundLabel — fallback (Pokalspiel / Hallenturnier / …) ─────────

    /**
     * @return array<string, array{string}>
     */
    public static function fallbackTypeProvider(): array
    {
        return [
            'Pokalspiel' => ['Pokalspiel'],
            'Hallenturnier' => ['Hallenturnier'],
            'Pokalturnier' => ['Pokalturnier'],
            'Saisonturnier' => ['Saisonturnier'],
        ];
    }

    #[DataProvider('fallbackTypeProvider')]
    public function testFallbackTypeReturnsTypeName(string $type): void
    {
        $game = $this->makeGame($type);
        $counters = [];

        self::assertSame($type, $this->service->resolveRoundLabel($game, $counters));
    }

    // ── buildTemplateData — shape & season display ────────────────────────────

    public function testBuildTemplateDataReturnsExpectedKeys(): void
    {
        $team = (new Team())->setName('FC Test');
        $this->setId($team, 42);

        $data = $this->serviceWithGames()->buildTemplateData($team, 2025);

        self::assertArrayHasKey('team', $data);
        self::assertArrayHasKey('season', $data);
        self::assertArrayHasKey('season_display', $data);
        self::assertArrayHasKey('rows', $data);
        self::assertArrayHasKey('logo_data_uri', $data);
        self::assertArrayHasKey('generated_at', $data);
        self::assertSame(2025, $data['season']);
    }

    public function testSeasonDisplayFormatFullYear(): void
    {
        $team = (new Team())->setName('FC Test');
        $this->setId($team, 1);

        $data = $this->serviceWithGames()->buildTemplateData($team, 2025);

        self::assertSame('2025/26', $data['season_display']);
    }

    public function testSeasonDisplayFormatTurnOfCentury(): void
    {
        $team = (new Team())->setName('FC Test');
        $this->setId($team, 1);

        $data = $this->serviceWithGames()->buildTemplateData($team, 2099);

        self::assertSame('2099/00', $data['season_display']);
    }

    public function testBuildTemplateDataRowsIsArrayWhenNoGames(): void
    {
        $team = (new Team())->setName('FC Test');
        $this->setId($team, 1);

        $data = $this->serviceWithGames()->buildTemplateData($team, 2025);

        self::assertIsArray($data['rows']);
        self::assertEmpty($data['rows']);
    }

    public function testGeneratedAtContainsCurrentDate(): void
    {
        $team = (new Team())->setName('FC Test');
        $this->setId($team, 1);

        $data = $this->serviceWithGames()->buildTemplateData($team, 2025);

        // Format: "17.04.2026 um 12:00 Uhr"
        self::assertMatchesRegularExpression(
            '/^\d{2}\.\d{2}\.\d{4} um \d{2}:\d{2} Uhr$/',
            $data['generated_at'],
        );
    }
}
