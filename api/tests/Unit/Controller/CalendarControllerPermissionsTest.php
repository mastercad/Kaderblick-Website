<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventReadController;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\TaskAssignment;
use App\Entity\User;
use App\Repository\CalendarEventRepository;
use App\Repository\ParticipationRepository;
use App\Security\Voter\CalendarEventVoter;
use App\Service\CalendarEventSerializer;
use App\Service\SystemSettingService;
use App\Service\TeamMembershipService;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Tests that the 'canParticipate' flag in the permissions array returned by
 * CalendarController::retrieveEvents() is set correctly:
 *
 *  - Tournament-type events delegate to TeamMembershipService (team-membership check)
 *  - ROLE_SUPERADMIN always gets canParticipate: true
 *  - Non-tournament events delegate to TeamMembershipService
 */
#[AllowMockObjectsWithoutExpectations]
class CalendarControllerPermissionsTest extends TestCase
{
    private CalendarEventReadController $controller;
    private TeamMembershipService&MockObject $membershipService;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private EntityManagerInterface&MockObject $em;
    private Security&MockObject $security;
    /** @var EntityRepository<CalendarEventType>&MockObject */
    private EntityRepository&MockObject $eventTypeRepo;
    /** @var EntityRepository<TaskAssignment>&MockObject */
    private EntityRepository&MockObject $taskAssignmentRepo;

