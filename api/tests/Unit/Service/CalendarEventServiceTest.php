<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Event\GameDeletedEvent;
use App\Service\CalendarEventService;
use App\Service\TaskEventGeneratorService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class CalendarEventServiceTest extends TestCase
{
    public function testDeleteCalendarEventsForTaskRemovesAllRelatedEvents(): void
    {
        $task = $this->createMock(Task::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $taskAssignment = $this->createMock(TaskAssignment::class);
        $taskAssignment->method('getCalendarEvent')->willReturn($calendarEvent);
        $taskAssignmentRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $taskAssignmentRepo->method('findBy')->willReturnCallback(function ($criteria) use ($task, $calendarEvent, $taskAssignment) {
            if (isset($criteria['task']) && $criteria['task'] === $task) {
                return [$taskAssignment];
            }
            if (isset($criteria['calendarEvent']) && $criteria['calendarEvent'] === $calendarEvent) {
                return [];
            }

            return [];
        });
        $teamRideRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $teamRideRepo->method('findBy')->willReturn([]);
        $participationRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $participationRepo->method('findBy')->willReturn([]);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnMap([
            [TaskAssignment::class, $taskAssignmentRepo],
            [\App\Entity\TeamRide::class, $teamRideRepo],
            [\App\Entity\Participation::class, $participationRepo],
        ]);
        $em->expects($this->once())->method('remove')->with($calendarEvent);
        $em->expects($this->once())->method('flush');
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $this->createMock(TeamMembershipService::class),
        );
        $service->deleteCalendarEventsForTask($task);
    }

    public function testDeleteCalendarEventsForTaskNoAssignments(): void
    {
        $task = $this->createMock(Task::class);
        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $repo->method('findBy')->willReturn([]);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->with(TaskAssignment::class)->willReturn($repo);
        $em->expects($this->never())->method('remove');
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $this->createMock(TeamMembershipService::class),
        );
        $service->deleteCalendarEventsForTask($task);
    }

    public function testDeleteCalendarEventWithDependenciesRemovesAllDependenciesAndDispatches(): void
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $game = $this->createMock(Game::class);
        $calendarEvent->method('getGame')->willReturn($game);
        $em = $this->createMock(EntityManagerInterface::class);
        $connection = $this->getMockBuilder(\Doctrine\DBAL\Connection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['executeStatement'])
            ->getMock();
        $connection->method('executeStatement')->willReturn(true);
        $em->method('getConnection')->willReturn($connection);
        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $repo->method('findBy')->willReturn([]);
        $em->method('getRepository')->willReturn($repo);
        $em->expects($this->atLeastOnce())->method('remove');
        $em->expects($this->once())->method('flush');
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->once())->method('dispatch')->with($this->isInstanceOf(GameDeletedEvent::class));
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $dispatcher,
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $this->createMock(TeamMembershipService::class),
        );

        $service->deleteCalendarEventWithDependencies($calendarEvent);
    }

    public function testDeleteCalendarEventWithDependenciesNoGame(): void
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getGame')->willReturn(null);
        $em = $this->createMock(EntityManagerInterface::class);
        $connection = $this->getMockBuilder(\Doctrine\DBAL\Connection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['executeStatement'])
            ->getMock();
        $connection->method('executeStatement')->willReturn(true);
        $em->method('getConnection')->willReturn($connection);
        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findBy'])
            ->getMock();
        $repo->method('findBy')->willReturn([]);
        $em->method('getRepository')->willReturn($repo);
        $em->expects($this->atLeastOnce())->method('remove');
        $em->expects($this->once())->method('flush');
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $dispatcher,
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $this->createMock(TeamMembershipService::class),
        );

        $service->deleteCalendarEventWithDependencies($calendarEvent);
    }

    public function testUpdateEventFromDataValidDataCreatesAndFlushes(): void
    {
        $calendarEvent = $this->getMockBuilder(CalendarEvent::class)->onlyMethods(
            [
                'getId',
                'setTitle',
                'setDescription',
                'setStartDate',
                'setCreatedBy',
                'setCalendarEventType',
                'setEndDate',
                'setLocation',
                'getGame',
                'setGame',
                'getCalendarEventType'
            ]
        )->getMock();

        $calendarEvent->method('getId')->willReturn(null);
        $calendarEventType = $this->createMock(CalendarEventType::class);
        $calendarEventType->method('getId')->willReturn(1);
        $calendarEventType->method('getName')->willReturn('Spiel');
        $calendarEvent->method('getCalendarEventType')->willReturn($calendarEventType);
        $repoType = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy'])
            ->getMock();
        $repoType->method('findOneBy')->willReturnCallback(function (array $criteria) use ($calendarEventType) {
            if (isset($criteria['name']) && 'Spiel' === $criteria['name']) {
                return $calendarEventType;
            }

            return null;
        });
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repoType);
        $em->method('getReference')->willReturn($calendarEventType);
        $em->expects($this->atLeastOnce())->method('flush');
        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());
        $service = new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        $data = [
            'title' => 'Test',
            'description' => 'Desc',
            'startDate' => '2025-01-01',
            'eventTypeId' => 1
        ];
        $result = $service->updateEventFromData($calendarEvent, $data);
        $this->assertInstanceOf(ConstraintViolationList::class, $result);
    }

    public function testUpdateEventFromDataWithErrorsReturnsViolations(): void
    {
        $calendarEvent = $this->getMockBuilder(CalendarEvent::class)->onlyMethods(
            [
                'getId',
                'setTitle',
                'setDescription',
                'setStartDate',
                'setCreatedBy',
                'setCalendarEventType',
                'setEndDate',
                'setLocation',
                'getGame',
                'setGame'
            ]
        )->getMock();

        $calendarEvent->method('getId')->willReturn(null);
        $calendarEventType = $this->createMock(CalendarEventType::class);
        $calendarEventType->method('getId')->willReturn(1);
        $calendarEventType->method('getName')->willReturn('Spiel');
        $repoType = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy'])
            ->getMock();
        $repoType->method('findOneBy')->willReturnCallback(function (array $criteria) use ($calendarEventType) {
            if (isset($criteria['name']) && 'Spiel' === $criteria['name']) {
                return $calendarEventType;
            }

            return null;
        });
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repoType);
        $em->method('getReference')->willReturn($calendarEventType);
        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $violation = $this->getMockBuilder('Symfony\Component\Validator\ConstraintViolationInterface')->getMock();
        $violations = new ConstraintViolationList([$violation]);
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn($violations);
        $service = new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        $data = [
            'title' => 'Test',
            'description' => 'Desc',
            'startDate' => '2025-01-01',
            'eventTypeId' => 1
        ];
        $result = $service->updateEventFromData($calendarEvent, $data);
        $this->assertSame($violations, $result);
    }

    public function testFullfillTaskEntitySetsAllFields(): void
    {
        $task = $this->createMock(Task::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getTitle')->willReturn('T');
        $calendarEvent->method('getDescription')->willReturn('D');
        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->getMock());
        $task->expects($this->once())->method('setTitle')->with('T');
        $task->expects($this->once())->method('setDescription')->with('D');
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        $result = $service->fullfillTaskEntity($task, $calendarEvent, []);
        $this->assertInstanceOf(Task::class, $result);
    }

    public function testLoadEventRecipientsDelegatesToTeamMembershipService(): void
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $user1 = $this->createMock(User::class);
        $user2 = $this->createMock(User::class);

        $teamMembershipService = $this->createMock(TeamMembershipService::class);
        $teamMembershipService->expects($this->once())
            ->method('resolveEventRecipients')
            ->with($calendarEvent)
            ->willReturn([$user1, $user2]);

        $em = $this->createMock(EntityManagerInterface::class);
        $service = new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $teamMembershipService,
        );

        $result = $service->loadEventRecipients($calendarEvent);
        $this->assertCount(2, $result);
        $this->assertSame($user1, $result[0]);
        $this->assertSame($user2, $result[1]);
    }

    // ─── validateMatchTeamOwnership ───────────────────────────────────────────

    /** Builds a CalendarEventService whose repository mock returns CalendarEventType stubs. */
    private function buildServiceWithEventTypes(int $spielId, int $turnierId): CalendarEventService
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => $spielId]);
        $turnierType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => $turnierId]);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy'])
            ->getMock();

        $repo->method('findOneBy')->willReturnCallback(function (array $criteria) use ($spielType, $turnierType) {
            return match ($criteria['name'] ?? '') {
                'Spiel' => $spielType,
                'Turnier' => $turnierType,
                default => null,
            };
        });

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);

        return new CalendarEventService(
            $em,
            $this->createMock(ValidatorInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $this->createMock(Security::class),
            $this->createMock(TeamMembershipService::class),
        );
    }

    /**
     * Creates a User mock with given roles and an optional list of coach team IDs.
     *
     * @param array<string> $roles
     * @param array<int>    $coachTeamIds
     */
    private function buildUser(array $roles, array $coachTeamIds = []): User
    {
        $relations = [];
        foreach ($coachTeamIds as $teamId) {
            $team = $this->createConfiguredMock(Team::class, ['getId' => $teamId]);
            $assignment = $this->createMock(CoachTeamAssignment::class);
            $assignment->method('getTeam')->willReturn($team);
            $coach = $this->createMock(Coach::class);
            $coach->method('getCoachTeamAssignments')->willReturn(new \Doctrine\Common\Collections\ArrayCollection([$assignment]));
            $relation = $this->createMock(UserRelation::class);
            $relation->method('getCoach')->willReturn($coach);
            $relations[] = $relation;
        }

        $user = $this->createMock(User::class);
        $user->method('getRoles')->willReturn($roles);
        $user->method('getUserRelations')->willReturn(new \Doctrine\Common\Collections\ArrayCollection($relations));

        return $user;
    }

    public function testValidateMatchTeamOwnershipAdminAlwaysReturnsNull(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $admin = $this->buildUser(['ROLE_ADMIN']);

        $result = $service->validateMatchTeamOwnership(['eventTypeId' => 5, 'game' => ['homeTeamId' => 99, 'awayTeamId' => 100]], $admin);

        $this->assertNull($result);
    }

    public function testValidateMatchTeamOwnershipNonGameEventReturnsNull(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $user = $this->buildUser(['ROLE_USER']); // ROLE_USER, no coach

        // eventTypeId=7 = training → no team ownership check
        $result = $service->validateMatchTeamOwnership(['eventTypeId' => 7], $user);

        $this->assertNull($result);
    }

    public function testValidateMatchTeamOwnershipNonCoachReturnsError(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $user = $this->buildUser(['ROLE_USER']); // no coach assignments

        $result = $service->validateMatchTeamOwnership(
            ['eventTypeId' => 5, 'game' => ['homeTeamId' => 1, 'awayTeamId' => 2]],
            $user
        );

        $this->assertNotNull($result);
        $this->assertStringContainsString('Trainer', $result);
    }

    public function testValidateMatchTeamOwnershipCoachOwnTeamAsHomeTeamReturnsNull(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $coach = $this->buildUser(['ROLE_USER'], [42]); // coach of team 42

        $result = $service->validateMatchTeamOwnership(
            ['eventTypeId' => 5, 'game' => ['homeTeamId' => 42, 'awayTeamId' => 99]],
            $coach
        );

        $this->assertNull($result);
    }

    public function testValidateMatchTeamOwnershipCoachOwnTeamAsAwayTeamReturnsNull(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $coach = $this->buildUser(['ROLE_USER'], [42]); // coach of team 42

        $result = $service->validateMatchTeamOwnership(
            ['eventTypeId' => 5, 'game' => ['homeTeamId' => 10, 'awayTeamId' => 42]],
            $coach
        );

        $this->assertNull($result);
    }

    public function testValidateMatchTeamOwnershipCoachTeamNotInGameReturnsError(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $coach = $this->buildUser(['ROLE_USER'], [42]); // coach of team 42

        $result = $service->validateMatchTeamOwnership(
            ['eventTypeId' => 5, 'game' => ['homeTeamId' => 1, 'awayTeamId' => 2]],
            $coach
        );

        $this->assertNotNull($result);
        $this->assertStringContainsString('Heim', $result);
    }

    public function testValidateMatchTeamOwnershipTournamentWithOwnTeamInMatchReturnsNull(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $coach = $this->buildUser(['ROLE_USER'], [42]);

        $result = $service->validateMatchTeamOwnership(
            [
                'eventTypeId' => 6,
                'pendingTournamentMatches' => [
                    ['homeTeamId' => 10, 'awayTeamId' => 99],
                    ['homeTeamId' => 42, 'awayTeamId' => 11], // own team here
                ],
            ],
            $coach
        );

        $this->assertNull($result);
    }

    public function testValidateMatchTeamOwnershipTournamentWithoutOwnTeamReturnsError(): void
    {
        $service = $this->buildServiceWithEventTypes(5, 6);
        $coach = $this->buildUser(['ROLE_USER'], [42]);

        $result = $service->validateMatchTeamOwnership(
            [
                'eventTypeId' => 6,
                'pendingTournamentMatches' => [
                    ['homeTeamId' => 10, 'awayTeamId' => 99],
                    ['homeTeamId' => 1,  'awayTeamId' => 11],
                ],
            ],
            $coach
        );

        $this->assertNotNull($result);
        $this->assertStringContainsString('Turnier', $result);
    }

    // ────────────── Game Timing Fields ──────────────────────────────────────

    public function testGameTimingFieldsAppliedWhenSpielEventCreated(): void
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 1]);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy'])->getMock();
        $repo->method('findOneBy')->willReturnCallback(fn (array $c) => match ($c['name'] ?? '') {
            'Spiel' => $spielType,
            default => null,
        });

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $em->method('getReference')->willReturn($spielType);
        $em->method('flush');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());

        $service = new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        // CalendarEvent partial mock: only mock what we need, leave game/startDate real
        $calendarEvent = $this->getMockBuilder(CalendarEvent::class)
            ->onlyMethods(['getId', 'setTitle', 'setDescription', 'setCreatedBy', 'setCalendarEventType', 'setLocation', 'getCalendarEventType'])
            ->getMock();
        $calendarEvent->method('getId')->willReturn(null);
        $calendarEvent->method('getCalendarEventType')->willReturn(null);

        $data = [
            'title' => 'Testspiel',
            'description' => '',
            'startDate' => '2025-06-01T15:00:00',
            'eventTypeId' => 1,
            'game' => [
                'halfDuration' => 30,
                'halftimeBreakDuration' => 10,
                'firstHalfExtraTime' => 2,
                'secondHalfExtraTime' => 3,
            ],
        ];

        $service->updateEventFromData($calendarEvent, $data);

        $game = $calendarEvent->getGame();
        $this->assertNotNull($game, 'A Game entity should have been created');
        $this->assertSame(30, $game->getHalfDuration());
        $this->assertSame(10, $game->getHalftimeBreakDuration());
        $this->assertSame(2, $game->getFirstHalfExtraTime());
        $this->assertSame(3, $game->getSecondHalfExtraTime());
    }

    public function testAutoEndDateCalculatedFromTimingWhenNoEndDateProvided(): void
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 1]);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy'])->getMock();
        $repo->method('findOneBy')->willReturnCallback(fn (array $c) => match ($c['name'] ?? '') {
            'Spiel' => $spielType,
            default => null,
        });

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $em->method('getReference')->willReturn($spielType);
        $em->method('flush');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());

        $service = new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        $calendarEvent = $this->getMockBuilder(CalendarEvent::class)
            ->onlyMethods(['getId', 'setTitle', 'setDescription', 'setCreatedBy', 'setCalendarEventType', 'setLocation', 'getCalendarEventType'])
            ->getMock();
        $calendarEvent->method('getId')->willReturn(null);
        $calendarEvent->method('getCalendarEventType')->willReturn(null);

        // No 'endDate' in data → service should auto-calculate from 45+15+45 = 105 min
        $data = [
            'title' => 'Testspiel Endzeit',
            'description' => '',
            'startDate' => '2025-06-01T19:00:00',
            'eventTypeId' => 1,
            'game' => [
                'halfDuration' => 45,
                'halftimeBreakDuration' => 15,
            ],
        ];

        $service->updateEventFromData($calendarEvent, $data);

        $endDate = $calendarEvent->getEndDate();
        $this->assertNotNull($endDate, 'End date should have been auto-calculated');
        $this->assertSame('2025-06-01 20:45:00', $endDate->format('Y-m-d H:i:s'));
    }

    public function testExplicitEndDateNotOverriddenByTimingAutoCalc(): void
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 1]);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy'])->getMock();
        $repo->method('findOneBy')->willReturnCallback(fn (array $c) => match ($c['name'] ?? '') {
            'Spiel' => $spielType,
            default => null,
        });

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $em->method('getReference')->willReturn($spielType);
        $em->method('flush');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());

        $service = new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );

        $calendarEvent = $this->getMockBuilder(CalendarEvent::class)
            ->onlyMethods(['getId', 'setTitle', 'setDescription', 'setCreatedBy', 'setCalendarEventType', 'setLocation', 'getCalendarEventType'])
            ->getMock();
        $calendarEvent->method('getId')->willReturn(null);
        $calendarEvent->method('getCalendarEventType')->willReturn(null);

        $data = [
            'title' => 'Testspiel mit Endzeit',
            'description' => '',
            'startDate' => '2025-06-01T19:00:00',
            'endDate' => '2025-06-01T22:00:00',  // explicit end time
            'eventTypeId' => 1,
            'game' => [
                'halfDuration' => 45,
                'halftimeBreakDuration' => 15,
            ],
        ];

        $service->updateEventFromData($calendarEvent, $data);

        $endDate = $calendarEvent->getEndDate();
        $this->assertNotNull($endDate, 'EndDate should be set');
        $this->assertSame('2025-06-01 22:00:00', $endDate->format('Y-m-d H:i:s'));
    }

    // =========================================================================
    // Training series metadata — updateEventFromData
    // =========================================================================

    /** Minimal CalendarEventService sufficient for training-field tests. */
    private function buildServiceForTrainingTests(): CalendarEventService
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy'])->getMock();
        $repo->method('findOneBy')->willReturn(null);
        $em->method('getRepository')->willReturn($repo);
        $em->method('flush');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($this->createMock(User::class));
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());

        return new CalendarEventService(
            $em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );
    }

    public function testUpdateEventFromDataSetsTrainingWeekdays(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Montags-Training',
            'startDate' => '2026-04-07T18:00:00',
            'trainingWeekdays' => [1, 3],
        ]);

        $this->assertSame([1, 3], $calendarEvent->getTrainingWeekdays());
    }

    public function testUpdateEventFromDataClearsTrainingWeekdaysWhenNull(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingWeekdays([1, 3]);

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Einzeltraining',
            'startDate' => '2026-04-07T18:00:00',
            'trainingWeekdays' => null,
        ]);

        $this->assertNull($calendarEvent->getTrainingWeekdays());
    }

    public function testUpdateEventFromDataPreservesTrainingWeekdaysWhenKeyAbsent(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingWeekdays([2, 4]);

        // Key intentionally absent from payload
        $service->updateEventFromData($calendarEvent, [
            'title' => 'Training unveränderlich',
            'startDate' => '2026-04-08T18:00:00',
        ]);

        $this->assertSame([2, 4], $calendarEvent->getTrainingWeekdays());
    }

    public function testUpdateEventFromDataSetsTrainingSeriesEndDate(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
            'trainingSeriesEndDate' => '2026-12-31',
        ]);

        $this->assertSame('2026-12-31', $calendarEvent->getTrainingSeriesEndDate());
    }

    public function testUpdateEventFromDataClearsTrainingSeriesEndDateWhenNull(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingSeriesEndDate('2026-06-30');

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Einzeltraining',
            'startDate' => '2026-04-07T18:00:00',
            'trainingSeriesEndDate' => null,
        ]);

        $this->assertNull($calendarEvent->getTrainingSeriesEndDate());
    }

    public function testUpdateEventFromDataPreservesTrainingSeriesEndDateWhenKeyAbsent(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingSeriesEndDate('2026-09-30');

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
        ]);

        $this->assertSame('2026-09-30', $calendarEvent->getTrainingSeriesEndDate());
    }

    public function testUpdateEventFromDataSetsTrainingSeriesId(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
            'trainingSeriesId' => 'some-uuid-1234',
        ]);

        $this->assertSame('some-uuid-1234', $calendarEvent->getTrainingSeriesId());
    }

    public function testUpdateEventFromDataClearsTrainingSeriesIdWhenNull(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingSeriesId('existing-uuid');

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Einzeltraining',
            'startDate' => '2026-04-07T18:00:00',
            'trainingSeriesId' => null,
        ]);

        $this->assertNull($calendarEvent->getTrainingSeriesId());
    }

    public function testUpdateEventFromDataPreservesTrainingSeriesIdWhenKeyAbsent(): void
    {
        $service = $this->buildServiceForTrainingTests();
        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTrainingSeriesId('preserved-uuid');

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Training',
            'startDate' => '2026-04-07T18:00:00',
        ]);

        $this->assertSame('preserved-uuid', $calendarEvent->getTrainingSeriesId());
    }
}
