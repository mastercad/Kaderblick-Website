<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\HeartbeatService;
use App\Service\XPEventProcessor;
use Exception;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:xp:process-pending',
    description: 'Process pending XP events and award XP to users'
)]
class ProcessPendingXpCommand extends Command
{
    public function __construct(
        private XPEventProcessor $xpEventProcessor,
        private LoggerInterface $xpProcessingLogger,
        private HeartbeatService $heartbeatService,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $this->xpProcessingLogger->info('Starting XP event processing');
        $io->title('Processing Pending XP Events');

        try {
            $this->xpEventProcessor->processPendingXpEvents();
            $this->xpProcessingLogger->info('Successfully processed all pending XP events');
            $this->heartbeatService->beat('app:xp:process-pending');
            $io->success('Successfully processed all pending XP events');

            return Command::SUCCESS;
        } catch (Exception $e) {
            $this->xpProcessingLogger->error('Error processing pending XP events', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            $io->error('Error processing pending XP events: ' . $e->getMessage());

            return Command::FAILURE;
        }
    }
}