    private const TOURNAMENT_TYPE_ID = 5;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);

        $participationRepo = $this->createMock(ParticipationRepository::class);
        $participationRepo->method('findByUserAndEvent')->willReturn(null);

        $this->membershipService = $this->createMock(TeamMembershipService::class);
        $this->security = $this->createMock(Security::class);

        $serializer = new CalendarEventSerializer(
            $this->em,
            $participationRepo,
            $this->membershipService,
            $this->security,
        );

        $this->controller = new CalendarEventReadController(
            $this->em,
            $serializer,
            $this->createMock(SystemSettingService::class),
        );

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        // Repository stubs
        $this->eventTypeRepo = $this->createMock(EntityRepository::class);
        $this->taskAssignmentRepo = $this->createMock(EntityRepository::class);
        $this->taskAssignmentRepo->method('findOneBy')->willReturn(null);

        $tournamentRepo = $this->createMock(EntityRepository::class);
        $tournamentRepo->method('findOneBy')->willReturn(null);

        $this->em->method('getRepository')
            ->willReturnCallback(fn (string $class) => match ($class) {
                CalendarEventType::class => $this->eventTypeRepo,
                TaskAssignment::class => $this->taskAssignmentRepo,
                \App\Entity\Tournament::class => $tournamentRepo,
                default => $this->createMock(EntityRepository::class),
            });
    }

    // ─── Tournament events ────────────────────────────────────────────────────

    public function testTournamentEventCanParticipateWhenMembershipServiceReturnsTrue(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->with(['name' => 'Turnier'])
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $event = $this->makeCalendarEventMock(typeId: self::TOURNAMENT_TYPE_ID);

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertTrue($permissions['canParticipate']);
    }

    public function testTournamentEventCannotParticipateWhenNotMember(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->with(['name' => 'Turnier'])
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $event = $this->makeCalendarEventMock(typeId: self::TOURNAMENT_TYPE_ID);

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertFalse($permissions['canParticipate']);
    }

    public function testTournamentEventSuperAdminCanAlwaysParticipate(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        // Membership service should not be reached for SUPERADMIN
        $this->membershipService->expects($this->never())->method('canUserParticipateInEvent');

        $event = $this->makeCalendarEventMock(typeId: self::TOURNAMENT_TYPE_ID);

        $permissions = $this->fetchFirstEventPermissions($event, isSuperAdmin: true);

        $this->assertTrue($permissions['canParticipate']);
    }

    // ─── Non-tournament events ────────────────────────────────────────────────

    public function testNonTournamentEventCanParticipateTrueWhenMember(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $event = $this->makeCalendarEventMock(typeId: 99); // different id → not tournament

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertTrue($permissions['canParticipate']);
    }

    public function testNonTournamentEventCanParticipateFalseWhenNotMember(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $event = $this->makeCalendarEventMock(typeId: 99);

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertFalse($permissions['canParticipate']);
    }

    public function testEventWithNoTypeIsNotTreatedAsTournament(): void
    {
        $this->eventTypeRepo->method('findOneBy')
            ->willReturn($this->makeTournamentType(self::TOURNAMENT_TYPE_ID));

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        // Event has no type at all
        $event = $this->makeCalendarEventMock(typeId: null);

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertTrue($permissions['canParticipate']);
    }

    public function testWhenTournamentTypeNotFoundInDbEventIsNeverTournament(): void
    {
        // DB has no "Turnier" event type → $tournamentEventType = null → $isTournamentEvent = false
        $this->eventTypeRepo->method('findOneBy')->willReturn(null);

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $event = $this->makeCalendarEventMock(typeId: 5);

        $permissions = $this->fetchFirstEventPermissions($event);

        $this->assertTrue($permissions['canParticipate']);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * Calls retrieveEvents and returns the permissions array of the first event.
     *
     * @return array<string, mixed>
     */
    private function fetchFirstEventPermissions(CalendarEvent $event, bool $isSuperAdmin = false): array
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);

        // Security mock used by CalendarEventSerializer
        $this->security->method('isGranted')
            ->willReturnCallback(fn (string $attr, mixed $subject = null) => match ($attr) {
                'ROLE_SUPERADMIN' => $isSuperAdmin,
                default => false,
            });
        $this->security->method('getUser')->willReturn($user);

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        // VIEW always passes for the controller's isGranted() call
        $this->authChecker->method('isGranted')
            ->willReturnCallback(fn (string $attr) => CalendarEventVoter::VIEW === $attr);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $this->controller->setContainer($container);

        $calendarEventRepo = $this->createMock(CalendarEventRepository::class);
        $calendarEventRepo->method('findBetweenDates')->willReturn([$event]);

        $request = Request::create('/api/calendar/events', 'GET', [
            'start' => '2026-01-01',
            'end' => '2026-12-31',
        ]);

        $response = $this->controller->retrieveEvents($request, $calendarEventRepo);

        $data = json_decode($response->getContent(), true);
        $this->assertNotEmpty($data, 'Expected at least one event in the response');

        return $data[0]['permissions'];
    }

    private function makeTournamentType(int $id): CalendarEventType&MockObject
    {
        $type = $this->createMock(CalendarEventType::class);
        $type->method('getId')->willReturn($id);
        $type->method('getName')->willReturn('Turnier');
        $type->method('getColor')->willReturn('#e53935');

        return $type;
    }

    private function makeCalendarEventMock(?int $typeId): CalendarEvent&MockObject
    {
        $start = new DateTime('2026-06-15 10:00:00');
        $end = new DateTime('2026-06-15 12:00:00');

        $type = null;
        if (null !== $typeId) {
            $type = $this->createMock(CalendarEventType::class);
            $type->method('getId')->willReturn($typeId);
            $type->method('getName')->willReturn(self::TOURNAMENT_TYPE_ID === $typeId ? 'Turnier' : 'Training');
            $type->method('getColor')->willReturn('#1976d2');
        }

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getStartDate')->willReturn($start);
        $event->method('getEndDate')->willReturn($end);
        $event->method('getDescription')->willReturn(null);
        $event->method('getCalendarEventType')->willReturn($type);
        $event->method('getTournament')->willReturn(null);
        $event->method('getWeatherData')->willReturn(null);
        $event->method('getGame')->willReturn(null);
        $event->method('getLocation')->willReturn(null);
        $event->method('getPermissions')->willReturn(new ArrayCollection());
        $event->method('getTrainingWeekdays')->willReturn(null);
        $event->method('getTrainingSeriesEndDate')->willReturn(null);
        $event->method('getTrainingSeriesId')->willReturn(null);
        $event->method('isCancelled')->willReturn(false);
        $event->method('getCancelReason')->willReturn(null);
        $event->method('getCancelledBy')->willReturn(null);

        return $event;
    }
}
