<?php

namespace App\Tests\Unit\Service;

use App\Service\ReportFieldAliasService;
use DateTime;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use stdClass;

#[AllowMockObjectsWithoutExpectations]
class ReportFieldAliasServiceTest extends TestCase
{
    public function testFieldAliasesReturnsArrayWithoutEntityManager(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertNotEmpty($aliases);
    }

    public function testFieldAliasesContainsDimensionFields(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $expectedDimensions = ['player', 'team', 'eventType', 'gameDate', 'month', 'gameType', 'position', 'homeAway', 'surfaceType'];

        foreach ($expectedDimensions as $dim) {
            $this->assertArrayHasKey($dim, $aliases, "Missing dimension alias: $dim");
            $this->assertSame('dimension', $aliases[$dim]['category'], "Expected '$dim' to be a dimension");
        }
    }

    public function testFieldAliasesContainsMetricFields(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $expectedMetrics = ['goals', 'assists', 'shots', 'yellowCards', 'redCards', 'fouls', 'passes', 'tackles', 'interceptions', 'saves'];

        foreach ($expectedMetrics as $metric) {
            $this->assertArrayHasKey($metric, $aliases, "Missing metric alias: $metric");
            $this->assertSame('metric', $aliases[$metric]['category'], "Expected '$metric' to be a metric");
        }
    }

    public function testEachAliasHasLabel(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        foreach ($aliases as $key => $alias) {
            $this->assertArrayHasKey('label', $alias, "Alias '$key' is missing a label");
            $this->assertNotEmpty($alias['label'], "Alias '$key' has an empty label");
        }
    }

    public function testEachAliasHasCategory(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        foreach ($aliases as $key => $alias) {
            $this->assertArrayHasKey('category', $alias, "Alias '$key' is missing category");
            $this->assertContains($alias['category'], ['dimension', 'metric'], "Alias '$key' has invalid category");
        }
    }

    public function testMetricAliasesHaveAggregateCallable(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        foreach ($aliases as $key => $alias) {
            if ('metric' === $alias['category']) {
                $this->assertArrayHasKey('aggregate', $alias, "Metric '$key' is missing 'aggregate'");
                $this->assertTrue(is_callable($alias['aggregate']), "Metric '$key' aggregate is not callable");
            }
        }
    }

    public function testDimensionAliasesHaveAccessibleFromEventFlag(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        foreach ($aliases as $key => $alias) {
            if ('dimension' === $alias['category']) {
                $this->assertArrayHasKey('accessibleFromEvent', $alias, "Dimension '$key' missing 'accessibleFromEvent' flag");
                $this->assertTrue($alias['accessibleFromEvent'], "Dimension '$key' should be accessible from event");
            }
        }
    }

