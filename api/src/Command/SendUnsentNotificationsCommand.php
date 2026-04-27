<?php

namespace App\Command;

use App\Repository\NotificationRepository;
use App\Service\PushNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

#[AsCommand(name: 'app:notifications:send-unsent', description: 'Send unsent notifications via PushNotificationService')]
class SendUnsentNotificationsCommand extends AbstractCronCommand
{
    public function __construct(
        private EntityManagerInterface $em,
        private NotificationRepository $notificationRepository,
        private PushNotificationService $pushNotificationService,
        private LoggerInterface $logger,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, 'Maximum number of notifications to process', 100);
        $this->addOption('batch', null, InputOption::VALUE_OPTIONAL, 'Batch size for DB flush', 20);
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $limit = (int) $input->getOption('limit');
        $batch = (int) $input->getOption('batch');

        $io->info(sprintf('Looking for up to %d unsent notifications...', $limit));

        $notifications = $this->notificationRepository->findUnsent($limit);
        $count = count($notifications);

        if (0 === $count) {
            $io->success('No unsent notifications found.');

            return self::SUCCESS;
        }

        $io->progressStart($count);

        $processed = 0;
        $flushed = 0;

        foreach ($notifications as $notification) {
            $user = $notification->getUser();

            try {
                $url = '/';
                $data = $notification->getData();
                if (is_array($data) && isset($data['url'])) {
                    $url = (string) $data['url'];
                }

                $this->pushNotificationService->sendNotification(
                    $user,
                    $notification->getTitle(),
                    $notification->getMessage() ?? '',
                    $url
                );

                $notification->setIsSent(true);
                $this->em->persist($notification);
            } catch (Throwable $e) {
                $this->logger->error('Failed to send push for notification', ['id' => $notification->getId(), 'error' => $e->getMessage()]);
                $io->error('Failed to send notification id ' . $notification->getId() . ': ' . $e->getMessage());
            }

            ++$processed;
            $io->progressAdvance();

            if (0 === $processed % $batch) {
                $this->em->flush();
                $flushed += $batch;
            }
        }

        // final flush for remaining
        $this->em->flush();

        $io->progressFinish();
        $io->success(sprintf('Processed %d notifications, flushed %d.', $processed, $flushed ?: $processed));

        return self::SUCCESS;
    }
}
