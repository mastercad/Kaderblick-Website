<?php

namespace App\Tests\Unit\Controller;

use App\Controller\ParticipationController;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\Location;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Event\CalendarEventParticipatedEvent;
use App\Event\MatchAttendedEvent;
use App\Event\ParticipationRespondedEvent;
use App\Event\TrainingAttendedEvent;
use App\Repository\ParticipationRepository;
use App\Repository\ParticipationStatusRepository;
use App\Service\NotificationService;
use App\Service\TeamMembershipService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Tests that ParticipationController::respond() dispatches the correct XP event
 * based on the participation status and calendar event type.
 */
#[AllowMockObjectsWithoutExpectations]
class ParticipationControllerXpTest extends TestCase
{
    private ParticipationController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;
    private ParticipationRepository&MockObject $participationRepo;
    private ParticipationStatusRepository&MockObject $statusRepo;
    private TeamMembershipService&MockObject $membershipService;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private NotificationService&MockObject $notificationService;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $this->participationRepo = $this->createMock(ParticipationRepository::class);
        $this->statusRepo = $this->createMock(ParticipationStatusRepository::class);
        $this->notificationService = $this->createMock(NotificationService::class);
        $this->membershipService = $this->createMock(TeamMembershipService::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);

        $this->controller = new ParticipationController(
            $em,
            $this->participationRepo,
            $this->statusRepo,
            $this->notificationService,
            $this->membershipService,
            $this->dispatcher,
        );

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
    }

    // ─── TrainingAttendedEvent ────────────────────────────────────────────────

    public function testDispatchesTrainingAttendedWhenAttendingAndTypeIsTraining(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Training');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(TrainingAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── MatchAttendedEvent ───────────────────────────────────────────────────

    public function testDispatchesMatchAttendedWhenAttendingAndTypeIsSpiel(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Spiel');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(MatchAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testDispatchesMatchAttendedWhenAttendingAndTypeIsTurnierMatch(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Turnier-Match');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(MatchAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── CalendarEventParticipatedEvent ──────────────────────────────────────

    public function testDispatchesCalendarEventParticipatedForOtherEventTypes(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Vereinstreffen');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(CalendarEventParticipatedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── ParticipationRespondedEvent ──────────────────────────────────────────

    public function testDispatchesParticipationRespondedWhenStatusIsNotAttending(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('not_attending');
        $event = $this->makeCalendarEvent('Training');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(ParticipationRespondedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 2, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testDispatchesParticipationRespondedWhenStatusIsMaybe(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('maybe');
        $event = $this->makeCalendarEvent('Spiel');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(ParticipationRespondedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 3, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testDispatchesParticipationRespondedWhenStatusIsLate(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('late');
        $event = $this->makeCalendarEvent('Training');

        $this->wireScenario($user, $status, $event);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(ParticipationRespondedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 4, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    // ─── Error cases ──────────────────────────────────────────────────────────

    public function testRespondReturns401WhenNoUserAuthenticated(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $this->controller->setContainer($container);

        $event = $this->makeCalendarEvent('Training');
        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testRespondReturns403WhenUserNotAllowedToParticipate(): void
    {
        $user = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $this->controller->setContainer($container);

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testRespondReturns400WhenStatusNotFound(): void
    {
        $user = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);
        $this->controller->setContainer($container);

        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn(null);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        $request = new Request(content: json_encode(['status_id' => 999, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ─── getEventParticipations ───────────────────────────────────────────────

    public function testGetEventParticipationsReturnsForbiddenForNonTeamMember(): void
    {
        $user = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testGetEventParticipationsReturnsParticipationData(): void
    {
        $user = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $participant = $this->makeParticipantUser(99);
        $participation = $this->makeParticipationFor($participant, 'attending');

        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([$this->makeStatus('attending')]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(1, $data['participations']);
        $this->assertSame(99, $data['participations'][0]['user_id']);
        $this->assertNull($data['my_participation']);
        // available_statuses should be populated via getAvailableStatuses()
        $this->assertCount(1, $data['available_statuses']);
    }

    public function testGetEventParticipationsSetsMyParticipation(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('getFullName')->willReturn('Test User');
        $user->method('getFirstName')->willReturn('Test');
        $user->method('getLastName')->willReturn('User');
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $participation = $this->makeParticipationFor($user, 'attending');

        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNotNull($data['my_participation']);
        $this->assertSame('attending', $data['my_participation']['status_code']);
    }

    public function testGetEventParticipationsSuperAdminSkipsTeamCheck(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getRoles')->willReturn(['ROLE_SUPERADMIN']);

        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->participationRepo->method('findBy')->willReturn([]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetEventParticipationsIsTeamPlayerTrueWhenPlayerInGameTeam(): void
    {
        $user = $this->makeUser();

        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(10);

        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn($team);
        $game->method('getAwayTeam')->willReturn(null);

        $calendarEventType = $this->createMock(CalendarEventType::class);
        $calendarEventType->method('getName')->willReturn('Spiel');

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn($calendarEventType);
        $event->method('getGame')->willReturn($game);

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getTeam')->willReturn($team); // SAME $team → === comparison passes

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');
        $relationType->method('getIdentifier')->willReturn('self_player');

        $userRelation = $this->createMock(UserRelation::class);
        $userRelation->method('getPlayer')->willReturn($player);
        $userRelation->method('getRelationType')->willReturn($relationType);

        $participant = $this->createMock(User::class);
        $participant->method('getId')->willReturn(55);
        $participant->method('getFirstName')->willReturn('First');
        $participant->method('getLastName')->willReturn('Last');
        $participant->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));

        $participation = $this->makeParticipationFor($participant, 'attending');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['participations'][0]['is_team_player']);
    }

    public function testGetEventParticipationsIsTeamPlayerFalseWhenNoSelfPlayerRelation(): void
    {
        $user = $this->makeUser();

        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn(null);
        $game->method('getAwayTeam')->willReturn(null);

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn(null);
        $event->method('getGame')->willReturn($game);

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');
        $relationType->method('getIdentifier')->willReturn('other_relation'); // not self_player

        $userRelation = $this->createMock(UserRelation::class);
        $userRelation->method('getPlayer')->willReturn($this->createMock(Player::class));
        $userRelation->method('getRelationType')->willReturn($relationType);

        $participant = $this->makeParticipantUser(88);
        $participant->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));

        $participation = $this->makeParticipationFor($participant, 'attending');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertFalse($data['participations'][0]['is_team_player']);
    }

    public function testGetEventParticipationsIsTeamPlayerFalseWhenPlayerNotInGameTeam(): void
    {
        $user = $this->makeUser();

        $gameTeam = $this->createMock(Team::class);
        $playerTeam = $this->createMock(Team::class); // different object → === fails

        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn($gameTeam);
        $game->method('getAwayTeam')->willReturn(null);

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn(null);
        $event->method('getGame')->willReturn($game);

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getTeam')->willReturn($playerTeam); // NOT $gameTeam

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');
        $relationType->method('getIdentifier')->willReturn('self_player');

        $userRelation = $this->createMock(UserRelation::class);
        $userRelation->method('getPlayer')->willReturn($player);
        $userRelation->method('getRelationType')->willReturn($relationType);

        $participant = $this->makeParticipantUser(77);
        $participant->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));

        $participation = $this->makeParticipationFor($participant, 'attending');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertFalse($data['participations'][0]['is_team_player']);
    }

    public function testGetEventParticipationsIsTeamPlayerFalseWhenPlayerIsNull(): void
    {
        $user = $this->makeUser();

        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn(null);
        $game->method('getAwayTeam')->willReturn(null);

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn(null);
        $event->method('getGame')->willReturn($game);

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');
        $relationType->method('getIdentifier')->willReturn('self_player');

        $userRelation = $this->createMock(UserRelation::class);
        $userRelation->method('getPlayer')->willReturn(null); // null player → return false
        $userRelation->method('getRelationType')->willReturn($relationType);

        $participant = $this->createMock(User::class);
        $participant->method('getId')->willReturn(66);
        $participant->method('getFirstName')->willReturn('First');
        $participant->method('getLastName')->willReturn('Last');
        $participant->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));

        $participation = $this->makeParticipationFor($participant, 'attending');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->participationRepo->method('findBy')->willReturn([$participation]);
        $this->statusRepo->method('findBy')->willReturn([]);

        $response = $this->controller->getEventParticipations($event);
        $data = json_decode($response->getContent(), true);

        $this->assertFalse($data['participations'][0]['is_team_player']);
    }

    // ─── getParticipationStatuses ─────────────────────────────────────────────

    public function testGetParticipationStatusesReturnsList(): void
    {
        $this->wireUser(null); // initializes the container for $this->json()
        $status = $this->makeStatus('attending');
        $this->statusRepo->method('findBy')->willReturn([$status]);

        $response = $this->controller->getParticipationStatuses();
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(1, $data['statuses']);
        $this->assertSame('attending', $data['statuses'][0]['code']);
    }

    // ─── getEventOverview ─────────────────────────────────────────────────────

    public function testGetEventOverviewReturnsForbiddenForNonTeamMember(): void
    {
        $user = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $response = $this->controller->getEventOverview($event);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testGetEventOverviewSuperAdminSkipsTeamCheck(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getRoles')->willReturn(['ROLE_SUPERADMIN']);

        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->participationRepo->method('findBy')->willReturn([]);
        $this->membershipService->method('getEventTeams')->willReturn([]);

        $response = $this->controller->getEventOverview($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([], $data['teams']);
        $this->assertNull($data['my_team_id']);
    }

    public function testGetEventOverviewReturnsTeamsDataAndSetsMyTeamId(): void
    {
        $currentUser = $this->makeUser(); // ID=42
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($currentUser);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(5);
        $team->method('getName')->willReturn('Team A');

        $member = $this->makeParticipantUser(77);

        $this->participationRepo->method('findBy')->willReturn([]);
        $this->membershipService->method('getEventTeams')->willReturn([$team]);
        $this->membershipService->method('isUserInTeam')->willReturn(true);
        $this->membershipService->method('resolveTeamMembers')->willReturn([$member]);

        $response = $this->controller->getEventOverview($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertCount(1, $data['teams']);
        $this->assertSame('Team A', $data['teams'][0]['name']);
        $this->assertSame(5, $data['my_team_id']);
    }

    // ─── respond() additional paths ───────────────────────────────────────────

    public function testRespondSuperAdminCanAlwaysRespond(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getRoles')->willReturn(['ROLE_SUPERADMIN']);
        $user->method('getFullName')->willReturn('Admin');

        $status = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);
        $this->participationRepo->method('findByEvent')->willReturn([]);

        $this->dispatcher->expects($this->once())->method('dispatch')
            ->with($this->isInstanceOf(TrainingAttendedEvent::class));

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testRespondUpdatesExistingParticipationAndDetectsStatusChange(): void
    {
        $user = $this->makeUser(); // ID=42
        $newStatus = $this->makeStatus('attending');
        $event = $this->makeCalendarEvent('Training');

        $oldStatus = $this->createMock(ParticipationStatus::class);
        $oldStatus->method('getId')->willReturn(99); // different from newStatus ID (1)

        $existingParticipation = $this->createMock(Participation::class);
        $existingParticipation->method('getId')->willReturn(5); // non-null → enters if-block
        $existingParticipation->method('getStatus')->willReturn($oldStatus);
        $existingParticipation->method('setUser')->willReturnSelf();
        $existingParticipation->method('setEvent')->willReturnSelf();
        $existingParticipation->method('setStatus')->willReturnSelf();
        $existingParticipation->method('setNote')->willReturnSelf();
        $existingParticipation->method('getNote')->willReturn('');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($newStatus);
        $this->participationRepo->method('findOneBy')->willReturn($existingParticipation);
        $this->participationRepo->method('findByEvent')->willReturn([]);

        $this->dispatcher->expects($this->once())->method('dispatch');

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testRespondDoesNotDispatchForUnknownStatus(): void
    {
        $user = $this->makeUser();
        $status = $this->makeStatus('custom_status');
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);
        $this->participationRepo->method('findByEvent')->willReturn([]);

        $this->dispatcher->expects($this->never())->method('dispatch');

        $request = new Request(content: json_encode(['status_id' => 9, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testRespondSendsNotificationToOtherParticipants(): void
    {
        $actor = $this->makeUser(); // ID=42
        $status = $this->makeStatus('not_attending'); // → 'abgesagt'
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($actor);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        $recipient = $this->createMock(User::class);
        $recipient->method('getId')->willReturn(99); // different from actor

        $recipientParticipation = $this->createMock(Participation::class);
        $recipientParticipation->method('getUser')->willReturn($recipient);

        $this->participationRepo->method('findByEvent')->willReturn([$recipientParticipation]);

        $this->notificationService->expects($this->once())->method('createNotification');

        $request = new Request(content: json_encode(['status_id' => 2, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testRespondNotificationIncludesDateAndLocation(): void
    {
        $actor = $this->makeUser(); // ID=42
        $status = $this->makeStatus('maybe'); // → 'vielleicht'

        $location = $this->createMock(Location::class);
        $location->method('getName')->willReturn('Stadion');

        $date = new DateTimeImmutable('2026-05-18 15:00');

        $calendarEventType = $this->createMock(CalendarEventType::class);
        $calendarEventType->method('getName')->willReturn('Training');

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn($calendarEventType);
        $event->method('getGame')->willReturn(null);
        $event->method('getStartDate')->willReturn($date);
        $event->method('getLocation')->willReturn($location);

        $this->wireUser($actor);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        $recipient = $this->createMock(User::class);
        $recipient->method('getId')->willReturn(99);

        $recipientParticipation = $this->createMock(Participation::class);
        $recipientParticipation->method('getUser')->willReturn($recipient);

        $this->participationRepo->method('findByEvent')->willReturn([$recipientParticipation]);

        $this->notificationService->expects($this->once())->method('createNotification')
            ->with(
                $recipient,
                'participation',
                $this->stringContains('vielleicht'),
                $this->stringContains('📅'),
                $this->anything()
            );

        $request = new Request(content: json_encode(['status_id' => 3, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testRespondNotificationUsesDefaultStatusTextForLate(): void
    {
        $actor = $this->makeUser(); // ID=42
        $status = $this->makeStatus('late'); // → default match arm
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($actor);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        $recipient = $this->createMock(User::class);
        $recipient->method('getId')->willReturn(99);

        $recipientParticipation = $this->createMock(Participation::class);
        $recipientParticipation->method('getUser')->willReturn($recipient);

        $this->participationRepo->method('findByEvent')->willReturn([$recipientParticipation]);

        $this->notificationService->expects($this->once())->method('createNotification');

        $request = new Request(content: json_encode(['status_id' => 4, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testRespondNotificationSkipsActorAsRecipient(): void
    {
        $actor = $this->makeUser(); // ID=42
        $status = $this->makeStatus('not_attending');
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($actor);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        // Participation whose user has the SAME ID as the actor → must be skipped
        $sameUserParticipation = $this->createMock(Participation::class);
        $sameUserParticipation->method('getUser')->willReturn($actor);

        $this->participationRepo->method('findByEvent')->willReturn([$sameUserParticipation]);

        $this->notificationService->expects($this->never())->method('createNotification');

        $request = new Request(content: json_encode(['status_id' => 2, 'note' => '']));
        $this->controller->respond($request, $event);
    }

    public function testRespondNotificationUsesAttendingStatusText(): void
    {
        $actor = $this->makeUser(); // ID=42
        $status = $this->makeStatus('attending'); // → 'zugesagt'
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($actor);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);
        $this->statusRepo->method('find')->willReturn($status);
        $this->participationRepo->method('findOneBy')->willReturn(null);

        $recipient = $this->createMock(User::class);
        $recipient->method('getId')->willReturn(99);
        $recipientParticipation = $this->createMock(Participation::class);
        $recipientParticipation->method('getUser')->willReturn($recipient);

        $this->participationRepo->method('findByEvent')->willReturn([$recipientParticipation]);

        $this->dispatcher->expects($this->once())->method('dispatch'); // TrainingAttendedEvent

        $this->notificationService->expects($this->once())
            ->method('createNotification')
            ->with(
                $recipient,
                'participation',
                $this->stringContains('zugesagt'),
                $this->anything(),
                $this->anything()
            );

        $request = new Request(content: json_encode(['status_id' => 1, 'note' => '']));
        $response = $this->controller->respond($request, $event);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetEventOverviewSortsMembersWithParticipationFirst(): void
    {
        $currentUser = $this->makeUser();
        $event = $this->makeCalendarEvent('Training');

        $this->wireUser($currentUser);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(7);
        $team->method('getName')->willReturn('Team B');

        // 3 members: memberA has participation, memberB and memberC don't
        $memberA = $this->createMock(User::class);
        $memberA->method('getId')->willReturn(10);
        $memberA->method('getFirstName')->willReturn('Alpha');
        $memberA->method('getLastName')->willReturn('Alpha');

        $memberB = $this->createMock(User::class);
        $memberB->method('getId')->willReturn(20);
        $memberB->method('getFirstName')->willReturn('Beta');
        $memberB->method('getLastName')->willReturn('Beta');

        $memberC = $this->createMock(User::class);
        $memberC->method('getId')->willReturn(30);
        $memberC->method('getFirstName')->willReturn('Gamma');
        $memberC->method('getLastName')->willReturn('Gamma');

        // Only memberA has a participation
        $participationA = $this->makeParticipationFor($memberA, 'attending');
        // participationA must expose user id for the map
        $this->participationRepo->method('findBy')->willReturn([$participationA]);

        $this->membershipService->method('getEventTeams')->willReturn([$team]);
        $this->membershipService->method('isUserInTeam')->willReturn(false);
        $this->membershipService->method('resolveTeamMembers')->willReturn([$memberB, $memberA, $memberC]);

        $response = $this->controller->getEventOverview($event);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $members = $data['teams'][0]['members'];
        // memberA (has participation) should be first
        $this->assertSame(10, $members[0]['user_id']);
        // memberB and memberC sorted alphabetically
        $this->assertSame(20, $members[1]['user_id']);
        $this->assertSame(30, $members[2]['user_id']);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function wireUser(?User $user): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }

    private function makeParticipantUser(int $id): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getFirstName')->willReturn('First');
        $user->method('getLastName')->willReturn('Last');
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        return $user;
    }

    private function makeParticipationFor(User $user, string $statusCode): Participation&MockObject
    {
        $status = $this->makeStatus($statusCode);

        $participation = $this->createMock(Participation::class);
        $participation->method('getUser')->willReturn($user);
        $participation->method('getStatus')->willReturn($status);
        $participation->method('getNote')->willReturn('');

        return $participation;
    }

    private function makeUser(): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('getFullName')->willReturn('Test User');

        return $user;
    }

    private function makeStatus(string $code): ParticipationStatus&MockObject
    {
        $status = $this->createMock(ParticipationStatus::class);
        $status->method('getId')->willReturn(1);
        $status->method('getCode')->willReturn($code);
        $status->method('getName')->willReturn($code);
        $status->method('getColor')->willReturn('#000');
        $status->method('getIcon')->willReturn('check');

        return $status;
    }

    private function makeCalendarEvent(string $typeName): CalendarEvent&MockObject
    {
        $type = $this->createMock(CalendarEventType::class);
        $type->method('getName')->willReturn($typeName);

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(1);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getCalendarEventType')->willReturn($type);
        $event->method('getGame')->willReturn(null);

        return $event;
    }

    /**
     * Wires up all shared mock expectations for a successful respond() call.
     */
    private function wireScenario(
        User&MockObject $user,
        ParticipationStatus&MockObject $status,
        CalendarEvent&MockObject $event,
    ): void {
        // Wire user into the security container
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);

        // User is eligible to participate
        $this->membershipService
            ->method('canUserParticipateInEvent')
            ->willReturn(true);

        // Status lookup
        $this->statusRepo
            ->method('find')
            ->willReturn($status);

        // No existing participation → new Participation() is created in the method
        $this->participationRepo
            ->method('findOneBy')
            ->willReturn(null);

        // No other participants → no notifications sent
        $this->participationRepo
            ->method('findByEvent')
            ->willReturn([]);
    }
}
