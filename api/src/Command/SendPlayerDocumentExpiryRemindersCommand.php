<?php

declare(strict_types=1);

namespace App\Command;

use App\Repository\PlayerDocumentRepository;
use App\Repository\UserRelationRepository;
use App\Service\NotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:documents:send-expiry-reminders', description: 'Send reminders for expiring player documents')]
class SendPlayerDocumentExpiryRemindersCommand extends AbstractCronCommand
{
    public function __construct(
        private readonly PlayerDocumentRepository $documents,
        private readonly UserRelationRepository $relations,
        private readonly NotificationService $notifications,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $count = 0;
        $today = new DateTimeImmutable('today');
        foreach ($this->documents->findExpiringWithin(30) as $document) {
            $days = (int) $today->diff($document->getExpiresAt())->format('%r%a');
            $key = $days <= 0 ? 'expired' : ($days <= 1 ? '1_day' : ($days <= 7 ? '7_days' : '30_days'));
            if (isset($document->getExpiryNotificationsSent()[$key])) {
                continue;
            }
            $recipients = [];
            if ($document->getUploadedBy()) {
                $recipients[$document->getUploadedBy()->getId()] = $document->getUploadedBy();
            }
            foreach ($this->relations->findAllWithAccessToPlayer($document->getPlayer()) as $relation) {
                if ($relation->hasPermission('view_documents') || $relation->hasPermission('Dokumente ansehen') || $relation->hasPermission('manage_documents')) {
                    $recipients[$relation->getUser()->getId()] = $relation->getUser();
                }
            }
            $when = $days <= 0 ? 'ist abgelaufen' : sprintf('läuft in %d Tag%s ab', $days, 1 === $days ? '' : 'en');
            if ($recipients) {
                $this->notifications->createNotificationForUsers(
                    array_values($recipients),
                    'document_expiry',
                    'Spielerdokument ' . $when,
                    sprintf('%s von %s %s.', $document->getDisplayName(), $document->getPlayer()->getFullName(), $when),
                    ['playerId' => $document->getPlayer()->getId(), 'documentId' => $document->getId(), 'url' => '/players']
                );
            }
            $document->markExpiryNotificationSent($key);
            ++$count;
        }
        $this->em->flush();
        $io->success(sprintf('%d Dokument-Erinnerungen verarbeitet.', $count));

        return Command::SUCCESS;
    }
}
