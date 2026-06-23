<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\ProcessHistoricalXpCommand;
use App\Entity\XpRule;
use App\Repository\XpRuleRepository;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * @covers \App\Command\ProcessHistoricalXpCommand
 */
#[AllowMockObjectsWithoutExpectations]
class ProcessHistoricalXpCommandTest extends TestCase
{
    private EntityManagerInterface & MockObject $entityManager;
    private XpRuleRepository & MockObject $xpRuleRepository;
    private Connection & MockObject $connection;

    /** @var list<array{sql: string, params: array<string, mixed>}> */
    private array $executedStatements = [];

    /** @var array<string, list<array<string, mixed>>> */
    private array $fetchResults = [];

    private function buildCommandTester(): CommandTester
    {
        $command = new ProcessHistoricalXpCommand(
            $this->entityManager,
            $this->xpRuleRepository,
        );

        return new CommandTester($command);
    }

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->xpRuleRepository = $this->createMock(XpRuleRepository::class);
        $this->connection = $this->createMock(Connection::class);

        $this->entityManager->method('getConnection')->willReturn($this->connection);
        $this->executedStatements = [];
        $this->fetchResults = [];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeXpRule(string $actionType, int $xpValue): XpRule
    {
        $rule = $this->createMock(XpRule::class);
        $rule->method('getActionType')->willReturn($actionType);
        $rule->method('getXpValue')->willReturn($xpValue);

        return $rule;
    }

    /** @param list<XpRule> $rules */
    private function setupRules(array $rules): void
    {
        $this->xpRuleRepository->method('findBy')->willReturn($rules);
    }

    private function setupFetch(): void
    {
        $this->connection->method('fetchAllAssociative')
            ->willReturnCallback(function (string $sql, array $params = []): array {
                if (str_contains($sql, 'CONCAT(user_id')) {
                    return $this->fetchResults['dedup'] ?? [];
                }
                if (str_contains($sql, 'game_events') && str_contains($sql, 'goal')) {
                    return $this->fetchResults['goals'] ?? [];
                }
                if (str_contains($sql, 'game_events') && str_contains($sql, 'assist')) {
                    return $this->fetchResults['assists'] ?? [];
                }
                if (str_contains($sql, 'game_events')) {
                    return $this->fetchResults['game_events'] ?? [];
                }
                if (str_contains($sql, 'participations')) {
                    return $this->fetchResults['participations'] ?? [];
                }
                if (str_contains($sql, 'is_enabled')) {
                    return $this->fetchResults['profiles'] ?? [];
                }

                return [];
            });
    }

    private function trackStatements(): void
    {
        $this->connection->method('executeStatement')
            ->willReturnCallback(function (string $sql, array $params = []): int {
                $this->executedStatements[] = ['sql' => $sql, 'params' => $params];

                return 1;
            });
    }

    // ── Basic execution ──────────────────────────────────────────────────────

    public function testReturnsSuccessWithNoRules(): void
    {
        $this->setupRules([]);
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testReturnsSuccessWithNoData(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = ['dedup' => [], 'goals' => [], 'assists' => []];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 goals', $tester->getDisplay());
    }

    // ── Deduplication ────────────────────────────────────────────────────────

    public function testSkipsAlreadyProcessedEvents(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [['k' => '1:goal_scored:100']],
            'goals' => [['game_event_id' => 100, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 goals', $tester->getDisplay());
        $inserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'INSERT INTO user_xp_events'));
        $this->assertEmpty($inserts);
    }

    public function testProcessesNewEventsNotInDedupSet(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [['k' => '1:goal_scored:99']],
            'goals' => [['game_event_id' => 100, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 1 goals, awarded 50 XP', $tester->getDisplay());
        $inserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'INSERT INTO user_xp_events'));
        $this->assertNotEmpty($inserts);
    }

    public function testInlineDedupPreventsDuplicatesDuringRun(): void
    {
        $this->setupRules([$this->makeXpRule('game_event', 15)]);
        $this->fetchResults = [
            'dedup' => [],
            'game_events' => [
                ['game_event_id' => 10, 'user_id' => 1],
                ['game_event_id' => 10, 'user_id' => 1],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'game_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 1 game events, awarded 15 XP', $tester->getDisplay());
    }

    // ── Dry-run mode ─────────────────────────────────────────────────────────

    public function testDryRunDoesNotInsertAnything(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [
                ['game_event_id' => 1, 'user_id' => 1],
                ['game_event_id' => 2, 'user_id' => 1],
            ],
            'assists' => [],
        ];
        $this->setupFetch();

        $this->connection->expects($this->never())->method('executeStatement');

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $tester->getDisplay();
        $this->assertStringContainsString('DRY-RUN', $output);
        $this->assertStringContainsString('Processed 2 goals, awarded 100 XP', $output);
    }

    public function testDryRunReportsCorrectXpValues(): void
    {
        $this->setupRules([$this->makeXpRule('game_event', 15)]);
        $this->fetchResults = [
            'dedup' => [],
            'game_events' => [['game_event_id' => 10, 'user_id' => 5]],
        ];
        $this->setupFetch();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'game_events', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('15 XP', $tester->getDisplay());
    }

    // ── Goal processing ──────────────────────────────────────────────────────

    public function testGoalsBatchInsertMultipleEvents(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [
                ['game_event_id' => 1, 'user_id' => 1],
                ['game_event_id' => 2, 'user_id' => 1],
                ['game_event_id' => 3, 'user_id' => 2],
            ],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 3 goals, awarded 150 XP', $tester->getDisplay());

        $inserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'INSERT INTO user_xp_events'));
        $this->assertNotEmpty($inserts);

