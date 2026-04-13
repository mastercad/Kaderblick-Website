<?php

namespace App\Service;

use App\Entity\Survey;
use App\Entity\User;
use App\Repository\UserRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

class SurveyNotificationService
{
    /**
     * Reminder thresholds in hours before the due date.
     * Escalating pattern: infrequent early on, more frequent near the deadline.
     *
     * @var array<string, int>
     */
    public const REMINDER_THRESHOLDS = [
        '7_days' => 168,   // 7 days = 168 hours
        '3_days' => 72,    // 3 days = 72 hours
        '1_day' => 24,     // 1 day = 24 hours
        '3_hours' => 3,    // 3 hours
    ];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private NotificationService $notificationService,
        private UserRepository $userRepository,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Send the initial notification when a survey is created.
     *
     * @return int number of users notified
     */
    public function sendSurveyCreatedNotification(Survey $survey): int
    {
        if ($survey->isInitialNotificationSent()) {
            return 0;
        }

        $users = $this->getTargetUsersForSurvey($survey);
        if (empty($users)) {
            return 0;
        }

        $dueDateText = '';
        if ($survey->getDueDate()) {
            $dueDateText = ' (Fällig: ' . $survey->getDueDate()->format('d.m.Y') . ')';
        }

        $this->notificationService->createNotificationForUsers(
            $users,
            'survey',
            'Neue Umfrage: ' . $survey->getTitle(),
            ($survey->getDescription() ?: 'Es wurde eine neue Umfrage erstellt.') . $dueDateText,
            [
                'surveyId' => $survey->getId(),
                'url' => '/survey/fill/' . $survey->getId(),
            ]
        );

        $survey->setInitialNotificationSent(true);
        $this->entityManager->flush();

        $this->logger->info('Sent survey creation notification', [
            'surveyId' => $survey->getId(),
            'usersNotified' => count($users),
        ]);

        return count($users);
    }

    /**
     * Send reminder notifications for a survey to users who haven't responded yet.
     *
     * @return int number of users reminded
     */
    public function sendSurveyReminder(Survey $survey, string $reminderKey): int
    {
        if ($survey->hasReminderBeenSent($reminderKey)) {
            return 0;
        }

        $users = $this->getUsersWhoHaveNotResponded($survey);
        if (empty($users)) {
            return 0;
        }

        $hoursLeft = self::REMINDER_THRESHOLDS[$reminderKey] ?? 0;
        $urgencyText = $this->getUrgencyText($reminderKey);

        $this->notificationService->createNotificationForUsers(
            $users,
            'survey',
            'Erinnerung: ' . $survey->getTitle(),
            $urgencyText,
            [
                'surveyId' => $survey->getId(),
                'url' => '/survey/fill/' . $survey->getId(),
            ]
        );

        $survey->addReminderSent($reminderKey);
        $this->entityManager->flush();

        $this->logger->info('Sent survey reminder', [
            'surveyId' => $survey->getId(),
            'reminderKey' => $reminderKey,
            'usersReminded' => count($users),
        ]);

        return count($users);
    }

    /**
     * Get the applicable reminder key for a survey based on current time.
     * Returns the most specific (closest to deadline) reminder that hasn't been sent yet.
     *
     * @return string|null the reminder key, or null if no reminder is due
     */
    public function getApplicableReminderKey(Survey $survey): ?string
    {
        $dueDate = $survey->getDueDate();
        if (!$dueDate) {
            return null;
        }

        $now = new DateTimeImmutable();
        if ($now > $dueDate) {
            return null; // survey already expired
        }

        $hoursUntilDue = ($dueDate->getTimestamp() - $now->getTimestamp()) / 3600;

        // Check thresholds from most urgent to least urgent
        // Send the most urgent applicable reminder that hasn't been sent
        $sortedThresholds = self::REMINDER_THRESHOLDS;
        asort($sortedThresholds); // sort ascending by hours (3, 24, 72, 168)

        foreach ($sortedThresholds as $key => $threshold) {
            if ($hoursUntilDue <= $threshold && !$survey->hasReminderBeenSent($key)) {
                return $key;
            }
        }

        return null;
    }

    /**
     * Resolve all target users for a survey based on teams, clubs, and platform flag.
     *
     * @return User[]
     */
    public function getTargetUsersForSurvey(Survey $survey): array
    {
        $userIds = [];

        // Platform = all enabled users
        if ($survey->isPlatform()) {
            return $this->userRepository->findBy(['isEnabled' => true]);
        }

        // Collect users from teams (players + coaches via UserRelation)
        foreach ($survey->getTeams() as $team) {
            $teamUserIds = $this->getUserIdsForTeam($team->getId());
            $userIds = array_merge($userIds, $teamUserIds);
        }

        // Collect users from clubs (players + coaches via UserRelation)
        foreach ($survey->getClubs() as $club) {
            $clubUserIds = $this->getUserIdsForClub($club->getId());
            $userIds = array_merge($userIds, $clubUserIds);
        }

        $userIds = array_values(array_unique($userIds));

        if (empty($userIds)) {
            return [];
        }

        return $this->userRepository->findBy(['id' => $userIds, 'isEnabled' => true]);
    }

