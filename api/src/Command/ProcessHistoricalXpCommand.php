<?php

declare(strict_types=1);

namespace App\Command;

use App\Repository\XpRuleRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:xp:process-historical',
    description: 'Process historical events and award XP retroactively (optimized batch processing)'
)]
class ProcessHistoricalXpCommand extends Command
{
    private const BATCH_SIZE = 500;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private XpRuleRepository $xpRuleRepository,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('type', 't', InputOption::VALUE_OPTIONAL, 'Type of events to process (goals, game_events, calendar_events, profiles, all)', 'all')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Run without actually awarding XP')
            ->addOption('user-id', 'u', InputOption::VALUE_OPTIONAL, 'Process events only for specific user ID')
            ->addOption('force', 'f', InputOption::VALUE_NONE, 'Force processing even if XP events already exist')
            ->addOption('batch-size', 'b', InputOption::VALUE_OPTIONAL, 'Number of records per batch', (string) self::BATCH_SIZE);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $type = $input->getOption('type');
        $dryRun = $input->getOption('dry-run');
        $userId = $input->getOption('user-id');
        $force = $input->getOption('force');
        $batchSize = (int) $input->getOption('batch-size');

        if ($batchSize < 1) {
            $batchSize = self::BATCH_SIZE;
        }

        if ($dryRun) {
            $io->warning('Running in DRY-RUN mode - no XP will be awarded');
        }

        $io->title('Processing Historical Events and Awarding XP Retroactively');

        // Pre-load XP rules into memory (eliminates thousands of DB queries)
        $xpRules = $this->loadXpRules();
        $io->text(sprintf('Loaded %d XP rules into memory.', count($xpRules)));

        if ($force) {
            $io->warning('Force mode enabled - resetting all XP events and levels.');
            $this->resetAllXpData();
        }

        // Pre-load all existing XP event keys for O(1) deduplication
        $processedKeys = $force ? [] : $this->loadProcessedKeys($userId ? (int) $userId : null);
        $io->text(sprintf('Loaded %d existing XP event keys for deduplication.', count($processedKeys)));

        $totalProcessed = 0;
        $totalXpAwarded = 0;

