<?php

namespace App\Service;

use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Repository\CalendarEventRepository;
use App\Repository\CalendarEventTypeRepository;
use App\Repository\UserRelationRepository;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

class TaskEventGeneratorService
{
    public function __construct(
        private EntityManagerInterface $em,
        private CalendarEventTypeRepository $calendarEventTypeRepository,
        private CalendarEventRepository $calendarEventRepository,
        private UserRelationRepository $userRelationRepository
    ) {
    }

    public function generateEvents(Task $task, User $user): void
    {
        $futureAssignments = $this->em->getRepository(TaskAssignment::class)
            ->createQueryBuilder('ta')
            ->where('ta.task = :task')
            ->andWhere('ta.assignedDate >= :now')
            ->setParameter('task', $task)
            ->setParameter('now', new DateTime())
            ->getQuery()
            ->getResult() ?? [];

        foreach ($futureAssignments as $assignment) {
            if ($assignment->getCalendarEvent()) {
                $this->em->remove($assignment->getCalendarEvent());
            }
            $this->em->remove($assignment);
        }
        $this->em->flush();

        if ('per_match' === $task->getRecurrenceMode()) {
            $this->generatePerMatchOccurrences($task, $user);
        } elseif ($task->isRecurring() && 'classic' === $task->getRecurrenceMode()) {
            $this->generateClassicOccurrences($task, $user);
        } elseif (!$task->isRecurring()) {
            $this->generateSingleOccurrence($task, $user);
        }
    }

    public function generateSingleOccurrence(Task $task, User $user): void
    {
        $aufgabeType = $this->calendarEventTypeRepository->findOneBy(['name' => 'Aufgabe']);
        if (!$aufgabeType) {
            return;
        }

        $assignedDate = $task->getAssignedDate();
        $startDate = $assignedDate instanceof DateTimeImmutable
            ? $assignedDate
            : new DateTimeImmutable($assignedDate?->format('Y-m-d') ?? 'now');

        $users = $task->getRotationUsers()->toArray();
        if (0 === count($users)) {
            $users = [$user];
        }

        $rotationCount = min($task->getRotationCount() ?? 1, count($users));

        for ($index = 0; $index < $rotationCount; ++$index) {
            $assignedUser = $users[$index];

            $assignment = new TaskAssignment();
            $assignment->setTask($task);
            $assignment->setUser($assignedUser);
            $assignment->setSubstituteUser($user);
            $assignment->setAssignedDate($startDate);
            $assignment->setStatus('offen');
            $this->em->persist($assignment);

            $aufgabeEvent = new CalendarEvent();
            $aufgabeEvent->setTitle($task->getTitle() . ' - ' . $assignedUser->getFullName());
            $aufgabeEvent->setDescription($task->getDescription());
            $aufgabeEvent->setStartDate($startDate);
            $aufgabeEvent->setCalendarEventType($aufgabeType);
            $this->em->persist($aufgabeEvent);
            $this->em->flush();

            $assignment->setCalendarEvent($aufgabeEvent);
        }

        $this->em->flush();
    }

