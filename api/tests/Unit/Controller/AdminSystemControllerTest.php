<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\AdminSystemController;
use App\Entity\Game;
use App\Repository\GameRepository;
use App\Service\HeartbeatService;
use App\Service\PlayerStatsRecalcService;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;

#[AllowMockObjectsWithoutExpectations]
class AdminSystemControllerTest extends TestCase
{
    private Connection&MockObject $connection;
    private GameRepository&MockObject $gameRepository;
    private PlayerStatsRecalcService&MockObject $recalcService;
    private HeartbeatService&MockObject $heartbeatService;
    private string $projectDir;
    private AdminSystemController $controller;

    protected function setUp(): void
    {
        $this->connection = $this->createMock(Connection::class);
        $this->gameRepository = $this->createMock(GameRepository::class);
        $this->recalcService = $this->createMock(PlayerStatsRecalcService::class);
        $this->heartbeatService = $this->createMock(HeartbeatService::class);
        $this->projectDir = sys_get_temp_dir() . '/admin_sys_test_' . uniqid('', true);

        $this->controller = new AdminSystemController(
            $this->connection,
            $this->gameRepository,
            $this->recalcService,
            $this->heartbeatService,
            $this->projectDir,
        );

        // AbstractController::json() benötigt einen Serializer im Container
        $container = new ContainerBuilder();
        $container->set(
            'serializer',
            new class {
                /** @param array<string, mixed> $context */
                public function serialize(mixed $data, string $format, array $context = []): string
                {
                    return json_encode($data, JSON_THROW_ON_ERROR);
                }
            }
        );
        $this->controller->setContainer($container);
    }

    protected function tearDown(): void
    {
        // Aufräumen: temporäre Backup-Dateien entfernen
        $backupDir = $this->projectDir . '/var/backups';
        if (is_dir($backupDir)) {
            foreach (glob($backupDir . '/*.sql') ?: [] as $file) {
                unlink($file);
            }
            rmdir($backupDir);
        }
        $varDir = $this->projectDir . '/var';
        if (is_dir($varDir)) {
            rmdir($varDir);
        }
        if (is_dir($this->projectDir)) {
            rmdir($this->projectDir);
        }
    }

    // ── gameStats() ──────────────────────────────────────────────────────────

