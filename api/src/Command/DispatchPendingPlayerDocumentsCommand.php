<?php

declare(strict_types=1);

namespace App\Command;

use App\Message\ProcessPlayerDocumentMessage;
use App\Repository\PlayerDocumentRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Messenger\MessageBusInterface;
use Throwable;

#[AsCommand(name: 'app:documents:dispatch-pending', description: 'Relay pending player-document outbox messages to the broker')]
class DispatchPendingPlayerDocumentsCommand extends AbstractCronCommand
{
    public function __construct(
        private readonly PlayerDocumentRepository $documents,
        private readonly MessageBusInterface $bus,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $dispatched = 0;
        foreach ($this->documents->findUndispatchedPending() as $document) {
            try {
                $this->bus->dispatch(new ProcessPlayerDocumentMessage((int) $document->getId()));
                $document->setProcessingDispatchedAt(new DateTimeImmutable())->setProcessingError(null);
                ++$dispatched;
            } catch (Throwable $exception) {
                $document->setProcessingError('Broker nicht erreichbar: ' . mb_substr($exception->getMessage(), 0, 500));
            }
        }
        $this->em->flush();
        $output->writeln(sprintf('%d ausstehende Dokumentjobs versendet.', $dispatched));

        return Command::SUCCESS;
    }
}
