<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\CompetitionCardRule;
use App\Entity\Game;
use App\Entity\PlayerSuspension;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\PlayerSuspensionRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Pflegt historische Kartensperren nach:
 * Iteriert alle Karten-GameEvents chronologisch und legt fehlende
 * PlayerSuspension-Einträge an. Bereits vorhandene Sperren werden übersprungen
 * (idempotent). Gelb-Karten-Zähler werden mit Reset-Logik simuliert.
 *
 * Verwendung:
 *   php bin/console app:suspension:backfill
 *   php bin/console app:suspension:backfill --dry-run
 */
#[AsCommand(
    name: 'app:suspension:backfill',
    description: 'Legt fehlende Sperren (PlayerSuspension) aus historischen Karten-Events nach.',
)]
class BackfillSuspensionsCommand extends Command
{
    public function __construct(
        private readonly GameEventRepository $gameEventRepository,
        private readonly PlayerSuspensionRepository $suspensionRepository,
        private readonly CompetitionCardRuleRepository $cardRuleRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'dry-run',
            null,
            InputOption::VALUE_NONE,
            'Keine Änderungen in die DB schreiben – nur ausgeben, was erstellt werden würde.',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $dryRun = (bool) $input->getOption('dry-run');
        $io = new SymfonyStyle($input, $output);

        if ($dryRun) {
            $io->note('Dry-Run aktiv – es werden keine Daten gespeichert.');
        }

        $events = $this->gameEventRepository->findAllCardEventsChronological();

        $created = 0;
        $skipped = 0;

        /** @var array<string, int> $yellowCounts Key: "{playerId}_{compType}_{compId}" */
        $yellowCounts = [];
        $batchCount = 0;
        $batchSize = 50;

        foreach ($events as $event) {
            $player = $event->getPlayer();
            if (null === $player) {
                continue;
            }

            $game = $event->getGame();
            $code = $event->getGameEventType()?->getCode();
            if (null === $code || null === $game) {
                continue;
            }

            $competitionType = $this->resolveCompetitionType($game);
            $competitionId = $this->resolveCompetitionId($game, $competitionType);
            $gameDate = $this->resolveGameDate($game);

            if ('red_card' === $code || 'yellow_red_card' === $code) {
                $reason = 'red_card' === $code
                    ? PlayerSuspension::REASON_RED_CARD
                    : PlayerSuspension::REASON_YELLOW_RED_CARD;

                $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId, $gameDate);
                $gamesSuspended = 'red_card' === $code
                    ? ($rule?->getRedCardSuspensionGames() ?? 1)
                    : ($rule?->getYellowRedCardSuspensionGames() ?? 1);

                $existing = $this->suspensionRepository->findByTriggerGameAndReason(
                    $player,
                    $competitionType,
                    $competitionId,
                    $reason,
                    $game,
                );

                if (null === $existing) {
                    $io->writeln(sprintf(
                        '  [NEU] %s für %s (%s, Spiel-ID %d)',
                        $reason,
                        $player->getFullName(),
                        $competitionType,
                        $game->getId() ?? 0,
                    ));

                    if (!$dryRun) {
                        $suspension = new PlayerSuspension(
                            player: $player,
                            competitionType: $competitionType,
                            competitionId: $competitionId,
                            reason: $reason,
                            gamesSuspended: $gamesSuspended,
                            triggeredByGame: $game,
                        );
                        $this->em->persist($suspension);
                        ++$batchCount;
                    }
                    ++$created;
                } else {
                    ++$skipped;
                }
            } elseif ('yellow_card' === $code) {
                $key = sprintf('%d_%s_%s', $player->getId() ?? 0, $competitionType, $competitionId ?? 'null');
                $yellowCounts[$key] = ($yellowCounts[$key] ?? 0) + 1;
                $count = $yellowCounts[$key];

                $rule = $this->cardRuleRepository->findApplicableRule($competitionType, $competitionId, $gameDate);
                if (null === $rule) {
                    continue;
                }

                if ($count >= $rule->getYellowSuspensionThreshold()) {
                    $existing = $this->suspensionRepository->findByTriggerGameAndReason(
                        $player,
                        $competitionType,
                        $competitionId,
                        PlayerSuspension::REASON_YELLOW_CARDS,
                        $game,
                    );

                    if (null === $existing) {
                        $io->writeln(sprintf(
                            '  [NEU] yellow_cards für %s (%s, %d. Gelbe, Spiel-ID %d)',
                            $player->getFullName(),
                            $competitionType,
                            $count,
                            $game->getId() ?? 0,
                        ));

                        if (!$dryRun) {
                            $suspension = new PlayerSuspension(
                                player: $player,
                                competitionType: $competitionType,
                                competitionId: $competitionId,
                                reason: PlayerSuspension::REASON_YELLOW_CARDS,
                                gamesSuspended: $rule->getSuspensionGames(),
                                triggeredByGame: $game,
                            );
                            $this->em->persist($suspension);
                            ++$batchCount;
                        }
                        ++$created;
                    } else {
                        ++$skipped;
                    }

                    if ($rule->isResetAfterSuspension()) {
                        $yellowCounts[$key] = 0;
                    }
                }
            }

            if (!$dryRun && $batchCount >= $batchSize) {
                $this->em->flush();
                $batchCount = 0;
            }
        }

        if (!$dryRun) {
            $this->em->flush();
        }

        $io->success(sprintf(
            'Backfill abgeschlossen: %d Sperre(n) erstellt, %d übersprungen (bereits vorhanden).',
            $created,
            $skipped,
        ));

        return Command::SUCCESS;
    }

    private function resolveCompetitionType(Game $game): string
    {
        if (null !== $game->getLeague()) {
            return CompetitionCardRule::TYPE_LEAGUE;
        }

        if (null !== $game->getCup()) {
            return CompetitionCardRule::TYPE_CUP;
        }

        if (null !== $game->getTournamentMatch()) {
            return CompetitionCardRule::TYPE_TOURNAMENT;
        }

        return CompetitionCardRule::TYPE_FRIENDLY;
    }

    private function resolveCompetitionId(Game $game, string $competitionType): ?int
    {
        return match ($competitionType) {
            CompetitionCardRule::TYPE_LEAGUE => $game->getLeague()?->getId(),
            CompetitionCardRule::TYPE_CUP => $game->getCup()?->getId(),
            CompetitionCardRule::TYPE_TOURNAMENT => $game->getTournamentMatch()?->getTournament()?->getId(),
            default => null,
        };
    }

    private function resolveGameDate(Game $game): ?DateTimeImmutable
    {
        $startDate = $game->getCalendarEvent()?->getStartDate();

        if (null === $startDate) {
            return null;
        }

        return $startDate instanceof DateTimeImmutable
            ? $startDate
            : DateTimeImmutable::createFromInterface($startDate);
    }
}
