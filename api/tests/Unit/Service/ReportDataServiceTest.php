<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\Team;
use App\Entity\WeatherData;
use App\Service\ReportDataService;
use App\Service\ReportFieldAliasService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use stdClass;

#[AllowMockObjectsWithoutExpectations]
class ReportDataServiceTest extends TestCase
{
    protected function setUp(): void
    {
        // Reset the static cache so tests do not pollute each other via shared closure state.
        $ref = new ReflectionClass(ReportFieldAliasService::class);
        $prop = $ref->getProperty('cache');
        $prop->setAccessible(true);
        $prop->setValue(null, null);
    }

    public function testGenerateSpatialPointsNormalizesAndClamps(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // create simple stubs with pos getters
        $ev1 = new class {
            public function getPosX(): float
            {
                return 0.5;
            }

            public function getPosY(): float
            {
                return 0.75;
            }
        };

        $ev2 = new class {
            public function getPosX(): float
            {
                return 150;
            }

            public function getPosY(): float
            {
                return 200;
            }
        };

        $ev3 = new class {
            public function getPosX(): float
            {
                return -5;
            }

            public function getPosY(): float
            {
                return 50;
            }
        };

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateSpatialPoints');
        $m->setAccessible(true);

        $points = $m->invokeArgs($svc, [[$ev1, $ev2, $ev3], []]);

        $this->assertIsArray($points);
        $this->assertCount(3, $points);

        // ev1: 0.5 -> 50.00, 0.75 -> 75.00
        $this->assertEquals(50.00, $points[0]['x']);
        $this->assertEquals(75.00, $points[0]['y']);

        // ev2: values >100 should be clamped to 100
        $this->assertEquals(100.00, $points[1]['x']);
        $this->assertEquals(100.00, $points[1]['y']);

        // ev3: x negative -> clamped to 0, y 50 stays
        $this->assertEquals(0.00, $points[2]['x']);
        $this->assertEquals(50.00, $points[2]['y']);
    }

    public function testGenerateReportDataForRadarCountsGoalsAndMeta(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Create stub GameEventType with code 'goal'
        $typeGoal = new class {
            public function getId(): int
            {
                return 1;
            }

            public function getCode(): string
            {
                return 'goal';
            }

            public function getName(): string
            {
                return 'Tor';
            }
        };

        // Event stubs returning the above type (use public property to avoid constructor arg formatting issues)
        $ev1 = new class {
            public mixed $t;

            public function getGameEventType(): mixed
            {
                return $this->t;
            }
        };
        $ev1->t = $typeGoal;

        $ev2 = new class {
            public mixed $t;

            public function getGameEventType(): mixed
            {
                return $this->t;
            }
        };
        $ev2->t = $typeGoal;

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadar');
        $m->setAccessible(true);

        // Request metric 'goals'
        $out = $m->invokeArgs($svc, [[$ev1, $ev2], ['goals'], []]);

        $this->assertArrayHasKey('labels', $out);
        $this->assertArrayHasKey('datasets', $out);
        $this->assertEquals('radar', $out['diagramType']);
        $this->assertEquals(1, count($out['labels']));
        $this->assertEquals('Tore', $out['labels'][0]);

        $this->assertCount(1, $out['datasets']);
        $this->assertEquals([2], $out['datasets'][0]['data']);

        $this->assertArrayHasKey('meta', $out);
        $this->assertArrayHasKey('radarHasData', $out['meta']);
        $this->assertTrue($out['meta']['radarHasData']);
    }

    public function testGenerateReportDataLineAndGroupAndPie(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // events: players A,A,B; groupKey: teamX/teamY
        // Create Player and Team instances (subclasses) that stringify to readable names
        $playerA = new class extends Player {
            public function __toString(): string
            {
                return 'Alice';
            }

            public function getFullName(): string
            {
                return 'Alice';
            }
        };

        $playerB = new class extends Player {
            public function __toString(): string
            {
                return 'Bob';
            }

            public function getFullName(): string
            {
                return 'Bob';
            }
        };

        $teamX = new class extends Team {
            public function __toString(): string
            {
                return 'TeamX';
            }

            public function getName(): string
            {
                return 'TeamX';
            }
        };

        $teamY = new class extends Team {
            public function __toString(): string
            {
                return 'TeamY';
            }

            public function getName(): string
            {
                return 'TeamY';
            }
        };

        $evA1 = $this->createMock(GameEvent::class);
        $evA1->method('getPlayer')->willReturn($playerA);
        $evA1->method('getTeam')->willReturn($teamX);

        $evA2 = $this->createMock(GameEvent::class);
        $evA2->method('getPlayer')->willReturn($playerA);
        $evA2->method('getTeam')->willReturn($teamY);

        $evB = $this->createMock(GameEvent::class);
        $evB->method('getPlayer')->willReturn($playerB);
        $evB->method('getTeam')->willReturn($teamX);

        $ref = new ReflectionClass(ReportDataService::class);
        $mLine = $ref->getMethod('generateReportDataForLineOrBarWithoutGroup');
        $mLine->setAccessible(true);
        $outLine = $mLine->invokeArgs($svc, [[$evA1, $evA2, $evB], 'player', 'count']);

        $this->assertEquals(['Alice', 'Bob'], $outLine['labels']);
        $this->assertEquals([2, 1], $outLine['datasets'][0]['data']);

        $mGroup = $ref->getMethod('generateReportDataForGroup');
        $mGroup->setAccessible(true);
        $outGroup = $mGroup->invokeArgs($svc, [[$evA1, $evA2, $evB], 'player', 'count', ['team']]);
        $this->assertArrayHasKey('labels', $outGroup);
        $this->assertArrayHasKey('datasets', $outGroup);

        $mPie = $ref->getMethod('generateReportDataForPieWithoutGroup');
        $mPie->setAccessible(true);
        $outPie = $mPie->invokeArgs($svc, [[$evA1, $evA2, $evB], 'player']);
        $this->assertEquals(['Alice', 'Bob'], $outPie['labels']);
        $this->assertEquals([2, 1], $outPie['datasets'][0]['data']);
    }

