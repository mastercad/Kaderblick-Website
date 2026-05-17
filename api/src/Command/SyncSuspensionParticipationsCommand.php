<?php

declare(strict_types=1);

namespace App\Command;

use App\Repository\PlayerSuspensionRepository;
use App\Service\SuspensionService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Trägt fehlende Participation-Einträge (Status: suspended) für alle aktiven
 * Sperren nach. Nützlich wenn der User-Spieler-Link (UserRelation) erst nach
 * dem Anlegen der Sperre erstellt wurde.
 *
 * Verwendung:
 *   php bin/console app:suspension:sync-participations
 *   php bin/console app:suspension:sync-participations --dry-run
 */
#[AsCommand(
    name: 'app:suspension:sync-participations',
    description: 'Legt fehlende Participation-Einträge (suspended) für alle aktiven Sperren nach.',
)]
class SyncSuspensionParticipationsCommand extends Command
{
    public function __construct(
        private readonly PlayerSuspensionRepository $suspensionRepository,
        private readonly SuspensionService $suspensionService,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'dry-run',
            null,
            InputOption::VALUE_NONE,
            'Keine Änderungen in die DB schreiben – nur ausgeben, welche Sperren verarbeitet würden.',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $dryRun = (bool) $input->getOption('dry-run');
        $io = new SymfonyStyle($input, $output);

        if ($dryRun) {
            $io->note('Dry-Run aktiv – es werden keine Daten gespeichert.');
        }

        $suspensions = $this->suspensionRepository->findAllActive();
        $io->info(sprintf('Aktive Sperren gefunden: %d', count($suspensions)));

        $processed = 0;
        $skipped = 0;

        foreach ($suspensions as $suspension) {
            $player = $suspension->getPlayer();
            $game = $suspension->getTriggeredByGame();

            if (null === $game) {
                $io->warning(sprintf(
                    'Sperre #%d (%s %s) hat kein triggeredByGame → übersprungen.',
                    (int) $suspension->getId(),
                    $player->getFirstName(),
                    $player->getLastName(),
                ));
                ++$skipped;

                continue;
            }

            $io->text(sprintf(
                '[%s] Sperre #%d: %s %s – Grund: %s, %dx gesperrt, Wettbewerb: %s/%s',
                $dryRun ? 'DRY' : 'SYNC',
                (int) $suspension->getId(),
                $player->getFirstName(),
                $player->getLastName(),
                $suspension->getReason(),
                $suspension->getGamesSuspended(),
                $suspension->getCompetitionType(),
                $suspension->getCompetitionId() ?? 'NULL',
            ));

            if (!$dryRun) {
                $this->suspensionService->syncParticipationsForSuspension($suspension);
            }

            ++$processed;
        }

        $io->success(sprintf(
            'Fertig: %d Sperren %s, %d übersprungen.',
            $processed,
            $dryRun ? 'würden verarbeitet werden' : 'verarbeitet',
            $skipped,
        ));

        return Command::SUCCESS;
    }
}
