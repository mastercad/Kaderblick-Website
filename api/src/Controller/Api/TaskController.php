<?php

namespace App\Controller\Api;

use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Event\TaskCompletedEvent;
use App\Repository\TaskAssignmentRepository;
use App\Repository\TaskRepository;
use App\Repository\UserRepository;
use App\Security\Voter\TaskVoter;
use App\Service\CalendarEventService;
use App\Service\TaskEventGeneratorService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/tasks', name: 'api_tasks_')]
class TaskController extends AbstractController
{
    /**
     * @return array<string, mixed>
     */
    private function serializeTask(Task $task): array
    {
        return [
            'id' => $task->getId(),
            'title' => $task->getTitle(),
            'description' => $task->getDescription(),
            'assignedDate' => $task->getAssignedDate()?->format('Y-m-d'),
            'isRecurring' => $task->isRecurring(),
            'recurrenceMode' => $task->getRecurrenceMode(),
            'recurrenceRule' => $task->getRecurrenceRule(),
            'createdBy' => [
                'id' => $task->getCreatedBy()->getId(),
                'firstName' => $task->getCreatedBy()->getFirstName(),
                'lastName' => $task->getCreatedBy()->getLastName(),
                'fullName' => $task->getCreatedBy()->getFullName(),
            ],
            'createdAt' => $task->getCreatedAt()->format('Y-m-d H:i:s'),
            'rotationUsers' => array_map(fn ($user) => [
                'id' => $user->getId(),
                'firstName' => $user->getFirstName(),
                'lastName' => $user->getLastName(),
                'fullName' => $user->getFullName(),
            ], $task->getRotationUsers()->toArray()),
            'rotationCount' => $task->getRotationCount(),
            'offset' => $task->getOffsetDays(),
            'assignments' => array_map(fn ($a) => [
                'id' => $a->getId(),
                'user' => [
                    'id' => $a->getUser()->getId(),
                    'firstName' => $a->getUser()->getFirstName(),
                    'lastName' => $a->getUser()->getLastName(),
                    'fullName' => $a->getUser()->getFullName(),
                ],
                'assignedDate' => $a->getAssignedDate()->format('Y-m-d'),
                'status' => $a->getStatus(),
                'substituteUser' => $a->getSubstituteUser() ? [
                    'id' => $a->getSubstituteUser()->getId(),
                    'fullName' => $a->getSubstituteUser()->getFullName(),
                ] : null,
            ], $task->getAssignments()->toArray()),
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    private function validateTaskPayload(array $data): ?JsonResponse
    {
        $title = trim((string) ($data['title'] ?? ''));
        if ('' === $title) {
            return new JsonResponse(['error' => 'Bitte einen Titel für die Aufgabe angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $isRecurring = filter_var($data['isRecurring'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $assignedDate = $data['assignedDate'] ?? null;
        if (!is_string($assignedDate) || '' === trim($assignedDate)) {
            if (!$isRecurring) {
                return new JsonResponse(['error' => 'Bitte ein Startdatum für die Aufgabe angeben.'], Response::HTTP_BAD_REQUEST);
            }
        } else {
            try {
                new DateTimeImmutable($assignedDate);
            } catch (Exception) {
                return new JsonResponse(['error' => 'Das Startdatum der Aufgabe ist ungültig.'], Response::HTTP_BAD_REQUEST);
            }
        }

        $recurrenceMode = (string) ($data['recurrenceMode'] ?? 'classic');
        if ($isRecurring && !in_array($recurrenceMode, ['classic', 'per_match'], true)) {
            return new JsonResponse(['error' => 'Bitte einen gültigen Wiederkehr-Modus wählen.'], Response::HTTP_BAD_REQUEST);
        }

        $rotationUsers = $data['rotationUsers'] ?? null;
        if (!is_array($rotationUsers) || 0 === count($rotationUsers)) {
            return new JsonResponse(['error' => 'Bitte mindestens einen Benutzer für die Rotation auswählen.'], Response::HTTP_BAD_REQUEST);
        }

        $rotationCount = (int) ($data['rotationCount'] ?? 0);
        if ($rotationCount < 1) {
            return new JsonResponse(['error' => 'Bitte eine gültige Anzahl Personen pro Aufgabe angeben.'], Response::HTTP_BAD_REQUEST);
        }

        if ($rotationCount > count($rotationUsers)) {
            return new JsonResponse(['error' => 'Die Anzahl gleichzeitig eingeteilter Personen darf nicht größer sein als die ausgewählte Rotation.'], Response::HTTP_BAD_REQUEST);
        }

        if ($isRecurring && 'classic' === $recurrenceMode) {
            $rawRule = $data['recurrenceRule'] ?? null;
            if (!is_string($rawRule) || '' === trim($rawRule)) {
                return new JsonResponse(['error' => 'Bitte eine gültige Wiederholungsregel angeben.'], Response::HTTP_BAD_REQUEST);
            }

            $rule = json_decode($rawRule, true);
            if (!is_array($rule)) {
                return new JsonResponse(['error' => 'Die Wiederholungsregel ist ungültig formatiert.'], Response::HTTP_BAD_REQUEST);
            }

            $freq = $rule['freq'] ?? null;
            $interval = (int) ($rule['interval'] ?? 0);
            if (!in_array($freq, ['DAILY', 'WEEKLY', 'MONTHLY'], true) || $interval < 1) {
                return new JsonResponse(['error' => 'Bitte eine gültige Frequenz und ein Intervall größer als 0 angeben.'], Response::HTTP_BAD_REQUEST);
            }

            if ('WEEKLY' === $freq) {
                $byDay = $rule['byday'] ?? null;
                if (!is_array($byDay) || 0 === count($byDay) || !is_string($byDay[0]) || '' === trim($byDay[0])) {
                    return new JsonResponse(['error' => 'Bitte einen gültigen Wochentag auswählen.'], Response::HTTP_BAD_REQUEST);
                }
            }

            if ('MONTHLY' === $freq) {
                $byMonthDay = (int) ($rule['bymonthday'] ?? 0);
                if ($byMonthDay < 1 || $byMonthDay > 31) {
                    return new JsonResponse(['error' => 'Bitte einen gültigen Monatstag zwischen 1 und 31 angeben.'], Response::HTTP_BAD_REQUEST);
                }
            }
        }

        if ($isRecurring && 'per_match' === $recurrenceMode) {
            $offset = (int) ($data['offset'] ?? 0);
            if ($offset < -365 || $offset > 365) {
                return new JsonResponse(['error' => 'Bitte einen gültigen Spiel-Versatz zwischen -365 und 365 Tagen angeben.'], Response::HTTP_BAD_REQUEST);
            }
        }

        return null;
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(TaskRepository $taskRepository, SerializerInterface $serializer): JsonResponse
    {
        $tasks = $taskRepository->findAll();

        $tasks = array_values(array_filter($tasks, fn ($task) => $this->isGranted(TaskVoter::VIEW, $task)));

        return $this->json([
            'tasks' => array_map(fn ($task) => $this->serializeTask($task), $tasks),
        ]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Task $task, SerializerInterface $serializer): JsonResponse
    {
        if (!$this->isGranted(TaskVoter::VIEW, $task)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = $serializer->serialize($task, 'json', ['groups' => ['task:read', 'assignment:read']]);

        return JsonResponse::fromJsonString($data, Response::HTTP_OK);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        UserRepository $userRepository,
        TaskEventGeneratorService $taskEventGeneratorService
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $validationError = $this->validateTaskPayload($data);
        if ($validationError instanceof JsonResponse) {
            return $validationError;
        }

        $task = new Task();
        $task->setTitle(trim((string) $data['title']));
        $task->setAssignedDate(new DateTimeImmutable((string) ($data['assignedDate'] ?? 'now')));
        $description = array_key_exists('description', $data) ? trim((string) $data['description']) : '';
        $task->setDescription('' === $description ? null : $description);

        if (!$this->isGranted(TaskVoter::CREATE, $task)) {
            return $this->json(['error' => 'Zugriff für anlegen verweigert'], 403);
        }

        $isRecurring = filter_var($data['isRecurring'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $task->setIsRecurring($isRecurring);
        $task->setRecurrenceMode((string) ($data['recurrenceMode'] ?? 'classic'));
        $task->setRecurrenceRule($isRecurring ? ($data['recurrenceRule'] ?? null) : null);
        $task->setRotationCount((int) ($data['rotationCount'] ?? 1));
        $task->setOffsetDays($isRecurring && 'per_match' === $task->getRecurrenceMode() ? (int) ($data['offset'] ?? 0) : 0);

        if (!empty($data['rotationUsers']) && is_array($data['rotationUsers'])) {
            $users = $userRepository->findBy(['id' => $data['rotationUsers']]);
            $task->setRotationUsers(new ArrayCollection($users));
        }

        $task->setCreatedBy($user);

        $em->persist($task);
        $em->flush();

        $taskEventGeneratorService->generateEvents($task, $user);

        return new JsonResponse($this->serializeTask($task), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT', 'PATCH'])]
    public function update(
        Task $task,
        Request $request,
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        UserRepository $userRepository,
        TaskEventGeneratorService $taskEventGeneratorService
    ): JsonResponse {
        $this->denyAccessUnlessGranted(TaskVoter::EDIT, $task);

        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $mergedData = [
            'title' => $data['title'] ?? $task->getTitle(),
            'assignedDate' => $data['assignedDate'] ?? $task->getAssignedDate()?->format('Y-m-d') ?? 'now',
            'description' => array_key_exists('description', $data) ? $data['description'] : $task->getDescription(),
            'isRecurring' => $data['isRecurring'] ?? $task->isRecurring(),
            'recurrenceMode' => $data['recurrenceMode'] ?? $task->getRecurrenceMode(),
            'recurrenceRule' => array_key_exists('recurrenceRule', $data) ? $data['recurrenceRule'] : $task->getRecurrenceRule(),
            'rotationCount' => $data['rotationCount'] ?? $task->getRotationCount(),
            'rotationUsers' => array_key_exists('rotationUsers', $data)
                ? $data['rotationUsers']
                : array_map(static fn (User $rotationUser) => $rotationUser->getId(), $task->getRotationUsers()->toArray()),
            'offset' => $data['offset'] ?? $task->getOffsetDays(),
        ];

        $validationError = $this->validateTaskPayload($mergedData);
        if ($validationError instanceof JsonResponse) {
            return $validationError;
        }

        if (isset($data['title'])) {
            $task->setTitle(trim((string) $data['title']));
        }
        if (isset($data['assignedDate'])) {
            $task->setAssignedDate(new DateTimeImmutable((string) $data['assignedDate']));
        } elseif (null === $task->getAssignedDate()) {
            $task->setAssignedDate(new DateTimeImmutable('now'));
        }
        if (array_key_exists('description', $data)) {
            $description = trim((string) $data['description']);
            $task->setDescription('' === $description ? null : $description);
        }

        if (isset($data['isRecurring'])) {
            $task->setIsRecurring(filter_var($data['isRecurring'], FILTER_VALIDATE_BOOLEAN));
        }
        if (array_key_exists('recurrenceMode', $data)) {
            $task->setRecurrenceMode((string) $data['recurrenceMode']);
        }
        if (array_key_exists('recurrenceRule', $data)) {
            $task->setRecurrenceRule($task->isRecurring() ? $data['recurrenceRule'] : null);
        }
        if (array_key_exists('rotationCount', $data)) {
            $task->setRotationCount((int) $data['rotationCount']);
        }
        if (array_key_exists('offset', $data)) {
            $task->setOffsetDays($task->isRecurring() && 'per_match' === $task->getRecurrenceMode() ? (int) $data['offset'] : 0);
        }
        if (array_key_exists('rotationUsers', $data) && is_array($data['rotationUsers'])) {
            if (0 === count($data['rotationUsers'])) {
                $task->setRotationUsers(new ArrayCollection());
            } else {
                $users = $userRepository->findBy(['id' => $data['rotationUsers']]);
                $task->setRotationUsers(new ArrayCollection($users));
            }
        }

        $em->flush();

        $taskEventGeneratorService->generateEvents($task, $user);

        return new JsonResponse($this->serializeTask($task), Response::HTTP_OK);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Task $task, CalendarEventService $calendarEventService, EntityManagerInterface $em): JsonResponse
    {
        $this->denyAccessUnlessGranted(TaskVoter::DELETE, $task);

        $calendarEventService->deleteCalendarEventsForTask($task);

        $em->remove($task);
        $em->flush();

        return new JsonResponse(['message' => 'Task deleted successfully with all Dependencies'], Response::HTTP_OK);
    }

    #[Route('/assignments/{assignmentId}', name: 'assignment_update', methods: ['PUT', 'PATCH'])]
    public function updateAssignment(
        int $assignmentId,
        Request $request,
        TaskAssignmentRepository $assignmentRepo,
        EntityManagerInterface $em,
        SerializerInterface $serializer,
        EventDispatcherInterface $dispatcher
    ): JsonResponse {
        $assignment = $assignmentRepo->find($assignmentId);
        if (!$assignment) {
            return new JsonResponse(['error' => 'Assignment not found'], Response::HTTP_NOT_FOUND);
        }
        $data = json_decode($request->getContent(), true);
        if (isset($data['status'])) {
            $assignment->setStatus($data['status']);
        }
        if (isset($data['assignedDate'])) {
            $assignment->setAssignedDate(new DateTimeImmutable($data['assignedDate']));
        }
        $em->flush();

        if (isset($data['status']) && 'erledigt' === $data['status']) {
            $assignedUser = $assignment->getUser();
            if ($assignedUser instanceof User) {
                $dispatcher->dispatch(new TaskCompletedEvent($assignedUser, $assignment->getTask()));
            }
        }

        $json = $serializer->serialize($assignment, 'json', ['groups' => ['assignment:read']]);

        return JsonResponse::fromJsonString($json, Response::HTTP_OK);
    }

    #[Route('/assignments/{assignmentId}', name: 'assignment_delete', methods: ['DELETE'])]
    public function deleteAssignment(
        int $assignmentId,
        TaskAssignmentRepository $assignmentRepo,
        EntityManagerInterface $em,
        Request $request
    ): JsonResponse {
        $assignment = $assignmentRepo->find($assignmentId);
        if (!$assignment) {
            return new JsonResponse(['error' => 'Assignment not found'], Response::HTTP_NOT_FOUND);
        }

        $deleteMode = $request->query->get('deleteMode', 'single');
        $task = $assignment->getTask();

        // Bei deleteMode=series: Lösche einfach den Task und seine Assignments (keine Serien-Logik mehr)
        if ('series' === $deleteMode) {
            foreach ($task->getAssignments() as $assignmentToDelete) {
                $em->remove($assignmentToDelete);
            }
            $em->remove($task);
            $em->flush();

            return new JsonResponse(['message' => 'Task deleted successfully'], Response::HTTP_OK);
        }

        // Einzelnes Assignment löschen
        $em->remove($assignment);
        $em->flush();

        return new JsonResponse(['message' => 'Task assignment deleted successfully'], Response::HTTP_OK);
    }

    #[Route('/{id}/assignments', name: 'assignments_create', methods: ['POST'])]
    public function createAssignment(Task $task, Request $request, EntityManagerInterface $em, SerializerInterface $serializer): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $assignment = new TaskAssignment();
        $assignment->setTask($task);
        $assignment->setUser($user);
        $assignment->setAssignedDate(new DateTimeImmutable($data['assignedDate'] ?? 'now'));
        $assignment->setStatus($data['status'] ?? 'offen');
        $em->persist($assignment);
        $em->flush();
        $json = $serializer->serialize($assignment, 'json', ['groups' => ['assignment:read']]);

        return JsonResponse::fromJsonString($json, Response::HTTP_CREATED);
    }
}
