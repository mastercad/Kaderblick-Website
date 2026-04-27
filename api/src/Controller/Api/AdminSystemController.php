<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Repository\GameRepository;
use App\Service\HeartbeatService;
use App\Service\PlayerStatsRecalcService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Druidfi\Mysqldump\Mysqldump;
use Exception;
use FilesystemIterator;
use SplFileInfo;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/admin/system')]
#[IsGranted('ROLE_SUPERADMIN')]
class AdminSystemController extends AbstractController
{
    /**
     * Bekannte Cron-Jobs und ihr maximales erlaubtes Intervall in Minuten.
     * Spiegelt AppHealthMonitorCommand::EXPECTED_COMMANDS wider.
     */
    private const KNOWN_CRON_JOBS = [
        'app:xp:process-pending' => ['label' => 'XP-Events verarbeiten',         'maxAgeMin' => 60],
        'app:notifications:send-unsent' => ['label' => 'Benachrichtigungen versenden',  'maxAgeMin' => 30],
        'app:surveys:send-reminders' => ['label' => 'Umfrage-Erinnerungen senden',   'maxAgeMin' => 1440],
        'app:collect-weather-data-for-events' => ['label' => 'Wetterdaten abrufen',           'maxAgeMin' => 1440],
        'app:xp:award-titles' => ['label' => 'Titel vergeben',                'maxAgeMin' => 1500],
        'app:health:monitor' => ['label' => 'System-Gesundheitscheck',       'maxAgeMin' => 10],
        'app:recalc-player-stats' => ['label' => 'Spieler-Stats (Backfill)',      'maxAgeMin' => null],
    ];

    public function __construct(
        private readonly Connection $connection,
        private readonly GameRepository $gameRepository,
        private readonly PlayerStatsRecalcService $recalcService,
        private readonly HeartbeatService $heartbeatService,
        private readonly string $projectDir,
    ) {
    }

    // ─── Spielstatistiken ─────────────────────────────────────────────────────

    /**
     * Liefert eine Übersicht abgeschlossener Spiele und ihren Stats-Status.
     *
     * GET /api/admin/system/game-stats
     */
    #[Route('/game-stats', name: 'api_admin_system_game_stats', methods: ['GET'])]
    public function gameStats(Request $request): JsonResponse
    {
        // filter: 'all' | 'withStats' | 'withoutStats' | 'noMatchPlan'
        // withoutStats ist der Default (inkonsistente Spiele)
        $filter = $request->query->get('filter', 'withoutStats');
        if (!in_array($filter, ['all', 'withStats', 'withoutStats', 'noMatchPlan'], true)) {
            $filter = 'withoutStats';
        }

        $perPage = max(1, min(200, (int) $request->query->get('perPage', 25)));
        $page = max(1, (int) $request->query->get('page', 1));
        $offset = ($page - 1) * $perPage;

        // ── Gesamtstatistik (immer alle abgeschlossenen Spiele) ──────────────
        $summaryRow = $this->connection->fetchAssociative(
            'SELECT
                COUNT(*)                                                           AS total,
                SUM(CASE WHEN statsCount > 0 THEN 1 ELSE 0 END)                   AS withStats,
                SUM(CASE WHEN hasMatchPlan = 1 AND statsCount = 0 THEN 1 ELSE 0 END) AS withoutStats,
                SUM(CASE WHEN hasMatchPlan = 0 THEN 1 ELSE 0 END)                 AS noMatchPlan
             FROM (
                 SELECT
                     COUNT(pgs.id)                                          AS statsCount,
                     CASE WHEN g.match_plan IS NOT NULL THEN 1 ELSE 0 END   AS hasMatchPlan
                 FROM games g
                 LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
                 WHERE g.is_finished = 1
                 GROUP BY g.id, g.match_plan
             ) AS agg'
        );

        $summary = [
            'total' => (int) ($summaryRow['total'] ?? 0),
            'withStats' => (int) ($summaryRow['withStats'] ?? 0),
            'withoutStats' => (int) ($summaryRow['withoutStats'] ?? 0),
            'noMatchPlan' => (int) ($summaryRow['noMatchPlan'] ?? 0),
        ];

        // ── HAVING-Bedingung für den aktiven Filter ──────────────────────────
        $having = match ($filter) {
            'withStats' => 'HAVING COUNT(pgs.id) > 0',
            'withoutStats' => 'HAVING g.match_plan IS NOT NULL AND COUNT(pgs.id) = 0',
            'noMatchPlan' => 'HAVING g.match_plan IS NULL',
            default => '',
        };

        // ── Gefilterte Gesamtanzahl (für Pagination-Meta) ────────────────────
        $filteredTotal = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM (
                SELECT g.id
                FROM games g
                LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
                WHERE g.is_finished = 1
                GROUP BY g.id, g.match_plan
                {$having}
             ) AS filtered"
        );