        $levelUpdates = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'user_levels'));
        $this->assertNotEmpty($levelUpdates);
    }

    // ── Assist processing ────────────────────────────────────────────────────

    public function testAssistsAreProcessedSeparately(): void
    {
        $this->setupRules([
            $this->makeXpRule('goal_scored', 50),
            $this->makeXpRule('goal_assisted', 30),
        ]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [['game_event_id' => 1, 'user_id' => 1]],
            'assists' => [['game_event_id' => 2, 'user_id' => 1]],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $tester->getDisplay();
        $this->assertStringContainsString('Processed 1 goals, awarded 50 XP', $output);
        $this->assertStringContainsString('Processed 1 assists, awarded 30 XP', $output);
    }

    // ── Game events ──────────────────────────────────────────────────────────

    public function testGameEventsAwardCorrectXp(): void
    {
        $this->setupRules([$this->makeXpRule('game_event', 15)]);
        $this->fetchResults = [
            'dedup' => [],
            'game_events' => [
                ['game_event_id' => 10, 'user_id' => 3],
                ['game_event_id' => 11, 'user_id' => 3],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'game_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 2 game events, awarded 30 XP', $tester->getDisplay());
    }

    // ── Calendar events ──────────────────────────────────────────────────────

    /** @return array<string, array{string, string, string}> */
    public static function calendarEventMappingProvider(): array
    {
        return [
            'Training attending → training_attended' => ['attending', 'Training', 'training_attended'],
            'Spiel attending → match_attended' => ['attending', 'Spiel', 'match_attended'],
            'Turnier-Match attending → match_attended' => ['attending', 'Turnier-Match', 'match_attended'],
            'Other attending → calendar_event' => ['attending', 'Vereinsfest', 'calendar_event'],
            'not_attending → participation_response' => ['not_attending', 'Training', 'participation_response'],
            'maybe → participation_response' => ['maybe', 'Training', 'participation_response'],
            'late → participation_response' => ['late', 'Spiel', 'participation_response'],
        ];
    }

    #[DataProvider('calendarEventMappingProvider')]
    public function testCalendarEventActionTypeMapping(string $statusCode, string $eventTypeName, string $expectedAction): void
    {
        $this->setupRules([
            $this->makeXpRule('training_attended', 20),
            $this->makeXpRule('match_attended', 25),
            $this->makeXpRule('calendar_event', 10),
            $this->makeXpRule('participation_response', 5),
        ]);
        $this->fetchResults = [
            'dedup' => [],
            'participations' => [
                [
                    'participation_id' => 1,
                    'user_id' => 1,
                    'event_id' => 100,
                    'status_code' => $statusCode,
                    'event_type_name' => $eventTypeName,
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 1 calendar event participations', $tester->getDisplay());

        $inserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'INSERT INTO user_xp_events'));
        $this->assertNotEmpty($inserts, 'Expected at least one INSERT statement');
        $insertStmt = array_values($inserts)[0];
        $this->assertSame($expectedAction, $insertStmt['params']['at0']);
    }

    public function testCalendarEventUnknownStatusIsSkipped(): void
    {
        $this->setupRules([$this->makeXpRule('training_attended', 20)]);
        $this->fetchResults = [
            'dedup' => [],
            'participations' => [
                [
                    'participation_id' => 1,
                    'user_id' => 1,
                    'event_id' => 100,
                    'status_code' => 'unknown_status',
                    'event_type_name' => 'Training',
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 calendar event', $tester->getDisplay());
    }

    public function testCalendarEventWithZeroXpRuleIsSkipped(): void
    {
        $this->setupRules([]);
        $this->fetchResults = [
            'dedup' => [],
            'participations' => [
                [
                    'participation_id' => 1,
                    'user_id' => 1,
                    'event_id' => 100,
                    'status_code' => 'attending',
                    'event_type_name' => 'Training',
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 calendar event', $tester->getDisplay());
    }

    // ── Profile completeness ─────────────────────────────────────────────────

    public function testProfileFullCompletenessAwardsAllMilestones(): void
    {
        $this->setupRules([
            $this->makeXpRule('profile_completion_25', 10),
            $this->makeXpRule('profile_completion_50', 20),
            $this->makeXpRule('profile_completion_75', 30),
            $this->makeXpRule('profile_completion_100', 50),
        ]);
        $this->fetchResults = [
            'dedup' => [],
            'profiles' => [
                [
                    'id' => 1,
                    'first_name' => 'Max',
                    'last_name' => 'Mustermann',
                    'email' => 'max@example.com',
                    'avatar_filename' => 'avatar.jpg',
                    'height' => 180,
                    'weight' => 75,
                    'shoe_size' => 42,
                    'shirt_size' => 'M',
                    'pants_size' => '32',
                    'relation_count' => 1,
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 4 user profiles, awarded 110 XP', $tester->getDisplay());
    }

    public function testProfilePartialCompletenessAwardsOnlyReachedMilestones(): void
    {
        $this->setupRules([
            $this->makeXpRule('profile_completion_25', 10),
            $this->makeXpRule('profile_completion_50', 20),
            $this->makeXpRule('profile_completion_75', 30),
            $this->makeXpRule('profile_completion_100', 50),
        ]);
        $this->fetchResults = [
            'dedup' => [],
            'profiles' => [
                [
                    'id' => 2,
                    'first_name' => 'Anna',
                    'last_name' => 'Test',
                    'email' => 'anna@example.com',
                    'avatar_filename' => null,
                    'height' => null,
                    'weight' => null,
                    'shoe_size' => null,
                    'shirt_size' => null,
                    'pants_size' => null,
                    'relation_count' => 0,
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        // 3/10 fields set = 30% → milestones 25 reached
        $this->assertStringContainsString('Processed 1 user profiles, awarded 10 XP', $tester->getDisplay());
    }

    public function testProfileAlreadyAwardedMilestonesAreSkipped(): void
    {
        $this->setupRules([
            $this->makeXpRule('profile_completion_25', 10),
            $this->makeXpRule('profile_completion_50', 20),
            $this->makeXpRule('profile_completion_75', 30),
            $this->makeXpRule('profile_completion_100', 50),
        ]);
        $this->fetchResults = [
            'dedup' => [
                ['k' => '1:profile_completion_25:1'],
                ['k' => '1:profile_completion_50:1'],
                ['k' => '1:profile_completion_75:1'],
                ['k' => '1:profile_completion_100:1'],
            ],
            'profiles' => [
                [
                    'id' => 1,
                    'first_name' => 'Max',
                    'last_name' => 'Mustermann',
                    'email' => 'max@example.com',
                    'avatar_filename' => 'a.jpg',
                    'height' => 180,
                    'weight' => 75,
                    'shoe_size' => 42,
                    'shirt_size' => 'M',
                    'pants_size' => '32',
                    'relation_count' => 1,
                ],
            ],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Processed 0 user profiles', $tester->getDisplay());
    }

    // ── Force mode ───────────────────────────────────────────────────────────

    public function testForceModeClearsExistingXpDataBeforeProcessing(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'goals' => [['game_event_id' => 1, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals', '--force' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Force mode', $tester->getDisplay());

        $deleteStatements = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'DELETE FROM user_xp_events'));
        $resetStatements = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'UPDATE user_levels SET xp_total = 0'));
        $this->assertNotEmpty($deleteStatements);
        $this->assertNotEmpty($resetStatements);
    }

    public function testForceModeSkipsDedupLoading(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);

        $fetchCalls = [];
        $this->connection->method('fetchAllAssociative')
            ->willReturnCallback(function (string $sql) use (&$fetchCalls): array {
                $fetchCalls[] = $sql;
                if (str_contains($sql, 'game_events') && str_contains($sql, 'goal')) {
                    return [['game_event_id' => 1, 'user_id' => 1]];
                }

                return [];
            });
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals', '--force' => true]);

        $dedupQueries = array_filter($fetchCalls, fn ($sql) => str_contains($sql, 'CONCAT(user_id'));
        $this->assertEmpty($dedupQueries);
    }

    // ── User ID filtering ────────────────────────────────────────────────────

    public function testUserIdFilterIsPassedToQueries(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);

        $capturedParams = [];
        $this->connection->method('fetchAllAssociative')
            ->willReturnCallback(function (string $sql, array $params) use (&$capturedParams): array {
                $capturedParams[] = $params;

                return [];
            });
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals', '--user-id' => '42']);

        $hasUserFilter = false;
        foreach ($capturedParams as $p) {
            if (isset($p['userId']) && 42 === $p['userId']) {
                $hasUserFilter = true;
                break;
            }
        }
        $this->assertTrue($hasUserFilter, 'Expected user-id filter to be applied to queries');
    }

    // ── Batch size ───────────────────────────────────────────────────────────

    public function testBatchSizeControlsFlushFrequency(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [
                ['game_event_id' => 1, 'user_id' => 1],
                ['game_event_id' => 2, 'user_id' => 1],
                ['game_event_id' => 3, 'user_id' => 1],
                ['game_event_id' => 4, 'user_id' => 1],
                ['game_event_id' => 5, 'user_id' => 1],
            ],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals', '--batch-size' => '2']);

        $this->assertSame(Command::SUCCESS, $tester->getStatusCode());
        // 5 events, batch size 2: flush at [2], [4], final [5] = 3 INSERT batches
        $inserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'INSERT INTO user_xp_events'));
        $this->assertCount(3, $inserts);
    }

    // ── Level recalculation ──────────────────────────────────────────────────

    public function testLevelRecalculationRunsAfterProcessing(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [['game_event_id' => 1, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals']);

        $levelRecalc = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'GREATEST(1, FLOOR(POW'));
        $this->assertNotEmpty($levelRecalc, 'Expected level recalculation SQL to be executed');
    }

    public function testLevelRecalculationSkippedWhenNothingProcessed(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = ['dedup' => [], 'goals' => [], 'assists' => []];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals']);

        $levelRecalc = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'GREATEST(1, FLOOR(POW'));
        $this->assertEmpty($levelRecalc);
    }

    public function testLevelRecalculationSkippedInDryRun(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [['game_event_id' => 1, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();

        $this->connection->expects($this->never())->method('executeStatement');

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals', '--dry-run' => true]);
    }

    // ── XP accumulation per user ─────────────────────────────────────────────

    public function testXpAccumulatesPerUser(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [
                ['game_event_id' => 1, 'user_id' => 1],
                ['game_event_id' => 2, 'user_id' => 1],
                ['game_event_id' => 3, 'user_id' => 2],
            ],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $tester->execute(['--type' => 'goals']);

        $levelUpserts = array_filter($this->executedStatements, fn ($s) => str_contains($s['sql'], 'ON DUPLICATE KEY UPDATE'));
        $levelUpserts = array_values($levelUpserts);

        $this->assertCount(2, $levelUpserts);
        $this->assertSame(1, $levelUpserts[0]['params']['uid']);
        $this->assertSame(100, $levelUpserts[0]['params']['xp']);
        $this->assertSame(2, $levelUpserts[1]['params']['uid']);
        $this->assertSame(50, $levelUpserts[1]['params']['xp']);
    }

    // ── --type=all ───────────────────────────────────────────────────────────

    public function testTypeAllProcessesAllSections(): void
    {
        $this->setupRules([
            $this->makeXpRule('goal_scored', 50),
            $this->makeXpRule('goal_assisted', 30),
            $this->makeXpRule('game_event', 15),
            $this->makeXpRule('training_attended', 20),
            $this->makeXpRule('profile_completion_25', 10),
        ]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [],
            'assists' => [],
            'game_events' => [],
            'participations' => [],
            'profiles' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'all']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $tester->getDisplay();
        $this->assertStringContainsString('Processing Goals', $output);
        $this->assertStringContainsString('Processing Assists', $output);
        $this->assertStringContainsString('Processing Game Events', $output);
        $this->assertStringContainsString('Processing Calendar Event Participations', $output);
        $this->assertStringContainsString('Processing Profile Completeness', $output);
    }

    // ── Error handling ───────────────────────────────────────────────────────

    public function testReturnsFailureOnException(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50), $this->makeXpRule('goal_assisted', 30)]);
        $this->connection->method('fetchAllAssociative')
            ->willReturnCallback(function (string $sql): array {
                if (str_contains($sql, 'CONCAT')) {
                    return [];
                }
                throw new RuntimeException('DB connection lost');
            });
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('DB connection lost', $tester->getDisplay());
    }

    // ── No XP rule for action → skip ─────────────────────────────────────────

    public function testSkipsActionTypeWithNoXpRule(): void
    {
        $this->setupRules([$this->makeXpRule('goal_scored', 50)]);
        $this->fetchResults = [
            'dedup' => [],
            'goals' => [['game_event_id' => 1, 'user_id' => 1]],
            'assists' => [],
        ];
        $this->setupFetch();
        $this->trackStatements();

        $tester = $this->buildCommandTester();
        $exitCode = $tester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $tester->getDisplay();
        $this->assertStringContainsString('No XP rule for goal_assisted', $output);
    }
}
