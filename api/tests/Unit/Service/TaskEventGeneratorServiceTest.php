<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Task;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
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
class TaskEventGeneratorServiceTest extends TestCase
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
            $this->userRelationRepository
        );
    }

    public function testGeneratePerMatchEventsWithNoUsers(): void
    {
        $task = new Task();
        $task->setRecurrenceMode('per_match');
        $task->setRotationUsers(new ArrayCollection([]));

        $aufgabeType = new CalendarEventType();
        $spielType = new CalendarEventType();

        $this->calendarEventTypeRepository->method('findOneBy')
            ->willReturnMap([
                [['name' => 'Aufgabe'], null, null, $aufgabeType],
                [['name' => 'Spiel'], null, null, $spielType],
            ]);

        // Mock QueryBuilder für Task-Occurrences löschen
        $occurrenceQuery = $this->createMock(Query::class);
        $occurrenceQuery->method('getResult')->willReturn([]);

        $occurrenceQb = $this->createMock(QueryBuilder::class);
        $occurrenceQb->method('where')->willReturnSelf();
        $occurrenceQb->method('andWhere')->willReturnSelf();
        $occurrenceQb->method('setParameter')->willReturnSelf();
        $occurrenceQb->method('getQuery')->willReturn($occurrenceQuery);

        // Mock QueryBuilder für Spiel-Events
        $spielQuery = $this->createMock(Query::class);
        $spielQuery->method('getResult')->willReturn([]);

        $spielQb = $this->createMock(QueryBuilder::class);
        $spielQb->method('where')->willReturnSelf();
        $spielQb->method('andWhere')->willReturnSelf();
        $spielQb->method('setParameter')->willReturnSelf();
        $spielQb->method('orderBy')->willReturnSelf();
        $spielQb->method('getQuery')->willReturn($spielQuery);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('createQueryBuilder')->willReturn($occurrenceQb);

        $this->calendarEventRepository->method('createQueryBuilder')->willReturn($spielQb);
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function ($class) use ($taskRepo) {
                if (Task::class === $class) {
                    return $taskRepo;
                }

                return $this->createMock(EntityRepository::class);
            });

        $this->entityManager->expects($this->atLeast(0))->method('persist');
        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $user = new User();
        $this->service->generateEvents($task, $user);
    }

    public function testGeneratePerMatchEventsWithSingleUserAndMultipleGames(): void
    {
        // Setup Task
        $task = new Task();
        $task->setTitle('Torwart');
        $task->setDescription('Torwart-Aufgabe');
        $task->setRecurrenceMode('per_match');
        $task->setRotationCount(1);

        $taskCreator = new User();
        $taskCreator->setFirstName('Admin');
        $taskCreator->setLastName('User');
        $creatorReflection = new ReflectionClass($taskCreator);
        $creatorIdProperty = $creatorReflection->getProperty('id');
        $creatorIdProperty->setValue($taskCreator, 99);
        $task->setCreatedBy($taskCreator);

        $user = new User();
        $user->setFirstName('Max');
        $user->setLastName('Mustermann');
        $userReflection = new ReflectionClass($user);
        $userIdProperty = $userReflection->getProperty('id');
        $userIdProperty->setValue($user, 1);

        $team = new Team();
        $teamReflection = new ReflectionClass($team);
        $teamIdProperty = $teamReflection->getProperty('id');
        $teamIdProperty->setValue($team, 1);

        $player = new Player();
        $playerAssignment = new PlayerTeamAssignment();
        $playerAssignment->setTeam($team);
        $player->addPlayerTeamAssignment($playerAssignment);

        $userRelation = new UserRelation();
        $userRelation->setUser($user);
        $userRelation->setPlayer($player);

        $task->setRotationUsers(new ArrayCollection([$user]));

        // Setup Calendar Event Types
        $aufgabeType = new CalendarEventType();
        $aufgabeType->setName('Aufgabe');
        $spielType = new CalendarEventType();
        $spielType->setName('Spiel');

        $this->calendarEventTypeRepository->method('findOneBy')
            ->willReturnMap([
                [['name' => 'Aufgabe'], null, null, $aufgabeType],
                [['name' => 'Spiel'], null, null, $spielType],
            ]);

        // Setup Games with IDs
        $team2 = new Team();
        $team2Reflection = new ReflectionClass($team2);
        $team2IdProperty = $team2Reflection->getProperty('id');
        $team2IdProperty->setValue($team2, 2);

        $game1 = new Game();
        $game1->setHomeTeam($team);
        $game1->setAwayTeam($team2);

        $calendarEvent1 = new CalendarEvent();
        $calendarEvent1->setStartDate(new DateTimeImmutable('+1 week'));
        $calendarEvent1->setEndDate(new DateTimeImmutable('+1 week +2 hours'));
        $calendarEvent1->setGame($game1);

        $game2 = new Game();
        $game2->setHomeTeam($team2);
        $game2->setAwayTeam($team);

        $calendarEvent2 = new CalendarEvent();
        $calendarEvent2->setStartDate(new DateTimeImmutable('+2 weeks'));
        $calendarEvent2->setEndDate(new DateTimeImmutable('+2 weeks +2 hours'));
        $calendarEvent2->setGame($game2);

        // Mock QueryBuilder for old occurrences deletion
        $occurrenceQuery = $this->createMock(Query::class);
        $occurrenceQuery->method('getResult')->willReturn([]);

        $occurrenceQb = $this->createMock(QueryBuilder::class);
        $occurrenceQb->method('where')->willReturnSelf();
        $occurrenceQb->method('andWhere')->willReturnSelf();
        $occurrenceQb->method('setParameter')->willReturnSelf();
        $occurrenceQb->method('getQuery')->willReturn($occurrenceQuery);

        // Mock QueryBuilder for Spiel-Events
        $spielQuery = $this->createMock(Query::class);
        $spielQuery->method('getResult')->willReturn([$calendarEvent1, $calendarEvent2]);

        $spielQb = $this->createMock(QueryBuilder::class);
        $spielQb->method('where')->willReturnSelf();
        $spielQb->method('andWhere')->willReturnSelf();
        $spielQb->method('setParameter')->willReturnSelf();
        $spielQb->method('orderBy')->willReturnSelf();
        $spielQb->method('getQuery')->willReturn($spielQuery);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('createQueryBuilder')->willReturn($occurrenceQb);

        $this->calendarEventRepository->method('createQueryBuilder')->willReturn($spielQb);
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function ($class) use ($taskRepo) {
                if (Task::class === $class) {
                    return $taskRepo;
                }

                return $this->createMock(EntityRepository::class);
            });

        $this->userRelationRepository->method('findBy')
            ->with(['user' => $user])
            ->willReturn([$userRelation]);

        $this->entityManager->expects($this->atLeast(4))->method('persist');
        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $this->service->generateEvents($task, $taskCreator);
    }

    public function testGeneratePerMatchEventsWithMultipleUsersRotation(): void
    {
        // Setup Task with 2 users
        $task = new Task();
        $task->setTitle('Torwart');
        $task->setRecurrenceMode('per_match');
        $task->setRotationCount(1);

        $taskCreator = new User();
        $taskCreator->setFirstName('Admin');
        $taskCreator->setLastName('User');
        $creatorReflection = new ReflectionClass($taskCreator);
        $creatorIdProperty = $creatorReflection->getProperty('id');
        $creatorIdProperty->setValue($taskCreator, 99);
        $task->setCreatedBy($taskCreator);

        $user1 = new User();
        $user1->setFirstName('Max');
        $user1->setLastName('Mustermann');
        $user1Reflection = new ReflectionClass($user1);
        $user1IdProperty = $user1Reflection->getProperty('id');
        $user1IdProperty->setValue($user1, 1);

        $user2 = new User();
        $user2->setFirstName('Anna');
        $user2->setLastName('Schmidt');
        $user2Reflection = new ReflectionClass($user2);
        $user2IdProperty = $user2Reflection->getProperty('id');
        $user2IdProperty->setValue($user2, 2);

        $team = new Team();
        $teamReflection = new ReflectionClass($team);
        $teamIdProperty = $teamReflection->getProperty('id');
        $teamIdProperty->setValue($team, 1);

        // Setup for user1
        $player1 = new Player();
        $assignment1 = new PlayerTeamAssignment();
        $assignment1->setTeam($team);
        $player1->addPlayerTeamAssignment($assignment1);

        $userRelation1 = new UserRelation();
        $userRelation1->setUser($user1);
        $userRelation1->setPlayer($player1);

        // Setup for user2
        $player2 = new Player();
        $assignment2 = new PlayerTeamAssignment();
        $assignment2->setTeam($team);
        $player2->addPlayerTeamAssignment($assignment2);

        $userRelation2 = new UserRelation();
        $userRelation2->setUser($user2);
        $userRelation2->setPlayer($player2);

        $task->setRotationUsers(new ArrayCollection([$user1, $user2]));

        // Setup Calendar Event Types
        $aufgabeType = new CalendarEventType();
        $spielType = new CalendarEventType();

        $this->calendarEventTypeRepository->method('findOneBy')
            ->willReturnMap([
                [['name' => 'Aufgabe'], null, null, $aufgabeType],
                [['name' => 'Spiel'], null, null, $spielType],
            ]);

        // Setup 3 Games with proper team IDs
        $team2 = new Team();
        $team2Reflection = new ReflectionClass($team2);
        $team2IdProperty = $team2Reflection->getProperty('id');
        $team2IdProperty->setValue($team2, 2);

        $calendarEvents = [];
        for ($i = 1; $i <= 3; ++$i) {
            $game = new Game();
            if (1 === $i % 2) {
                $game->setHomeTeam($team);
                $game->setAwayTeam($team2);
            } else {
                $game->setHomeTeam($team2);
                $game->setAwayTeam($team);
            }

            $calendarEvent = new CalendarEvent();
            $calendarEvent->setStartDate(new DateTimeImmutable("+{$i} week"));
            $calendarEvent->setEndDate(new DateTimeImmutable("+{$i} week +2 hours"));
            $calendarEvent->setGame($game);

            $calendarEvents[] = $calendarEvent;
        }

        // Mock QueryBuilder for old occurrences
        $occurrenceQuery = $this->createMock(Query::class);
        $occurrenceQuery->method('getResult')->willReturn([]);

        $occurrenceQb = $this->createMock(QueryBuilder::class);
        $occurrenceQb->method('where')->willReturnSelf();
        $occurrenceQb->method('andWhere')->willReturnSelf();
        $occurrenceQb->method('setParameter')->willReturnSelf();
        $occurrenceQb->method('getQuery')->willReturn($occurrenceQuery);

        // Mock QueryBuilder for Spiel-Events
        $spielQuery = $this->createMock(Query::class);
        $spielQuery->method('getResult')->willReturn($calendarEvents);

        $spielQb = $this->createMock(QueryBuilder::class);
        $spielQb->method('where')->willReturnSelf();
        $spielQb->method('andWhere')->willReturnSelf();
        $spielQb->method('setParameter')->willReturnSelf();
        $spielQb->method('orderBy')->willReturnSelf();
        $spielQb->method('getQuery')->willReturn($spielQuery);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('createQueryBuilder')->willReturn($occurrenceQb);

        $this->calendarEventRepository->method('createQueryBuilder')->willReturn($spielQb);
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function ($class) use ($taskRepo) {
                if (Task::class === $class) {
                    return $taskRepo;
                }

                return $this->createMock(EntityRepository::class);
            });

        $this->userRelationRepository->method('findBy')
            ->willReturnCallback(function ($criteria) use ($user1, $user2, $userRelation1, $userRelation2) {
                if ($criteria['user'] === $user1) {
                    return [$userRelation1];
                }
                if ($criteria['user'] === $user2) {
                    return [$userRelation2];
                }

                return [];
            });

        // Expect multiple persists for occurrences
        $this->entityManager->expects($this->atLeast(6))->method('persist');
        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $this->service->generateEvents($task, $taskCreator);
    }

    public function testRegeneratePerMatchEventsRemovesOldAssignments(): void
    {
        $task = new Task();
        $task->setTitle('Torwart');
        $task->setRecurrenceMode('per_match');
        $task->setRotationUsers(new ArrayCollection([]));

        $aufgabeType = new CalendarEventType();
        $spielType = new CalendarEventType();
        $this->calendarEventTypeRepository->method('findOneBy')
            ->willReturnMap([
                [['name' => 'Aufgabe'], null, null, $aufgabeType],
                [['name' => 'Spiel'], null, null, $spielType],
            ]);

        // Mock QueryBuilders for removal of old occurrences
        $occurrenceQuery = $this->createMock(Query::class);
        $oldOccurrence = new Task();
        $occurrenceQuery->method('getResult')->willReturn([$oldOccurrence]);

        $occurrenceQb = $this->createMock(QueryBuilder::class);
        $occurrenceQb->method('where')->willReturnSelf();
        $occurrenceQb->method('andWhere')->willReturnSelf();
        $occurrenceQb->method('setParameter')->willReturnSelf();
        $occurrenceQb->method('getQuery')->willReturn($occurrenceQuery);

        // Mock Task repository for finding occurrences
        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('createQueryBuilder')->willReturn($occurrenceQb);

        // Setup for SpielEvents query
        $spielQuery = $this->createMock(Query::class);
        $spielQuery->method('getResult')->willReturn([]);

        $spielQb = $this->createMock(QueryBuilder::class);
        $spielQb->method('where')->willReturnSelf();
        $spielQb->method('andWhere')->willReturnSelf();
        $spielQb->method('setParameter')->willReturnSelf();
        $spielQb->method('orderBy')->willReturnSelf();
        $spielQb->method('getQuery')->willReturn($spielQuery);

        $this->calendarEventRepository->method('createQueryBuilder')->willReturn($spielQb);
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function ($class) use ($taskRepo) {
                if (Task::class === $class) {
                    return $taskRepo;
                }

                return $this->createMock(EntityRepository::class);
            });

        // Expect no removal since no future assignments
        $this->entityManager->expects($this->never())
            ->method('remove');

        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $user = new User();
        $this->service->generateEvents($task, $user);
    }

    public function testGeneratePerMatchEventsSkipsNonPerMatchTasks(): void
    {
        $task = new Task();
        $task->setRecurrenceMode('classic');

        // Non-templates don't trigger event generation for per_match
        $this->calendarEventTypeRepository->expects($this->never())->method('findOneBy');
        $this->entityManager->expects($this->never())->method('persist');
        $user = new User();
        $this->service->generateEvents($task, $user);
    }

    public function testGeneratePerMatchEventsOnlyCreatesEventsForUserTeams(): void
    {
        $task = new Task();
        $task->setTitle('Torwart');
        $task->setRecurrenceMode('per_match');
        $task->setRotationCount(1);

        $taskCreator = new User();
        $taskCreator->setFirstName('Admin');
        $taskCreator->setLastName('User');
        $creatorReflection = new ReflectionClass($taskCreator);
        $creatorIdProperty = $creatorReflection->getProperty('id');
        $creatorIdProperty->setValue($taskCreator, 99);
        $task->setCreatedBy($taskCreator);

        $user = new User();
        $user->setFirstName('Max');
        $user->setLastName('Mustermann');
        $userReflection = new ReflectionClass($user);
        $userIdProperty = $userReflection->getProperty('id');
        $userIdProperty->setValue($user, 1);

        $userTeam = new Team();
        $userTeamReflection = new ReflectionClass($userTeam);
        $userTeamIdProperty = $userTeamReflection->getProperty('id');
        $userTeamIdProperty->setValue($userTeam, 1);

        $otherTeam = new Team();
        $otherTeamReflection = new ReflectionClass($otherTeam);
        $otherTeamIdProperty = $otherTeamReflection->getProperty('id');
        $otherTeamIdProperty->setValue($otherTeam, 2);

        $player = new Player();
        $assignment = new PlayerTeamAssignment();
        $assignment->setTeam($userTeam);
        $player->addPlayerTeamAssignment($assignment);

        $userRelation = new UserRelation();
        $userRelation->setUser($user);
        $userRelation->setPlayer($player);

        $task->setRotationUsers(new ArrayCollection([$user]));

        $aufgabeType = new CalendarEventType();
        $spielType = new CalendarEventType();

        $this->calendarEventTypeRepository->method('findOneBy')
            ->willReturnMap([
                [['name' => 'Aufgabe'], null, null, $aufgabeType],
                [['name' => 'Spiel'], null, null, $spielType],
            ]);

        // Game with user's team (should create event)
        $matchingGame = new Game();
        $matchingGame->setHomeTeam($userTeam);
        $matchingGame->setAwayTeam($otherTeam);

        $matchingEvent = new CalendarEvent();
        $matchingEvent->setStartDate(new DateTimeImmutable('+1 week'));
        $matchingEvent->setEndDate(new DateTimeImmutable('+1 week +2 hours'));
        $matchingEvent->setGame($matchingGame);

        // Game without user's team (should NOT create event)
        $nonMatchingGame = new Game();
        $nonMatchingGame->setHomeTeam($otherTeam);
        $nonMatchingGame->setAwayTeam($otherTeam);

        $nonMatchingEvent = new CalendarEvent();
        $nonMatchingEvent->setStartDate(new DateTimeImmutable('+2 weeks'));
        $nonMatchingEvent->setEndDate(new DateTimeImmutable('+2 weeks +2 hours'));
        $nonMatchingEvent->setGame($nonMatchingGame);

        // Mock QueryBuilder for old occurrences
        $occurrenceQuery = $this->createMock(Query::class);
        $occurrenceQuery->method('getResult')->willReturn([]);

        $occurrenceQb = $this->createMock(QueryBuilder::class);
        $occurrenceQb->method('where')->willReturnSelf();
        $occurrenceQb->method('andWhere')->willReturnSelf();
        $occurrenceQb->method('setParameter')->willReturnSelf();
        $occurrenceQb->method('getQuery')->willReturn($occurrenceQuery);

        // Mock QueryBuilder for Spiel-Events
        $spielQuery = $this->createMock(Query::class);
        $spielQuery->method('getResult')->willReturn([$matchingEvent, $nonMatchingEvent]);

        $spielQb = $this->createMock(QueryBuilder::class);
        $spielQb->method('where')->willReturnSelf();
        $spielQb->method('andWhere')->willReturnSelf();
        $spielQb->method('setParameter')->willReturnSelf();
        $spielQb->method('orderBy')->willReturnSelf();
        $spielQb->method('getQuery')->willReturn($spielQuery);

        $taskRepo = $this->createMock(EntityRepository::class);
        $taskRepo->method('createQueryBuilder')->willReturn($occurrenceQb);

        $this->calendarEventRepository->method('createQueryBuilder')->willReturn($spielQb);
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function ($class) use ($taskRepo) {
                if (Task::class === $class) {
                    return $taskRepo;
                }

                return $this->createMock(EntityRepository::class);
            });

        $this->userRelationRepository->method('findBy')->willReturn([$userRelation]);

        // Expect only occurrences for matching game
        $this->entityManager->expects($this->atLeast(3))->method('persist');
        $this->entityManager->expects($this->atLeast(1))->method('flush');

        $this->service->generateEvents($task, $taskCreator);
    }
}
