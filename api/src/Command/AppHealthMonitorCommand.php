<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\AdminAlertService;
use App\Service\HeartbeatService;
use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

/**
 * Umfassender Systemgesundheitscheck.
 *
 * Prüft:
 *   - Festplattenspeicher (uploads/ und var/)
 *   - Fehlgeschlagene Messenger-Queue-Nachrichten
 *   - Cron-Job-Heartbeats (werden erwartete Jobs noch regelmäßig ausgeführt?)
 *
 * Im Fehlerfall wird via AdminAlertService ein SystemAlert ausgelöst
 * (E-Mail + Push + DB-Persistenz).
 *
 * Empfohlenes Cron-Intervall: alle 5 Minuten
 *   * / 5 * * * * /var/www/symfony/bin/console app:health:monitor --no-interaction
 */
#[AsCommand(
    name: 'app:health:monitor',
    description: 'Comprehensive system health check – disk space, failed queue, cron heartbeats'
)]
class AppHealthMonitorCommand extends Command
{
    /**
     * Maximales Alter in Minuten pro erwartetem Cron-Job.
     *
     * Schlüssel = Symfony-Command-Name, Wert = maximales erlaubtes Intervall in Minuten.
     * Liegt der letzte Heartbeat länger zurück als angegeben,
     * wird ein CRON_FAILURE-Alert ausgelöst.
     */
    private const EXPECTED_COMMANDS = [
        'app:xp:process-pending' => 60,    // alle ~30 min erwartet
        'app:notifications:send-unsent' => 30,    // alle ~15 min erwartet
        'app:surveys:send-reminders' => 1440,  // täglich erwartet
        'app:collect-weather-data-for-events' => 1440,  // täglich erwartet
        'app:xp:award-titles' => 10080, // wöchentlich erwartet
    ];

    /** Festplatten-Schwellwert in % (Belegung ≥ dieses Werts → Alert) */
    private const DISK_DEFAULT_THRESHOLD = 90;

    public function __construct(
        private readonly AdminAlertService $adminAlertService,
        private readonly HeartbeatService $heartbeatService,
        private readonly Connection $connection,
        private readonly LoggerInterface $cronLogger,
        private readonly string $projectDir,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'disk-threshold',
            null,
            InputOption::VALUE_OPTIONAL,
            sprintf('Festplatten-Schwellwert in %% für Disk-Alerts (default: %d)', self::DISK_DEFAULT_THRESHOLD),
            self::DISK_DEFAULT_THRESHOLD
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $diskThreshold = (int) $input->getOption('disk-threshold');
        $hasIssue = false;

        $io->title('System Health Monitor');

        // ── 1. Festplatten-Check ──────────────────────────────────────────────
        $io->section('Festplattenspeicher');
        $hasIssue = $this->checkDisk($io, $diskThreshold);

        // ── 2. Messenger Failed Queue ─────────────────────────────────────────
        $io->section('Messenger – Fehlgeschlagene Queue');
        $hasIssue = $this->checkFailedQueue($io) || $hasIssue;

        // ── 3. Cron-Heartbeats ────────────────────────────────────────────────
        $io->section('Cron-Job-Heartbeats');
        $hasIssue = $this->checkCronHeartbeats($io) || $hasIssue;

        if ($hasIssue) {
            $io->warning('Health-Monitor hat Probleme festgestellt – Alerts wurden ausgelöst.');
            $this->cronLogger->warning('app:health:monitor: Probleme erkannt');
        } else {
            $io->success('Alles gesund – keine Auffälligkeiten festgestellt.');
            $this->cronLogger->info('app:health:monitor: Alle Checks erfolgreich');
        }

        return $hasIssue ? Command::FAILURE : Command::SUCCESS;
    }

    private function checkDisk(SymfonyStyle $io, int $threshold): bool
    {
        $hasAlert = false;

        $paths = [
            'uploads' => $this->projectDir . '/public/uploads',
            'var' => $this->projectDir . '/var',
        ];

        foreach ($paths as $label => $path) {
            if (!is_dir($path)) {
                $io->text(sprintf('[%s] Verzeichnis nicht gefunden: %s', $label, $path));
                continue;
            }

            $free = disk_free_space($path);
            $total = disk_total_space($path);

            if (false === $free || false === $total || 0.0 === $total) {
                $io->text(sprintf('[%s] Konnte Speicherplatz nicht lesen.', $label));
                continue;
            }

            $usedPercent = (int) round((($total - $free) / $total) * 100);
            $freeMiB = (int) round($free / 1024 / 1024);

            $io->text(sprintf('[%s] %d %% belegt, %d MiB frei', $label, $usedPercent, $freeMiB));

            if ($usedPercent >= $threshold) {
                $hasAlert = true;
                $this->adminAlertService->trackDiskSpaceWarning($path, $usedPercent, $freeMiB);
                $io->warning(sprintf('[%s] Schwellwert überschritten: %d %% belegt!', $label, $usedPercent));
                $this->cronLogger->warning(
                    sprintf('Disk-Alert: %s – %d %% belegt (%d MiB frei)', $path, $usedPercent, $freeMiB)
                );
            }
        }

        return $hasAlert;
    }

    private function checkFailedQueue(SymfonyStyle $io): bool
    {
        try {
            $failedCount = (int) $this->connection
                ->executeQuery("SELECT COUNT(*) FROM messenger_messages WHERE queue_name = 'failed'")
                ->fetchOne();
        } catch (Throwable $e) {
            $io->text('Konnte Failed-Queue nicht prüfen: ' . $e->getMessage());
            $this->cronLogger->warning('Failed-Queue-Check fehlgeschlagen: ' . $e->getMessage());

            return false;
        }

        if ($failedCount > 0) {
            $this->adminAlertService->trackQueueFailure($failedCount);
            $io->warning(sprintf('%d fehlgeschlagene Nachricht(en) in der Messenger-Queue!', $failedCount));
            $this->cronLogger->warning(sprintf('Failed-Queue: %d Nachrichten', $failedCount));

            return true;
        }

        $io->text('OK – keine fehlgeschlagenen Nachrichten.');

        return false;
    }

    private function checkCronHeartbeats(SymfonyStyle $io): bool
    {
        $hasAlert = false;

        foreach (self::EXPECTED_COMMANDS as $commandName => $maxAgeMinutes) {
            $last = $this->heartbeatService->getLastBeat($commandName);

            if (null === $last) {
                // Beim allerersten Deployment noch keinen Heartbeat erwarted
                $io->text(sprintf('[%s] Noch kein Heartbeat registriert – wird beim nächsten Run gesetzt.', $commandName));
                continue;
            }

            $ageMinutes = (int) round((time() - $last->getTimestamp()) / 60);

            if ($ageMinutes > $maxAgeMinutes) {
                $hasAlert = true;
                $this->adminAlertService->trackCronFailure($commandName, $ageMinutes);
                $io->warning(sprintf(
                    '[%s] Letzter Heartbeat vor %d min – erwartet max %d min!',
                    $commandName,
                    $ageMinutes,
                    $maxAgeMinutes
                ));
                $this->cronLogger->warning(sprintf(
                    'Cron-Failure: %s – letzter Heartbeat vor %d min (max: %d min)',
                    $commandName,
                    $ageMinutes,
                    $maxAgeMinutes
                ));
            } else {
                $io->text(sprintf(
                    '[%s] OK – letzter Heartbeat vor %d min (max: %d min)',
                    $commandName,
                    $ageMinutes,
                    $maxAgeMinutes
                ));
            }
        }

        return $hasAlert;
    }
}