    public function testGameStatsReturnsSummaryAndGames(): void
    {
        $this->connection->method('fetchAssociative')->willReturn([
            'total' => 3,
            'withStats' => 1,
            'withoutStats' => 1,
            'noMatchPlan' => 1,
        ]);
        $this->connection->method('fetchOne')->willReturn(3);
        $this->connection->method('fetchAllAssociative')->willReturn([
            $this->makeRow(id: 1, statsCount: 11, hasMatchPlan: 1),
            $this->makeRow(id: 2, statsCount: 0, hasMatchPlan: 1),
            $this->makeRow(id: 3, statsCount: 0, hasMatchPlan: 0),
        ]);

        $response = $this->controller->gameStats(new Request());

        $this->assertSame(200, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertArrayHasKey('summary', $data);
        $this->assertArrayHasKey('games', $data);
        $this->assertArrayHasKey('pagination', $data);
        $this->assertSame(3, $data['summary']['total']);
        $this->assertSame(1, $data['summary']['withStats']);
        $this->assertSame(1, $data['summary']['withoutStats']);
        $this->assertSame(1, $data['summary']['noMatchPlan']);
        $this->assertCount(3, $data['games']);
        $this->assertSame(3, $data['pagination']['total']);
    }

    public function testGameStatsWithInconsistentOnlyFilterReturnsonlyInconsistentGames(): void
    {
        $this->connection->method('fetchAssociative')->willReturn([
            'total' => 2,
            'withStats' => 1,
            'withoutStats' => 1,
            'noMatchPlan' => 0,
        ]);
        $this->connection->method('fetchOne')->willReturn(1);
        // fetchAllAssociative liefert nur die inkonsistente Zeile (Backend filtert per HAVING)
        $this->connection->method('fetchAllAssociative')->willReturn([
            $this->makeRow(id: 2, statsCount: 0, hasMatchPlan: 1),
        ]);

        $request = new Request(['filter' => 'withoutStats']);
        $response = $this->controller->gameStats($request);

        $data = $this->decodeResponse($response);
        $this->assertSame(2, $data['summary']['total']);
        $this->assertCount(1, $data['games']);
        $this->assertSame(2, $data['games'][0]['id']);
        $this->assertTrue($data['games'][0]['isInconsistent']);
        $this->assertSame(1, $data['pagination']['total']);
    }

    public function testGameStatsInconsistentFlagIsSetCorrectly(): void
    {
        $this->connection->method('fetchAssociative')->willReturn([
            'total' => 3,
            'withStats' => 1,
            'withoutStats' => 1,
            'noMatchPlan' => 1,
        ]);
        $this->connection->method('fetchOne')->willReturn(3);
        $this->connection->method('fetchAllAssociative')->willReturn([
            $this->makeRow(id: 1, statsCount: 5, hasMatchPlan: 1),  // kein Fehler
            $this->makeRow(id: 2, statsCount: 0, hasMatchPlan: 1),  // inkonsistent
            $this->makeRow(id: 3, statsCount: 0, hasMatchPlan: 0),  // kein MatchPlan
        ]);

        $data = $this->decodeResponse($this->controller->gameStats(new Request()));
        $games = array_column($data['games'], null, 'id');

        $this->assertFalse($games[1]['isInconsistent']);
        $this->assertTrue($games[2]['isInconsistent']);
        $this->assertFalse($games[3]['isInconsistent']);
    }

    // ── recalcAll() ──────────────────────────────────────────────────────────

    public function testRecalcAllReturnsNoGamesMessageWhenNoneInconsistent(): void
    {
        $this->connection->method('fetchFirstColumn')->willReturn([]);
        $this->recalcService->expects($this->never())->method('recalcForGame');

        $data = $this->decodeResponse($this->controller->recalcAll());

        $this->assertSame(0, $data['processed']);
        $this->assertSame(0, $data['failed']);
    }

    public function testRecalcAllProcessesInconsistentGames(): void
    {
        $game1 = $this->makeGame(1);
        $game2 = $this->makeGame(2);

        $this->connection->method('fetchFirstColumn')->willReturn([1, 2]);
        $this->gameRepository->method('findBy')->willReturn([$game1, $game2]);
        $this->recalcService->expects($this->exactly(2))->method('recalcForGame');

        $data = $this->decodeResponse($this->controller->recalcAll());

        $this->assertSame(2, $data['processed']);
        $this->assertSame(0, $data['failed']);
        $this->assertSame([], $data['errors']);
    }

    public function testRecalcAllCountsFailedGames(): void
    {
        $game1 = $this->makeGame(1);
        $game2 = $this->makeGame(2);

        $this->connection->method('fetchFirstColumn')->willReturn([1, 2]);
        $this->gameRepository->method('findBy')->willReturn([$game1, $game2]);
        $this->recalcService->method('recalcForGame')
            ->willReturnCallback(static function (Game $game): void {
                if (2 === $game->getId()) {
                    throw new RuntimeException('Recalc-Fehler');
                }
            });

        $data = $this->decodeResponse($this->controller->recalcAll());

        $this->assertSame(1, $data['processed']);
        $this->assertSame(1, $data['failed']);
        $this->assertCount(1, $data['errors']);
        $this->assertSame(2, $data['errors'][0]['gameId']);
    }

    // ── recalcSingle() ───────────────────────────────────────────────────────

    public function testRecalcSingleReturns404WhenGameNotFound(): void
    {
        $this->gameRepository->method('find')->willReturn(null);

        $response = $this->controller->recalcSingle(99);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testRecalcSingleSucceeds(): void
    {
        $game = $this->makeGame(42);
        $this->gameRepository->method('find')->with(42)->willReturn($game);
        $this->recalcService->expects($this->once())->method('recalcForGame')->with($game);

        $response = $this->controller->recalcSingle(42);

        $this->assertSame(200, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertTrue($data['success']);
        $this->assertSame(42, $data['gameId']);
    }

    public function testRecalcSingleReturns500OnException(): void
    {
        $game = $this->makeGame(5);
        $this->gameRepository->method('find')->willReturn($game);
        $this->recalcService->method('recalcForGame')->willThrowException(new RuntimeException('boom'));

        $response = $this->controller->recalcSingle(5);

        $this->assertSame(500, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertSame('boom', $data['error']);
    }

    // ── cronStatus() ─────────────────────────────────────────────────────────

    public function testCronStatusReturnsAllKnownJobs(): void
    {
        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        $data = $this->decodeResponse($this->controller->cronStatus());

        $this->assertArrayHasKey('jobs', $data);
        $this->assertCount(7, $data['jobs']);
    }

    public function testCronStatusReturnsUnknownWhenNoHeartbeat(): void
    {
        $this->heartbeatService->method('getLastBeat')->willReturn(null);

        $data = $this->decodeResponse($this->controller->cronStatus());
        $statuses = array_column($data['jobs'], 'status');

        foreach ($statuses as $status) {
            $this->assertSame('unknown', $status);
        }
    }

    public function testCronStatusReturnsOkForFreshHeartbeat(): void
    {
        // Jeder Job soll einen gerade eben aktuellen Heartbeat haben
        $freshBeat = new DateTimeImmutable('now');
        $this->heartbeatService->method('getLastBeat')->willReturn($freshBeat);

        $data = $this->decodeResponse($this->controller->cronStatus());

        foreach ($data['jobs'] as $job) {
            if (null !== $job['maxAgeMin']) {
                $this->assertSame('ok', $job['status'], $job['command'] . ' sollte ok sein');
            }
        }
    }

    public function testCronStatusReturnsLateWhenHeartbeatIsStale(): void
    {
        // Sehr alter Heartbeat: 10 Tage in der Vergangenheit → alle with maxAgeMin sind late
        $staleBeat = new DateTimeImmutable('-10 days');
        $this->heartbeatService->method('getLastBeat')->willReturn($staleBeat);

        $data = $this->decodeResponse($this->controller->cronStatus());

        foreach ($data['jobs'] as $job) {
            if (null !== $job['maxAgeMin']) {
                $this->assertSame('late', $job['status'], $job['command'] . ' sollte late sein');
            }
        }
    }

    public function testCronStatusManualJobIsOkEvenWhenStale(): void
    {
        // app:recalc-player-stats hat maxAgeMin=null → immer ok, nie late
        $staleBeat = new DateTimeImmutable('-30 days');
        $this->heartbeatService->method('getLastBeat')->willReturn($staleBeat);

        $data = $this->decodeResponse($this->controller->cronStatus());
        $manualJob = null;

        foreach ($data['jobs'] as $job) {
            if ('app:recalc-player-stats' === $job['command']) {
                $manualJob = $job;
                break;
            }
        }

        $this->assertNotNull($manualJob);
        $this->assertNull($manualJob['maxAgeMin']);
        $this->assertSame('ok', $manualJob['status']);
    }

    // ── listBackups() ────────────────────────────────────────────────────────

    public function testListBackupsReturnsEmptyArrayWhenDirDoesNotExist(): void
    {
        $data = $this->decodeResponse($this->controller->listBackups());

        $this->assertArrayHasKey('backups', $data);
        $this->assertSame([], $data['backups']);
    }

    public function testListBackupsReturnsSqlFilesOnly(): void
    {
        $backupDir = $this->projectDir . '/var/backups';
        mkdir($backupDir, 0750, true);
        file_put_contents($backupDir . '/backup_mydb_20251201_120000.sql', '-- SQL');
        file_put_contents($backupDir . '/ignored.txt', 'not a backup');

        $data = $this->decodeResponse($this->controller->listBackups());

        $this->assertCount(1, $data['backups']);
        $this->assertSame('backup_mydb_20251201_120000.sql', $data['backups'][0]['filename']);
    }

    public function testListBackupsSortsByDateDescending(): void
    {
        $backupDir = $this->projectDir . '/var/backups';
        mkdir($backupDir, 0750, true);

        $old = $backupDir . '/backup_db_20250101_000000.sql';
        $new = $backupDir . '/backup_db_20251201_000000.sql';
        file_put_contents($old, '-- old');
        sleep(1); // mtime muss sich unterscheiden
        file_put_contents($new, '-- new');

        $data = $this->decodeResponse($this->controller->listBackups());

        $this->assertCount(2, $data['backups']);
        // Neuere Datei zuerst (sortiert nach createdAt desc)
        $this->assertSame('backup_db_20251201_000000.sql', $data['backups'][0]['filename']);
    }

    // ── createBackup() ───────────────────────────────────────────────────────

    public function testCreateBackupReturns500WhenDbnameIsEmpty(): void
    {
        $this->connection->method('getParams')->willReturn([
            'host' => 'localhost',
            'port' => '3306',
            'dbname' => '',
            'user' => 'root',
            'password' => 'secret',
        ]);

        $response = $this->controller->createBackup();

        $this->assertSame(500, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertArrayHasKey('error', $data);
    }

    public function testCreateBackupReturns500WhenDbnameIsEmptyInUrlParams(): void
    {
        // Simuliert DATABASE_URL-Konfiguration ohne separate host/dbname-Keys
        $this->connection->method('getParams')->willReturn([
            'url' => 'mysql://root:secret@localhost:3306/',
            'driver' => 'pdo_mysql',
        ]);

        $response = $this->controller->createBackup();

        $this->assertSame(500, $response->getStatusCode());
    }

    // ── runCronJob() ─────────────────────────────────────────────────────────

    public function testRunCronJobReturns400ForUnknownCommand(): void
    {
        $request = Request::create('/api/admin/system/cron/run', 'POST', [], [], [], [], json_encode(['command' => 'app:unknown-command'], JSON_THROW_ON_ERROR));
        $request->headers->set('Content-Type', 'application/json');

        $response = $this->controller->runCronJob($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertStringContainsString('Unbekannter Cron-Job', $data['error']);
    }

    public function testRunCronJobReturns400WhenCommandIsEmpty(): void
    {
        $request = Request::create('/api/admin/system/cron/run', 'POST', [], [], [], [], json_encode(['command' => ''], JSON_THROW_ON_ERROR));
        $request->headers->set('Content-Type', 'application/json');

        $response = $this->controller->runCronJob($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ── restoreBackup() ──────────────────────────────────────────────────────

    public function testRestoreBackupReturns400ForInvalidFilename(): void
    {
        $response = $this->controller->restoreBackup('../etc/passwd');

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testRestoreBackupReturns400ForFilenameWithoutBackupPrefix(): void
    {
        $response = $this->controller->restoreBackup('evil_injection.sql');

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testRestoreBackupReturns404WhenFileDoesNotExist(): void
    {
        $response = $this->controller->restoreBackup('backup_missingdb_20251201_120000.sql');

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testRestoreBackupSucceedsWithValidSqlFile(): void
    {
        // Backup-Datei anlegen (gültiges SQL)
        $backupDir = $this->projectDir . '/var/backups';
        mkdir($backupDir, 0750, true);
        $filename = 'backup_testdb_20251201_120000.sql';
        file_put_contents($backupDir . '/' . $filename, "-- SQL dump\nSELECT 1;\n");

        $this->connection->expects($this->exactly(3))
            ->method('executeStatement')
            ->willReturnCallback(static function (string $sql): int {
                return 0; // Alle Statements erfolgreich
            });

        $this->connection->expects($this->never())->method('executeQuery');

        $response = $this->controller->restoreBackup($filename);

        $this->assertSame(200, $response->getStatusCode());
    }

    // ── uploadBackup() ───────────────────────────────────────────────────────

    public function testUploadBackupReturns400WhenNoFileProvided(): void
    {
        $request = new Request();

        $response = $this->controller->uploadBackup($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertStringContainsString('Keine Datei', $data['error']);
    }

    public function testUploadBackupReturns400ForNonSqlFile(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'test_') . '.txt';
        file_put_contents($tmpFile, 'not sql');
        $uploadedFile = new UploadedFile($tmpFile, 'backup.txt', 'text/plain', null, true);

        $request = new Request([], [], [], [], ['file' => $uploadedFile]);

        $response = $this->controller->uploadBackup($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertStringContainsString('.sql', $data['error']);

        @unlink($tmpFile);
    }

    public function testUploadBackupSavesSqlFileAndReturnsMetadata(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'test_') . '.sql';
        file_put_contents($tmpFile, '-- SQL dump');
        $uploadedFile = new UploadedFile($tmpFile, 'backup_mydb_20251201_120000.sql', 'application/octet-stream', null, true);

        $request = new Request([], [], [], [], ['file' => $uploadedFile]);

        $response = $this->controller->uploadBackup($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = $this->decodeResponse($response);
        $this->assertSame('backup_mydb_20251201_120000.sql', $data['filename']);
        $this->assertGreaterThan(0, $data['size']);
        $this->assertArrayHasKey('createdAt', $data);
    }

    // ── downloadBackup() ─────────────────────────────────────────────────────

    public function testDownloadBackupReturns400ForInvalidFilename(): void
    {
        $response = $this->controller->downloadBackup('../etc/passwd');

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDownloadBackupReturns400ForFilenameWithoutBackupPrefix(): void
    {
        $response = $this->controller->downloadBackup('evil_injection.sql');

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDownloadBackupReturns404WhenFileDoesNotExist(): void
    {
        $response = $this->controller->downloadBackup('backup_missingdb_20251201_120000.sql');

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testDownloadBackupReturnsBinaryFileResponseForValidFile(): void
    {
        $backupDir = $this->projectDir . '/var/backups';
        mkdir($backupDir, 0750, true);
        $filename = 'backup_testdb_20251201_120000.sql';
        file_put_contents($backupDir . '/' . $filename, '-- SQL dump');

        $response = $this->controller->downloadBackup($filename);

        $this->assertInstanceOf(BinaryFileResponse::class, $response);
    }

    // ── Hilfsmethoden ────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function decodeResponse(\Symfony\Component\HttpFoundation\JsonResponse|\Symfony\Component\HttpFoundation\Response $response): array
    {
        return json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
    }

    private function makeGame(int $id): Game&MockObject
    {
        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn($id);

        return $game;
    }

    /**
     * @return array<string, mixed>
     */
    private function makeRow(int $id, int $statsCount, int $hasMatchPlan): array
    {
        return [
            'id' => $id,
            'matchDay' => 'Spieltag ' . $id,
            'scheduledAt' => '2025-10-0' . $id . ' 15:00:00',
            'homeTeam' => 'FC Home',
            'awayTeam' => 'FC Away',
            'homeScore' => 2,
            'awayScore' => 1,
            'statsCount' => $statsCount,
            'hasMatchPlan' => $hasMatchPlan,
        ];
    }
}
