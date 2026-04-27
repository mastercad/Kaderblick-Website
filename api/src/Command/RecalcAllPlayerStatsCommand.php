<?php

declare(strict_types=1);

namespace App\Command;

use App\Repository\GameRepository;
use App\Service\PlayerStatsRecalcService;
use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

/**
 * Einmaliger/manueller Backfill-Command:
 * Berechnet PlayerGameStats für alle (oder nur lückenhafte) abgeschlossenen Spiele neu.
 *
 * Verwendung:
 *   bin/console app:recalc-player-stats              # nur Spiele ohne Stats
 *   bin/console app:recalc-player-stats --all        # alle finished games
 *   bin/console app:recalc-player-stats --game=42    # einzelnes Spiel
 */
#[AsCommand(
    name: 'app:recalc-player-stats',
    description: 'Berechnet PlayerGameStats für abgeschlossene Spiele neu (Backfill)'
)]
class RecalcAllPlayerStatsCommand extends AbstractCronCommand
{
    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly PlayerStatsRecalcService $recalcService,
        private readonly Connection $connection,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('all', null, InputOption::VALUE_NONE, 'Alle abgeschlossenen Spiele neu berechnen (nicht nur lückenhafte)')
            ->addOption('game', null, InputOption::VALUE_REQUIRED, 'Nur ein bestimmtes Spiel neu berechnen (Game-ID)');
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('PlayerGameStats Backfill');

        $gameId = $input->getOption('game');

        // Einzelnes Spiel
        if (null !== $gameId) {
            $game = $this->gameRepository->find((int) $gameId);
            if (null === $game) {
                $io->error(sprintf('Spiel mit ID %s nicht gefunden.', $gameId));

                return self::FAILURE;
            }
            $io->section(sprintf('Recalc für Spiel #%d', $game->getId()));
            $this->recalcService->recalcForGame($game);
            $io->success('Fertig.');

            return self::SUCCESS;
        }

        // Alle oder nur lückenhafte Spiele
        $recalcAll = (bool) $input->getOption('all');

        if ($recalcAll) {
            $games = $this->gameRepository->findBy(['isFinished' => true]);
            $io->section(sprintf('Recalc für alle %d abgeschlossenen Spiele …', count($games)));
        } else {
            $games = $this->findGamesWithMissingStats();
            $io->section(sprintf('Recalc für %d Spiele ohne PlayerGameStats …', count($games)));
        }

        if (empty($games)) {
            $io->success('Keine Spiele zu verarbeiten.');

            return self::SUCCESS;
        }

        $io->progressStart(count($games));
        $ok = 0;
        $failed = 0;

        foreach ($games as $game) {
            try {
                $this->recalcService->recalcForGame($game);
                ++$ok;
            } catch (Throwable $e) {
                $io->warning(sprintf('Fehler bei Spiel #%d: %s', $game->getId(), $e->getMessage()));
                ++$failed;
            }
            $io->progressAdvance();
        }

        $io->progressFinish();
        $io->success(sprintf('%d Spiele verarbeitet, %d Fehler.', $ok, $failed));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Liefert alle abgeschlossenen Spiele, für die noch kein PlayerGameStats-Eintrag existiert.
     *
     * @return \App\Entity\Game[]
     */
    private function findGamesWithMissingStats(): array
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
            return [];
        }

        return $this->gameRepository->findBy(['id' => $ids]);
    }
}
