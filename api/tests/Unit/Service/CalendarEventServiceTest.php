<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\TournamentMatch;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Enum\CalendarEventPermissionType;
use App\Event\GameDeletedEvent;
use App\Service\CalendarEventService;
use App\Service\TaskEventGeneratorService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[AllowMockObjectsWithoutExpectations]
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
    // =========================================================================
    // processTournament — tournament creation and match processing
    // =========================================================================

    /**
     * Builds a CalendarEventService configured for tournament path tests.
     *
     * @return array{0: CalendarEventService, 1: CalendarEventType}
     */
    private function buildServiceForTournamentTest(int $spielId = 5, int $turnierId = 6): array
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => $spielId, 'getName' => 'Spiel']);
        $turnierType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => $turnierId, 'getName' => 'Turnier']);
        $homeTeam = $this->createConfiguredMock(Team::class, ['getId' => 1, 'getName' => 'Heimteam']);
        $awayTeam = $this->createConfiguredMock(Team::class, ['getId' => 2, 'getName' => 'Gastteam']);
        $gameType = $this->createMock(GameType::class);
        $matchEventType = $this->createConfiguredMock(CalendarEventType::class, ['getName' => 'Turnier-Match']);

        $calendarEventTypeRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $calendarEventTypeRepo->method('findOneBy')->willReturnCallback(
            function (array $c) use ($spielType, $turnierType, $matchEventType) {
                return match ($c['name'] ?? '') {
                    'Spiel' => $spielType,
                    'Turnier' => $turnierType,
                    'Turnier-Match' => $matchEventType,
                    default => null,
                };
            }
        );
        $calendarEventTypeRepo->method('findBy')->willReturn([]);
        $calendarEventTypeRepo->method('find')->willReturn(null);

        $teamRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $teamRepo->method('find')->willReturnCallback(fn ($id) => match ((int) $id) {
            1 => $homeTeam,
            2 => $awayTeam,
            default => null,
        });

        $gameTypeRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $gameTypeRepo->method('findOneBy')->willReturn($gameType);

        $genericRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $genericRepo->method('findOneBy')->willReturn(null);
        $genericRepo->method('findBy')->willReturn([]);
        $genericRepo->method('find')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            CalendarEventType::class => $calendarEventTypeRepo,
            Team::class => $teamRepo,
            GameType::class => $gameTypeRepo,
            TournamentMatch::class => $genericRepo,
            default => $genericRepo,
        });
        $em->method('getReference')->willReturn($turnierType);
        $em->method('persist');
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

        return [$service, $turnierType];
    }

    public function testUpdateEventFromDataTournamentTypeCreatesNewTournament(): void
    {
        [$service] = $this->buildServiceForTournamentTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Hallenturnier',
            'startDate' => '2026-01-10T10:00:00',
            'eventTypeId' => 6,
            'name' => 'Hallenturnier',
            'tournamentType' => 'roundrobin',
        ]);

        $tournament = $calendarEvent->getTournament();
        $this->assertNotNull($tournament);
        $this->assertInstanceOf(Tournament::class, $tournament);
        $this->assertSame('Hallenturnier', $tournament->getName());
        $this->assertSame('roundrobin', $tournament->getType());
    }

    public function testUpdateEventFromDataTournamentWithPendingMatchesCreatesMatch(): void
    {
        [$service] = $this->buildServiceForTournamentTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Gruppenturnier',
            'startDate' => '2026-02-15T09:00:00',
            'eventTypeId' => 6,
            'name' => 'Gruppenturnier',
            'tournamentType' => 'group',
            'pendingTournamentMatches' => [
                ['scheduledAt' => null, 'round' => 1, 'slot' => 1],
            ],
        ]);

        $tournament = $calendarEvent->getTournament();
        $this->assertNotNull($tournament);
        $this->assertCount(1, $tournament->getMatches());
    }

    public function testUpdateEventFromDataTournamentMatchWithTeamsCreatesGame(): void
    {
        [$service] = $this->buildServiceForTournamentTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'KO-Turnier',
            'startDate' => '2026-03-20T10:00:00',
            'eventTypeId' => 6,
            'name' => 'KO-Turnier',
            'tournamentType' => 'knockout',
            'pendingTournamentMatches' => [
                [
                    'scheduledAt' => null,
                    'homeTeamId' => 1,
                    'awayTeamId' => 2,
                    'round' => 1,
                    'slot' => 1,
                ],
            ],
        ]);

        $tournament = $calendarEvent->getTournament();
        $this->assertNotNull($tournament);
        $this->assertCount(1, $tournament->getMatches());
        $match = $tournament->getMatches()->first();
        $this->assertNotNull($match);
        $this->assertNotNull(
            $match->getGame(),
            'A Game should have been created for the match with home and away teams'
        );
    }

    public function testUpdateEventFromDataTournamentRemovesExistingMatchNotInPayload(): void
    {
        // Existing match has getId()=99; payload match has no 'id' key → payloadMatchKeys=[null]
        // Since 99 ∉ [null], the existing match is removed from the tournament.
        $existingMatch = $this->createMock(TournamentMatch::class);
        $existingMatch->method('getId')->willReturn(99);

        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 5, 'getName' => 'Spiel']);
        $turnierType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 6, 'getName' => 'Turnier']);

        $calendarEventTypeRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $calendarEventTypeRepo->method('findOneBy')->willReturnCallback(fn (array $c) => match ($c['name'] ?? '') {
            'Spiel' => $spielType, 'Turnier' => $turnierType, default => null,
        });

        $tournamentMatchRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $tournamentMatchRepo->method('findBy')->willReturn([$existingMatch]);
        $tournamentMatchRepo->method('find')->willReturn(null);

        $genericRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $genericRepo->method('findOneBy')->willReturn(null);
        $genericRepo->method('findBy')->willReturn([]);
        $genericRepo->method('find')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            CalendarEventType::class => $calendarEventTypeRepo,
            TournamentMatch::class => $tournamentMatchRepo,
            default => $genericRepo,
        });
        $em->method('getReference')->willReturn($turnierType);
        $em->method('persist');
        $em->method('flush');
        $em->expects($this->atLeastOnce())->method('remove');

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

        $calendarEvent = new CalendarEvent();
        $service->updateEventFromData($calendarEvent, [
            'title' => 'Turnier mit alter Runde',
            'startDate' => '2026-04-01T10:00:00',
            'eventTypeId' => 6,
            'name' => 'Altes Turnier',
            'tournamentType' => 'roundrobin',
            'pendingTournamentMatches' => [
                ['scheduledAt' => null, 'round' => 1],  // no 'id' → payloadMatchKeys=[null]
            ],
        ]);

        // The tournament was created and the existing match (id=99) was not in the new payload,
        // so remove() was called on it at least once (assertion verified above by expects).
        $this->assertNotNull($calendarEvent->getTournament());
    }

    public function testUpdateEventFromDataTournamentUpdatesExistingMatchInPayload(): void
    {
        // Existing match has getId()=5; payload contains match with id=5
        // → existing match goes into the "else" branch, processTournamentMatch is called for it
        $speicherCalendarEvent = new CalendarEvent();
        $mockTournament = $this->createMock(Tournament::class);
        $mockTournament->method('getCalendarEvent')->willReturn($speicherCalendarEvent);
        $mockTournament->method('getSettings')->willReturn(['roundDuration' => 20]);

        $existingMatch = $this->createMock(TournamentMatch::class);
        $existingMatch->method('getId')->willReturn(5);
        $existingMatch->method('getTournament')->willReturn($mockTournament);
        $existingMatch->method('getGame')->willReturn(null);
        $existingMatch->method('getHomeTeam')->willReturn(null);
        $existingMatch->method('getAwayTeam')->willReturn(null);

        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 5, 'getName' => 'Spiel']);
        $turnierType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 6, 'getName' => 'Turnier']);

        $calendarEventTypeRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $calendarEventTypeRepo->method('findOneBy')->willReturnCallback(fn (array $c) => match ($c['name'] ?? '') {
            'Spiel' => $spielType, 'Turnier' => $turnierType, default => null,
        });

        $tournamentMatchRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $tournamentMatchRepo->method('findBy')->willReturn([$existingMatch]);
        $tournamentMatchRepo->method('find')->willReturn(null);

        $genericRepo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()->onlyMethods(['findOneBy', 'findBy', 'find'])->getMock();
        $genericRepo->method('findOneBy')->willReturn(null);
        $genericRepo->method('findBy')->willReturn([]);
        $genericRepo->method('find')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            CalendarEventType::class => $calendarEventTypeRepo,
            TournamentMatch::class => $tournamentMatchRepo,
            default => $genericRepo,
        });
        $em->method('getReference')->willReturn($turnierType);
        $em->method('persist');
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

        $calendarEvent = new CalendarEvent();
        $service->updateEventFromData($calendarEvent, [
            'title' => 'Bestehendes Turnier',
            'startDate' => '2026-04-02T10:00:00',
            'eventTypeId' => 6,
            'name' => 'Bestehendes Turnier',
            'tournamentType' => 'roundrobin',
            'pendingTournamentMatches' => [
                ['id' => 5, 'scheduledAt' => null, 'round' => 1],
            ],
        ]);

        // Existing match (id=5) was in payload → processTournamentMatch was called for it
        // Tournament was created on the calendarEvent
        $this->assertNotNull($calendarEvent->getTournament());
    }

    // =========================================================================
    // updatePermissionsForEvent — all permissionType branches
    // =========================================================================

    /** Builds a minimal CalendarEventService for permission-update path tests. */
    private function buildServiceForPermissionTest(): CalendarEventService
    {
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 5, 'getName' => 'Spiel']);
        $trainingType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 99, 'getName' => 'Training']);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $repo->method('findOneBy')->willReturnCallback(
            fn (array $c) => 'Spiel' === $c['name'] ? $spielType : null
        );
        $repo->method('findBy')->willReturn([]);
        $repo->method('find')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $em->method('getReference')->willReturnCallback(
            function (string $class, $id) use ($trainingType) {
                return match ($class) {
                    CalendarEventType::class => $trainingType,
                    User::class => $this->createMock(User::class),
                    Team::class => $this->createMock(Team::class),
                    Club::class => $this->createMock(Club::class),
                    default => null,
                };
            }
        );
        $em->method('persist');
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

    public function testUpdateEventFromDataPermissionPublicCreatesPublicPermission(): void
    {
        $service = $this->buildServiceForPermissionTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Öffentliches Event',
            'startDate' => '2026-03-01T10:00:00',
            'eventTypeId' => 99,
            'permissionType' => 'public',
        ]);

        $permissions = $calendarEvent->getPermissions();
        $this->assertCount(1, $permissions);
        $this->assertSame(CalendarEventPermissionType::PUBLIC, $permissions->first()->getPermissionType());
    }

    public function testUpdateEventFromDataPermissionUserCreatesUserPermissions(): void
    {
        $service = $this->buildServiceForPermissionTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Benutzer-Event',
            'startDate' => '2026-03-02T10:00:00',
            'eventTypeId' => 99,
            'permissionType' => 'user',
            'permissionUsers' => [111, 222],
        ]);

        $permissions = $calendarEvent->getPermissions();
        $this->assertCount(2, $permissions);
        foreach ($permissions as $perm) {
            $this->assertSame(CalendarEventPermissionType::USER, $perm->getPermissionType());
        }
    }

    public function testUpdateEventFromDataPermissionTeamCreatesTeamPermission(): void
    {
        $service = $this->buildServiceForPermissionTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Team-Event',
            'startDate' => '2026-03-03T10:00:00',
            'eventTypeId' => 99,
            'permissionType' => 'team',
            'permissionTeams' => [333],
        ]);

        $permissions = $calendarEvent->getPermissions();
        $this->assertCount(1, $permissions);
        $this->assertSame(CalendarEventPermissionType::TEAM, $permissions->first()->getPermissionType());
    }

    public function testUpdateEventFromDataPermissionClubCreatesClubPermission(): void
    {
        $service = $this->buildServiceForPermissionTest();
        $calendarEvent = new CalendarEvent();

        $service->updateEventFromData($calendarEvent, [
            'title' => 'Vereins-Event',
            'startDate' => '2026-03-04T10:00:00',
            'eventTypeId' => 99,
            'permissionType' => 'club',
            'permissionClubs' => [444],
        ]);

        $permissions = $calendarEvent->getPermissions();
        $this->assertCount(1, $permissions);
        $this->assertSame(CalendarEventPermissionType::CLUB, $permissions->first()->getPermissionType());
    }

    // =========================================================================
    // createDefaultPermissionsForEvent — non-Spiel/Aufgabe event type
    // =========================================================================

    public function testUpdateEventFromDataNewNonSpielEventGetsDefaultPublicPermission(): void
    {
        $trainingType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 77, 'getName' => 'Training']);
        $spielType = $this->createConfiguredMock(CalendarEventType::class, ['getId' => 5, 'getName' => 'Spiel']);

        $repo = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['findOneBy', 'findBy', 'find'])
            ->getMock();
        $repo->method('findOneBy')->willReturnCallback(fn (array $c) => 'Spiel' === $c['name'] ? $spielType : null);
        $repo->method('findBy')->willReturn([]);
        $repo->method('find')->willReturn(null);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $em->method('getReference')->willReturn($trainingType);
        $em->method('persist');
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

        // New event (no ID), no permissionType in data → createDefaultPermissionsForEvent runs
        $calendarEvent = new CalendarEvent();
        $service->updateEventFromData($calendarEvent, [
            'title' => 'Montagstraining',
            'startDate' => '2026-04-06T18:00:00',
            'eventTypeId' => 77,
        ]);

        $permissions = $calendarEvent->getPermissions();
        $this->assertCount(1, $permissions);
        $this->assertSame(CalendarEventPermissionType::PUBLIC, $permissions->first()->getPermissionType());
    }
}
