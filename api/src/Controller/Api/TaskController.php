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
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(TaskRepository $taskRepository, SerializerInterface $serializer): JsonResponse
    {
        $tasks = $taskRepository->findAll();

        $tasks = array_values(array_filter($tasks, fn ($task) => $this->isGranted(TaskVoter::VIEW, $task)));

        return $this->json([
            'tasks' => array_map(fn ($task) => [
                'id' => $task->getId(),
                'title' => $task->getTitle(),
                'description' => $task->getDescription(),
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
            ], $tasks),
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
        $task = new Task();
        $task->setTitle($data['title'] ?? '');
        $task->setDescription($data['description'] ?? null);

        if (!$this->isGranted(TaskVoter::CREATE, $task)) {
            return $this->json(['error' => 'Zugriff für anlegen verweigert'], 403);
        }

        $isRecurring = $data['isRecurring'] ?? false;

        $task->setIsRecurring($isRecurring);
        $task->setRecurrenceMode($data['recurrenceMode'] ?? 'classic');
        $task->setRecurrenceRule($data['recurrenceRule'] ?? null);
        $task->setRotationCount($data['rotationCount'] ?? 1);

        if (
            $isRecurring
            && !empty($data['rotationUsers'])
            && is_array($data['rotationUsers'])
        ) {
            $users = $userRepository->findBy(['id' => $data['rotationUsers']]);
            $task->setRotationUsers(new ArrayCollection($users));
        }

        $task->setCreatedBy($user);

        $em->persist($task);
        $em->flush();

        $taskEventGeneratorService->generateEvents($task, $user);

        $json = $serializer->serialize($task, 'json', ['groups' => ['task:read']]);

        return JsonResponse::fromJsonString($json, Response::HTTP_CREATED);
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
        if (isset($data['title'])) {
            $task->setTitle($data['title']);
        }
        if (array_key_exists('description', $data)) {
            $task->setDescription($data['description']);
        }

        if (isset($data['isRecurring'])) {
            $task->setIsRecurring($data['isRecurring']);
        }
        if (array_key_exists('recurrenceMode', $data)) {
            $task->setRecurrenceMode($data['recurrenceMode']);
        }
        if (array_key_exists('recurrenceRule', $data)) {
            $task->setRecurrenceRule($data['recurrenceRule']);
        }
        if (array_key_exists('rotationCount', $data)) {
            $task->setRotationCount($data['rotationCount']);
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

        $json = $serializer->serialize($task, 'json', ['groups' => ['task:read']]);

        return JsonResponse::fromJsonString($json, Response::HTTP_OK);
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