    /**
     * Get users who have been targeted by the survey but haven't responded yet.
     *
     * @return User[]
     */
    public function getUsersWhoHaveNotResponded(Survey $survey): array
    {
        $allUsers = $this->getTargetUsersForSurvey($survey);

        if (empty($allUsers)) {
            return [];
        }

        $respondedUserIds = $this->getRespondedUserIds($survey);

        return array_values(array_filter(
            $allUsers,
            fn (User $user) => !in_array($user->getId(), $respondedUserIds, true)
        ));
    }

    /**
     * Get user IDs who have already responded to a survey.
     *
     * @return int[]
     */
    private function getRespondedUserIds(Survey $survey): array
    {
        $qb = $this->entityManager->createQueryBuilder();
        $result = $qb->select('sr.userId')
            ->from('App\Entity\SurveyResponse', 'sr')
            ->where('sr.survey = :survey')
            ->setParameter('survey', $survey)
            ->getQuery()
            ->getSingleColumnResult();

        return array_map('intval', $result);
    }

    /**
     * Get user IDs associated with a team (via PlayerTeamAssignment and CoachTeamAssignment → UserRelation).
     *
     * @return int[]
     */
    private function getUserIdsForTeam(int $teamId): array
    {
        $qb = $this->entityManager->createQueryBuilder();

        // Players in team → UserRelation → User
        $playerUserIds = $qb->select('IDENTITY(ur.user)')
            ->from('App\Entity\UserRelation', 'ur')
            ->innerJoin('ur.player', 'p')
            ->innerJoin('App\Entity\PlayerTeamAssignment', 'pta', 'WITH', 'pta.player = p')
            ->where('pta.team = :teamId')
            ->setParameter('teamId', $teamId)
            ->getQuery()
            ->getSingleColumnResult();

        // Coaches in team → UserRelation → User
        $qb2 = $this->entityManager->createQueryBuilder();
        $coachUserIds = $qb2->select('IDENTITY(ur2.user)')
            ->from('App\Entity\UserRelation', 'ur2')
            ->innerJoin('ur2.coach', 'c')
            ->innerJoin('App\Entity\CoachTeamAssignment', 'cta', 'WITH', 'cta.coach = c')
            ->where('cta.team = :teamId')
            ->setParameter('teamId', $teamId)
            ->getQuery()
            ->getSingleColumnResult();

        return array_map('intval', array_merge($playerUserIds, $coachUserIds));
    }

    /**
     * Get user IDs associated with a club (via PlayerClubAssignment and CoachClubAssignment → UserRelation).
     *
     * @return int[]
     */
    private function getUserIdsForClub(int $clubId): array
    {
        $qb = $this->entityManager->createQueryBuilder();

        // Players in club → UserRelation → User
        $playerUserIds = $qb->select('IDENTITY(ur.user)')
            ->from('App\Entity\UserRelation', 'ur')
            ->innerJoin('ur.player', 'p')
            ->innerJoin('App\Entity\PlayerClubAssignment', 'pca', 'WITH', 'pca.player = p')
            ->where('pca.club = :clubId')
            ->setParameter('clubId', $clubId)
            ->getQuery()
            ->getSingleColumnResult();

        // Coaches in club → UserRelation → User
        $qb2 = $this->entityManager->createQueryBuilder();
        $coachUserIds = $qb2->select('IDENTITY(ur2.user)')
            ->from('App\Entity\UserRelation', 'ur2')
            ->innerJoin('ur2.coach', 'c')
            ->innerJoin('App\Entity\CoachClubAssignment', 'cca', 'WITH', 'cca.coach = c')
            ->where('cca.club = :clubId')
            ->setParameter('clubId', $clubId)
            ->getQuery()
            ->getSingleColumnResult();

        return array_map('intval', array_merge($playerUserIds, $coachUserIds));
    }

    /**
     * Generate user-friendly urgency text for a reminder.
     */
    private function getUrgencyText(string $reminderKey): string
    {
        return match ($reminderKey) {
            '7_days' => 'Die Umfrage läuft in 7 Tagen ab. Bitte ausfüllen, falls noch nicht geschehen.',
            '3_days' => 'Die Umfrage läuft in 3 Tagen ab. Bitte bald ausfüllen.',
            '1_day' => 'Die Umfrage läuft morgen ab! Bitte jetzt noch schnell ausfüllen.',
            '3_hours' => 'Die Umfrage läuft in wenigen Stunden ab! Letzte Chance zum Ausfüllen.',
            default => 'Die Umfrage läuft bald ab. Bitte ausfüllen.',
        };
    }
}
