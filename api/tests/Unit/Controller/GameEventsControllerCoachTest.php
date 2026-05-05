<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\GameEventsController;
use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\Team;
use App\Repository\CoachRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameEventTypeRepository;
use App\Repository\PlayerRepository;
use App\Repository\SubstitutionReasonRepository;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Testet die Coach-Unterstützung in GameEventsController:
 * - listEvents: coach / coachId in der JSON-Antwort
 * - addEvent:   wenn coach-Parameter gesetzt → Coach wird gesetzt, kein Player-Lookup
 * - updateEvent: coach-Update setzt Player auf null; null-Coach löscht Coach
 */
#[AllowMockObjectsWithoutExpectations]
class GameEventsControllerCoachTest extends TestCase
{
    private GameEventsController $controller;

    protected function setUp(): void
    {
        $this->controller = new GameEventsController();

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn(null);

        $container = new ContainerBuilder();
        $container->set('security.authorization_checker', $authChecker);
        $container->set('security.token_storage', $tokenStorage);
        $container->set('serializer', new class {
            /** @param array<string, mixed> $context */
            public function serialize(mixed $data, string $format, array $context = []): string
            {
                return json_encode($data, JSON_THROW_ON_ERROR);
            }
        });

        $this->controller->setContainer($container);
    }

    // ── listEvents: coach-Felder in der Antwort ──────────────────────────────

    public function testListEventsContainsCoachAndCoachId(): void
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getFullName')->willReturn('Hans Trainer');
        $coach->method('getId')->willReturn(42);

        $game = $this->makeGame();
        $event = $this->makeGameEventWithCoach($game, $coach);

        $eventRepo = $this->createMock(GameEventRepository::class);
        $eventRepo->method('findBy')->willReturn([$event]);

        $response = $this->controller->listEvents($game, $eventRepo);
        $data = json_decode($response->getContent(), true);

