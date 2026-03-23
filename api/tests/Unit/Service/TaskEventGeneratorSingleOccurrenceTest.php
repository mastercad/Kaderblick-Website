<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Repository\CalendarEventRepository;
use App\Repository\CalendarEventTypeRepository;
use App\Repository\UserRelationRepository;
use App\Service\TaskEventGeneratorService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[AllowMockObjectsWithoutExpectations]
class TaskEventGeneratorSingleOccurrenceTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private CalendarEventTypeRepository&MockObject $calendarEventTypeRepository;
    private CalendarEventRepository&MockObject $calendarEventRepository;
    private UserRelationRepository&MockObject $userRelationRepository;
    private TaskEventGeneratorService $service;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventTypeRepository = $this->createMock(CalendarEventTypeRepository::class);
        $this->calendarEventRepository = $this->createMock(CalendarEventRepository::class);
        $this->userRelationRepository = $this->createMock(UserRelationRepository::class);

        $this->service = new TaskEventGeneratorService(
            $this->entityManager,
            $this->calendarEventTypeRepository,
            $this->calendarEventRepository,
            $this->userRelationRepository,
        );
    }

    public function testGenerateEventsCreatesSingleOccurrenceForNonRecurringTask(): void
    {
        $task = new Task();
        $task->setTitle('Bälle mitbringen');
        $task->setDescription('Bitte fünf Bälle organisieren');
        $task->setIsRecurring(false);
        $task->setAssignedDate(new DateTimeImmutable('2026-04-12'));
        $task->setRotationCount(1);

        $assignedUser = new User();
        $assignedUser->setFirstName('Max');
        $assignedUser->setLastName('Mustermann');
        $assignedUserReflection = new ReflectionClass($assignedUser);
        $assignedUserReflection->getProperty('id')->setValue($assignedUser, 77);
        $task->setRotationUsers(new ArrayCollection([$assignedUser]));

        $creator = new User();
        $creator->setFirstName('Admin');
        $creator->setLastName('User');
        $creatorReflection = new ReflectionClass($creator);
        $creatorReflection->getProperty('id')->setValue($creator, 99);

        $aufgabeType = new CalendarEventType();
        $aufgabeType->setName('Aufgabe');

        $this->calendarEventTypeRepository->method('findOneBy')
            ->with(['name' => 'Aufgabe'])
            ->willReturn($aufgabeType);

        $oldAssignmentsQuery = $this->createMock(Query::class);
        $oldAssignmentsQuery->method('getResult')->willReturn([]);

        $oldAssignmentsQb = $this->createMock(QueryBuilder::class);
        $oldAssignmentsQb->method('where')->willReturnSelf();
        $oldAssignmentsQb->method('andWhere')->willReturnSelf();
        $oldAssignmentsQb->method('setParameter')->willReturnSelf();
        $oldAssignmentsQb->method('getQuery')->willReturn($oldAssignmentsQuery);

        $assignmentRepo = $this->createMock(EntityRepository::class);
        $assignmentRepo->method('createQueryBuilder')->willReturn($oldAssignmentsQb);

        $this->entityManager->method('getRepository')->willReturn($assignmentRepo);

        $persisted = [];
        $this->entityManager->expects($this->atLeast(2))
            ->method('persist')
            ->willReturnCallback(function (object $entity) use (&$persisted): void {
                $persisted[] = $entity;
            });
        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $this->service->generateEvents($task, $creator);

        $assignment = array_values(array_filter($persisted, static fn (object $entity): bool => $entity instanceof TaskAssignment))[0] ?? null;
        $calendarEvent = array_values(array_filter($persisted, static fn (object $entity): bool => $entity instanceof CalendarEvent))[0] ?? null;

        self::assertInstanceOf(TaskAssignment::class, $assignment);
        self::assertInstanceOf(CalendarEvent::class, $calendarEvent);
        self::assertSame('2026-04-12', $assignment->getAssignedDate()->format('Y-m-d'));
        self::assertSame('2026-04-12', $calendarEvent->getStartDate()->format('Y-m-d'));
        self::assertSame($assignedUser, $assignment->getUser());
    }
}
