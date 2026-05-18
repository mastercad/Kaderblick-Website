<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\ProcessHistoricalXpCommand;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\GameEvent;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\Player;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserLevel;
use App\Entity\UserRelation;
use App\Entity\UserXpEvent;
use App\Service\XPService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * @covers \App\Command\ProcessHistoricalXpCommand
 */
#[AllowMockObjectsWithoutExpectations]
class ProcessHistoricalXpCommandTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private XPService&MockObject $xpService;
    /** @phpstan-var EntityRepository<Participation>&MockObject */
    private EntityRepository&MockObject $participationRepository;
    /** @phpstan-var EntityRepository<UserXpEvent>&MockObject */
    private EntityRepository&MockObject $xpEventRepository;
    /** @phpstan-var EntityRepository<GameEvent>&MockObject */
    private EntityRepository&MockObject $gameEventRepository;
    /** @phpstan-var EntityRepository<User>&MockObject */
    private EntityRepository&MockObject $userRepository;
    /** @phpstan-var EntityRepository<UserLevel>&MockObject */
    private EntityRepository&MockObject $userLevelRepository;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->xpService = $this->createMock(XPService::class);
        $this->participationRepository = $this->createMock(EntityRepository::class);
        $this->xpEventRepository = $this->createMock(EntityRepository::class);
        $this->gameEventRepository = $this->createMock(EntityRepository::class);
        $this->userRepository = $this->createMock(EntityRepository::class);
        $this->userLevelRepository = $this->createMock(EntityRepository::class);

        // By default: no existing XP events (XP not yet awarded) — configured per-test where needed
        // Route getRepository() calls
        $this->entityManager->method('getRepository')
            ->willReturnCallback(function (string $class): EntityRepository {
                return match ($class) {
                    Participation::class => $this->participationRepository,
                    UserXpEvent::class => $this->xpEventRepository,
                    GameEvent::class => $this->gameEventRepository,
                    User::class => $this->userRepository,
                    UserLevel::class => $this->userLevelRepository,
                    default => $this->createMock(EntityRepository::class),
                };
            });

        $command = new ProcessHistoricalXpCommand($this->entityManager, $this->xpService);
        $this->commandTester = new CommandTester($command);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * @param Participation[] $participations
     */
    private function mockParticipationQuery(array $participations): void
    {
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($participations);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('innerJoin')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $this->participationRepository->method('createQueryBuilder')->willReturn($qb);
    }

    /**
     * @param GameEvent[] $gameEvents
     */
    private function mockGameEventQuery(array $gameEvents): void
    {
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($gameEvents);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('innerJoin')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $this->gameEventRepository->method('createQueryBuilder')->willReturn($qb);
    }

    /**
     * @param User[] $users
     */
    private function mockUserQuery(array $users): void
    {
        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($users);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $this->userRepository->method('createQueryBuilder')->willReturn($qb);
    }

    private function makeParticipation(
        int $id,
        User $user,
        CalendarEvent $calendarEvent,
        string $statusCode,
    ): Participation {
        $status = $this->createMock(ParticipationStatus::class);
        $status->method('getCode')->willReturn($statusCode);

        $participation = $this->createMock(Participation::class);
        $participation->method('getId')->willReturn($id);
        $participation->method('getUser')->willReturn($user);
        $participation->method('getEvent')->willReturn($calendarEvent);
        $participation->method('getStatus')->willReturn($status);

        return $participation;
    }

    private function makeCalendarEvent(int $id, ?string $typeName): CalendarEvent
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn($id);

        if (null !== $typeName) {
            $eventType = $this->createMock(CalendarEventType::class);
            $eventType->method('getName')->willReturn($typeName);
            $calendarEvent->method('getCalendarEventType')->willReturn($eventType);
        } else {
            $calendarEvent->method('getCalendarEventType')->willReturn(null);
        }

        return $calendarEvent;
    }

    private function makeUser(int $id = 1): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getEmail')->willReturn("user{$id}@example.com");

        return $user;
    }

    /**
     * Build a GameEvent mock linked to a User via a self_player relation.
     */
    private function makeGameEventWithUser(int $gameEventId, User $user): GameEvent
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getIdentifier')->willReturn('self_player');

        $userRelation = $this->createMock(UserRelation::class);
        $userRelation->method('getRelationType')->willReturn($relationType);
        $userRelation->method('getUser')->willReturn($user);

        $player = $this->createMock(Player::class);
        $player->method('getUserRelations')->willReturn(new \Doctrine\Common\Collections\ArrayCollection([$userRelation]));

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn($gameEventId);
        $gameEvent->method('getPlayer')->willReturn($player);

        return $gameEvent;
    }

    /**
     * Build a User mock with all profile fields set for calculateProfileCompleteness().
     */
    private function makeUserWithProfile(int $id): User
    {
        $userRelations = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $userRelations->method('count')->willReturn(1);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getEmail')->willReturn("user{$id}@example.com");
        $user->method('getFirstName')->willReturn('Max');
        $user->method('getLastName')->willReturn('Mustermann');
        $user->method('getAvatarFilename')->willReturn('avatar.jpg');
        $user->method('getHeight')->willReturn(180.0);
        $user->method('getWeight')->willReturn(75.0);
        $user->method('getShoeSize')->willReturn(42.0);
        $user->method('getShirtSize')->willReturn('M');
        $user->method('getPantsSize')->willReturn('32');
        $user->method('getUserRelations')->willReturn($userRelations);
        $user->method('getUserLevel')->willReturn(null); // triggers new UserLevel creation

        return $user;
    }

    // ── Status-to-ActionType mapping ──────────────────────────────────────────

    /** @return array<string, array{string, string}> */
    public static function nonAttendingStatusProvider(): array
    {
        return [
            'not_attending → participation_response' => ['not_attending', 'participation_response'],
            'maybe → participation_response' => ['maybe',        'participation_response'],
            'late → participation_response' => ['late',         'participation_response'],
        ];
    }

    #[DataProvider('nonAttendingStatusProvider')]
    public function testNonAttendingStatusMapsToParticipationResponseActionType(
        string $statusCode,
        string $expectedActionType,
    ): void {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(100, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, $statusCode);

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(5);

        $this->xpService->expects($this->once())
            ->method('addXPToUser')
            ->with($user, 5);

        $capturedActionType = null;
        $this->xpEventRepository->method('findOneBy')
            ->willReturnCallback(function (array $criteria) use (&$capturedActionType): ?UserXpEvent {
                $capturedActionType = $criteria['actionType'];

                return null;
            });

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame($expectedActionType, $capturedActionType);
        $this->assertSame(Command::SUCCESS, $this->commandTester->getStatusCode());
    }

    /** @return array<string, array{string, string}> */
    public static function attendingEventTypeProvider(): array
    {
        return [
            'Training → training_attended' => ['Training',      'training_attended'],
            'Spiel → match_attended' => ['Spiel',         'match_attended'],
            'Turnier-Match → match_attended' => ['Turnier-Match', 'match_attended'],
            'Sonstiges → calendar_event' => ['Sonstiges',     'calendar_event'],
        ];
    }

    #[DataProvider('attendingEventTypeProvider')]
    public function testAttendingStatusMapsToCorrectActionTypeByEventType(
        string $eventTypeName,
        string $expectedActionType,
    ): void {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(200, $eventTypeName);
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);
        $this->xpService->method('addXPToUser');

        $capturedActionType = null;
        $this->xpEventRepository->method('findOneBy')
            ->willReturnCallback(function (array $criteria) use (&$capturedActionType): ?UserXpEvent {
                $capturedActionType = $criteria['actionType'];

                return null;
            });

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame($expectedActionType, $capturedActionType);
    }

    public function testAttendingWithNullEventTypeFallsBackToCalendarEvent(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(300, null); // no event type
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(10);
        $this->xpService->method('addXPToUser');

        $capturedActionType = null;
        $this->xpEventRepository->method('findOneBy')
            ->willReturnCallback(function (array $criteria) use (&$capturedActionType): ?UserXpEvent {
                $capturedActionType = $criteria['actionType'];

                return null;
            });

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame('calendar_event', $capturedActionType);
    }

    // ── Deduplication ─────────────────────────────────────────────────────────

    public function testAlreadyAwardedParticipationIsSkipped(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(10, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);

        // Simulate already-awarded: findOneBy returns an existing XP event
        $existingXpEvent = $this->createMock(UserXpEvent::class);
        $this->xpEventRepository->method('findOneBy')->willReturn($existingXpEvent);

        // Must NOT award any XP
        $this->xpService->expects($this->never())->method('addXPToUser');

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $this->commandTester->getStatusCode());
    }

    public function testParticipationWithXpValueZeroIsSkipped(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(10, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(0); // rule disabled or missing

        $this->xpService->expects($this->never())->method('addXPToUser');

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $this->commandTester->getStatusCode());
    }

    // ── Unknown status is skipped ─────────────────────────────────────────────

    public function testUnknownStatusCodeIsSkipped(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(10, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'unknown_custom_status');

        $this->mockParticipationQuery([$participation]);

        $this->xpService->expects($this->never())->method('addXPToUser');

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $this->commandTester->getStatusCode());
    }

    // ── Dry-run mode ──────────────────────────────────────────────────────────

    public function testDryRunDoesNotCallAddXPToUser(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(20, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);

        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->entityManager->expects($this->never())->method('persist');

        $exitCode = $this->commandTester->execute(['--type' => 'calendar_events', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('DRY-RUN', $this->commandTester->getDisplay());
    }

    public function testDryRunReportsExpectedXpWithoutSaving(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(21, 'Training');
        $participation = $this->makeParticipation(5, $user, $calendarEvent, 'not_attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(5);

        $exitCode = $this->commandTester->execute(['--type' => 'calendar_events', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $this->commandTester->getDisplay();
        $this->assertStringContainsString('5 XP', $output);
        $this->assertStringContainsString('participation_response', $output);
    }

    // ── Multiple participations ───────────────────────────────────────────────

    public function testMultipleParticipationsAreAllProcessed(): void
    {
        $user1 = $this->makeUser(1);
        $user2 = $this->makeUser(2);
        $event1 = $this->makeCalendarEvent(10, 'Training');
        $event2 = $this->makeCalendarEvent(11, 'Spiel');

        $p1 = $this->makeParticipation(1, $user1, $event1, 'attending');
        $p2 = $this->makeParticipation(2, $user2, $event2, 'not_attending');

        $this->mockParticipationQuery([$p1, $p2]);
        $this->xpService->method('retrieveXPForAction')->willReturn(10);

        $addXpCalls = 0;
        $this->xpService->method('addXPToUser')
            ->willReturnCallback(function () use (&$addXpCalls): void {
                ++$addXpCalls;
            });

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(2, $addXpCalls, 'Expected XP to be awarded for both participations');
    }

    // ── Output messages ───────────────────────────────────────────────────────

    public function testSuccessfulAwardAppearsInOutput(): void
    {
        $user = $this->makeUser(3);
        $calendarEvent = $this->makeCalendarEvent(50, 'Training');
        $participation = $this->makeParticipation(7, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);
        $this->xpService->method('addXPToUser');

        $this->commandTester->execute(['--type' => 'calendar_events']);

        $output = $this->commandTester->getDisplay();
        $this->assertStringContainsString('training_attended', $output);
        $this->assertStringContainsString('+15 XP', $output);
    }

    public function testEmptyParticipationListReturnsSuccess(): void
    {
        $this->mockParticipationQuery([]);

        $exitCode = $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── XP values are persisted ───────────────────────────────────────────────

    public function testXpEventRecordIsPersistedAndFlushed(): void
    {
        $user = $this->makeUser();
        $calendarEvent = $this->makeCalendarEvent(60, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);
        $this->xpService->method('addXPToUser');

        $this->entityManager->expects($this->atLeastOnce())->method('persist');
        $this->entityManager->expects($this->atLeastOnce())->method('flush');

        $this->commandTester->execute(['--type' => 'calendar_events']);
    }

    // ── --type=goals ──────────────────────────────────────────────────────────

    public function testTypeGoalsReturnsSuccessWithEmptyList(): void
    {
        $this->mockGameEventQuery([]);

        $exitCode = $this->commandTester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testTypeGoalsAwardsXpForGoalAndAssist(): void
    {
        $user = $this->makeUser(10);
        $goalEvent = $this->makeGameEventWithUser(1, $user);
        $assistEvent = $this->makeGameEventWithUser(2, $user);

        // Return same events for both processGoals() and processAssists() calls
        $this->mockGameEventQuery([$goalEvent, $assistEvent]);
        $this->xpService->method('retrieveXPForAction')->willReturn(10);

        $addXpCalls = 0;
        $this->xpService->method('addXPToUser')
            ->willReturnCallback(function () use (&$addXpCalls): void {
                ++$addXpCalls;
            });

        $exitCode = $this->commandTester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        // processGoals + processAssists each award XP for 2 events = 4 total
        $this->assertSame(4, $addXpCalls);
    }

    public function testTypeGoalsDryRunDoesNotCallAddXPToUser(): void
    {
        $user = $this->makeUser(11);
        $goalEvent = $this->makeGameEventWithUser(5, $user);

        $this->mockGameEventQuery([$goalEvent]);
        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->xpService->method('retrieveXPForAction')->willReturn(50);

        $exitCode = $this->commandTester->execute(['--type' => 'goals', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('DRY-RUN', $this->commandTester->getDisplay());
    }

    public function testTypeGoalsSkipsAlreadyAwardedGoal(): void
    {
        $user = $this->makeUser(12);
        $goalEvent = $this->makeGameEventWithUser(6, $user);

        $this->mockGameEventQuery([$goalEvent]);

        $existing = $this->createMock(UserXpEvent::class);
        $this->xpEventRepository->method('findOneBy')->willReturn($existing);

        $this->xpService->expects($this->never())->method('addXPToUser');

        $exitCode = $this->commandTester->execute(['--type' => 'goals']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── --type=game_events ────────────────────────────────────────────────────

    public function testTypeGameEventsReturnsSuccessWithEmptyList(): void
    {
        $this->mockGameEventQuery([]);

        $exitCode = $this->commandTester->execute(['--type' => 'game_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testTypeGameEventsAwardsXpForEventWithPlayer(): void
    {
        $user = $this->makeUser(20);
        $gameEvent = $this->makeGameEventWithUser(10, $user);

        $this->mockGameEventQuery([$gameEvent]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);

        $this->xpService->expects($this->once())->method('addXPToUser')->with($user, 15);

        $exitCode = $this->commandTester->execute(['--type' => 'game_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testTypeGameEventsSkipsEventWithNullPlayer(): void
    {
        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getId')->willReturn(11);
        $gameEvent->method('getPlayer')->willReturn(null);

        $this->mockGameEventQuery([$gameEvent]);
        $this->xpService->expects($this->never())->method('addXPToUser');

        $exitCode = $this->commandTester->execute(['--type' => 'game_events']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testTypeGameEventsDryRunDoesNotAwardXp(): void
    {
        $user = $this->makeUser(21);
        $gameEvent = $this->makeGameEventWithUser(12, $user);

        $this->mockGameEventQuery([$gameEvent]);
        $this->xpService->method('retrieveXPForAction')->willReturn(15);
        $this->xpService->expects($this->never())->method('addXPToUser');

        $exitCode = $this->commandTester->execute(['--type' => 'game_events', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── --type=profiles ───────────────────────────────────────────────────────

    public function testTypeProfilesReturnsSuccessWithEmptyList(): void
    {
        $this->mockUserQuery([]);

        $exitCode = $this->commandTester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    public function testTypeProfilesAwardsXpForMilestonesReached(): void
    {
        $this->mockUserQuery([$this->makeUserWithProfile(30)]);
        $this->xpService->method('retrieveXPForAction')->willReturn(20);

        // 100% completeness → milestones 25, 50, 75, 100 all reached = 4 awards
        $addXpCalls = 0;
        $this->xpService->method('addXPToUser')
            ->willReturnCallback(function () use (&$addXpCalls): void {
                ++$addXpCalls;
            });

        $exitCode = $this->commandTester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertSame(4, $addXpCalls);
    }

    public function testTypeProfilesDryRunReportsWithoutSaving(): void
    {
        $this->mockUserQuery([$this->makeUserWithProfile(31)]);
        $this->xpService->method('retrieveXPForAction')->willReturn(10);
        $this->xpService->expects($this->never())->method('addXPToUser');

        $exitCode = $this->commandTester->execute(['--type' => 'profiles', '--dry-run' => true]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('DRY-RUN', $this->commandTester->getDisplay());
    }

    public function testTypeProfilesSkipsAlreadyAwardedMilestone(): void
    {
        $this->mockUserQuery([$this->makeUserWithProfile(32)]);

        $existing = $this->createMock(UserXpEvent::class);
        $this->xpEventRepository->method('findOneBy')->willReturn($existing);

        $this->xpService->expects($this->never())->method('addXPToUser');

        $exitCode = $this->commandTester->execute(['--type' => 'profiles']);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── --type=all ────────────────────────────────────────────────────────────

    public function testTypeAllProcessesAllSectionsAndReturnsSuccess(): void
    {
        // All repos return empty lists — just validate the branches are hit
        $this->mockGameEventQuery([]);
        $this->mockParticipationQuery([]);
        $this->mockUserQuery([]);

        $exitCode = $this->commandTester->execute(['--type' => 'all']);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $output = $this->commandTester->getDisplay();
        $this->assertStringContainsString('Processing Goals', $output);
        $this->assertStringContainsString('Processing Game Events', $output);
        $this->assertStringContainsString('Processing Calendar Event Participations', $output);
        $this->assertStringContainsString('Processing Profile Completeness', $output);
    }

    // ── --user-id option ──────────────────────────────────────────────────────

    public function testUserIdOptionRestrictsProcessingToSpecificUser(): void
    {
        $user = $this->makeUser(42);
        $calendarEvent = $this->makeCalendarEvent(70, 'Training');
        $participation = $this->makeParticipation(1, $user, $calendarEvent, 'attending');

        $this->mockParticipationQuery([$participation]);
        $this->xpService->method('retrieveXPForAction')->willReturn(10);

        $exitCode = $this->commandTester->execute([
            '--type' => 'calendar_events',
            '--user-id' => '42',
        ]);

        $this->assertSame(Command::SUCCESS, $exitCode);
    }

    // ── --force option ────────────────────────────────────────────────────────

    public function testForceOptionDeletesExistingXpEventsAndResetsLevels(): void
    {
        // Force mode uses QueryBuilder on UserXpEvent and UserLevel repos for DELETE/UPDATE
        $xpEventDeleteQuery = $this->createMock(Query::class);
        $xpEventDeleteQb = $this->createMock(QueryBuilder::class);
        $xpEventDeleteQb->method('delete')->willReturnSelf();
        $xpEventDeleteQb->method('getQuery')->willReturn($xpEventDeleteQuery);
        $xpEventDeleteQuery->method('execute')->willReturn(0);

        $userLevelUpdateQuery = $this->createMock(Query::class);
        $userLevelUpdateQb = $this->createMock(QueryBuilder::class);
        $userLevelUpdateQb->method('update')->willReturnSelf();
        $userLevelUpdateQb->method('set')->willReturnSelf();
        $userLevelUpdateQb->method('getQuery')->willReturn($userLevelUpdateQuery);
        $userLevelUpdateQuery->method('execute')->willReturn(0);

        $this->xpEventRepository->method('createQueryBuilder')->willReturn($xpEventDeleteQb);
        $this->userLevelRepository->method('createQueryBuilder')->willReturn($userLevelUpdateQb);
        $this->mockParticipationQuery([]);

        $exitCode = $this->commandTester->execute([
            '--type' => 'calendar_events',
            '--force' => true,
        ]);

        $this->assertSame(Command::SUCCESS, $exitCode);
        $this->assertStringContainsString('Force mode', $this->commandTester->getDisplay());
    }

    // ── Exception handling → Command::FAILURE ─────────────────────────────────

    public function testExecuteReturnsFailureWhenExceptionIsThrown(): void
    {
        $this->participationRepository->method('createQueryBuilder')
            ->willThrowException(new RuntimeException('DB connection lost'));

        $exitCode = $this->commandTester->execute(['--type' => 'calendar_events']);

        $this->assertSame(Command::FAILURE, $exitCode);
        $this->assertStringContainsString('DB connection lost', $this->commandTester->getDisplay());
    }
}