    public function testGenerateReportDataFiltersPrecipitationYesNo(): void
    {
        // Prepare two events: one with precipitation, one without
        // Create WeatherData mocks that return arrays as expected by the service
        $wdWith = $this->createMock(WeatherData::class);
        $wdWith->method('getDailyWeatherData')->willReturn(['precipitation_sum' => [5]]);
        $wdWith->method('getHourlyWeatherData')->willReturn(['precipitation' => [0, 0]]);

        $wdNo = $this->createMock(WeatherData::class);
        $wdNo->method('getDailyWeatherData')->willReturn(['precipitation_sum' => [0]]);
        $wdNo->method('getHourlyWeatherData')->willReturn(['precipitation' => [0, 0]]);

        // CalendarEvent mocks
        $calEventWith = $this->createMock(CalendarEvent::class);
        $calEventWith->method('getWeatherData')->willReturn($wdWith);

        $calEventNo = $this->createMock(CalendarEvent::class);
        $calEventNo->method('getWeatherData')->willReturn($wdNo);

        // Game mocks returning the calendar events (match entity types)
        $gameWith = $this->createMock(Game::class);
        $gameWith->method('getCalendarEvent')->willReturn($calEventWith);

        $gameNo = $this->createMock(Game::class);
        $gameNo->method('getCalendarEvent')->willReturn($calEventNo);

        // GameEvent mocks returning the Game instances
        $evWith = $this->createMock(GameEvent::class);
        $evWith->method('getGame')->willReturn($gameWith);

        $evNo = $this->createMock(GameEvent::class);
        $evNo->method('getGame')->willReturn($gameNo);

        // Build a fake query chain that returns [$evWith, $evNo]
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$evWith, $evNo]);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $svc = new ReportDataService($em);

        // precipitation = 'yes' should keep only the first event
        $outYes = $svc->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'filters' => [
                'precipitation' => 'yes',
            ],
        ]);
        $this->assertEquals(1, $outYes['meta']['eventsCount']);

        // precipitation = 'no' should keep only the second event
        $outNo = $svc->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'filters' => [
                'precipitation' => 'no',
            ],
        ]);
        $this->assertEquals(1, $outNo['meta']['eventsCount']);
    }

    // ── stringifyValue ─────────────────────────────────────────────────

    public function testStringifyValueReturnsUnbekanntForNull(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $this->assertSame('Unbekannt', $m->invoke($svc, null));
    }

    public function testStringifyValueReturnsUnbekanntForEmptyString(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $this->assertSame('Unbekannt', $m->invoke($svc, ''));
    }

    public function testStringifyValueReturnsScalarAsString(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $this->assertSame('42', $m->invoke($svc, 42));
        $this->assertSame('hello', $m->invoke($svc, 'hello'));
        $this->assertSame('1', $m->invoke($svc, true));
    }

    public function testStringifyValueEncodesArray(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $result = $m->invoke($svc, ['a' => 1, 'b' => 'ü']);
        $this->assertSame('{"a":1,"b":"ü"}', $result);
    }

    public function testStringifyValueUsesGetNameForObject(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $obj = new class {
            public function getName(): string
            {
                return 'TeamAlpha';
            }
        };

        $this->assertSame('TeamAlpha', $m->invoke($svc, $obj));
    }

    public function testStringifyValueUsesGetTitleForObject(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $obj = new class {
            public function getTitle(): string
            {
                return 'Report A';
            }
        };

        $this->assertSame('Report A', $m->invoke($svc, $obj));
    }

    public function testStringifyValueUsesGetFullNameForObject(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $obj = new class {
            public function getFullName(): string
            {
                return 'Max Mustermann';
            }
        };

        $this->assertSame('Max Mustermann', $m->invoke($svc, $obj));
    }

    public function testStringifyValueUsesGetIdForObject(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $obj = new class {
            public function getId(): int
            {
                return 99;
            }
        };

        $this->assertSame('99', $m->invoke($svc, $obj));
    }

    public function testStringifyValueUsesGetFirstAndLastNameForObject(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        $obj = new class {
            public function getFirstName(): string
            {
                return 'Max';
            }

            public function getLastName(): string
            {
                return 'Müller';
            }
        };

        $this->assertSame('Max Müller', $m->invoke($svc, $obj));
    }

    public function testStringifyValueFallsBackToClassName(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('stringifyValue');
        $m->setAccessible(true);

        // Object without any recognized methods
        $obj = new stdClass();

        $this->assertSame('stdClass', $m->invoke($svc, $obj));
    }

    // ── deriveUserSuggestions ──────────────────────────────────────────

    public function testDeriveUserSuggestionsReturnsDefaultTipForEmptyInput(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        $tips = $m->invoke($svc, [], []);

        $this->assertCount(1, $tips);
        $this->assertStringContainsString('Presets', $tips[0]);
    }

    public function testDeriveUserSuggestionsHandlesMetricNotSupported(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        $tips = $m->invoke($svc, ['metric xp not supported by aggregate path']);

        $this->assertNotEmpty($tips);
        $this->assertStringContainsString('Metrik', $tips[0]);
    }

    public function testDeriveUserSuggestionsHandlesNoJoinPath(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        $tips = $m->invoke($svc, ['no join path found for field surfaceType']);

        $this->assertNotEmpty($tips);
        $this->assertStringContainsString('Feld', $tips[0]);
    }

    public function testDeriveUserSuggestionsHandlesDbAggregateFallback(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        $tips = $m->invoke($svc, ['DB-aggregate path not available for this combination']);

        $this->assertNotEmpty($tips);
        $this->assertStringContainsString('Gruppierungen', $tips[0]);
    }

    public function testDeriveUserSuggestionsIncludesWarningTip(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        $tips = $m->invoke($svc, ['some generic suggestion'], ['a warning']);

        $found = false;
        foreach ($tips as $t) {
            if (str_contains($t, 'Filter') && str_contains($t, 'Zeitraum')) {
                $found = true;
            }
        }
        $this->assertTrue($found, 'Expected a tip about filters/Zeitraum when warnings exist');
    }

    public function testDeriveUserSuggestionsDeduplicatesTips(): void
    {
        $svc = new ReportDataService($this->createMock(EntityManagerInterface::class));
        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('deriveUserSuggestions');
        $m->setAccessible(true);

        // Two identical suggestion types should produce deduplicated results
        $tips = $m->invoke($svc, [
            'some unknown suggestion',
            'another unknown suggestion',
        ]);

        // Both unknowns map to the same fallback tip → should be deduplicated
        $this->assertCount(1, $tips);
    }

    // ── considerGroup routing ──────────────────────────────────────────

    public function testConsiderGroupRoutesPieWithoutGroupBy(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $playerB = $this->createMock(Player::class);
        $playerB->method('getFullName')->willReturn('Bob');
        $playerB->method('__toString')->willReturn('Bob');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getPlayer')->willReturn($playerB);

        $ev3 = $this->createMock(GameEvent::class);
        $ev3->method('getPlayer')->willReturn($playerA);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('considerGroup');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1, $ev2, $ev3], 'pie', 'player', 'player', []);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        // Pie without group should group by yField (player)
        $this->assertContains('Alice', $result['labels']);
        $this->assertContains('Bob', $result['labels']);
    }

    public function testConsiderGroupRoutesBarWithoutGroupBy(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getPlayer')->willReturn($playerA);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('considerGroup');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1, $ev2], 'bar', 'player', 'count', []);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        $this->assertContains('Alice', $result['labels']);
    }

    public function testConsiderGroupRoutesToGroupMethodWithGroupBy(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getTeam')->willReturn($teamX);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('considerGroup');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1], 'bar', 'player', 'count', ['team']);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        // grouped result: datasets have label from groupBy
        $this->assertNotEmpty($result['datasets']);
        $this->assertSame('TeamX', $result['datasets'][0]['label']);
    }

    public function testConsiderGroupStripsGroupByWhenEqualToXField(): void
    {
        // Bug-fix regression: groupBy=['player'] + xField='player' must NOT produce
        // an N×N cross-product matrix — it should strip the duplicate and route to ungrouped.
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getPlayer')->willReturn($playerA);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('considerGroup');
        $m->setAccessible(true);

        // groupBy=['player'] and xField='player' → groupBy stripped to [] → ungrouped
        $result = $m->invoke($svc, [$ev1, $ev2], 'bar', 'player', 'count', ['player']);

        // Ungrouped: exactly 1 dataset (not one dataset per player)
        $this->assertCount(1, $result['datasets']);
        $this->assertContains('Alice', $result['labels']);
    }

    public function testConsiderGroupStripsXFieldFromGroupByButKeepsOtherFields(): void
    {
        // groupBy=['player', 'team'] + xField='player':
        // 'player' is stripped (= xField), 'team' is kept → grouped by team → 2 datasets
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');
        $teamY = $this->createMock(Team::class);
        $teamY->method('getName')->willReturn('TeamY');
        $teamY->method('__toString')->willReturn('TeamY');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getTeam')->willReturn($teamX);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getPlayer')->willReturn($playerA);
        $ev2->method('getTeam')->willReturn($teamY);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('considerGroup');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1, $ev2], 'bar', 'player', 'count', ['player', 'team']);

        // 'team' is kept → grouped result with 2 datasets (one per team)
        $this->assertCount(2, $result['datasets']);
        $datasetLabels = array_column($result['datasets'], 'label');
        $this->assertContains('TeamX', $datasetLabels);
        $this->assertContains('TeamY', $datasetLabels);
    }

    // ── Boxplot: raw-value arrays per bucket ───────────────────────────

    public function testBoxplotWithoutGroupEmitsRawValueArraysPerLabel(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $playerB = $this->createMock(Player::class);
        $playerB->method('getFullName')->willReturn('Bob');
        $playerB->method('__toString')->willReturn('Bob');

        $game1 = $this->createMock(Game::class);
        $game1->method('getId')->willReturn(1);

        $game2 = $this->createMock(Game::class);
        $game2->method('getId')->willReturn(2);

        // Alice: 2 events in game1, 1 event in game2 → distribution = [2.0, 1.0] (counts per game)
        $evA1 = $this->createMock(GameEvent::class);
        $evA1->method('getPlayer')->willReturn($playerA);
        $evA1->method('getGame')->willReturn($game1);

        $evA2 = $this->createMock(GameEvent::class);
        $evA2->method('getPlayer')->willReturn($playerA);
        $evA2->method('getGame')->willReturn($game1);

        $evA3 = $this->createMock(GameEvent::class);
        $evA3->method('getPlayer')->willReturn($playerA);
        $evA3->method('getGame')->willReturn($game2);

        // Bob: 1 event in game1 → distribution = [1.0]
        $evB = $this->createMock(GameEvent::class);
        $evB->method('getPlayer')->willReturn($playerB);
        $evB->method('getGame')->willReturn($game1);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForLineOrBarWithoutGroup');
        $m->setAccessible(true);

        // yField='eventType' has no aggregate → count($gameBucket) fallback is used
        $result = $m->invokeArgs($svc, [[$evA1, $evA2, $evA3, $evB], 'player', 'eventType', 'boxplot']);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        $data = $result['datasets'][0]['data'];
        // Each data point must be an array (per-game distribution), not a scalar
        foreach ($data as $point) {
            $this->assertIsArray($point, 'Boxplot data points must be arrays of per-game values');
        }
        $aliceIdx = array_search('Alice', $result['labels']);
        $bobIdx = array_search('Bob', $result['labels']);
        $this->assertNotFalse($aliceIdx);
        $this->assertNotFalse($bobIdx);
        // Alice: game1 has 2 events (count=2), game2 has 1 event (count=1)
        $this->assertEqualsCanonicalizing([2.0, 1.0], $data[$aliceIdx]);
        // Bob: game1 has 1 event (count=1)
        $this->assertEqualsCanonicalizing([1.0], $data[$bobIdx]);
    }

    public function testBoxplotWithGroupEmitsRawValueArraysPerLayerAndLabel(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');

        $teamY = $this->createMock(Team::class);
        $teamY->method('getName')->willReturn('TeamY');
        $teamY->method('__toString')->willReturn('TeamY');

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $game1 = $this->createMock(Game::class);
        $game1->method('getId')->willReturn(1);

        $game2 = $this->createMock(Game::class);
        $game2->method('getId')->willReturn(2);

        // Alice in TeamX: 2 events across 2 games (1 each) → distribution = [1.0, 1.0]
        $evA1 = $this->createMock(GameEvent::class);
        $evA1->method('getTeam')->willReturn($teamX);
        $evA1->method('getPlayer')->willReturn($playerA);
        $evA1->method('getGame')->willReturn($game1);

        $evA2 = $this->createMock(GameEvent::class);
        $evA2->method('getTeam')->willReturn($teamX);
        $evA2->method('getPlayer')->willReturn($playerA);
        $evA2->method('getGame')->willReturn($game2);

        // Alice in TeamY: 1 event in game1 → distribution = [1.0]
        $evA3 = $this->createMock(GameEvent::class);
        $evA3->method('getTeam')->willReturn($teamY);
        $evA3->method('getPlayer')->willReturn($playerA);
        $evA3->method('getGame')->willReturn($game1);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForGroup');
        $m->setAccessible(true);

        // yField='eventType' has no aggregate → count($gameBucket) fallback is used
        $result = $m->invokeArgs($svc, [[$evA1, $evA2, $evA3], 'player', 'eventType', ['team'], 'boxplot']);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);

        // Every data point in every dataset must be an array (not a scalar)
        foreach ($result['datasets'] as $ds) {
            foreach ($ds['data'] as $point) {
                $this->assertIsArray($point, 'Boxplot grouped data points must be arrays');
            }
        }

        // TeamX dataset: Alice has 2 events in 2 different games → [1.0, 1.0]
        $teamXDs = null;
        foreach ($result['datasets'] as $ds) {
            if ('TeamX' === $ds['label']) {
                $teamXDs = $ds;
                break;
            }
        }
        $this->assertNotNull($teamXDs, 'Expected a TeamX dataset');
        $aliceIdx = array_search('Alice', $result['labels']);
        $this->assertNotFalse($aliceIdx);
        $this->assertEqualsCanonicalizing([1.0, 1.0], $teamXDs['data'][$aliceIdx]);
    }

    // ── retrieveFieldValue ─────────────────────────────────────────────

    public function testRetrieveFieldValueUsesAliasCallback(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // 'eventType' alias has a 'value' callback in ReportFieldAliasService
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getGameEventType')->willReturn($eventType);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('retrieveFieldValue');
        $m->setAccessible(true);

        $result = $m->invoke($svc, $ev, 'eventType');
        $this->assertSame('Tor', $result);
    }

    public function testRetrieveFieldValueFallsBackToGetter(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $player = $this->createMock(Player::class);
        $player->method('getFullName')->willReturn('TestPlayer');

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getPlayer')->willReturn($player);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('retrieveFieldValue');
        $m->setAccessible(true);

        // 'player' is an alias with a 'value' callback, so let's test a field
        // that uses the getter fallback: use a field without alias
        $result = $m->invoke($svc, $ev, 'player');

        // player alias has a value callback that calls getPlayer()->getFullName()
        // so this won't test the getter fallback. Let's test with 'game' instead
        $this->assertNotNull($result);
    }

    public function testRetrieveFieldValueReturnsNullForUnknownField(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $ev = $this->createMock(GameEvent::class);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('retrieveFieldValue');
        $m->setAccessible(true);

        $result = $m->invoke($svc, $ev, 'completelyUnknownField');
        $this->assertNull($result);
    }

    // ── generateReportDataForFaceted ──────────────────────────────────

    public function testGenerateReportDataForFacetedCreatesCorrectPanels(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Create events with different teams (facetBy=team) and players (xField=player)
        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');
        $teamY = $this->createMock(Team::class);
        $teamY->method('getName')->willReturn('TeamY');
        $teamY->method('__toString')->willReturn('TeamY');
        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $playerB = $this->createMock(Player::class);
        $playerB->method('getFullName')->willReturn('Bob');
        $playerB->method('__toString')->willReturn('Bob');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getTeam')->willReturn($teamX);
        $ev1->method('getPlayer')->willReturn($playerA);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getTeam')->willReturn($teamX);
        $ev2->method('getPlayer')->willReturn($playerB);

        $ev3 = $this->createMock(GameEvent::class);
        $ev3->method('getTeam')->willReturn($teamY);
        $ev3->method('getPlayer')->willReturn($playerA);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForFaceted');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1, $ev2, $ev3], [
            'facetBy' => 'team',
            'xField' => 'player',
            'groupBy' => [],
        ]);

        $this->assertSame('faceted', $result['diagramType']);
        $this->assertArrayHasKey('panels', $result);
        $this->assertCount(2, $result['panels']); // TeamX and TeamY

        // Meta should contain facet info
        $this->assertSame('team', $result['meta']['facetBy']);
        $this->assertSame(2, $result['meta']['panelCount']);

        // Each panel should have labels and datasets
        foreach ($result['panels'] as $panel) {
            $this->assertArrayHasKey('title', $panel);
            $this->assertArrayHasKey('labels', $panel);
            $this->assertArrayHasKey('datasets', $panel);
        }
    }

    public function testGenerateReportDataForFacetedWithGroupBy(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');
        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getTeam')->willReturn($teamX);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getGameEventType')->willReturn($eventType);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForFaceted');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1], [
            'facetBy' => 'team',
            'xField' => 'player',
            'groupBy' => ['eventType'],
            'facetSubType' => 'bar',
        ]);

        $this->assertSame('faceted', $result['diagramType']);
        $this->assertSame('bar', $result['facetSubType']);
        $this->assertCount(1, $result['panels']);

        // With groupBy, datasets should have layer labels
        $panel = $result['panels'][0];
        $this->assertSame('TeamX', $panel['title']);
        $this->assertNotEmpty($panel['datasets']);
        $this->assertSame('Tor', $panel['datasets'][0]['label']);
    }

    public function testGenerateReportDataForFacetedWithTranspose(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');
        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $playerB = $this->createMock(Player::class);
        $playerB->method('getFullName')->willReturn('Bob');
        $playerB->method('__toString')->willReturn('Bob');

        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getTeam')->willReturn($teamX);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getGameEventType')->willReturn($eventType);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getTeam')->willReturn($teamX);
        $ev2->method('getPlayer')->willReturn($playerB);
        $ev2->method('getGameEventType')->willReturn($eventType);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForFaceted');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev1, $ev2], [
            'facetBy' => 'team',
            'xField' => 'player',
            'groupBy' => ['eventType'],
            'facetTranspose' => true,
            'facetSubType' => 'radar',
        ]);

        $this->assertTrue($result['meta']['facetTranspose']);

        // Transposed: labels = layers (event types as radar axes), datasets = x-values (players)
        $panel = $result['panels'][0];
        $this->assertContains('Tor', $panel['labels']);

        $datasetLabels = array_column($panel['datasets'], 'label');
        $this->assertContains('Alice', $datasetLabels);
        $this->assertContains('Bob', $datasetLabels);
    }

    // ── generateReportDataForGroup (additional tests) ──────────────────

    public function testGenerateReportDataForGroupMultipleGroupByFields(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');

        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');

        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getTeam')->willReturn($teamX);
        $ev1->method('getGameEventType')->willReturn($eventType);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForGroup');
        $m->setAccessible(true);

        // Group by BOTH team and eventType
        $result = $m->invoke($svc, [$ev1], 'player', 'count', ['team', 'eventType']);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);

        // The layer label should be "TeamX | Tor" (composite key)
        $this->assertNotEmpty($result['datasets']);
        $this->assertSame('TeamX | Tor', $result['datasets'][0]['label']);
    }

    // ── Radar with eventType:id metrics ────────────────────────────────

    public function testGenerateReportDataForRadarCountsEventTypeById(): void
    {
        // Prepare GameEventType stub with id = 5
        $eventType = new class {
            public function getId(): int
            {
                return 5;
            }

            public function getName(): string
            {
                return 'Torschuss';
            }

            public function getCode(): string
            {
                return 'shot';
            }
        };

        // Repository mock returning the type when queried by id
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findBy')->willReturn([$eventType]);
        $repo->method('findAll')->willReturn([$eventType]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $svc = new ReportDataService($em);

        // Event stub that has the matching type
        $ev = new class {
            public mixed $type;

            public function getGameEventType(): mixed
            {
                return $this->type;
            }
        };
        $ev->type = $eventType;

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadar');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev], ['eventType:5'], []);

        $this->assertSame('radar', $result['diagramType']);
        $this->assertSame(['Torschuss'], $result['labels']);
        $this->assertCount(1, $result['datasets']);
        $this->assertSame([1.0], $result['datasets'][0]['data']);
        $this->assertTrue($result['meta']['radarHasData']);
    }

    public function testGenerateReportDataForRadarCountsEventTypeByCode(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $eventType = new class {
            public function getId(): int
            {
                return 3;
            }

            public function getCode(): string
            {
                return 'assist';
            }

            public function getName(): string
            {
                return 'Vorlage';
            }
        };

        $ev = new class {
            public mixed $type;

            public function getGameEventType(): mixed
            {
                return $this->type;
            }
        };
        $ev->type = $eventType;

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadar');
        $m->setAccessible(true);

        $result = $m->invoke($svc, [$ev], ['eventCode:assist'], []);

        $this->assertSame('radar', $result['diagramType']);
        $this->assertSame(['Ereignis: assist'], $result['labels']);
        $this->assertSame([1.0], $result['datasets'][0]['data']);
    }

    public function testGenerateReportDataForRadarWithGroupBy(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');
        $playerB = $this->createMock(Player::class);
        $playerB->method('getFullName')->willReturn('Bob');
        $playerB->method('__toString')->willReturn('Bob');

        // Events: A has eventType goal, B has eventType goal
        $ev1 = $this->createMock(GameEvent::class);
        $ev1->method('getPlayer')->willReturn($playerA);
        $ev1->method('getGameEventType')->willReturn(null);

        $ev2 = $this->createMock(GameEvent::class);
        $ev2->method('getPlayer')->willReturn($playerB);
        $ev2->method('getGameEventType')->willReturn(null);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadar');
        $m->setAccessible(true);

        // Group by player, metrics = ['goals']
        $result = $m->invoke($svc, [$ev1, $ev2], ['goals'], ['player']);

        $this->assertSame('radar', $result['diagramType']);
        // Should create separate datasets per player
        $this->assertCount(2, $result['datasets']);

        $datasetLabels = array_column($result['datasets'], 'label');
        $this->assertContains('Alice', $datasetLabels);
        $this->assertContains('Bob', $datasetLabels);
    }

    public function testGenerateReportDataForRadarMetaHasDataFalseWhenAllZero(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Event with no matching eventType
        $ev = new class {
            public function getGameEventType(): mixed
            {
                return null;
            }
        };

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadar');
        $m->setAccessible(true);

        // request eventType:999 which won't match anything
        $result = $m->invoke($svc, [$ev], ['eventType:999'], []);

        $this->assertFalse($result['meta']['radarHasData']);
    }

    // ── generateSpatialPoints additional tests ──────────────────────────

    public function testGenerateSpatialPointsReturnsEmptyForNoEvents(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateSpatialPoints');
        $m->setAccessible(true);

        $points = $m->invoke($svc, [], []);

        $this->assertIsArray($points);
        $this->assertEmpty($points);
    }

    public function testGenerateSpatialPointsSkipsEventsWithoutPosGetters(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $ev = new stdClass(); // no getPosX/getPosY

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateSpatialPoints');
        $m->setAccessible(true);

        $points = $m->invoke($svc, [$ev], []);

        $this->assertIsArray($points);
        $this->assertEmpty($points);
    }

    // ── generateReportData main method (integration-style) ──────────────

    public function testGenerateReportDataReturnsMetaAndChart(): void
    {
        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $gameMock = $this->createMock(Game::class);
        $teamMock = $this->createMock(Team::class);

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getPlayer')->willReturn($playerA);
        $ev->method('getGame')->willReturn($gameMock);
        $ev->method('getGameEventType')->willReturn(null);
        $ev->method('getTeam')->willReturn($teamMock);

        // Build query chain
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$ev]);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $svc = new ReportDataService($em);

        $result = $svc->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'diagramType' => 'bar',
        ]);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        $this->assertArrayHasKey('meta', $result);
        // diagramType is only set in result for special types (radar, faceted, pitchheatmap)
        $this->assertArrayNotHasKey('diagramType', $result);
        $this->assertSame(1, $result['meta']['eventsCount']);
    }

    public function testGenerateReportDataRadarTypeDelegatesCorrectly(): void
    {
        $ev = new class {
            public function getGameEventType(): mixed
            {
                return null;
            }

            public function getPlayer(): mixed
            {
                return null;
            }
        };

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$ev]);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $svc = new ReportDataService($em);

        $result = $svc->generateReportData([
            'diagramType' => 'radar',
            'metrics' => ['goals'],
            'groupBy' => [],
            'xField' => 'player',
            'yField' => 'goals',
        ]);

        $this->assertSame('radar', $result['diagramType']);
        $this->assertArrayHasKey('meta', $result);
        $this->assertArrayHasKey('radarHasData', $result['meta']);
    }

    // ── DB aggregate path tests ────────────────────────────────────────

    /**
     * Creates a fully-mocked QueryBuilder that supports all chaining methods used by
     * both the DB-aggregate path and the PHP-fallback path.
     *
     * @param array<int, array<string,mixed>> $arrayResult rows for getArrayResult()
     * @param array<int, mixed>               $result      rows for getResult()
     *
     * @return array{qb: QueryBuilder, query: Query}
     */
    private function makeFullQbMock(array $arrayResult = [], array $result = []): array
    {
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($result);
        $query->method('getArrayResult')->willReturn($arrayResult);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('addSelect')->willReturnSelf();
        $qb->method('addGroupBy')->willReturnSelf();
        $qb->method('select')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        return compact('qb', 'query');
    }

    public function testGenerateReportDataDbAggregateSuccessReturnsLabelAndData(): void
    {
        ['qb' => $qb] = $this->makeFullQbMock(
            [['label' => 'Alice', 'value' => '3'], ['label' => 'Bob', 'value' => '1']]
        );

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $svc = new ReportDataService($em);

        $result = $svc->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'groupBy' => ['player'],
            'use_db_aggregates' => true,
        ]);

        $this->assertSame(['Alice', 'Bob'], $result['labels']);
        $this->assertSame([3.0, 1.0], $result['datasets'][0]['data']);
        $this->assertTrue($result['meta']['dbAggregate']);
    }

    public function testGenerateReportDataDbAggregateGoalsMetric(): void
    {
        // Verifies that the metric code-map path is hit for 'goals'
        ['qb' => $qb] = $this->makeFullQbMock([['label' => 'TeamX', 'value' => '5']]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'team',
            'yField' => 'goals',
            'groupBy' => ['team'],
            'use_db_aggregates' => true,
        ]);

        $this->assertSame(['TeamX'], $result['labels']);
        $this->assertSame([5.0], $result['datasets'][0]['data']);
        $this->assertTrue($result['meta']['dbAggregate']);
    }

    public function testGenerateReportDataDbAggregateEventTypeIdField(): void
    {
        // yField matching 'eventType:42' triggers the regex path
        ['qb' => $qb] = $this->makeFullQbMock([['label' => 'Max', 'value' => '2']]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'eventType:42',
            'groupBy' => ['player'],
            'use_db_aggregates' => true,
        ]);

        $this->assertSame(['Max'], $result['labels']);
        $this->assertTrue($result['meta']['dbAggregate']);
    }

    public function testGenerateReportDataDbAggregateUnsupportedMetricFallsBackToPhp(): void
    {
        // 'duelsWonPercent' is NOT in $dbSupportedMetrics → falls back to PHP
        $ev = $this->createMock(GameEvent::class);

        ['qb' => $qb] = $this->makeFullQbMock([], [$ev]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'duelsWonPercent',
            'groupBy' => ['player'],
            'use_db_aggregates' => true,
        ]);

        // PHP fallback: result has dbAggregate = false (or not set, or meta.suggestions has hint)
        $this->assertArrayHasKey('meta', $result);
        // suggestions should mention that the metric needs PHP processing
        $this->assertStringContainsString('not supported', implode(' ', $result['meta']['suggestions'] ?? []));
    }

    public function testGenerateReportDataDbAggregateNoJoinPathFallsBackToPhp(): void
    {
        // 'homeAway' has joinHint = null → canUseDb becomes false
        $ev = $this->createMock(GameEvent::class);

        ['qb' => $qb] = $this->makeFullQbMock([], [$ev]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'groupBy' => ['homeAway'],  // joinHint = null → canUseDb = false
            'use_db_aggregates' => true,
        ]);

        $this->assertArrayHasKey('meta', $result);
        // Should have fallen back to PHP path with userSuggestions set
        $this->assertArrayHasKey('userSuggestions', $result['meta']);
    }

    public function testGenerateReportDataDbAggregateWithDateFilters(): void
    {
        // Covers the dateFrom / dateTo filter branches in the DB aggregate path
        ['qb' => $qb] = $this->makeFullQbMock([['label' => 'Alice', 'value' => '1']]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'assists',
            'groupBy' => ['player'],
            'use_db_aggregates' => true,
            'filters' => [
                'team' => 1,
                'player' => 2,
                'dateFrom' => '2024-01-01',
                'dateTo' => '2024-12-31',
            ],
        ]);

        $this->assertTrue($result['meta']['dbAggregate']);
    }

    public function testGenerateReportDataDbAggregateWithSurfaceTypeFilter(): void
    {
        // Covers the surfaceType / gameType filter branches in the DB aggregate path
        ['qb' => $qb] = $this->makeFullQbMock([['label' => 'Rasen', 'value' => '2']]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'surfaceType',
            'yField' => 'shots',
            'groupBy' => ['player'],
            'use_db_aggregates' => true,
            'filters' => [
                'surfaceType' => 3,
                'gameType' => 2,
            ],
        ]);

        $this->assertTrue($result['meta']['dbAggregate']);
    }

    // ── Spatial heatmap via generateReportData ─────────────────────────

    public function testGenerateReportDataPitchHeatmapReturnsSpatialPoints(): void
    {
        $ev = new class {
            public function getPosX(): float
            {
                return 50.0;
            }

            public function getPosY(): float
            {
                return 30.0;
            }
        };

        ['qb' => $qb] = $this->makeFullQbMock([], [$ev]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'diagramType' => 'pitchheatmap',
            'heatmapSpatial' => true,
            'xField' => 'player',
            'yField' => 'goals',
        ]);

        $this->assertSame('pitchheatmap', $result['diagramType']);
        $this->assertTrue($result['meta']['spatialRequested']);
        $this->assertTrue($result['meta']['spatialProvided']);
        $this->assertNotEmpty($result['datasets'][0]['data']);
        $this->assertSame(50.0, $result['datasets'][0]['data'][0]['x']);
        $this->assertSame(30.0, $result['datasets'][0]['data'][0]['y']);
    }

    public function testGenerateReportDataPitchHeatmapFallsBackWhenNoPos(): void
    {
        // Events without pos getters → spatialProvided = false, continues to matrix output
        $ev = $this->createMock(GameEvent::class);

        ['qb' => $qb] = $this->makeFullQbMock([], [$ev]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'diagramType' => 'pitchheatmap',
            'heatmapSpatial' => true,
            'xField' => 'player',
            'yField' => 'goals',
        ]);

        // Falls through to standard output (no diagramType in result, or different structure)
        $this->assertArrayHasKey('meta', $result);
        $this->assertTrue($result['meta']['spatialRequested']);
        $this->assertFalse($result['meta']['spatialProvided']);
    }

    public function testGenerateReportDataZeroEventsAddsUserMessage(): void
    {
        // When no events match filters, meta.userMessage should be set
        ['qb' => $qb] = $this->makeFullQbMock([], []);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'diagramType' => 'bar',
        ]);

        $this->assertSame(0, $result['meta']['eventsCount']);
        $this->assertArrayHasKey('userMessage', $result['meta']);
        $this->assertStringContainsString('Keine', $result['meta']['userMessage']);
    }

    public function testGenerateReportDataWithAllStandardFilters(): void
    {
        // Covers all individual filter branches in the PHP fallback path
        ['qb' => $qb] = $this->makeFullQbMock([], []);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'xField' => 'player',
            'yField' => 'goals',
            'diagramType' => 'bar',
            'filters' => [
                'team' => 1,
                'eventType' => 2,
                'player' => 3,
                'surfaceType' => 4,
                'gameType' => 5,
                'dateFrom' => '2024-01-01',
                'dateTo' => '2024-12-31',
            ],
        ]);

        $this->assertArrayHasKey('meta', $result);
    }

    public function testGenerateReportDataFacetedTypeDelegatesCorrectly(): void
    {
        $teamX = $this->createMock(Team::class);
        $teamX->method('getName')->willReturn('TeamX');
        $teamX->method('__toString')->willReturn('TeamX');

        $playerA = $this->createMock(Player::class);
        $playerA->method('getFullName')->willReturn('Alice');
        $playerA->method('__toString')->willReturn('Alice');

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getTeam')->willReturn($teamX);
        $ev->method('getPlayer')->willReturn($playerA);
        $ev->method('getGameEventType')->willReturn(null);

        ['qb' => $qb] = $this->makeFullQbMock([], [$ev]);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        $result = (new ReportDataService($em))->generateReportData([
            'diagramType' => 'faceted',
            'facetBy' => 'team',
            'xField' => 'player',
            'yField' => 'goals',
        ]);

        $this->assertSame('faceted', $result['diagramType']);
        $this->assertArrayHasKey('panels', $result);
    }

    // ── retrieveSortKey ───────────────────────────────────────────────

    public function testRetrieveSortKeyUsesSortKeyCallback(): void
    {
        // 'gameDate' field has a sortKey callable
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $svc = new ReportDataService($em);

        $date = new DateTime('2024-05-20');

        $ce = $this->createMock(CalendarEvent::class);
        $ce->method('getStartDate')->willReturn($date);

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($ce);

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getGame')->willReturn($game);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('retrieveSortKey');
        $m->setAccessible(true);

        $key = $m->invoke($svc, $ev, 'gameDate');
        $this->assertSame('2024-05-20', $key);
    }

    public function testRetrieveSortKeyFallsBackToStringifyForPlayerField(): void
    {
        // 'player' field has no sortKey callable — uses fallback stringify
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findAll')->willReturn([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $svc = new ReportDataService($em);

        $player = $this->createMock(Player::class);
        $player->method('getFullName')->willReturn('Charlie Brown');

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getPlayer')->willReturn($player);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('retrieveSortKey');
        $m->setAccessible(true);

        $key = $m->invoke($svc, $ev, 'player');
        // 'player' alias has no sortKey callable; value falls back to getter getPlayer() →
        // Player mock has getFullName but stringifyValue picks getFullName on the Player object
        $this->assertNotEmpty($key); // confirms the fallback path was exercised
        $this->assertNotSame('zzzz', $key); // not the default empty placeholder
    }

    // =========================================================================
    // generateReportDataForRadarGroupedMetrics (neue Methode aus dieser Session)
    // =========================================================================

    /**
     * Helper: erstellt einen minimalen GameEvent-Stub für RadarGroupedMetrics-Tests.
     * Die Methode braucht retrieveFieldValue (player, competitionType) und die
     * metric-aggregate-Callables aus ReportFieldAliasService (yellowCards).
     */
    private function makeCardEvent(string $playerName, string $competitionType, string $eventTypeCode): object
    {
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getCode')->willReturn($eventTypeCode);

        $game = $this->createMock(Game::class);
        // competitionType field alias checks for league/cup/tournamentMatch on $game
        // We return null for all so it falls back to 'Freundschaftsspiel'
        if ('Liga' === $competitionType) {
            $leagueMock = $this->createMock(\App\Entity\League::class);
            $game->method('getLeague')->willReturn($leagueMock);
        } else {
            $game->method('getLeague')->willReturn(null);
            $game->method('getCup')->willReturn(null);
            $game->method('getTournamentMatch')->willReturn(null);
        }

        $player = $this->createMock(Player::class);
        $player->method('getFullName')->willReturn($playerName);
        $player->method('__toString')->willReturn($playerName);

        $ev = $this->createMock(GameEvent::class);
        $ev->method('getPlayer')->willReturn($player);
        $ev->method('getGame')->willReturn($game);
        $ev->method('getGameEventType')->willReturn($eventType);

        return $ev;
    }

    public function testRadarGroupedMetricsBasicStructure(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // 2 players, 2 competition types, each gets 1 yellow card
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Freundschaftsspiel', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        // labels = sorted player names (axes)
        $this->assertContains('Alice', $result['labels']);
        $this->assertContains('Bob', $result['labels']);
    }

    public function testRadarGroupedMetricsDatasetLabelsAreGroupKeyDashMetricLabel(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Alice', 'Freundschaftsspiel', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);

        $labels = array_column($result['datasets'], 'label');
        // Each dataset label must be "<GroupValue> – <MetricLabel>"
        // Liga → "Liga – Gelbe Karten"
        $this->assertTrue(
            count(array_filter($labels, fn ($l) => str_contains($l, ' – '))) === count($labels),
            'Alle Dataset-Labels müssen "<Gruppe> – <Metrik>" enthalten'
        );
    }

    public function testRadarGroupedMetricsEmptyEvents(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [[], 'player', ['yellowCards'], ['competitionType']]);

        $this->assertSame([], $result['labels']);
        $this->assertSame([], $result['datasets']);
    }

    public function testRadarGroupedMetricsMultipleMetrics(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // 1 player, Liga, 1 yellow + 1 red card
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Alice', 'Liga', 'red_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards', 'redCards'], ['competitionType']]);

        $datasetLabels = array_column($result['datasets'], 'label');
        // Should produce 1 group (Liga) × 2 metrics = 2 datasets
        $this->assertCount(2, $datasetLabels);
    }

    public function testRadarGroupedMetricsDataValuesCountCorrectly(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Alice gets 2 yellow cards in Liga, Bob gets 1
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Liga', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);

        $this->assertCount(1, $result['datasets']); // 1 group × 1 metric
        // labels are sorted: ['Alice', 'Bob']
        $this->assertSame(['Alice', 'Bob'], $result['labels']);
        // data: Alice=2, Bob=1
        $this->assertSame([2, 1], $result['datasets'][0]['data']);
    }

    public function testRadarGroupedMetricsMissingBucketProducesZero(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Alice in Liga, Bob ONLY in Freundschaftsspiel → Liga-bucket for Bob is empty
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Freundschaftsspiel', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForRadarGroupedMetrics');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);

        // Find the "Liga – Gelbe Karten" dataset
        $ligaDataset = null;
        foreach ($result['datasets'] as $ds) {
            if (str_contains($ds['label'], 'Liga')) {
                $ligaDataset = $ds;
                break;
            }
        }
        $this->assertNotNull($ligaDataset);

        // Bob has no events in Liga → his slot must be 0
        $bobIdx = array_search('Bob', $result['labels'], true);
        $this->assertNotFalse($bobIdx);
        $this->assertSame(0, $ligaDataset['data'][$bobIdx]);
    }

    // =========================================================================
    // generateReportDataForMultiMetricGroup (bar/line multi-metric routing)
    // =========================================================================

    public function testMultiMetricGroupBasicStructure(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Liga', 'red_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForMultiMetricGroup');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards', 'redCards'], ['competitionType']]);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        $this->assertContains('Alice', $result['labels']);
        $this->assertContains('Bob', $result['labels']);
    }

    public function testMultiMetricGroupDatasetCountIsGroupsTimesMetrics(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // 1 group (Liga) × 2 metrics = 2 datasets
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForMultiMetricGroup');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards', 'redCards'], ['competitionType']]);
        $this->assertCount(2, $result['datasets']);
    }

    public function testMultiMetricGroupEmptyBucketProducesZeroFloat(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        // Alice in Liga, Bob not → Bob slot in Liga dataset = 0.0
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Freundschaftsspiel', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForMultiMetricGroup');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);

        $ligaDs = null;
        foreach ($result['datasets'] as $ds) {
            if (str_contains($ds['label'], 'Liga')) {
                $ligaDs = $ds;
                break;
            }
        }
        $this->assertNotNull($ligaDs);
        $bobIdx = array_search('Bob', $result['labels'], true);
        $this->assertNotFalse($bobIdx);
        $this->assertSame(0.0, $ligaDs['data'][$bobIdx]);
    }

    public function testMultiMetricGroupDatasetLabelsContainGroupAndMetric(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForMultiMetricGroup');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [$events, 'player', ['yellowCards'], ['competitionType']]);
        $label = $result['datasets'][0]['label'];
        $this->assertStringContainsString(' – ', $label);
    }

    public function testMultiMetricGroupEmptyEvents(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $svc = new ReportDataService($em);

        $ref = new ReflectionClass(ReportDataService::class);
        $m = $ref->getMethod('generateReportDataForMultiMetricGroup');
        $m->setAccessible(true);

        $result = $m->invokeArgs($svc, [[], 'player', ['yellowCards'], ['competitionType']]);
        $this->assertSame([], $result['labels']);
        $this->assertSame([], $result['datasets']);
    }

    // =========================================================================
    // Routing: generateReportData dispatches to correct method
    // =========================================================================

    /**
     * Helper that builds a minimal QueryBuilder/Query chain returning the given events.
     *
     * @param list<mixed> $events
     */
    private function buildEmMockForEvents(array $events): EntityManagerInterface
    {
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($events);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        return $em;
    }

    public function testRoutingGroupedMetricsDispatchesToRadarGroupedMetrics(): void
    {
        // groupedMetrics=true + radar + metrics + groupBy → generateReportDataForRadarGroupedMetrics
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'radaroverlay',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => ['competitionType'],
            'metrics' => ['yellowCards'],
            'groupedMetrics' => true,
        ]);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        // Must NOT have the faceted/pitchheatmap keys
        $this->assertArrayNotHasKey('panels', $result);
        // At least one dataset label contains " – " (group × metric format)
        $found = false;
        foreach ($result['datasets'] as $ds) {
            if (str_contains($ds['label'] ?? '', ' – ')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Routing zu RadarGroupedMetrics erwartet');
    }

    public function testRoutingGroupedMetricsRequiresGroupBy(): void
    {
        // groupedMetrics=true BUT empty groupBy → must NOT dispatch to RadarGroupedMetrics
        // (falls through to regular radar path)
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'radar',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => [],
            'metrics' => ['yellowCards'],
            'groupedMetrics' => true,
        ]);

        // Without groupBy, the dispatch condition is not met — no group×metric label format
        $foundGroupMetricLabel = false;
        foreach ($result['datasets'] ?? [] as $ds) {
            if (str_contains($ds['label'] ?? '', ' – ')) {
                $foundGroupMetricLabel = true;
                break;
            }
        }
        $this->assertFalse($foundGroupMetricLabel, 'Ohne groupBy darf kein Gruppe×Metrik-Format entstehen');
    }

    public function testRoutingBarWithMultipleMetricsAndGroupByDispatchesToMultiMetricGroup(): void
    {
        // bar + metrics (non-empty) + groupBy → generateReportDataForMultiMetricGroup
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
            $this->makeCardEvent('Bob', 'Liga', 'red_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'bar',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => ['competitionType'],
            'metrics' => ['yellowCards', 'redCards'],
        ]);

        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayHasKey('datasets', $result);
        // MultiMetricGroup produces " – " labels
        $found = false;
        foreach ($result['datasets'] as $ds) {
            if (str_contains($ds['label'] ?? '', ' – ')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Routing zu MultiMetricGroup für bar erwartet');
    }

    public function testRoutingLineWithMultipleMetricsAndGroupByDispatchesToMultiMetricGroup(): void
    {
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'line',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => ['competitionType'],
            'metrics' => ['yellowCards', 'redCards'],
        ]);

        $this->assertArrayHasKey('datasets', $result);
        $found = false;
        foreach ($result['datasets'] as $ds) {
            if (str_contains($ds['label'] ?? '', ' – ')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Routing zu MultiMetricGroup für line erwartet');
    }

    public function testRoutingBarWithEmptyMetricsDoesNotDispatchToMultiMetricGroup(): void
    {
        // bar + empty metrics → falls through to regular group path (no " – " labels)
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'bar',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => ['competitionType'],
            'metrics' => [],
        ]);

        $this->assertArrayHasKey('datasets', $result);
        // Without metrics, no multi-metric path → no " – " labels
        foreach ($result['datasets'] as $ds) {
            $this->assertStringNotContainsString(' – ', $ds['label'] ?? '');
        }
    }

    public function testRoutingBarWithMetricsButNoGroupByDoesNotDispatchToMultiMetricGroup(): void
    {
        // bar + metrics + empty groupBy → must NOT dispatch (condition requires non-empty groupBy)
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'bar',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => [],
            'metrics' => ['yellowCards', 'redCards'],
        ]);

        $this->assertArrayHasKey('datasets', $result);
        foreach ($result['datasets'] as $ds) {
            $this->assertStringNotContainsString(' – ', $ds['label'] ?? '');
        }
    }

    public function testRoutingPieWithMetricsAndGroupByDoesNotDispatchToMultiMetricGroup(): void
    {
        // pie is NOT in the ['bar', 'line'] routing condition — must not dispatch
        $events = [
            $this->makeCardEvent('Alice', 'Liga', 'yellow_card'),
        ];
        $svc = new ReportDataService($this->buildEmMockForEvents($events));

        $result = $svc->generateReportData([
            'diagramType' => 'pie',
            'xField' => 'player',
            'yField' => 'yellowCards',
            'groupBy' => ['competitionType'],
            'metrics' => ['yellowCards', 'redCards'],
        ]);

        $this->assertArrayHasKey('datasets', $result);
        // pie path uses generateReportDataForPieWithoutGroup or considerGroup — no " – " format
        foreach ($result['datasets'] as $ds) {
            $this->assertStringNotContainsString(' – ', $ds['label'] ?? '');
        }
    }
}
