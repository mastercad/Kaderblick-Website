<?php

namespace App\Command;

use App\Entity\GameEvent;
use App\Entity\PlayerTitle;
use App\Service\HeartbeatService;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:xp:award-titles',
    description: 'Award top scorer titles (team and platform) retroactively.'
)]
class AwardTitlesCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TitleCalculationService $titleCalculationService,
        private HeartbeatService $heartbeatService,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('season', null, InputOption::VALUE_OPTIONAL, 'Season string (e.g. 2024/2025). Default: current season')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Show what would be awarded, but do not persist changes');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $season = $input->getOption('season') ?? $this->titleCalculationService->retrieveCurrentSeason();
        $dryRun = $input->getOption('dry-run');

        $io->title('Awarding Top Scorer Titles');
        $io->text("Season: $season");
        if ($dryRun) {
            $io->warning('DRY-RUN: No changes will be persisted.');
        }

        // Debug: Alle gezählten Tore für die Saison ausgeben
        $io->section('DEBUG: Alle gezählten Tore für diese Saison (inkl. Player-Relationen)');
        $gameEvents = $this->titleCalculationService->debugGoalsForSeason($season);

        $counted = 0;
        /** @var GameEvent $gameEvent */
        foreach ($gameEvents as $gameEvent) {
            $scorer = $gameEvent->getPlayer();
            $relations = [];
            foreach ($scorer->getUserRelations() as $userRelation) {
                $relations[] = $userRelation->getRelationType()->getIdentifier();
            }

            if ('goal' !== $gameEvent->getGameEventType()?->getCode()) {
                continue;
            }

            $game = $gameEvent->getGame();
            $calendarEvent = $game->getCalendarEvent();
            $team = $game->getHomeTeam();
            $io->writeln(sprintf(
                'Tor-ID: %d | Spieler: %s %s | Spiel-ID: %d | Team: %s | Datum: %s | Player-RelationTypes: [%s]',
                $gameEvent->getId(),
                $scorer->getFirstName(),
                $scorer->getLastName(),
                $game->getId(),
                $team?->getName() ?? '-',
                $calendarEvent?->getStartDate()?->format('Y-m-d H:i') ?? '-',
                implode(', ', $relations)
            ));
            ++$counted;
        }
        if (0 === $counted) {
            $io->writeln('Keine Tore gefunden.');
        }

        // Platform-wide
        $platformTitles = $this->titleCalculationService->calculatePlatformTopScorers($season);
        $io->section('Platform-wide Top Scorers');
        /** @var PlayerTitle $title */
        foreach ($platformTitles as $title) {
            $io->writeln(sprintf(
                '%s: %s %s (%d goals)',
                ucfirst($title->getTitleRank()),
                $title->getPlayer()->getFirstName(),
                $title->getPlayer()->getLastName(),
                $title->getValue()
            ));
        }

        // Team-wise
        $teamTitles = $this->titleCalculationService->calculateAllTeamTopScorers($season);
        $io->section('Team Top Scorers');
        foreach ($teamTitles as $title) {
            $io->writeln(sprintf(
                '%s: %s %s (%d goals) [Team: %s]',
                ucfirst($title->getTitleRank()),
                $title->getPlayer()->getFirstName(),
                $title->getPlayer()->getLastName(),
                $title->getValue(),
                $title->getTeam()?->getName()
            ));
        }

        // Team-wise
        $leagueTitles = $this->titleCalculationService->calculateLeagueTopScorers($season);
        $io->section('League Top Scorers');
        foreach ($leagueTitles as $title) {
            $io->writeln(sprintf(
                '%s: %s %s (%d goals) [League: %s]',
                ucfirst($title->getTitleRank()),
                $title->getPlayer()->getFirstName(),
                $title->getPlayer()->getLastName(),
                $title->getValue(),
                $title->getLeague()?->getName()
            ));
        }

        if ($dryRun) {
            $io->success('DRY-RUN complete. No titles were persisted.');
            $this->entityManager->clear();
        } else {
            $io->success('Titles awarded and persisted.');
            $this->heartbeatService->beat('app:xp:award-titles');
        }

        return Command::SUCCESS;
    }
}
