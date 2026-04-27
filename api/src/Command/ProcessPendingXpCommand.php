<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\XPEventProcessor;
use Exception;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:xp:process-pending',
    description: 'Process pending XP events and award XP to users'
)]
class ProcessPendingXpCommand extends AbstractCronCommand
{
    public function __construct(
        private XPEventProcessor $xpEventProcessor,
        private LoggerInterface $xpProcessingLogger,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $this->xpProcessingLogger->info('Starting XP event processing');
        $io->title('Processing Pending XP Events');

        try {
            $this->xpEventProcessor->processPendingXpEvents();
            $this->xpProcessingLogger->info('Successfully processed all pending XP events');
            $io->success('Successfully processed all pending XP events');

            return self::SUCCESS;
        } catch (Exception $e) {
            $this->xpProcessingLogger->error('Error processing pending XP events', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            $io->error('Error processing pending XP events: ' . $e->getMessage());

            return self::FAILURE;
        }
    }
}