        try {
            if ('goals' === $type || 'all' === $type) {
                [$processed, $xpAwarded] = $this->processGoalsBatched($io, $dryRun, $userId, $batchSize, $xpRules, $processedKeys);
                $totalProcessed += $processed;
                $totalXpAwarded += $xpAwarded;
                $io->success("Processed {$processed} goals, awarded {$xpAwarded} XP");

                [$processed, $xpAwarded] = $this->processAssistsBatched($io, $dryRun, $userId, $batchSize, $xpRules, $processedKeys);
                $totalProcessed += $processed;
                $totalXpAwarded += $xpAwarded;
                $io->success("Processed {$processed} assists, awarded {$xpAwarded} XP");
            }

            if ('game_events' === $type || 'all' === $type) {
                [$processed, $xpAwarded] = $this->processGameEventsBatched($io, $dryRun, $userId, $batchSize, $xpRules, $processedKeys);
                $totalProcessed += $processed;
                $totalXpAwarded += $xpAwarded;
                $io->success("Processed {$processed} game events, awarded {$xpAwarded} XP");
            }

            if ('calendar_events' === $type || 'all' === $type) {
                [$processed, $xpAwarded] = $this->processCalendarEventsBatched($io, $dryRun, $userId, $batchSize, $xpRules, $processedKeys);
                $totalProcessed += $processed;
                $totalXpAwarded += $xpAwarded;
                $io->success("Processed {$processed} calendar event participations, awarded {$xpAwarded} XP");
            }

            if ('profiles' === $type || 'all' === $type) {
                [$processed, $xpAwarded] = $this->processProfilesBatched($io, $dryRun, $userId, $batchSize, $xpRules, $processedKeys);
                $totalProcessed += $processed;
                $totalXpAwarded += $xpAwarded;
                $io->success("Processed {$processed} user profiles, awarded {$xpAwarded} XP");
            }

            // Recalculate all user levels in bulk
            if (!$dryRun && $totalProcessed > 0) {
                $this->recalculateAllLevels($io);
            }

            $io->success("Total: {$totalProcessed} events processed, {$totalXpAwarded} XP awarded");

            return Command::SUCCESS;
        } catch (Exception $e) {
            $io->error('Error processing historical events: ' . $e->getMessage());

            return Command::FAILURE;
        }
    }

    /**
     * Pre-loads all enabled XP rules keyed by actionType.
     *
     * @return array<string, int>
     */
    private function loadXpRules(): array
    {
        $rules = [];
        foreach ($this->xpRuleRepository->findBy(['enabled' => true]) as $rule) {
            $rules[$rule->getActionType()] = $rule->getXpValue();
        }

        return $rules;
    }

    /**
     * Loads all already-processed XP event keys into a HashSet for O(1) dedup.
     *
     * @return array<string, true>
     */
    private function loadProcessedKeys(?int $userId = null): array
    {
        $conn = $this->entityManager->getConnection();
        $sql = 'SELECT CONCAT(user_id, \':\', action_type, \':\', COALESCE(action_id, 0), \':\', COALESCE(season, \'\')) AS k,
                       CONCAT(user_id, \':\', action_type, \':\', COALESCE(action_id, 0), \':legacy\') AS legacy_k,
                       season
                FROM user_xp_events';
        $params = [];

        if (null !== $userId) {
            $sql .= ' WHERE user_id = :userId';
            $params['userId'] = $userId;
        }

        $rows = $conn->fetchAllAssociative($sql, $params);

        $keys = [];
        foreach ($rows as $row) {
            $keys[$row['k']] = true;
            if (array_key_exists('legacy_k', $row) && null === ($row['season'] ?? null)) {
                $keys[$row['legacy_k']] = true;
            }
        }

        return $keys;
    }

    private function makeKey(int $userId, string $actionType, int $actionId, string $season): string
    {
        return $userId . ':' . $actionType . ':' . $actionId . ':' . $season;
    }

    private function makeLegacyKey(int $userId, string $actionType, int $actionId): string
    {
        return $userId . ':' . $actionType . ':' . $actionId . ':legacy';
    }

    /** @param array<string, int> $xpRules */
    private function getXpForAction(string $actionType, array $xpRules): int
    {
        return $xpRules[$actionType] ?? 0;
    }

    private function resetAllXpData(): void
    {
        $conn = $this->entityManager->getConnection();
        $conn->executeStatement('DELETE FROM user_xp_events');
        $conn->executeStatement('UPDATE user_levels SET xp_total = 0, level = 1, season_xp_total = 0, season_level = 1, season = NULL');
    }

    /**
     * Recalculates all user levels based on xp_total using bulk SQL.
     */
    private function recalculateAllLevels(SymfonyStyle $io): void
    {
        $io->text('Recalculating all user levels...');
        $conn = $this->entityManager->getConnection();

        // Level formula: floor((xp_total / 50) ^ (1/1.5))
        // MySQL: FLOOR(POW(xp_total / 50, 1/1.5))
        $conn->executeStatement('
            UPDATE user_levels
            SET level = GREATEST(1, FLOOR(POW(xp_total / 50.0, 0.6667))),
                season_level = GREATEST(1, FLOOR(POW(season_xp_total / 50.0, 0.6667))),
                updated_at = NOW()
            WHERE xp_total > 0 OR season_xp_total > 0
        ');
    }

    /**
     * Batch-inserts XP events and accumulates XP per user.
     *
     * @param list<array{userId: int, actionType: string, actionId: int, xpValue: int, season: string}> $pendingInserts
     * @param array<int, array{career: int, season: int}>                                               $userXpAccumulator userId => accumulated XP
     */
    private function batchInsertXpEvents(array $pendingInserts, array &$userXpAccumulator): void
    {
        if (empty($pendingInserts)) {
            return;
        }

        $conn = $this->entityManager->getConnection();
        $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

        $values = [];
        $params = [];
        $i = 0;
        foreach ($pendingInserts as $insert) {
            $values[] = "(:u{$i}, :at{$i}, :ai{$i}, :xp{$i}, :s{$i}, 1, :ca{$i})";
            $params["u{$i}"] = $insert['userId'];
            $params["at{$i}"] = $insert['actionType'];
            $params["ai{$i}"] = $insert['actionId'];
            $params["xp{$i}"] = $insert['xpValue'];
            $params["s{$i}"] = $insert['season'];
            $params["ca{$i}"] = $now;

            $userXpAccumulator[$insert['userId']] ??= ['career' => 0, 'season' => 0];
            $userXpAccumulator[$insert['userId']]['career'] += $insert['xpValue'];
            if ($insert['season'] === $this->retrieveCurrentSeason()) {
                $userXpAccumulator[$insert['userId']]['season'] += $insert['xpValue'];
            }
            ++$i;
        }

        $sql = 'INSERT INTO user_xp_events (user_id, action_type, action_id, xp_value, season, is_processed, created_at) VALUES ' . implode(', ', $values);
        $conn->executeStatement($sql, $params);
    }

    /**
     * Bulk-updates user_levels with accumulated XP totals.
     *
     * @param array<int, array{career: int, season: int}> $userXpAccumulator userId => total XP to add
     */
    private function flushXpAccumulator(array &$userXpAccumulator): void
    {
        if (empty($userXpAccumulator)) {
            return;
        }

        $conn = $this->entityManager->getConnection();

        $currentSeason = $this->retrieveCurrentSeason();

        foreach ($userXpAccumulator as $userId => $xp) {
            $conn->executeStatement(
                'INSERT INTO user_levels (user_id, xp_total, level, season_xp_total, season_level, season, updated_at)
                 VALUES (:uid, :xp, 1, :seasonXp, 1, :season, NOW())
                 ON DUPLICATE KEY UPDATE
                    xp_total = xp_total + :xp2,
                    season_xp_total = CASE WHEN season = :season2 THEN season_xp_total + :seasonXp2 ELSE :seasonXp3 END,
                    season = CASE WHEN season = :season3 THEN season ELSE :season4 END,
                    updated_at = NOW()',
                [
                    'uid' => $userId,
                    'xp' => $xp['career'],
                    'xp2' => $xp['career'],
                    'seasonXp' => $xp['season'],
                    'seasonXp2' => $xp['season'],
                    'seasonXp3' => $xp['season'],
                    'season' => $currentSeason,
                    'season2' => $currentSeason,
                    'season3' => $currentSeason,
                    'season4' => $currentSeason,
                ]
            );
        }

        $userXpAccumulator = [];
    }

    /**
     * @param array<string, int>  $xpRules
     * @param array<string, true> $processedKeys
     *
     * @return array{int, int} [processed, xpAwarded]
     */
    private function processGoalsBatched(SymfonyStyle $io, bool $dryRun, ?string $userId, int $batchSize, array $xpRules, array &$processedKeys): array
    {
        $io->section('Processing Goals');
        $xp = $this->getXpForAction('goal_scored', $xpRules);
        if (0 === $xp) {
            $io->text('No XP rule for goal_scored, skipping.');

            return [0, 0];
        }

        $conn = $this->entityManager->getConnection();
        $sql = '
            SELECT ge.id AS game_event_id, u.id AS user_id, COALESCE(ce.start_date, ge.timestamp) AS event_date
            FROM game_events ge
            INNER JOIN games g ON ge.game_id = g.id
            LEFT JOIN calendar_events ce ON g.calendar_event_id = ce.id
            INNER JOIN players p ON ge.player_id = p.id
            INNER JOIN game_event_types get ON ge.game_event_type_id = get.id
            INNER JOIN user_relations ur ON ur.player_id = p.id
            INNER JOIN relation_types rt ON ur.relation_type_id = rt.id AND rt.identifier = \'self_player\'
            INNER JOIN users u ON ur.user_id = u.id
            WHERE (get.code IN (\'goal\') OR get.code LIKE \'%_goal\')
            AND get.code != \'own_goal\'
        ';
        $params = [];
        if ($userId) {
            $sql .= ' AND u.id = :userId';
            $params['userId'] = (int) $userId;
        }
        $sql .= ' ORDER BY ge.id ASC';

        return $this->processBatchedResults($conn, $sql, $params, 'goal_scored', $xp, $batchSize, $dryRun, $io, $processedKeys);
    }

    /**
     * @param array<string, int>  $xpRules
     * @param array<string, true> $processedKeys
     *
     * @return array{int, int}
     */
    private function processAssistsBatched(SymfonyStyle $io, bool $dryRun, ?string $userId, int $batchSize, array $xpRules, array &$processedKeys): array
    {
        $io->section('Processing Assists');
        $xp = $this->getXpForAction('goal_assisted', $xpRules);
        if (0 === $xp) {
            $io->text('No XP rule for goal_assisted, skipping.');

            return [0, 0];
        }

        $conn = $this->entityManager->getConnection();
        $sql = '
            SELECT ge.id AS game_event_id, u.id AS user_id, COALESCE(ce.start_date, ge.timestamp) AS event_date
            FROM game_events ge
            INNER JOIN games g ON ge.game_id = g.id
            LEFT JOIN calendar_events ce ON g.calendar_event_id = ce.id
            INNER JOIN players p ON ge.player_id = p.id
            INNER JOIN game_event_types get ON ge.game_event_type_id = get.id
            INNER JOIN user_relations ur ON ur.player_id = p.id
            INNER JOIN relation_types rt ON ur.relation_type_id = rt.id AND rt.identifier = \'self_player\'
            INNER JOIN users u ON ur.user_id = u.id
            WHERE (get.code IN (\'assist\') OR get.code LIKE \'%_assist\')
        ';
        $params = [];
        if ($userId) {
            $sql .= ' AND u.id = :userId';
            $params['userId'] = (int) $userId;
        }
        $sql .= ' ORDER BY ge.id ASC';

        return $this->processBatchedResults($conn, $sql, $params, 'goal_assisted', $xp, $batchSize, $dryRun, $io, $processedKeys);
    }

    /**
     * @param array<string, int>  $xpRules
     * @param array<string, true> $processedKeys
     *
     * @return array{int, int}
     */
    private function processGameEventsBatched(SymfonyStyle $io, bool $dryRun, ?string $userId, int $batchSize, array $xpRules, array &$processedKeys): array
    {
        $io->section('Processing Game Events');
        $xp = $this->getXpForAction('game_event', $xpRules);
        if (0 === $xp) {
            $io->text('No XP rule for game_event, skipping.');

            return [0, 0];
        }

        $conn = $this->entityManager->getConnection();
        $sql = '
            SELECT ge.id AS game_event_id, u.id AS user_id, COALESCE(ce.start_date, ge.timestamp) AS event_date
            FROM game_events ge
            INNER JOIN games g ON ge.game_id = g.id
            LEFT JOIN calendar_events ce ON g.calendar_event_id = ce.id
            INNER JOIN players p ON ge.player_id = p.id
            INNER JOIN user_relations ur ON ur.player_id = p.id
            INNER JOIN relation_types rt ON ur.relation_type_id = rt.id AND rt.identifier = \'self_player\'
            INNER JOIN users u ON ur.user_id = u.id
        ';
        $params = [];
        if ($userId) {
            $sql .= ' WHERE u.id = :userId';
            $params['userId'] = (int) $userId;
        }
        $sql .= ' ORDER BY ge.id ASC';

        return $this->processBatchedResults($conn, $sql, $params, 'game_event', $xp, $batchSize, $dryRun, $io, $processedKeys);
    }

    /**
     * Generic batch processor for simple action types (goals, assists, game events).
     *
     * @param array<string, mixed> $params
     * @param array<string, true>  $processedKeys
     *
     * @return array{int, int}
     */
    private function processBatchedResults(
        Connection $conn,
        string $sql,
        array $params,
        string $actionType,
        int $xp,
        int $batchSize,
        bool $dryRun,
        SymfonyStyle $io,
        array &$processedKeys
    ): array {
        $rows = $conn->fetchAllAssociative($sql, $params);

        $processed = 0;
        $totalXpAwarded = 0;
        $pendingInserts = [];
        $userXpAccumulator = [];

        foreach ($rows as $row) {
            $eventUserId = (int) $row['user_id'];
            $eventId = (int) $row['game_event_id'];
            $season = $this->seasonFromDbValue($row['event_date'] ?? null);
            $key = $this->makeKey($eventUserId, $actionType, $eventId, $season);

            if (isset($processedKeys[$key]) || isset($processedKeys[$this->makeLegacyKey($eventUserId, $actionType, $eventId)])) {
                continue;
            }

            if ($dryRun) {
                $io->writeln("  [DRY-RUN] Would award {$xp} XP ({$actionType}) for event #{$eventId} to user #{$eventUserId}");
            } else {
                $pendingInserts[] = [
                    'userId' => $eventUserId,
                    'actionType' => $actionType,
                    'actionId' => $eventId,
                    'xpValue' => $xp,
                    'season' => $season,
                ];
                $processedKeys[$key] = true;
            }

            $totalXpAwarded += $xp;
            ++$processed;

            if (!$dryRun && count($pendingInserts) >= $batchSize) {
                $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
                $pendingInserts = [];
            }
        }

        if (!$dryRun) {
            $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
            $this->flushXpAccumulator($userXpAccumulator);
        }

        return [$processed, $totalXpAwarded];
    }

    /**
     * @param array<string, int>  $xpRules
     * @param array<string, true> $processedKeys
     *
     * @return array{int, int}
     */
    private function processCalendarEventsBatched(SymfonyStyle $io, bool $dryRun, ?string $userId, int $batchSize, array $xpRules, array &$processedKeys): array
    {
        $io->section('Processing Calendar Event Participations');

        $conn = $this->entityManager->getConnection();
        $sql = '
            SELECT p.id AS participation_id, u.id AS user_id, ce.id AS event_id, ce.start_date AS event_date,
                   ps.code AS status_code, cet.name AS event_type_name
            FROM participations p
            INNER JOIN users u ON p.user_id = u.id
            INNER JOIN calendar_events ce ON p.event_id = ce.id
            INNER JOIN participation_statuses ps ON p.status_id = ps.id
            LEFT JOIN calendar_event_types cet ON ce.calendar_event_type_id = cet.id
        ';
        $params = [];
        if ($userId) {
            $sql .= ' WHERE u.id = :userId';
            $params['userId'] = (int) $userId;
        }
        $sql .= ' ORDER BY p.id ASC';

        $rows = $conn->fetchAllAssociative($sql, $params);

        $processed = 0;
        $totalXpAwarded = 0;
        $pendingInserts = [];
        $userXpAccumulator = [];

        foreach ($rows as $row) {
            $eventUserId = (int) $row['user_id'];
            $eventId = (int) $row['event_id'];
            $season = $this->seasonFromDbValue($row['event_date'] ?? null);
            $statusCode = $row['status_code'];
            $eventTypeName = $row['event_type_name'] ?? '';

            $actionType = $this->resolveCalendarActionType($statusCode, $eventTypeName);
            if (null === $actionType) {
                continue;
            }

            $xp = $this->getXpForAction($actionType, $xpRules);
            if ($xp <= 0) {
                continue;
            }

            $key = $this->makeKey($eventUserId, $actionType, $eventId, $season);
            if (isset($processedKeys[$key]) || isset($processedKeys[$this->makeLegacyKey($eventUserId, $actionType, $eventId)])) {
                continue;
            }

            if ($dryRun) {
                $io->writeln("  [DRY-RUN] Would award {$xp} XP ({$actionType}) for event #{$eventId} to user #{$eventUserId}");
            } else {
                $pendingInserts[] = [
                    'userId' => $eventUserId,
                    'actionType' => $actionType,
                    'actionId' => $eventId,
                    'xpValue' => $xp,
                    'season' => $season,
                ];
                $processedKeys[$key] = true;
            }

            $totalXpAwarded += $xp;
            ++$processed;

            if (!$dryRun && count($pendingInserts) >= $batchSize) {
                $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
                $pendingInserts = [];
            }
        }

        if (!$dryRun) {
            $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
            $this->flushXpAccumulator($userXpAccumulator);
        }

        return [$processed, $totalXpAwarded];
    }

    private function resolveCalendarActionType(string $statusCode, string $eventTypeName): ?string
    {
        if ('attending' === $statusCode) {
            if ('Training' === $eventTypeName) {
                return 'training_attended';
            }
            if (in_array($eventTypeName, ['Spiel', 'Turnier-Match'], true)) {
                return 'match_attended';
            }

            return 'calendar_event';
        }

        if (in_array($statusCode, ['not_attending', 'maybe', 'late'], true)) {
            return 'participation_response';
        }

        return null;
    }

    /**
     * @param array<string, int>  $xpRules
     * @param array<string, true> $processedKeys
     *
     * @return array{int, int}
     */
    private function processProfilesBatched(SymfonyStyle $io, bool $dryRun, ?string $userId, int $batchSize, array $xpRules, array &$processedKeys): array
    {
        $io->section('Processing Profile Completeness');

        $conn = $this->entityManager->getConnection();
        $sql = '
            SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_filename,
                   u.height, u.weight, u.shoe_size, u.shirt_size, u.pants_size,
                   (SELECT COUNT(*) FROM user_relations ur WHERE ur.user_id = u.id) AS relation_count
            FROM users u
            WHERE u.is_enabled = 1
        ';
        $params = [];
        if ($userId) {
            $sql .= ' AND u.id = :userId';
            $params['userId'] = (int) $userId;
        }

        $rows = $conn->fetchAllAssociative($sql, $params);

        $processed = 0;
        $totalXpAwarded = 0;
        $pendingInserts = [];
        $userXpAccumulator = [];
        $milestones = [25, 50, 75, 100];

        foreach ($rows as $row) {
            $profileUserId = (int) $row['id'];
            $completeness = $this->calculateProfileCompletenessFromRow($row);

            foreach ($milestones as $milestone) {
                if ($completeness < $milestone) {
                    continue;
                }

                $actionType = 'profile_completion_' . $milestone;
                $xp = $this->getXpForAction($actionType, $xpRules);
                if ($xp <= 0) {
                    continue;
                }

                $season = $this->retrieveCurrentSeason();
                $key = $this->makeKey($profileUserId, $actionType, $profileUserId, $season);
                if (isset($processedKeys[$key]) || isset($processedKeys[$this->makeLegacyKey($profileUserId, $actionType, $profileUserId)])) {
                    continue;
                }

                if ($dryRun) {
                    $io->writeln("  [DRY-RUN] Would award {$xp} XP ({$actionType}) to user #{$profileUserId}");
                } else {
                    $pendingInserts[] = [
                        'userId' => $profileUserId,
                        'actionType' => $actionType,
                        'actionId' => $profileUserId,
                        'xpValue' => $xp,
                        'season' => $season,
                    ];
                    $processedKeys[$key] = true;
                }

                $totalXpAwarded += $xp;
                ++$processed;

                if (!$dryRun && count($pendingInserts) >= $batchSize) {
                    $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
                    $pendingInserts = [];
                }
            }
        }

        if (!$dryRun) {
            $this->batchInsertXpEvents($pendingInserts, $userXpAccumulator);
            $this->flushXpAccumulator($userXpAccumulator);
        }

        return [$processed, $totalXpAwarded];
    }

    /** @param array<string, mixed> $row */
    private function calculateProfileCompletenessFromRow(array $row): int
    {
        $fields = [
            null !== $row['first_name'] && '' !== $row['first_name'],
            null !== $row['last_name'] && '' !== $row['last_name'],
            null !== $row['email'] && '' !== $row['email'],
            null !== $row['avatar_filename'],
            null !== $row['height'],
            null !== $row['weight'],
            null !== $row['shoe_size'],
            null !== $row['shirt_size'],
            null !== $row['pants_size'],
            (int) $row['relation_count'] > 0,
        ];

        $completed = count(array_filter($fields));

        return (int) round(($completed / count($fields)) * 100);
    }

    private function seasonFromDbValue(mixed $value): string
    {
        if (is_string($value) && '' !== $value) {
            return $this->retrieveCurrentSeason(new DateTimeImmutable($value));
        }

        return $this->retrieveCurrentSeason();
    }

    private function retrieveCurrentSeason(?DateTimeImmutable $date = null): string
    {
        $date ??= new DateTimeImmutable();
        $year = (int) $date->format('Y');
        $month = (int) $date->format('n');
        $startYear = $month >= 7 ? $year : $year - 1;

        return sprintf('%d/%d', $startYear, $startYear + 1);
    }
}