    /**
     * Generiert Task-Occurrences pro Spiel mit Rotation.
     */
    public function generatePerMatchOccurrences(Task $task, User $user): void
    {
        if ('per_match' !== $task->getRecurrenceMode()) {
            return;
        }

        $aufgabeType = $this->calendarEventTypeRepository->findOneBy(['name' => 'Aufgabe']);
        $spielType = $this->calendarEventTypeRepository->findOneBy(['name' => 'Spiel']);

        if (!$aufgabeType || !$spielType) {
            return;
        }

        // Hole alle zukünftigen Spiel-Events (ab jetzt), damit vergangene Assignments,
        // die in generateEvents() bewusst erhalten werden (assignedDate < now),
        // nicht erneut angelegt und dadurch dupliziert werden.
        $startDate = new DateTimeImmutable();

        $spielEvents = $this->calendarEventRepository->createQueryBuilder('ce')
            ->where('ce.calendarEventType = :spielType')
            ->andWhere('ce.startDate >= :startDate')
            ->setParameter('spielType', $spielType)
            ->setParameter('startDate', $startDate)
            ->orderBy('ce.startDate', 'ASC')
            ->getQuery()->getResult();

        $users = $task->getRotationUsers()->toArray();

        if (0 === count($users)) {
            $users = [$user];
        }

        $rotationCount = $task->getRotationCount() ?? 1;
        $userIndex = 0;

        $userGames = [];
        foreach ($users as $user) {
            $userRelations = $this->userRelationRepository->findBy(['user' => $user]);
            $userTeams = [];
            foreach ($userRelations as $rel) {
                if ($rel->getPlayer() instanceof Player) {
                    foreach ($rel->getPlayer()->getPlayerTeamAssignments() as $assignment) {
                        $userTeams[$assignment->getTeam()->getId()] = $assignment->getTeam();
                    }
                }
                if ($rel->getCoach() instanceof Coach) {
                    foreach ($rel->getCoach()->getCoachTeamAssignments() as $assignment) {
                        $userTeams[$assignment->getTeam()->getId()] = $assignment->getTeam();
                    }
                }
            }
            $userGames[$user->getId()] = ['user' => $user, 'teams' => $userTeams];
        }

        // Gehe durch alle Spiel-Events und erstelle Task-Occurrences mit Rotation
        foreach ($spielEvents as $spielEvent) {
            $game = $spielEvent->getGame();
            if (!$game) {
                continue;
            }

            // Finde alle User, die für dieses Spiel berechtigt sind
            $eligibleUsers = [];
            foreach ($userGames as $userData) {
                $userTeams = $userData['teams'];
                $homeTeamId = $game->getHomeTeam()->getId();
                $awayTeamId = $game->getAwayTeam()->getId();

                foreach ($userTeams as $team) {
                    if ($team->getId() === $homeTeamId || $team->getId() === $awayTeamId) {
                        $eligibleUsers[] = $userData['user'];
                        break;
                    }
                }
            }

            if (0 === count($eligibleUsers)) {
                $eligibleUsers = [$user];
            }

            $offsetDays = $task->getOffsetDays() ?? 0;

            // Rotiere durch die berechtigten User und erstelle Task-Occurrences
            for ($i = 0; $i < $rotationCount; ++$i) {
                if ($userIndex >= count($eligibleUsers)) {
                    $userIndex = 0;
                }
                $assignedUser = $eligibleUsers[$userIndex];
                ++$userIndex;

                $startDateWithOffset = (clone $spielEvent->getStartDate())
                    ->modify(($offsetDays >= 0 ? '+' : '') . $offsetDays . ' days');

                $endDateWithOffset = (clone $spielEvent->getEndDate())
                    ->modify(($offsetDays >= 0 ? '+' : '') . $offsetDays . ' days');

                // Erstelle TaskAssignment
                $assignment = new TaskAssignment();
                $assignment->setTask($task);
                $assignment->setUser($assignedUser);
                $assignment->setSubstituteUser($user);
                $assignment->setAssignedDate($startDateWithOffset);
                $assignment->setStatus('offen');

                $this->em->persist($assignment);

                // Erstelle CalendarEvent und referenziere es
                $aufgabeEvent = new CalendarEvent();
                $aufgabeEvent->setTitle($task->getTitle() . ' - ' . $assignedUser->getFullName() . ' - ' . $spielEvent->getTitle());
                $aufgabeEvent->setDescription($task->getDescription());
                $aufgabeEvent->setStartDate($startDateWithOffset);
                $aufgabeEvent->setEndDate($endDateWithOffset);
                $aufgabeEvent->setCalendarEventType($aufgabeType);
                $aufgabeEvent->setLocation($spielEvent->getLocation());

                $this->em->persist($aufgabeEvent);
                $this->em->flush();

                // Link Assignment ↔ CalendarEvent
                $assignment->setCalendarEvent($aufgabeEvent);
            }
        }
        $this->em->flush();
    }