        // ── Paginierte Spielliste ─────────────────────────────────────────────
        $rows = $this->connection->fetchAllAssociative(
            "SELECT
                g.id,
                g.round                                 AS matchDay,
                ce.start_date                           AS scheduledAt,
                ht.name                                 AS homeTeam,
                at.name                                 AS awayTeam,
                g.home_score                            AS homeScore,
                g.away_score                            AS awayScore,
                COUNT(pgs.id)                           AS statsCount,
                CASE WHEN g.match_plan IS NOT NULL THEN 1 ELSE 0 END AS hasMatchPlan
             FROM games g
             LEFT JOIN calendar_events ce ON ce.id = g.calendar_event_id
             LEFT JOIN teams ht ON ht.id = g.home_team_id
             LEFT JOIN teams at ON at.id = g.away_team_id
             LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
             WHERE g.is_finished = 1
             GROUP BY g.id, g.round, ce.start_date, ht.name, at.name,
                      g.home_score, g.away_score, g.match_plan
             {$having}
             ORDER BY ce.start_date DESC
             LIMIT {$perPage} OFFSET {$offset}"
        );

        $games = array_map(static function (array $row): array {
            $statsCount = (int) $row['statsCount'];
            $hasMatchPlan = (bool) $row['hasMatchPlan'];

            return [
                'id' => (int) $row['id'],
                'matchDay' => $row['matchDay'],
                'scheduledAt' => $row['scheduledAt'],
                'homeTeam' => $row['homeTeam'],
                'awayTeam' => $row['awayTeam'],
                'homeScore' => $row['homeScore'],
                'awayScore' => $row['awayScore'],
                'statsCount' => $statsCount,
                'hasMatchPlan' => $hasMatchPlan,
                'isInconsistent' => $hasMatchPlan && 0 === $statsCount,
            ];
        }, $rows);