    public function testPlayerAliasHasJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(['player'], $aliases['player']['joinHint']);
    }

    public function testTeamAliasHasJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(['team'], $aliases['team']['joinHint']);
    }

    public function testEventTypeAliasHasJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(['gameEventType'], $aliases['eventType']['joinHint']);
    }

    public function testSurfaceTypeAliasHasJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(['game', 'location', 'surfaceType'], $aliases['surfaceType']['joinHint']);
    }

    public function testHomeAwayHasNullJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertNull($aliases['homeAway']['joinHint']);
    }

    public function testWeatherDimensionsHaveNullJoinHint(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $weatherDimensions = ['weatherCondition', 'temperatureRange', 'windStrength', 'cloudCover'];
        foreach ($weatherDimensions as $dim) {
            $this->assertNull($aliases[$dim]['joinHint'], "Weather dimension '$dim' should have null joinHint");
        }
    }

    public function testGoalsAliasLabel(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame('Tore', $aliases['goals']['label']);
    }

    public function testPlayerAliasLabel(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame('Spieler', $aliases['player']['label']);
    }

    public function testEventTypeValueCallbackReturnsNullForNullType(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $ev = new class {
            public function getGameEventType(): mixed
            {
                return null;
            }
        };

        $result = ($aliases['eventType']['value'])($ev);
        $this->assertNull($result);
    }

    public function testEventTypeValueCallbackReturnsName(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $type = new class {
            public function getName(): string
            {
                return 'Tor';
            }
        };

        $ev = new class {
            public mixed $type;

            public function getGameEventType(): mixed
            {
                return $this->type;
            }
        };
        $ev->type = $type;

        $result = ($aliases['eventType']['value'])($ev);
        $this->assertSame('Tor', $result);
    }

    public function testPlayerAliasHasPathWithFieldAndSubfield(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(['player', 'fullName'], $aliases['player']['path']);
    }

    public function testShotAccuracyReturnsZeroForNoShots(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $result = ($aliases['shotAccuracy']['aggregate'])([]);
        $this->assertSame(0, $result);
    }

    // =========================================================================
    //  Cache-Verhalten
    // =========================================================================

    /**
     * Calling fieldAliases without an EntityManager must not populate the
     * static cache. This prevents cross-test pollution when feature tests call
     * the controller which passes a real EntityManager: the closures capture
     * $typesByCode at construction time, so a null-EM cached result would
     * break type-based aggregates in subsequent EM-based calls.
     */
    public function testCallingWithoutEmNeverWritesToStaticCache(): void
    {
        // Reset the cache before the assertion so earlier test runs don't interfere.
        $ref = new ReflectionClass(ReportFieldAliasService::class);
        $prop = $ref->getProperty('cache');
        $prop->setAccessible(true);
        $prop->setValue(null, null);

        ReportFieldAliasService::fieldAliases(null);

        $this->assertNull(
            $prop->getValue(null),
            'Static $cache must remain null after calling fieldAliases(null).'
        );
    }

    /**
     * Two consecutive calls without EM must return the same set of field keys
     * (deterministic, no DB required).
     */
    public function testCallingWithoutEmTwiceReturnsDeterministicFieldKeys(): void
    {
        $first = ReportFieldAliasService::fieldAliases(null);
        $second = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame(
            array_keys($first),
            array_keys($second),
            'Repeated null-EM calls must return the same set of field keys.'
        );
    }

    /**
     * The static cache is only populated when fieldAliases is called with
     * a real EntityManager. Verify this by checking the reflection property
     * after calling with an injected mock EM.
     */
    public function testCallingWithEmPopulatesStaticCache(): void
    {
        // Reset first
        $ref = new ReflectionClass(ReportFieldAliasService::class);
        $prop = $ref->getProperty('cache');
        $prop->setAccessible(true);
        $prop->setValue(null, null);

        // Build a minimal mock EntityManager that returns empty arrays from repositories.
        $repo = $this->createMock(\Doctrine\ORM\EntityRepository::class);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(\Doctrine\ORM\EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        ReportFieldAliasService::fieldAliases($em);

        $cached = $prop->getValue(null);
        $this->assertIsArray($cached, 'Static $cache must be set after calling fieldAliases($em).');
        $this->assertNotEmpty($cached, 'Cached aliases array must not be empty.');
    }

    /**
     * A second call with an EM must return the cached result (the EM's
     * getRepository must NOT be called again).
     */
    public function testCallingWithEmTwiceUsesCache(): void
    {
        // Reset first
        $ref = new ReflectionClass(ReportFieldAliasService::class);
        $prop = $ref->getProperty('cache');
        $prop->setAccessible(true);
        $prop->setValue(null, null);

        $repo = $this->createMock(\Doctrine\ORM\EntityRepository::class);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(\Doctrine\ORM\EntityManagerInterface::class);
        // getRepository must only be called once (during the first call)
        $em->expects($this->once())->method('getRepository')->willReturn($repo);

        ReportFieldAliasService::fieldAliases($em);
        ReportFieldAliasService::fieldAliases($em); // second call — must use cache
    }

    // =========================================================================
    // Helpers — reusable anonymous class factories for closures
    // =========================================================================

    /** Makes a minimal event stub with getGame() returning null. */
    private function makeEventWithoutGame(): object
    {
        return new class {
            public function getGame(): mixed
            {
                return null;
            }

            public function getTeam(): mixed
            {
                return null;
            }

            public function getPlayer(): mixed
            {
                return null;
            }
        };
    }

    /**
     * Makes an event whose getGame()->getCalendarEvent()->getStartDate() returns a DateTime.
     * Weather data accessor is available but returns null by default.
     *
     * @param array<string, mixed>|null $weatherDaily
     * @param array<string, mixed>|null $weatherHourly
     */
    private function makeEventWithGameDate(DateTime $date, ?array $weatherDaily = null, ?array $weatherHourly = null): object
    {
        $wd = null;
        if (null !== $weatherDaily || null !== $weatherHourly) {
            $wd = new class ($weatherDaily ?? [], $weatherHourly ?? []) {
                /**
                 * @param array<string, mixed> $daily
                 * @param array<string, mixed> $hourly
                 */
                public function __construct(private array $daily, private array $hourly)
                {
                }

                /** @return array<string, mixed> */
                public function getDailyWeatherData(): array
                {
                    return $this->daily;
                }

                /** @return array<string, mixed> */
                public function getHourlyWeatherData(): array
                {
                    return $this->hourly;
                }
            };
        }

        $ce = new class ($date, $wd) {
            public function __construct(private DateTime $d, private mixed $wd)
            {
            }

            public function getStartDate(): DateTime
            {
                return $this->d;
            }

            public function getWeatherData(): mixed
            {
                return $this->wd;
            }
        };

        $game = new class ($ce) {
            public function __construct(private object $ce)
            {
            }

            public function getCalendarEvent(): object
            {
                return $this->ce;
            }

            public function getHomeTeam(): mixed
            {
                return null;
            }

            public function getAwayTeam(): mixed
            {
                return null;
            }

            public function getGameType(): mixed
            {
                return null;
            }

            public function getLocation(): mixed
            {
                return null;
            }
        };

        return new class ($game) {
            public function __construct(private object $game)
            {
            }

            public function getGame(): object
            {
                return $this->game;
            }

            public function getTeam(): mixed
            {
                return null;
            }

            public function getPlayer(): mixed
            {
                return null;
            }

            public function getGameEventType(): mixed
            {
                return null;
            }
        };
    }

    // =========================================================================
    // gameDate value + sortKey
    // =========================================================================

    public function testGameDateValueReturnsFormattedDate(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-03-15'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('15.03.2024', ($aliases['gameDate']['value'])($event));
    }

    public function testGameDateValueReturnsNullWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['gameDate']['value'])($this->makeEventWithoutGame()));
    }

    public function testGameDateSortKeyReturnsIsoDate(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-03-15'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('2024-03-15', ($aliases['gameDate']['sortKey'])($event));
    }

    public function testGameDateSortKeyReturnsDefaultWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('9999-99-99', ($aliases['gameDate']['sortKey'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // month value + sortKey
    // =========================================================================

    public function testMonthValueReturnsGermanMonthName(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-04-10'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('April 2024', ($aliases['month']['value'])($event));
    }

    public function testMonthValueReturnsNullWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['month']['value'])($this->makeEventWithoutGame()));
    }

    public function testMonthSortKeyReturnsYearMonth(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-07-22'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('2024-07', ($aliases['month']['sortKey'])($event));
    }

    public function testMonthSortKeyReturnsDefaultWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('9999-99', ($aliases['month']['sortKey'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // gameType value
    // =========================================================================

    public function testGameTypeValueReturnsTypeName(): void
    {
        $gameType = new class {
            public function getName(): string
            {
                return 'Friendly';
            }
        };
        $ce = new class {
            public function getStartDate(): mixed
            {
                return null;
            }

            public function getWeatherData(): mixed
            {
                return null;
            }
        };
        $game = new class ($ce, $gameType) {
            public function __construct(private object $ce, private object $gt)
            {
            }

            public function getCalendarEvent(): object
            {
                return $this->ce;
            }

            public function getGameType(): object
            {
                return $this->gt;
            }

            public function getHomeTeam(): mixed
            {
                return null;
            }

            public function getAwayTeam(): mixed
            {
                return null;
            }

            public function getLocation(): mixed
            {
                return null;
            }
        };
        $event = new class ($game) {
            public function __construct(private object $game)
            {
            }

            public function getGame(): object
            {
                return $this->game;
            }

            public function getTeam(): mixed
            {
                return null;
            }

            public function getPlayer(): mixed
            {
                return null;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Friendly', ($aliases['gameType']['value'])($event));
    }

    public function testGameTypeValueReturnsNullWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['gameType']['value'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // position value
    // =========================================================================

    public function testPositionValueReturnsPositionName(): void
    {
        $position = new class {
            public function getName(): string
            {
                return 'Stürmer';
            }
        };
        $player = new class ($position) {
            public function __construct(private object $pos)
            {
            }

            public function getMainPosition(): object
            {
                return $this->pos;
            }
        };
        $event = new class ($player) {
            public function __construct(private object $player)
            {
            }

            public function getGame(): mixed
            {
                return null;
            }

            public function getTeam(): mixed
            {
                return null;
            }

            public function getPlayer(): object
            {
                return $this->player;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Stürmer', ($aliases['position']['value'])($event));
    }

    public function testPositionValueReturnsNullWhenNoPlayer(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['position']['value'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // homeAway value
    // =========================================================================

    public function testHomeAwayValueReturnsHeim(): void
    {
        $team = new class {
            public function getId(): int
            {
                return 10;
            }
        };
        $homeTeam = new class {
            public function getId(): int
            {
                return 10;
            }
        };
        $game = new class ($homeTeam) {
            public function __construct(private object $ht)
            {
            }

            public function getHomeTeam(): object
            {
                return $this->ht;
            }

            public function getAwayTeam(): mixed
            {
                return null;
            }
        };
        $event = new class ($game, $team) {
            public function __construct(private object $g, private object $t)
            {
            }

            public function getGame(): object
            {
                return $this->g;
            }

            public function getTeam(): object
            {
                return $this->t;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Heim', ($aliases['homeAway']['value'])($event));
    }

    public function testHomeAwayValueReturnsAuswaerts(): void
    {
        $team = new class {
            public function getId(): int
            {
                return 20;
            }
        };
        $homeTeam = new class {
            public function getId(): int
            {
                return 10;
            }
        };
        $awayTeam = new class {
            public function getId(): int
            {
                return 20;
            }
        };
        $game = new class ($homeTeam, $awayTeam) {
            public function __construct(private object $ht, private object $at)
            {
            }

            public function getHomeTeam(): object
            {
                return $this->ht;
            }

            public function getAwayTeam(): object
            {
                return $this->at;
            }
        };
        $event = new class ($game, $team) {
            public function __construct(private object $g, private object $t)
            {
            }

            public function getGame(): object
            {
                return $this->g;
            }

            public function getTeam(): object
            {
                return $this->t;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Auswärts', ($aliases['homeAway']['value'])($event));
    }

    public function testHomeAwayValueReturnsUnbekannt(): void
    {
        $team = new class {
            public function getId(): int
            {
                return 99;
            }
        };
        $homeTeam = new class {
            public function getId(): int
            {
                return 10;
            }
        };
        $awayTeam = new class {
            public function getId(): int
            {
                return 20;
            }
        };
        $game = new class ($homeTeam, $awayTeam) {
            public function __construct(private object $ht, private object $at)
            {
            }

            public function getHomeTeam(): object
            {
                return $this->ht;
            }

            public function getAwayTeam(): object
            {
                return $this->at;
            }
        };
        $event = new class ($game, $team) {
            public function __construct(private object $g, private object $t)
            {
            }

            public function getGame(): object
            {
                return $this->g;
            }

            public function getTeam(): object
            {
                return $this->t;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Unbekannt', ($aliases['homeAway']['value'])($event));
    }

    public function testHomeAwayValueReturnsNullWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['homeAway']['value'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // surfaceType value
    // =========================================================================

    public function testSurfaceTypeValueReturnsSurfaceName(): void
    {
        $surfaceType = new class {
            public function getName(): string
            {
                return 'Rasen';
            }
        };
        $location = new class ($surfaceType) {
            public function __construct(private object $st)
            {
            }

            public function getSurfaceType(): object
            {
                return $this->st;
            }
        };
        $game = new class ($location) {
            public function __construct(private object $loc)
            {
            }

            public function getLocation(): object
            {
                return $this->loc;
            }
        };
        $event = new class ($game) {
            public function __construct(private object $g)
            {
            }

            public function getGame(): object
            {
                return $this->g;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Rasen', ($aliases['surfaceType']['value'])($event));
    }

    public function testSurfaceTypeValueReturnsNullWhenNoLocation(): void
    {
        $game = new class {
            public function getLocation(): mixed
            {
                return null;
            }
        };
        $event = new class ($game) {
            public function __construct(private object $g)
            {
            }

            public function getGame(): object
            {
                return $this->g;
            }
        };

        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['surfaceType']['value'])($event));
    }

    public function testSurfaceTypeValueReturnsNullWhenNoGame(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['surfaceType']['value'])($this->makeEventWithoutGame()));
    }

    // =========================================================================
    // weatherCondition value — all branches
    // =========================================================================

    private function makeWeatherEvent(int $weathercode): object
    {
        return $this->makeEventWithGameDate(new DateTime('2024-06-01'), ['weathercode' => [$weathercode]]);
    }

    public function testWeatherConditionValueSunny(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Sonnig / Klar', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(1)));
    }

    public function testWeatherConditionValueFog(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Nebel', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(45)));
    }

    public function testWeatherConditionValueDrizzle(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Nieselregen', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(51)));
    }

    public function testWeatherConditionValueRain(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Regen', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(63)));
    }

    public function testWeatherConditionValueRainFromShowersCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Regen', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(81)));
    }

    public function testWeatherConditionValueSnow(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Schnee', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(73)));
    }

    public function testWeatherConditionValueSnowShowersCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Schnee', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(85)));
    }

    public function testWeatherConditionValueThunder(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Gewitter', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(95)));
    }

    public function testWeatherConditionValueOther(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Sonstiges', ($aliases['weatherCondition']['value'])($this->makeWeatherEvent(10)));
    }

    public function testWeatherConditionFallbackToHourlyData(): void
    {
        $event = $this->makeEventWithGameDate(
            new DateTime('2024-01-01'),
            [],                                // empty daily → no weathercode
            ['weathercode' => [45]]            // hourly fallback
        );
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Nebel', ($aliases['weatherCondition']['value'])($event));
    }

    public function testWeatherConditionReturnsNullWhenNoWeatherData(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-01-01'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['weatherCondition']['value'])($event));
    }

    // =========================================================================
    // temperatureRange value — all branches
    // =========================================================================

    private function makeTempEvent(float $tempMax): object
    {
        return $this->makeEventWithGameDate(new DateTime('2024-06-01'), ['temperature_2m_max' => [$tempMax]]);
    }

    public function testTemperatureRangeEiskalt(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Eiskalt (< 0°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(-5.0)));
    }

    public function testTemperatureRangeKalt(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Kalt (0–10°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(5.0)));
    }

    public function testTemperatureRangeKuehl(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Kühl (10–15°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(12.0)));
    }

    public function testTemperatureRangeMild(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Mild (15–20°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(17.0)));
    }

    public function testTemperatureRangeWarm(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Warm (20–25°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(22.0)));
    }

    public function testTemperatureRangeHeiss(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Heiß (> 25°C)', ($aliases['temperatureRange']['value'])($this->makeTempEvent(30.0)));
    }

    public function testTemperatureRangeFallbackToHourlyData(): void
    {
        $event = $this->makeEventWithGameDate(
            new DateTime('2024-01-01'),
            [],                                          // no daily temperature
            ['temperature_2m' => [18.0, 20.0, 22.0]]    // hourly fallback, max=22
        );
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Warm (20–25°C)', ($aliases['temperatureRange']['value'])($event));
    }

    public function testTemperatureRangeReturnsNullWhenNoWeatherData(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-01-01'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['temperatureRange']['value'])($event));
    }

    // =========================================================================
    // windStrength value — all branches
    // =========================================================================

    private function makeWindEvent(float $windMax): object
    {
        return $this->makeEventWithGameDate(new DateTime('2024-06-01'), ['windspeed_10m_max' => [$windMax]]);
    }

    public function testWindStrengthWindstill(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Windstill (< 10 km/h)', ($aliases['windStrength']['value'])($this->makeWindEvent(5.0)));
    }

    public function testWindStrengthLeicht(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Leichter Wind (10–25 km/h)', ($aliases['windStrength']['value'])($this->makeWindEvent(15.0)));
    }

    public function testWindStrengthMassig(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Mäßiger Wind (25–40 km/h)', ($aliases['windStrength']['value'])($this->makeWindEvent(30.0)));
    }

    public function testWindStrengthStark(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Starker Wind (40–60 km/h)', ($aliases['windStrength']['value'])($this->makeWindEvent(50.0)));
    }

    public function testWindStrengthSturm(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Sturm (> 60 km/h)', ($aliases['windStrength']['value'])($this->makeWindEvent(70.0)));
    }

    public function testWindStrengthFallbackToHourlyData(): void
    {
        $event = $this->makeEventWithGameDate(
            new DateTime('2024-01-01'),
            [],                                          // no daily windspeed
            ['wind_speed_10m' => [12.0, 18.0, 22.0]]    // hourly fallback, max=22
        );
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Leichter Wind (10–25 km/h)', ($aliases['windStrength']['value'])($event));
    }

    public function testWindStrengthReturnsNullWhenNoWeatherData(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-01-01'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['windStrength']['value'])($event));
    }

    // =========================================================================
    // cloudCover value — all branches
    // =========================================================================

    private function makeCloudEvent(float $cloudCover): object
    {
        return $this->makeEventWithGameDate(new DateTime('2024-06-01'), ['cloudcover_mean' => [$cloudCover]]);
    }

    public function testCloudCoverWolkenlos(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Wolkenlos (< 20%)', ($aliases['cloudCover']['value'])($this->makeCloudEvent(10.0)));
    }

    public function testCloudCoverLeichtBewoelkt(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Leicht bewölkt (20–50%)', ($aliases['cloudCover']['value'])($this->makeCloudEvent(35.0)));
    }

    public function testCloudCoverBewoelkt(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Bewölkt (50–80%)', ($aliases['cloudCover']['value'])($this->makeCloudEvent(65.0)));
    }

    public function testCloudCoverStarkBewoelkt(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Stark bewölkt (> 80%)', ($aliases['cloudCover']['value'])($this->makeCloudEvent(90.0)));
    }

    public function testCloudCoverFallbackToHourlyData(): void
    {
        $event = $this->makeEventWithGameDate(
            new DateTime('2024-01-01'),
            [],                                    // no daily cloudcover
            ['cloudcover' => [60.0, 70.0, 80.0]]  // hourly fallback, avg=70
        );
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame('Bewölkt (50–80%)', ($aliases['cloudCover']['value'])($event));
    }

    public function testCloudCoverReturnsNullWhenNoWeatherData(): void
    {
        $event = $this->makeEventWithGameDate(new DateTime('2024-01-01'));
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertNull(($aliases['cloudCover']['value'])($event));
    }

    // =========================================================================
    // aggregate closures — countByCodes logic + each metric
    // =========================================================================

    /** Creates a minimal GameEvent stub with getGameEventType() returning a type with $code. */
    private function makeEventWithCode(string $code): object
    {
        $type = new class ($code) {
            public function __construct(private string $code)
            {
            }

            public function getCode(): string
            {
                return $this->code;
            }

            public function getId(): int
            {
                return 0;
            }
        };

        return new class ($type) {
            public function __construct(private object $type)
            {
            }

            public function getGameEventType(): object
            {
                return $this->type;
            }
        };
    }

    public function testGoalsAggregateCountsGoalCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $event = $this->makeEventWithCode('goal');
        $this->assertSame(1, ($aliases['goals']['aggregate'])([$event]));
    }

    public function testGoalsAggregateCountsAllGoalCodes(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $events = array_map(
            fn ($c) => $this->makeEventWithCode($c),
            ['goal', 'penalty_goal', 'freekick_goal', 'header_goal', 'corner_goal', 'cross_goal', 'counter_goal', 'pressing_goal']
        );
        $this->assertSame(8, ($aliases['goals']['aggregate'])($events));
    }

    public function testAssistsAggregateCountsAssistCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['assists']['aggregate'])([$this->makeEventWithCode('assist')]));
    }

    public function testShotsAggregateCountsShotOnTarget(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['shots']['aggregate'])([$this->makeEventWithCode('shot_on_target')]));
    }

    public function testShotAccuracyWithActualShotsAndGoals(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $events = [
            $this->makeEventWithCode('shot_on_target'),
            $this->makeEventWithCode('shot_on_target'),
            $this->makeEventWithCode('goal'),
        ];
        // 1 goal / 3 shots (goal counted by countByCodes for shots? No, 'goal' is not a shot code)
        // Wait: shots codes are shot_on_target etc., goals codes are goal etc. — separate
        // so: 2 shots, 0 goals from shot codes → shotAccuracy = 0/2 * 100 → 0, but goal not shot
        // Actually: shots = countByCodes(['shot_on_target','shot_off_target',...]) = 2 (two shot_on_target)
        // goals = countByCodes(['goal',...]) = 1 (the 'goal' event)
        // shotAccuracy = round(1/2 * 100, 1) = 50.0
        $this->assertSame(50.0, ($aliases['shotAccuracy']['aggregate'])($events));
    }

    public function testYellowCardsAggregateCountsYellowCardCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(2, ($aliases['yellowCards']['aggregate'])([$this->makeEventWithCode('yellow_card'), $this->makeEventWithCode('yellow_card')]));
    }

    public function testRedCardsAggregateCountsRedCardCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['redCards']['aggregate'])([$this->makeEventWithCode('red_card')]));
    }

    public function testFoulsAggregateCountsFoulCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['fouls']['aggregate'])([$this->makeEventWithCode('foul')]));
    }

    public function testDribblesAggregateCountsDribbleCode(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['dribbles']['aggregate'])([$this->makeEventWithCode('dribble_success')]));
    }

    public function testDuelsWonPercentWithWonAndLost(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $events = [
            $this->makeEventWithCode('duel_won'),
            $this->makeEventWithCode('duel_won'),
            $this->makeEventWithCode('duel_lost'),
        ];
        // 2 won / 3 total = 66.7%
        $this->assertSame(66.7, ($aliases['duelsWonPercent']['aggregate'])($events));
    }

    public function testDuelsWonPercentReturnsZeroForNoEvents(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(0, ($aliases['duelsWonPercent']['aggregate'])([]));
    }

    public function testSavesAggregateCountsSaveCodes(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['saves']['aggregate'])([$this->makeEventWithCode('save')]));
    }

    public function testPassesAggregateCountsPassNormal(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['passes']['aggregate'])([$this->makeEventWithCode('pass_normal')]));
    }

    public function testTacklesAggregateCountsTackleSuccess(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['tackles']['aggregate'])([$this->makeEventWithCode('tackle_success')]));
    }

    public function testInterceptionsAggregateCountsInterception(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $this->assertSame(1, ($aliases['interceptions']['aggregate'])([$this->makeEventWithCode('interception')]));
    }

    public function testCountByCodesSkipsEventWithoutGetGameEventType(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        // Object without getGameEventType() method — countByCodes should skip it
        $eventWithoutMethod = new class {
            public function noSuchMethod(): void
            {
            }
        };
        $this->assertSame(0, ($aliases['goals']['aggregate'])([$eventWithoutMethod]));
    }

    public function testCountByCodesSkipsEventWithNullGameEventType(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);
        $eventWithNullType = new class {
            public function getGameEventType(): mixed
            {
                return null;
            }
        };
        $this->assertSame(0, ($aliases['goals']['aggregate'])([$eventWithNullType]));
    }

    // =========================================================================
    //  eventCount – Ereignisse (Anzahl)
    // =========================================================================

    public function testEventCountAliasExists(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertArrayHasKey('eventCount', $aliases);
    }

    public function testEventCountHasCorrectLabel(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame('Ereignisse (Anzahl)', $aliases['eventCount']['label']);
    }

    public function testEventCountIsMetric(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertSame('metric', $aliases['eventCount']['category']);
    }

    public function testEventCountHasCallableAggregate(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $this->assertArrayHasKey('aggregate', $aliases['eventCount']);
        $this->assertTrue(is_callable($aliases['eventCount']['aggregate']));
    }

    public function testEventCountAggregateReturnsZeroForEmptyArray(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $result = ($aliases['eventCount']['aggregate'])([]);

        $this->assertSame(0, $result);
    }

    public function testEventCountAggregateCountsAllEvents(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $events = [new stdClass(), new stdClass(), new stdClass()];

        $result = ($aliases['eventCount']['aggregate'])($events);

        $this->assertSame(3, $result);
    }

    public function testEventCountAggregateCountsSingleEvent(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $result = ($aliases['eventCount']['aggregate'])([new stdClass()]);

        $this->assertSame(1, $result);
    }

    public function testEventCountAggregateCountsIndependentlyOfEventType(): void
    {
        // eventCount must count all events regardless of their type
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $makeEvent = static function (string $code): object {
            return new class ($code) {
                public function __construct(private string $code)
                {
                }

                public function getGameEventType(): object
                {
                    return new class ($this->code) {
                        public function __construct(private string $code)
                        {
                        }

                        public function getCode(): string
                        {
                            return $this->code;
                        }

                        public function getId(): int
                        {
                            return 0;
                        }
                    };
                }
            };
        };

        $events = [
            $makeEvent('goal'),
            $makeEvent('yellow_card'),
            $makeEvent('assist'),
            $makeEvent('foul'),
        ];

        $result = ($aliases['eventCount']['aggregate'])($events);

        $this->assertSame(4, $result);
    }

    public function testEventCountIsIncludedInMetricsContainsCheck(): void
    {
        $aliases = ReportFieldAliasService::fieldAliases(null);

        $metrics = array_filter($aliases, fn ($a) => 'metric' === $a['category']);

        $this->assertArrayHasKey('eventCount', $metrics);
    }
}
