<?php

namespace App\Controller\Api;

use App\Entity\CalendarEvent;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CalendarEventTypeRepository;
use App\Service\CoachTeamPlayerService;
use App\Service\PushNotificationService;
use App\Service\SizeGuidePdfService;
use DateTime;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class TeamSizeGuideController extends AbstractController
{
    public function __construct(
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
        private readonly SizeGuidePdfService $sizeGuidePdfService,
        private readonly PushNotificationService $pushNotificationService,
        private readonly EntityManagerInterface $em,
        private readonly CalendarEventTypeRepository $calendarEventTypeRepository,
    ) {
    }

    #[Route('/api/teams/size-guide-overview', name: 'api_teams_size_guide_overview', methods: ['GET'])]
    public function sizeGuideOverview(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        // Nur aktuell aktive Team-Zuordnungen des eingeloggten Coaches
        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        $result = [];
        $now = new DateTime();

        foreach ($activeTeams as $team) {
            $players = [];
            $addedUserIds = [];

            foreach ($team->getPlayerTeamAssignments() as $teamAssignment) {
                // Nur aktive Spieler-Zuordnungen berücksichtigen
                $start = $teamAssignment->getStartDate();
                $end = $teamAssignment->getEndDate();

                if ($start && $start > $now) {
                    continue;
                }
                if ($end && $end < $now) {
                    continue;
                }

                $player = $teamAssignment->getPlayer();

                $playerUser = null;
                foreach ($player->getUserRelations() as $playerRelation) {
                    /** @var UserRelation $playerRelation */
                    if ('self_player' === $playerRelation->getRelationType()->getIdentifier()) {
                        $playerUser = $playerRelation->getUser();
                        break;
                    }
                }

                if (null === $playerUser) {
                    continue;
                }

                $addedUserIds[] = $playerUser->getId();
                $players[] = [
                    'id' => $playerUser->getId(),
                    'name' => $player->getFullname(),
                    'shorts_size' => $playerUser->getPantsSize(),
                    'shirt_size' => $playerUser->getShirtSize(),
                    'shoe_size' => null !== $playerUser->getShoeSize() ? (string) $playerUser->getShoeSize() : null,
                    'socks_size' => $playerUser->getSocksSize(),
                    'jacket_size' => $playerUser->getJacketSize(),
                ];
            }

            $coaches = [];

            foreach ($team->getCoachTeamAssignments() as $coachAssignment) {
                $start = $coachAssignment->getStartDate();
                $end = $coachAssignment->getEndDate();

                if ($start && $start > $now) {
                    continue;
                }
                if ($end && $end < $now) {
                    continue;
                }

                $coach = $coachAssignment->getCoach();

                $coachUser = null;
                foreach ($coach->getUserRelations() as $coachRelation) {
                    /** @var UserRelation $coachRelation */
                    if ('self_coach' === $coachRelation->getRelationType()->getIdentifier()) {
                        $coachUser = $coachRelation->getUser();
                        break;
                    }
                }

                if (null === $coachUser) {
                    continue;
                }

                $addedUserIds[] = $coachUser->getId();
                $coaches[] = [
                    'id' => $coachUser->getId(),
                    'name' => $coach->getFullName(),
                    'shorts_size' => $coachUser->getPantsSize(),
                    'shirt_size' => $coachUser->getShirtSize(),
                    'shoe_size' => null !== $coachUser->getShoeSize() ? (string) $coachUser->getShoeSize() : null,
                    'socks_size' => $coachUser->getSocksSize(),
                    'jacket_size' => $coachUser->getJacketSize(),
                ];
            }

            $supporters = [];
            foreach ($team->getPlayerTeamAssignments() as $supAssignment) {
                $start = $supAssignment->getStartDate();
                $end = $supAssignment->getEndDate();
                if ($start && $start > $now) {
                    continue;
                }
                if ($end && $end < $now) {
                    continue;
                }
                foreach ($supAssignment->getPlayer()->getUserRelations() as $rel) {
                    $relUser = $rel->getUser();
                    if (!in_array('ROLE_SUPPORTER', $relUser->getRoles(), true)) {
                        continue;
                    }
                    if (in_array($relUser->getId(), $addedUserIds, true)) {
                        continue;
                    }
                    $addedUserIds[] = $relUser->getId();
                    $supporters[] = [
                        'id' => $relUser->getId(),
                        'name' => $relUser->getFullName(),
                        'shorts_size' => $relUser->getPantsSize(),
                        'shirt_size' => $relUser->getShirtSize(),
                        'shoe_size' => null !== $relUser->getShoeSize() ? (string) $relUser->getShoeSize() : null,
                        'socks_size' => $relUser->getSocksSize(),
                        'jacket_size' => $relUser->getJacketSize(),
                    ];
                }
            }
            foreach ($team->getCoachTeamAssignments() as $supCoachAssignment) {
                $start = $supCoachAssignment->getStartDate();
                $end = $supCoachAssignment->getEndDate();
                if ($start && $start > $now) {
                    continue;
                }
                if ($end && $end < $now) {
                    continue;
                }
                foreach ($supCoachAssignment->getCoach()->getUserRelations() as $rel) {
                    $relUser = $rel->getUser();
                    if (!in_array('ROLE_SUPPORTER', $relUser->getRoles(), true)) {
                        continue;
                    }
                    if (in_array($relUser->getId(), $addedUserIds, true)) {
                        continue;
                    }
                    $addedUserIds[] = $relUser->getId();
                    $supporters[] = [
                        'id' => $relUser->getId(),
                        'name' => $relUser->getFullName(),
                        'shorts_size' => $relUser->getPantsSize(),
                        'shirt_size' => $relUser->getShirtSize(),
                        'shoe_size' => null !== $relUser->getShoeSize() ? (string) $relUser->getShoeSize() : null,
                        'socks_size' => $relUser->getSocksSize(),
                        'jacket_size' => $relUser->getJacketSize(),
                    ];
                }
            }

            $result[] = [
                'team_id' => $team->getId(),
                'team_name' => $team->getName(),
                'players' => $players,
                'coaches' => $coaches,
                'supporters' => $supporters,
            ];
        }

        return $this->json($result);
    }

    /** Generate and download a PDF order overview for a specific team's sizes. */
    #[Route('/api/teams/{teamId}/size-guide-pdf', name: 'api_teams_size_guide_pdf', methods: ['GET'])]
    public function sizeGuidePdf(int $teamId): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        $targetTeam = null;
        foreach ($activeTeams as $team) {
            if ($team->getId() === $teamId) {
                $targetTeam = $team;
                break;
            }
        }

        if (null === $targetTeam) {
            throw new NotFoundHttpException('Team not found or access denied.');
        }

        $players = [];
        $now = new DateTime();

        foreach ($targetTeam->getPlayerTeamAssignments() as $teamAssignment) {
            $start = $teamAssignment->getStartDate();
            $end = $teamAssignment->getEndDate();

            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }

            $player = $teamAssignment->getPlayer();

            foreach ($player->getUserRelations() as $playerRelation) {
                /** @var UserRelation $playerRelation */
                if ('self_player' !== $playerRelation->getRelationType()->getIdentifier()) {
                    continue 2;
                }

                $playerUser = $playerRelation->getUser();
                $players[] = [
                    'id' => $player->getId(),
                    'name' => $player->getFullname(),
                    'shorts_size' => $playerUser->getPantsSize(),
                    'shirt_size' => $playerUser->getShirtSize(),
                    'shoe_size' => null !== $playerUser->getShoeSize() ? (string) $playerUser->getShoeSize() : null,
                    'socks_size' => $playerUser->getSocksSize(),
                    'jacket_size' => $playerUser->getJacketSize(),
                ];
            }
        }

        $pdfContent = $this->sizeGuidePdfService->generatePdf($targetTeam->getName(), $players);

        $safeTeamName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $targetTeam->getName()) ?? 'Team';
        $filename = sprintf('Bestelluebersicht_%s_%s.pdf', $safeTeamName, (new DateTime())->format('Y-m-d'));

        return new Response(
            $pdfContent,
            Response::HTTP_OK,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => sprintf('inline; filename="%s"', $filename),
                'Content-Length' => strlen($pdfContent),
            ]
        );
    }

    /** Send push notifications to players with incomplete size profiles. */
    #[Route('/api/teams/{teamId}/size-guide-remind', name: 'api_teams_size_guide_remind', methods: ['POST'])]
    public function sizeGuideRemind(int $teamId, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        $targetTeam = null;
        foreach ($activeTeams as $team) {
            if ($team->getId() === $teamId) {
                $targetTeam = $team;
                break;
            }
        }

        if (null === $targetTeam) {
            throw new NotFoundHttpException('Team not found or access denied.');
        }

        $requestBody = json_decode($request->getContent(), true) ?? [];
        $excludeIds = isset($requestBody['exclude']) && is_array($requestBody['exclude'])
            ? array_map('intval', $requestBody['exclude'])
            : [];

        $createTask = filter_var($requestBody['createTask'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $taskDueDateStr = $createTask && isset($requestBody['taskDueDate']) && is_string($requestBody['taskDueDate'])
            ? trim($requestBody['taskDueDate'])
            : null;
        $taskDueDate = null;
        if ($createTask) {
            if (!$taskDueDateStr) {
                return $this->json(['error' => 'Bitte ein Fälligkeitsdatum für die Aufgabe angeben.'], Response::HTTP_BAD_REQUEST);
            }
            try {
                $taskDueDate = new DateTimeImmutable($taskDueDateStr);
            } catch (Exception) {
                return $this->json(['error' => 'Ungültiges Fälligkeitsdatum.'], Response::HTTP_BAD_REQUEST);
            }
        }
        $aufgabeType = $createTask ? $this->calendarEventTypeRepository->findOneBy(['name' => 'Aufgabe']) : null;

        $now = new DateTime();
        $notified = 0;
        $skipped = 0;
        $processedUserIds = [];

        foreach ($targetTeam->getPlayerTeamAssignments() as $teamAssignment) {
            $start = $teamAssignment->getStartDate();
            $end = $teamAssignment->getEndDate();

            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }

            $player = $teamAssignment->getPlayer();

            $playerUser = null;
            foreach ($player->getUserRelations() as $playerRelation) {
                /** @var UserRelation $playerRelation */
                if ('self_player' === $playerRelation->getRelationType()->getIdentifier()) {
                    $playerUser = $playerRelation->getUser();
                    break;
                }
            }

            if (null === $playerUser) {
                continue;
            }

            $processedUserIds[] = $playerUser->getId();

            if (in_array($playerUser->getId(), $excludeIds, true)) {
                ++$skipped;
                continue;
            }

            $missing = [];
            if (null === $playerUser->getPantsSize() || '' === $playerUser->getPantsSize() || '0' === $playerUser->getPantsSize()) {
                $missing[] = 'Hose';
            }
            if (null === $playerUser->getShirtSize() || '' === $playerUser->getShirtSize() || '0' === $playerUser->getShirtSize()) {
                $missing[] = 'Trikot';
            }
            if (null === $playerUser->getShoeSize() || 0.0 === $playerUser->getShoeSize()) {
                $missing[] = 'Schuhgröße';
            }
            if (null === $playerUser->getSocksSize() || '' === $playerUser->getSocksSize() || '0' === $playerUser->getSocksSize()) {
                $missing[] = 'Stutzen';
            }
            if (null === $playerUser->getJacketSize() || '' === $playerUser->getJacketSize() || '0' === $playerUser->getJacketSize()) {
                $missing[] = 'Trainingsjacke';
            }

            if ([] === $missing) {
                ++$skipped;
                continue;
            }

            $notificationBody = 'Noch fehlend: ' . implode(', ', $missing) . '.';

            $this->pushNotificationService->sendNotification(
                $playerUser,
                'Ausrüstungsdaten unvollständig',
                $notificationBody,
                '/'
            );

            if ($createTask && $taskDueDate instanceof DateTimeImmutable) {
                $task = new Task();
                $task->setTitle('Ausrüstungsdaten vervollständigen');
                $task->setDescription('Noch fehlend: ' . implode(', ', $missing));
                $task->setIsRecurring(false);
                $task->setAssignedDate($taskDueDate);
                $task->setCreatedBy($user);
                $task->setRotationUsers(new ArrayCollection([$playerUser]));
                $task->setRotationCount(1);
                $this->em->persist($task);

                $calendarEvent = null;
                if ($aufgabeType) {
                    $calendarEvent = new CalendarEvent();
                    $calendarEvent->setTitle('Ausrüstungsdaten vervollständigen – ' . $playerUser->getFullName());
                    $calendarEvent->setDescription($task->getDescription());
                    $calendarEvent->setStartDate(DateTime::createFromImmutable($taskDueDate));
                    $calendarEvent->setCalendarEventType($aufgabeType);
                    $this->em->persist($calendarEvent);
                }

                $assignment = new TaskAssignment();
                $assignment->setTask($task);
                $assignment->setUser($playerUser);
                $assignment->setAssignedDate($taskDueDate);
                $assignment->setStatus('offen');
                if ($calendarEvent) {
                    $assignment->setCalendarEvent($calendarEvent);
                }
                $this->em->persist($assignment);
            }

            ++$notified;
        }

        foreach ($targetTeam->getCoachTeamAssignments() as $coachAssignment) {
            $start = $coachAssignment->getStartDate();
            $end = $coachAssignment->getEndDate();

            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }

            $coach = $coachAssignment->getCoach();

            $coachUser = null;
            foreach ($coach->getUserRelations() as $coachRelation) {
                /** @var UserRelation $coachRelation */
                if ('self_coach' === $coachRelation->getRelationType()->getIdentifier()) {
                    $coachUser = $coachRelation->getUser();
                    break;
                }
            }

            if (null === $coachUser) {
                continue;
            }

            $processedUserIds[] = $coachUser->getId();

            if (in_array($coachUser->getId(), $excludeIds, true)) {
                ++$skipped;
                continue;
            }

            $missing = [];
            if (null === $coachUser->getPantsSize() || '' === $coachUser->getPantsSize() || '0' === $coachUser->getPantsSize()) {
                $missing[] = 'Hose';
            }
            if (null === $coachUser->getShirtSize() || '' === $coachUser->getShirtSize() || '0' === $coachUser->getShirtSize()) {
                $missing[] = 'Trikot';
            }
            if (null === $coachUser->getShoeSize() || 0.0 === $coachUser->getShoeSize()) {
                $missing[] = 'Schuhgröße';
            }
            if (null === $coachUser->getSocksSize() || '' === $coachUser->getSocksSize() || '0' === $coachUser->getSocksSize()) {
                $missing[] = 'Stutzen';
            }
            if (null === $coachUser->getJacketSize() || '' === $coachUser->getJacketSize() || '0' === $coachUser->getJacketSize()) {
                $missing[] = 'Trainingsjacke';
            }

            if ([] === $missing) {
                ++$skipped;
                continue;
            }

            $notificationBody = 'Noch fehlend: ' . implode(', ', $missing) . '.';

            $this->pushNotificationService->sendNotification(
                $coachUser,
                'Ausrüstungsdaten unvollständig',
                $notificationBody,
                '/'
            );

            if ($createTask && $taskDueDate instanceof DateTimeImmutable) {
                $task = new Task();
                $task->setTitle('Ausrüstungsdaten vervollständigen');
                $task->setDescription('Noch fehlend: ' . implode(', ', $missing));
                $task->setIsRecurring(false);
                $task->setAssignedDate($taskDueDate);
                $task->setCreatedBy($user);
                $task->setRotationUsers(new ArrayCollection([$coachUser]));
                $task->setRotationCount(1);
                $this->em->persist($task);

                $calendarEvent = null;
                if ($aufgabeType) {
                    $calendarEvent = new CalendarEvent();
                    $calendarEvent->setTitle('Ausrüstungsdaten vervollständigen – ' . $coachUser->getFullName());
                    $calendarEvent->setDescription($task->getDescription());
                    $calendarEvent->setStartDate(DateTime::createFromImmutable($taskDueDate));
                    $calendarEvent->setCalendarEventType($aufgabeType);
                    $this->em->persist($calendarEvent);
                }

                $assignment = new TaskAssignment();
                $assignment->setTask($task);
                $assignment->setUser($coachUser);
                $assignment->setAssignedDate($taskDueDate);
                $assignment->setStatus('offen');
                if ($calendarEvent) {
                    $assignment->setCalendarEvent($calendarEvent);
                }
                $this->em->persist($assignment);
            }

            ++$notified;
        }

        foreach ($targetTeam->getPlayerTeamAssignments() as $supAssignment) {
            $start = $supAssignment->getStartDate();
            $end = $supAssignment->getEndDate();
            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }
            foreach ($supAssignment->getPlayer()->getUserRelations() as $rel) {
                $relUser = $rel->getUser();
                if (!in_array('ROLE_SUPPORTER', $relUser->getRoles(), true)) {
                    continue;
                }
                if (in_array($relUser->getId(), $excludeIds, true)) {
                    ++$skipped;
                    continue;
                }
                if (in_array($relUser->getId(), $processedUserIds, true)) {
                    continue;
                }
                $processedUserIds[] = $relUser->getId();
                $missing = [];
                if (null === $relUser->getPantsSize() || '' === $relUser->getPantsSize() || '0' === $relUser->getPantsSize()) {
                    $missing[] = 'Hose';
                }
                if (null === $relUser->getShirtSize() || '' === $relUser->getShirtSize() || '0' === $relUser->getShirtSize()) {
                    $missing[] = 'Trikot';
                }
                if (null === $relUser->getShoeSize() || 0.0 === $relUser->getShoeSize()) {
                    $missing[] = 'Schuhgröße';
                }
                if (null === $relUser->getSocksSize() || '' === $relUser->getSocksSize() || '0' === $relUser->getSocksSize()) {
                    $missing[] = 'Stutzen';
                }
                if (null === $relUser->getJacketSize() || '' === $relUser->getJacketSize() || '0' === $relUser->getJacketSize()) {
                    $missing[] = 'Trainingsjacke';
                }
                if ([] === $missing) {
                    ++$skipped;
                    continue;
                }
                $notificationBody = 'Noch fehlend: ' . implode(', ', $missing) . '.';
                $this->pushNotificationService->sendNotification(
                    $relUser,
                    'Ausrüstungsdaten unvollständig',
                    $notificationBody,
                    '/'
                );
                if ($createTask && $taskDueDate instanceof DateTimeImmutable) {
                    $task = new Task();
                    $task->setTitle('Ausrüstungsdaten vervollständigen');
                    $task->setDescription('Noch fehlend: ' . implode(', ', $missing));
                    $task->setIsRecurring(false);
                    $task->setAssignedDate($taskDueDate);
                    $task->setCreatedBy($user);
                    $task->setRotationUsers(new ArrayCollection([$relUser]));
                    $task->setRotationCount(1);
                    $this->em->persist($task);
                    $calendarEvent = null;
                    if ($aufgabeType) {
                        $calendarEvent = new CalendarEvent();
                        $calendarEvent->setTitle('Ausrüstungsdaten vervollständigen – ' . $relUser->getFullName());
                        $calendarEvent->setDescription($task->getDescription());
                        $calendarEvent->setStartDate(DateTime::createFromImmutable($taskDueDate));
                        $calendarEvent->setCalendarEventType($aufgabeType);
                        $this->em->persist($calendarEvent);
                    }
                    $assignment = new TaskAssignment();
                    $assignment->setTask($task);
                    $assignment->setUser($relUser);
                    $assignment->setAssignedDate($taskDueDate);
                    $assignment->setStatus('offen');
                    if ($calendarEvent) {
                        $assignment->setCalendarEvent($calendarEvent);
                    }
                    $this->em->persist($assignment);
                }
                ++$notified;
            }
        }

        foreach ($targetTeam->getCoachTeamAssignments() as $supCoachAssignment) {
            $start = $supCoachAssignment->getStartDate();
            $end = $supCoachAssignment->getEndDate();
            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }
            foreach ($supCoachAssignment->getCoach()->getUserRelations() as $rel) {
                $relUser = $rel->getUser();
                if (!in_array('ROLE_SUPPORTER', $relUser->getRoles(), true)) {
                    continue;
                }
                if (in_array($relUser->getId(), $excludeIds, true)) {
                    ++$skipped;
                    continue;
                }
                if (in_array($relUser->getId(), $processedUserIds, true)) {
                    continue;
                }
                $processedUserIds[] = $relUser->getId();
                $missing = [];
                if (null === $relUser->getPantsSize() || '' === $relUser->getPantsSize() || '0' === $relUser->getPantsSize()) {
                    $missing[] = 'Hose';
                }
                if (null === $relUser->getShirtSize() || '' === $relUser->getShirtSize() || '0' === $relUser->getShirtSize()) {
                    $missing[] = 'Trikot';
                }
                if (null === $relUser->getShoeSize() || 0.0 === $relUser->getShoeSize()) {
                    $missing[] = 'Schuhgröße';
                }
                if (null === $relUser->getSocksSize() || '' === $relUser->getSocksSize() || '0' === $relUser->getSocksSize()) {
                    $missing[] = 'Stutzen';
                }
                if (null === $relUser->getJacketSize() || '' === $relUser->getJacketSize() || '0' === $relUser->getJacketSize()) {
                    $missing[] = 'Trainingsjacke';
                }
                if ([] === $missing) {
                    ++$skipped;
                    continue;
                }
                $notificationBody = 'Noch fehlend: ' . implode(', ', $missing) . '.';
                $this->pushNotificationService->sendNotification(
                    $relUser,
                    'Ausrüstungsdaten unvollständig',
                    $notificationBody,
                    '/'
                );
                if ($createTask && $taskDueDate instanceof DateTimeImmutable) {
                    $task = new Task();
                    $task->setTitle('Ausrüstungsdaten vervollständigen');
                    $task->setDescription('Noch fehlend: ' . implode(', ', $missing));
                    $task->setIsRecurring(false);
                    $task->setAssignedDate($taskDueDate);
                    $task->setCreatedBy($user);
                    $task->setRotationUsers(new ArrayCollection([$relUser]));
                    $task->setRotationCount(1);
                    $this->em->persist($task);
                    $calendarEvent = null;
                    if ($aufgabeType) {
                        $calendarEvent = new CalendarEvent();
                        $calendarEvent->setTitle('Ausrüstungsdaten vervollständigen – ' . $relUser->getFullName());
                        $calendarEvent->setDescription($task->getDescription());
                        $calendarEvent->setStartDate(DateTime::createFromImmutable($taskDueDate));
                        $calendarEvent->setCalendarEventType($aufgabeType);
                        $this->em->persist($calendarEvent);
                    }
                    $assignment = new TaskAssignment();
                    $assignment->setTask($task);
                    $assignment->setUser($relUser);
                    $assignment->setAssignedDate($taskDueDate);
                    $assignment->setStatus('offen');
                    if ($calendarEvent) {
                        $assignment->setCalendarEvent($calendarEvent);
                    }
                    $this->em->persist($assignment);
                }
                ++$notified;
            }
        }

        if ($createTask && $notified > 0) {
            $this->em->flush();
        }

        return $this->json([
            'notified' => $notified,
            'skipped' => $skipped,
        ]);
    }
}