        $this->assertSame('Hans Trainer', $data[0]['coach'], 'coach-Name fehlt in listEvents-Antwort');
        $this->assertSame(42, $data[0]['coachId'], 'coachId fehlt in listEvents-Antwort');
    }

    public function testListEventsCoachFelderSindNullWennKeinCoach(): void
    {
        $game = $this->makeGame();
        $event = new GameEvent();
        $event->setGame($game);
        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getId')->willReturn(10);
        $event->setTeam($teamMock);
        $event->setTimestamp(new DateTime('2025-01-01 15:45:00'));

        $eventRepo = $this->createMock(GameEventRepository::class);
        $eventRepo->method('findBy')->willReturn([$event]);

        $response = $this->controller->listEvents($game, $eventRepo);
        $data = json_decode($response->getContent(), true);

        $this->assertNull($data[0]['coach'], 'coach sollte null sein wenn kein Coach gesetzt');
        $this->assertNull($data[0]['coachId'], 'coachId sollte null sein wenn kein Coach gesetzt');
    }

    // ── addEvent: Coach hat Vorrang vor Player ────────────────────────────────

    public function testAddEventSetztCoachUndIgnoriertPlayer(): void
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection());

        $coachRepo = $this->createMock(CoachRepository::class);
        $coachRepo->expects($this->once())->method('find')->with(7)->willReturn($coach);

        // playerRepo::find darf NICHT aufgerufen werden, wenn coach gesetzt ist
        $playerRepo = $this->createMock(PlayerRepository::class);
        $playerRepo->expects($this->never())->method('find');

        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Gelbe Karte');
        $eventType->method('getCode')->willReturn('yellow_card');

        $eventTypeRepo = $this->createMock(GameEventTypeRepository::class);
        $eventTypeRepo->method('find')->willReturn($eventType);

        $team = $this->createMock(Team::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('find')->with(Team::class, 3)->willReturn($team);
        $em->expects($this->once())->method('persist');
        $em->expects($this->once())->method('flush');

        $game = $this->makeGame();
        $request = Request::create(
            '/api/game/1/event',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['coach' => 7, 'team' => 3, 'eventType' => 1, 'minute' => '600'])
        );

        $response = $this->controller->addEvent(
            $game,
            $request,
            $em,
            $playerRepo,
            $coachRepo,
            $eventTypeRepo,
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    public function testAddEventOhneCoachVerwendetPlayer(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection());

        $playerRepo = $this->createMock(PlayerRepository::class);
        $playerRepo->expects($this->once())->method('find')->with(3)->willReturn($player);

        $coachRepo = $this->createMock(CoachRepository::class);
        $coachRepo->expects($this->never())->method('find');

        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');
        $eventType->method('getCode')->willReturn('goal');

        $eventTypeRepo = $this->createMock(GameEventTypeRepository::class);
        $eventTypeRepo->method('find')->willReturn($eventType);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('find')->willReturn($this->createMock(Team::class));
        $em->expects($this->once())->method('persist');
        $em->expects($this->once())->method('flush');

        $game = $this->makeGame();
        $request = Request::create(
            '/api/game/1/event',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['player' => 3, 'team' => 3, 'eventType' => 1, 'minute' => '600'])
        );

        $response = $this->controller->addEvent(
            $game,
            $request,
            $em,
            $playerRepo,
            $coachRepo,
            $eventTypeRepo,
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->assertSame(200, $response->getStatusCode());
    }

    // ── updateEvent: Coach setzt Player auf null ──────────────────────────────

    public function testUpdateEventSetztCoachUndLoeschtPlayer(): void
    {
        $coach = $this->createMock(Coach::class);

        $coachRepo = $this->createMock(CoachRepository::class);
        $coachRepo->method('find')->with(9)->willReturn($coach);

        // Event hat vorher einen Player – der muss danach null sein
        $event = new GameEvent();
        $event->setPlayer($this->createMock(Player::class));

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $event->setGame($game);

        $eventRepo = $this->createMock(GameEventRepository::class);
        $eventRepo->method('find')->with(5)->willReturn($event);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('flush');

        $request = Request::create(
            '/api/game/1/event/5',
            'PUT',
            [],
            [],
            [],
            [],
            json_encode(['coach' => 9])
        );

        $response = $this->controller->updateEvent(
            1,
            5,
            $request,
            $em,
            $eventRepo,
            $this->createMock(PlayerRepository::class),
            $coachRepo,
            $this->createMock(GameEventTypeRepository::class),
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame($coach, $event->getCoach(), 'Coach wurde nicht gesetzt');
        $this->assertNull($event->getPlayer(), 'Player wurde nicht auf null gesetzt');
    }

    public function testUpdateEventLoeschtCoachWennNullUebergeben(): void
    {
        $coach = $this->createMock(Coach::class);

        $event = new GameEvent();
        $event->setCoach($coach);

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $event->setGame($game);

        $eventRepo = $this->createMock(GameEventRepository::class);
        $eventRepo->method('find')->with(5)->willReturn($event);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('flush');

        $request = Request::create(
            '/api/game/1/event/5',
            'PUT',
            [],
            [],
            [],
            [],
            json_encode(['coach' => null])
        );

        $response = $this->controller->updateEvent(
            1,
            5,
            $request,
            $em,
            $eventRepo,
            $this->createMock(PlayerRepository::class),
            $this->createMock(CoachRepository::class),
            $this->createMock(GameEventTypeRepository::class),
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($event->getCoach(), 'Coach wurde nicht auf null gesetzt');
    }

    public function testUpdateEventKeepPlayerWennCoachKeyNichtVorhanden(): void
    {
        $player = $this->createMock(Player::class);
        $event = new GameEvent();
        $event->setPlayer($player);

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $event->setGame($game);

        $eventRepo = $this->createMock(GameEventRepository::class);
        $eventRepo->method('find')->with(5)->willReturn($event);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('flush');

        // Kein 'coach'-Key im Request → Player bleibt erhalten
        $request = Request::create(
            '/api/game/1/event/5',
            'PUT',
            [],
            [],
            [],
            [],
            json_encode(['description' => 'Testbeschreibung'])
        );

        $this->controller->updateEvent(
            1,
            5,
            $request,
            $em,
            $eventRepo,
            $this->createMock(PlayerRepository::class),
            $this->createMock(CoachRepository::class),
            $this->createMock(GameEventTypeRepository::class),
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );

        $this->assertSame($player, $event->getPlayer(), 'Player darf nicht gelöscht werden wenn kein coach-Key vorhanden');
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function makeGame(): Game&MockObject
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn(new DateTime('2025-01-01 15:00:00'));

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);
        $game->method('getHomeTeam')->willReturn($this->createMock(Team::class));
        $game->method('getAwayTeam')->willReturn($this->createMock(Team::class));

        return $game;
    }

    private function makeGameEventWithCoach(Game $game, Coach $coach): GameEvent
    {
        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getId')->willReturn(10);

        $event = new GameEvent();
        $event->setGame($game);
        $event->setCoach($coach);
        $event->setTeam($teamMock);
        $event->setTimestamp(new DateTime('2025-01-01 15:45:00'));

        return $event;
    }
}