    /**
     * Generiert Task-Occurrences nach Recurrence-Rule (Classic).
     */
    public function generateClassicOccurrences(Task $task, User $user): void
    {
        if ('classic' !== $task->getRecurrenceMode() || !$task->isRecurring()) {
            return;
        }

        $aufgabeType = $this->calendarEventTypeRepository->findOneBy(['name' => 'Aufgabe']);
        if (!$aufgabeType) {
            return;
        }

        $rule = json_decode($task->getRecurrenceRule() ?? '', true);
        if (!$rule || !isset($rule['freq']) || !isset($rule['interval'])) {
            return;
        }

        $assignedDate = $task->getAssignedDate();
        $startDate = $assignedDate instanceof DateTimeImmutable
            ? $assignedDate
            : new DateTimeImmutable($assignedDate?->format('Y-m-d') ?? 'now');
        $dates = [];

        // Erzeuge nächste 12 Vorkommnisse basierend auf Rule
        for ($i = 0; $i < 12; ++$i) {
            if ('WEEKLY' === $rule['freq']) {
                $date = $startDate->modify('+' . ($i * $rule['interval']) . ' week');
                if (isset($rule['byday'])) {
                    $weekday = $rule['byday'];
                    $date = $date->modify('next ' . $this->weekdayToString($weekday[0]));
                }
                $dates[] = $date;
            } elseif ('MONTHLY' === $rule['freq']) {
                $date = $startDate->modify('+' . ($i * $rule['interval']) . ' month');
                if (isset($rule['bymonthday'])) {
                    $date = $date->setDate((int) $date->format('Y'), (int) $date->format('m'), (int) $rule['bymonthday']);
                }
                $dates[] = $date;
            } elseif ('DAILY' === $rule['freq']) {
                $dates[] = $startDate->modify('+' . ($i * $rule['interval']) . ' day');
            }
        }

        $users = $task->getRotationUsers()->toArray();

        if (0 === count($users)) {
            $users = [$user];
        }

        $rotationCount = $task->getRotationCount() ?? 1;
        $userIndex = 0;

        foreach ($dates as $date) {
            // Für jede Wiederholung: Benutzer im Rotationsprinzip zuweisen
            for ($j = 0; $j < $rotationCount; ++$j) {
                $assignedUser = $users[($userIndex++) % count($users)];

                // Erstelle TaskAssignment
                $assignment = new TaskAssignment();
                $assignment->setTask($task);
                $assignment->setUser($assignedUser);
                $assignment->setSubstituteUser($user);
                $assignment->setAssignedDate($date);
                $assignment->setStatus('offen');
                $this->em->persist($assignment);

                // Erstelle CalendarEvent
                $aufgabeEvent = new CalendarEvent();
                $aufgabeEvent->setTitle($task->getTitle() . ' - ' . $assignedUser->getFullName());
                $aufgabeEvent->setDescription($task->getDescription());
                $aufgabeEvent->setStartDate($date);
                $aufgabeEvent->setCalendarEventType($aufgabeType);
                $this->em->persist($aufgabeEvent);
                $this->em->flush();

                // Link Assignment ↔ CalendarEvent
                $assignment->setCalendarEvent($aufgabeEvent);
            }
        }
        $this->em->flush();
    }

    private function weekdayToString(string $weekday): string
    {
        $map = [
            'MO' => 'Monday',
            'TU' => 'Tuesday',
            'WE' => 'Wednesday',
            'TH' => 'Thursday',
            'FR' => 'Friday',
            'SA' => 'Saturday',
            'SU' => 'Sunday',
        ];

        return $map[$weekday] ?? 'Monday';
    }
}
