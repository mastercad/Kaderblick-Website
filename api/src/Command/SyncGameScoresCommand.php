<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Game;
use App\Repository\GameRepository;
use App\Service\GameScoreSyncService;
use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

#[AsCommand(
    name: 'app:sync-game-scores',
    description: 'Berechnet die gespeicherten Spielstände aus den GameEvents neu',
)]
final class SyncGameScoresCommand extends Command
{
    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly GameScoreSyncService $gameScoreSyncService,
        private readonly Connection $connection,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('game', null, InputOption::VALUE_REQUIRED, 'Nur diese Game-ID synchronisieren')
            ->addOption('all', null, InputOption::VALUE_NONE, 'Auch bereits befüllte relevante Spiele neu berechnen');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $gameId = $input->getOption('game');

        if (null !== $gameId) {
            $game = $this->gameRepository->find((int) $gameId);
            if (!$game instanceof Game) {
                $io->error(sprintf('Spiel #%s wurde nicht gefunden.', $gameId));

                return self::FAILURE;
            }

            $scores = $this->gameScoreSyncService->sync($game);
            $io->success(sprintf('Spiel #%d: %d:%d', $game->getId(), $scores['home'], $scores['away']));

            return self::SUCCESS;
        }

        $missingOnly = !(bool) $input->getOption('all');
        $sql = 'SELECT g.id FROM games g
                WHERE (g.is_finished = 1 OR EXISTS (SELECT 1 FROM game_events ge WHERE ge.game_id = g.id))';
        if ($missingOnly) {
            $sql .= ' AND (g.home_score IS NULL OR g.away_score IS NULL)';
        }

        $ids = array_map('intval', $this->connection->fetchFirstColumn($sql));
        if ([] === $ids) {
            $io->success('Keine Spielstände zu synchronisieren.');

            return self::SUCCESS;
        }

        $games = $this->gameRepository->findBy(['id' => $ids]);
        $io->progressStart(count($games));
        $failed = 0;

        foreach ($games as $game) {
            try {
                $this->gameScoreSyncService->sync($game);
            } catch (Throwable $exception) {
                ++$failed;
                $io->warning(sprintf('Spiel #%d: %s', $game->getId(), $exception->getMessage()));
            }
            $io->progressAdvance();
        }

        $io->progressFinish();
        if ($failed > 0) {
            $io->error(sprintf('%d Spiele synchronisiert, %d Fehler.', count($games) - $failed, $failed));

            return self::FAILURE;
        }

        $io->success(sprintf('%d Spielstände synchronisiert.', count($games)));

        return self::SUCCESS;
    }
}
