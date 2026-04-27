<?php

namespace App\Command;

use App\Repository\SurveyRepository;
use App\Service\SurveyNotificationService;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

#[AsCommand(
    name: 'app:surveys:send-reminders',
    description: 'Send reminder notifications for surveys approaching their due date'
)]
class SendSurveyRemindersCommand extends AbstractCronCommand
{
    public function __construct(
        private SurveyRepository $surveyRepository,
        private SurveyNotificationService $surveyNotificationService,
        private LoggerInterface $logger,
    ) {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $surveys = $this->surveyRepository->findSurveysNeedingReminders();
        $totalReminded = 0;
        $surveysProcessed = 0;

        $io->info(sprintf('Found %d active surveys with due dates.', count($surveys)));

        foreach ($surveys as $survey) {
            $reminderKey = $this->surveyNotificationService->getApplicableReminderKey($survey);

            if (null === $reminderKey) {
                continue;
            }

            $io->text(sprintf(
                'Survey #%d "%s": sending "%s" reminder...',
                $survey->getId(),
                $survey->getTitle(),
                $reminderKey
            ));

            try {
                $usersReminded = $this->surveyNotificationService->sendSurveyReminder($survey, $reminderKey);
                $totalReminded += $usersReminded;
                ++$surveysProcessed;

                $io->text(sprintf('  -> Reminded %d users.', $usersReminded));
            } catch (Throwable $e) {
                $this->logger->error('Failed to send survey reminder', [
                    'surveyId' => $survey->getId(),
                    'reminderKey' => $reminderKey,
                    'error' => $e->getMessage(),
                ]);
                $io->error(sprintf('  -> Error: %s', $e->getMessage()));
            }
        }

        $io->success(sprintf(
            'Done. Processed %d surveys, sent reminders to %d users total.',
            $surveysProcessed,
            $totalReminded
        ));

        return self::SUCCESS;
    }
}