        return $this->json([
            'summary' => $summary,
            'games' => $games,
            'pagination' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $filteredTotal,
                'totalPages' => (int) ceil($filteredTotal / $perPage),
            ],
        ]);
    }

    /**
     * Berechnet die Stats für alle Spiele neu, die ein matchPlan haben aber keine Stats.
     *
     * POST /api/admin/system/recalc-all
     */
    #[Route('/recalc-all', name: 'api_admin_system_recalc_all', methods: ['POST'])]
    public function recalcAll(): JsonResponse
    {
        $ids = $this->connection->fetchFirstColumn(
            'SELECT g.id
             FROM games g
             WHERE g.is_finished = 1
               AND g.match_plan IS NOT NULL
               AND NOT EXISTS (
                   SELECT 1 FROM player_game_stats pgs WHERE pgs.game_id = g.id
               )'
        );

        if (empty($ids)) {
            return $this->json(['processed' => 0, 'failed' => 0, 'message' => 'Keine Spiele zu verarbeiten.']);
        }

        $games = $this->gameRepository->findBy(['id' => $ids]);
        $ok = 0;
        $failed = 0;
        $errors = [];

        foreach ($games as $game) {
            try {
                $this->recalcService->recalcForGame($game);
                ++$ok;
            } catch (Throwable $e) {
                ++$failed;
                $errors[] = ['gameId' => $game->getId(), 'error' => $e->getMessage()];
            }
        }

        return $this->json(['processed' => $ok, 'failed' => $failed, 'errors' => $errors]);
    }

    /**
     * Berechnet die Stats für ein einzelnes Spiel neu.
     *
     * POST /api/admin/system/recalc/{id}
     */
    #[Route('/recalc/{id}', name: 'api_admin_system_recalc_single', methods: ['POST'])]
    public function recalcSingle(int $id): JsonResponse
    {
        $game = $this->gameRepository->find($id);

        if (null === $game) {
            return $this->json(['error' => 'Spiel nicht gefunden.'], 404);
        }

        try {
            $this->recalcService->recalcForGame($game);
        } catch (Throwable $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }

        return $this->json(['success' => true, 'gameId' => $id]);
    }

    // ─── Cron-Job-Status ─────────────────────────────────────────────────────

    /**
     * Liefert den letzten bekannten Heartbeat aller bekannten Cron-Jobs.
     *
     * GET /api/admin/system/cron-status
     */
    #[Route('/cron-status', name: 'api_admin_system_cron_status', methods: ['GET'])]
    public function cronStatus(): JsonResponse
    {
        $jobs = [];
        $now = new DateTimeImmutable();

        foreach (self::KNOWN_CRON_JOBS as $command => $meta) {
            $lastBeat = $this->heartbeatService->getLastBeat($command);
            $lastError = $this->heartbeatService->getLastError($command);
            $maxAgeMin = $meta['maxAgeMin'];
            $runningState = $this->heartbeatService->getRunningState($command);
            $isRunning = null !== $runningState;

            if ($isRunning) {
                $status = 'running';
                $ageMinutes = null !== $lastBeat
                    ? (int) round(($now->getTimestamp() - $lastBeat->getTimestamp()) / 60)
                    : null;
            } elseif (null !== $lastError) {
                $status = 'error';
                $ageMinutes = null !== $lastBeat
                    ? (int) round(($now->getTimestamp() - $lastBeat->getTimestamp()) / 60)
                    : null;
            } elseif (null === $lastBeat) {
                $status = 'unknown';
                $ageMinutes = null;
            } else {
                $ageMinutes = (int) round(($now->getTimestamp() - $lastBeat->getTimestamp()) / 60);
                $status = (null !== $maxAgeMin && $ageMinutes > $maxAgeMin) ? 'late' : 'ok';
            }

            $jobs[] = [
                'command' => $command,
                'label' => $meta['label'],
                'maxAgeMin' => $maxAgeMin,
                'lastRunAt' => $lastBeat?->format(DateTimeInterface::ATOM),
                'ageMinutes' => $ageMinutes,
                'status' => $status,
                'lastError' => $lastError,
                'running' => $isRunning,
                'runningPid' => $isRunning ? $runningState['pid'] : null,
                'runningStartedAt' => $isRunning
                    ? (new DateTimeImmutable())->setTimestamp($runningState['startedAt'])->format(DateTimeInterface::ATOM)
                    : null,
            ];
        }

        return $this->json(['jobs' => $jobs]);
    }

    // ─── Datenbank-Backup ────────────────────────────────────────────────────

    /**
     * Listet alle vorhandenen Backup-Dateien auf.
     *
     * GET /api/admin/system/backups
     */
    #[Route('/backups', name: 'api_admin_system_backups_list', methods: ['GET'])]
    public function listBackups(): JsonResponse
    {
        $backupDir = $this->getBackupDir();
        $files = [];

        if (is_dir($backupDir)) {
            /** @var SplFileInfo $fileInfo */
            foreach (new FilesystemIterator($backupDir) as $fileInfo) {
                if ($fileInfo->isFile() && 'sql' === $fileInfo->getExtension()) {
                    $files[] = [
                        'filename' => $fileInfo->getFilename(),
                        'size' => $fileInfo->getSize(),
                        'createdAt' => date(DateTimeInterface::ATOM, (int) $fileInfo->getMTime()),
                    ];
                }
            }
        }

        usort($files, static fn ($a, $b) => strcmp($b['createdAt'], $a['createdAt']));

        return $this->json(['backups' => $files]);
    }

    /**
     * Erstellt ein vollständiges MySQL-Backup via mysqldump.
     *
     * POST /api/admin/system/backup
     */
    #[Route('/backup', name: 'api_admin_system_backup_create', methods: ['POST'])]
    public function createBackup(): JsonResponse
    {
        $params = $this->getMysqlParams();
        $dbname = $params['dbname'];

        if ('' === $dbname) {
            return $this->json(['error' => 'Datenbank-Name konnte nicht ermittelt werden.'], 500);
        }

        $backupDir = $this->getBackupDir();
        if (!is_dir($backupDir) && !mkdir($backupDir, 0750, true) && !is_dir($backupDir)) {
            return $this->json(['error' => 'Backup-Verzeichnis konnte nicht erstellt werden.'], 500);
        }

        $filename = sprintf('backup_%s_%s.sql', $dbname, date('Ymd_His'));
        $filepath = $backupDir . '/' . $filename;

        try {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s', $params['host'], $params['port'], $dbname);
            $dump = new Mysqldump($dsn, $params['user'], $params['password'], [
                'add-drop-table' => true,
            ]);
            $dump->start($filepath);
        } catch (Exception $e) {
            return $this->json(['error' => 'Backup fehlgeschlagen: ' . $e->getMessage()], 500);
        }

        return $this->json([
            'filename' => $filename,
            'size' => filesize($filepath),
            'createdAt' => date(DateTimeInterface::ATOM),
        ]);
    }

    /**
     * Lädt eine .sql-Datei als Backup in das Backup-Verzeichnis hoch.
     *
     * POST /api/admin/system/backup/upload
     */
    #[Route('/backup/upload', name: 'api_admin_system_backup_upload', methods: ['POST'])]
    public function uploadBackup(Request $request): JsonResponse
    {
        /** @var \Symfony\Component\HttpFoundation\File\UploadedFile|null $file */
        $file = $request->files->get('file');

        if (null === $file) {
            return $this->json(['error' => 'Keine Datei hochgeladen.'], 400);
        }

        if ('sql' !== strtolower($file->getClientOriginalExtension())) {
            return $this->json(['error' => 'Nur .sql-Dateien sind erlaubt.'], 400);
        }

        // Dateinamen bereinigen: nur alphanumerische Zeichen, Punkte, Bindestriche, Unterstriche
        $safeName = (string) preg_replace('/[^a-zA-Z0-9._-]/', '_', $file->getClientOriginalName());
        if (!str_ends_with($safeName, '.sql')) {
            $safeName .= '.sql';
        }

        $backupDir = $this->getBackupDir();
        if (!is_dir($backupDir) && !mkdir($backupDir, 0750, true) && !is_dir($backupDir)) {
            return $this->json(['error' => 'Backup-Verzeichnis konnte nicht erstellt werden.'], 500);
        }

        $file->move($backupDir, $safeName);

        return $this->json([
            'filename' => $safeName,
            'size' => (int) filesize($backupDir . '/' . $safeName),
            'createdAt' => date(DateTimeInterface::ATOM),
        ]);
    }

    /**
     * Stellt die Datenbank aus einem vorhandenen Backup wieder her.
     *
     * POST /api/admin/system/backup/restore/{filename}
     */
    #[Route('/backup/restore/{filename}', name: 'api_admin_system_backup_restore', methods: ['POST'])]
    public function restoreBackup(string $filename): JsonResponse
    {
        if (!preg_match('/^backup_[\w.-]+\.sql$/', $filename)) {
            return $this->json(['error' => 'Ungültiger Dateiname.'], 400);
        }

        $filepath = $this->getBackupDir() . '/' . $filename;

        if (!is_file($filepath)) {
            return $this->json(['error' => 'Datei nicht gefunden.'], 404);
        }

        $handle = fopen($filepath, 'r');
        if (false === $handle) {
            return $this->json(['error' => 'Backup-Datei konnte nicht geöffnet werden.'], 500);
        }

        try {
            $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=0');

            $statement = '';
            while (($line = fgets($handle)) !== false) {
                $trimmed = trim($line);

                // Reine Kommentarzeilen und Leerzeilen überspringen
                if ('' === $trimmed || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '#')) {
                    continue;
                }

                $statement .= $line;

                // Ein vollständiges Statement endet mit ; am Zeilenende
                if (str_ends_with($trimmed, ';')) {
                    $stmt = trim($statement);
                    if ('' !== $stmt) {
                        $this->connection->executeStatement($stmt);
                    }
                    $statement = '';
                }
            }

            // Verbleibendes Statement ausführen (z.B. ohne abschließendes Semikolon)
            $stmt = trim($statement);
            if ('' !== $stmt) {
                $this->connection->executeStatement($stmt);
            }

            $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=1');
        } catch (Throwable $e) {
            $this->connection->executeStatement('SET FOREIGN_KEY_CHECKS=1');

            return $this->json(['error' => 'Import fehlgeschlagen: ' . $e->getMessage()], 500);
        } finally {
            fclose($handle);
        }

        return $this->json([
            'success' => true,
            'message' => "Backup '{$filename}' erfolgreich wiederhergestellt.",
        ]);
    }

    /**
     * Startet einen bekannten Cron-Job als Hintergrundprozess (non-blocking).
     * Der Heartbeat wird vom AbstractCronCommand am Ende des Prozesses automatisch gesetzt.
     *
     * POST /api/admin/system/cron/run
     */
    #[Route('/cron/run', name: 'api_admin_system_cron_run', methods: ['POST'])]
    public function runCronJob(Request $request): JsonResponse
    {
        /** @var array<string, mixed> $body */
        $body = $request->toArray();
        $command = (string) ($body['command'] ?? '');

        if (!isset(self::KNOWN_CRON_JOBS[$command])) {
            return $this->json(['error' => 'Unbekannter Cron-Job: ' . $command], 400);
        }

        // Verhindere Doppelstart
        if (null !== $this->heartbeatService->getRunningState($command)) {
            return $this->json(['error' => 'Job läuft bereits.'], 409);
        }

        if (!function_exists('exec')) {
            return $this->json(['error' => 'exec() ist in dieser PHP-Umgebung deaktiviert.'], 500);
        }

        $consolePath = $this->projectDir . '/bin/console';
        $logFile = $this->projectDir . '/var/log/cron_manual_' . str_replace(':', '_', $command) . '.log';

        // Hintergrundprozess starten – nohup + & trennt den Prozess vom HTTP-Request.
        // Alle Argumente werden escapeshellarg-gesichert; $command ist zusätzlich gegen
        // KNOWN_CRON_JOBS validiert.
        $shellCmd = sprintf(
            'nohup php %s %s --no-debug >> %s 2>&1 & echo $!',
            escapeshellarg($consolePath),
            escapeshellarg($command),
            escapeshellarg($logFile)
        );

        $output = [];
        exec($shellCmd, $output);
        $pid = (int) ($output[0] ?? 0);

        if ($pid <= 0) {
            return $this->json(['error' => 'Prozess konnte nicht gestartet werden.'], 500);
        }

        $this->heartbeatService->setRunning($command, $pid);

        return $this->json(['success' => true, 'pid' => $pid]);
    }

    /**
     * Stoppt einen laufenden Cron-Job per SIGTERM.
     *
     * POST /api/admin/system/cron/kill
     */
    #[Route('/cron/kill', name: 'api_admin_system_cron_kill', methods: ['POST'])]
    public function killCronJob(Request $request): JsonResponse
    {
        /** @var array<string, mixed> $body */
        $body = $request->toArray();
        $command = (string) ($body['command'] ?? '');

        if (!isset(self::KNOWN_CRON_JOBS[$command])) {
            return $this->json(['error' => 'Unbekannter Cron-Job: ' . $command], 400);
        }

        $runningState = $this->heartbeatService->getRunningState($command);

        if (null === $runningState) {
            return $this->json(['error' => 'Job läuft nicht.'], 409);
        }

        $pid = (int) $runningState['pid'];

        if (function_exists('posix_kill')) {
            posix_kill($pid, 15); // SIGTERM = 15
        }

        $this->heartbeatService->clearRunning($command);

        return $this->json(['success' => true]);
    }

    /**
     * Löscht eine Backup-Datei.
     *
     * DELETE /api/admin/system/backup/{filename}
     */
    #[Route('/backup/{filename}', name: 'api_admin_system_backup_delete', methods: ['DELETE'])]
    public function deleteBackup(string $filename): JsonResponse
    {
        if (!preg_match('/^backup_[\w.-]+\.sql$/', $filename)) {
            return $this->json(['error' => 'Ungültiger Dateiname.'], 400);
        }

        $filepath = $this->getBackupDir() . '/' . $filename;

        if (!is_file($filepath)) {
            return $this->json(['error' => 'Datei nicht gefunden.'], 404);
        }

        if (!unlink($filepath)) {
            return $this->json(['error' => 'Datei konnte nicht gelöscht werden.'], 500);
        }

        return $this->json(['success' => true]);
    }

    /**
     * Liefert eine Backup-Datei als Download.
     *
     * GET /api/admin/system/backup/download/{filename}
     */
    #[Route('/backup/download/{filename}', name: 'api_admin_system_backup_download', methods: ['GET'])]
    public function downloadBackup(string $filename): BinaryFileResponse|JsonResponse
    {
        // Verhindere Path-Traversal-Angriffe
        if (!preg_match('/^backup_[\w.-]+\.sql$/', $filename)) {
            return $this->json(['error' => 'Ungültiger Dateiname.'], 400);
        }

        $filepath = $this->getBackupDir() . '/' . $filename;

        if (!is_file($filepath)) {
            return $this->json(['error' => 'Datei nicht gefunden.'], 404);
        }

        $response = new BinaryFileResponse($filepath);
        $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $filename);
        $response->headers->set('Content-Type', 'application/octet-stream');

        return $response;
    }

    private function getBackupDir(): string
    {
        return $this->projectDir . '/var/backups';
    }

    /**
     * Extrahiert MySQL-Verbindungsparameter aus der DBAL-Verbindung.
     * Unterstützt sowohl individuelle Params als auch DATABASE_URL-Format.
     *
     * @return array{host: string, port: string, user: string, password: string, dbname: string}
     */
    private function getMysqlParams(): array
    {
        $params = $this->connection->getParams();

        // Bei URL-basierter Konfiguration können host/port/user/password fehlen
        if (isset($params['url']) && !isset($params['host'])) {
            $parsed = parse_url((string) $params['url']);

            return [
                'host' => (string) ($parsed['host'] ?? 'db'),
                'port' => (string) ($parsed['port'] ?? 3306),
                'user' => rawurldecode((string) ($parsed['user'] ?? '')),
                'password' => rawurldecode((string) ($parsed['pass'] ?? '')),
                'dbname' => ltrim((string) ($parsed['path'] ?? ''), '/'),
            ];
        }

        return [
            'host' => (string) ($params['host'] ?? 'db'),
            'port' => (string) ($params['port'] ?? 3306),
            'user' => (string) ($params['user'] ?? ''),
            'password' => (string) ($params['password'] ?? ''),
            'dbname' => (string) ($params['dbname'] ?? (string) ($this->connection->getDatabase() ?? '')),
        ];
    }
}
