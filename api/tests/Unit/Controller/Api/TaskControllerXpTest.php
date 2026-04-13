<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\TaskController;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Event\TaskCompletedEvent;
use App\Repository\TaskAssignmentRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Tests that TaskController::updateAssignment() dispatches TaskCompletedEvent
 * when the assignment status is set to 'erledigt'.
 */
#[AllowMockObjectsWithoutExpectations]
class TaskControllerXpTest extends TestCase
{
    /** @var EventDispatcherInterface&MockObject */
    private EventDispatcherInterface $dispatcher;
    /** @var SerializerInterface&MockObject */
    private SerializerInterface $serializer;
    /** @var EntityManagerInterface&MockObject */
    private EntityManagerInterface $em;
    private TaskController $controller;

    protected function setUp(): void
    {
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->serializer = $this->createMock(SerializerInterface::class);
        $this->serializer->method('serialize')->willReturn('{}');
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->controller = new TaskController();

        // TaskController uses isGranted() on task list; for updateAssignment there
        // are no isGranted/getUser calls, so no container wiring is required.
        // We still set a minimal container to prevent missing-container errors from json().
        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn(null);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->createMock(AuthorizationCheckerInterface::class));
        $this->controller->setContainer($container);
    }

    public function testDispatchesTaskCompletedEventWhenStatusIsErledigt(): void
    {
        $user = $this->createMock(User::class);
        $task = $this->createMock(Task::class);
        $assignment = $this->makeAssignment($user, $task);

        $assignmentRepo = $this->makeAssignmentRepo($assignment);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(TaskCompletedEvent::class));

        $request = new Request(content: json_encode(['status' => 'erledigt']));
        $this->controller->updateAssignment(1, $request, $assignmentRepo, $this->em, $this->serializer, $this->dispatcher);
    }

    public function testNoEventDispatchedWhenStatusIsNotErledigt(): void
    {
        $user = $this->createMock(User::class);
        $task = $this->createMock(Task::class);
        $assignment = $this->makeAssignment($user, $task);

        $assignmentRepo = $this->makeAssignmentRepo($assignment);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(content: json_encode(['status' => 'offen']));
        $this->controller->updateAssignment(1, $request, $assignmentRepo, $this->em, $this->serializer, $this->dispatcher);
    }

    public function testNoEventDispatchedWhenAssignmentHasNoUser(): void
    {
        $task = $this->createMock(Task::class);
        $assignment = $this->makeAssignment(null, $task);

        $assignmentRepo = $this->makeAssignmentRepo($assignment);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(content: json_encode(['status' => 'erledigt']));
        $this->controller->updateAssignment(1, $request, $assignmentRepo, $this->em, $this->serializer, $this->dispatcher);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function makeAssignment(?User $user, Task $task): TaskAssignment&MockObject
    {
        $assignment = $this->createMock(TaskAssignment::class);
        $assignment->method('getUser')->willReturn($user);
        $assignment->method('getTask')->willReturn($task);

        return $assignment;
    }

    private function makeAssignmentRepo(TaskAssignment $assignment): TaskAssignmentRepository&MockObject
    {
        $repo = $this->createMock(TaskAssignmentRepository::class);
        $repo->method('find')->with(1)->willReturn($assignment);

        return $repo;
    }
}
