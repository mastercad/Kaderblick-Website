<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\GameEventsController;
use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\GameEventType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Repository\CoachRepository;
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
use TypeError;

/**
 * Regressionstests für die Team-Auflösung bei Leihgabe-Zuordnungen.
 *
 * Fehler: new DateTime() enthält die aktuelle Uhrzeit. Enddaten aus der
 * Datenbank sind vom Typ DATE (Mitternacht 00:00:00). Ein Leihspieler, der
 * nur für heute zugeordnet ist, hatte damit endDate < currentDateTime und
 * wurde fälschlicherweise als abgelaufen eingestuft.
 *
 * Fix: new DateTime('today') → Vergleich auf Tagesbasis.
 */
#[AllowMockObjectsWithoutExpectations]
class GameEventsControllerLoanTest extends TestCase
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

    // ── Hilfsmethoden ────────────────────────────────────────────────────────

    /**
     * Erstellt einen Game-Mock, bei dem das homeTeam die angegebene ID hat.
     *
     * @return Game&MockObject
     */
    private function makeGameWithHomeTeamId(int $homeTeamId): Game
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn(new DateTime('2025-01-01 15:00:00'));

        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn($homeTeamId);

        $awayTeam = $this->createMock(Team::class);
        $awayTeam->method('getId')->willReturn($homeTeamId + 1);

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);
        $game->method('getHomeTeam')->willReturn($homeTeam);
        $game->method('getAwayTeam')->willReturn($awayTeam);

        return $game;
    }

    /**
     * Ruft addEvent mit einem Spieler-Payload auf.
     *
     * @return \Symfony\Component\HttpFoundation\JsonResponse
     */
    private function callAddEventWithPlayer(Player $player, int $homeTeamId): mixed
    {
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Tor');
        $eventType->method('getCode')->willReturn('goal');

        $eventTypeRepo = $this->createMock(GameEventTypeRepository::class);
        $eventTypeRepo->method('find')->willReturn($eventType);

        $playerRepo = $this->createMock(PlayerRepository::class);
        $playerRepo->method('find')->willReturn($player);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('persist');
        $em->method('flush');

        $request = Request::create(
            '/api/game/1/event',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['player' => 127, 'eventType' => 1, 'minute' => '600'])
        );

        return $this->controller->addEvent(
            $this->makeGameWithHomeTeamId($homeTeamId),
            $request,
            $em,
            $playerRepo,
            $this->createMock(CoachRepository::class),
            $eventTypeRepo,
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );
    }

    /**
     * Ruft addEvent mit einem Coach-Payload auf.
     *
     * @return \Symfony\Component\HttpFoundation\JsonResponse
     */
    private function callAddEventWithCoach(Coach $coach, int $homeTeamId): mixed
    {
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getName')->willReturn('Gelbe Karte');
        $eventType->method('getCode')->willReturn('yellow_card');

        $eventTypeRepo = $this->createMock(GameEventTypeRepository::class);
        $eventTypeRepo->method('find')->willReturn($eventType);

        $coachRepo = $this->createMock(CoachRepository::class);
        $coachRepo->method('find')->willReturn($coach);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('persist');
        $em->method('flush');

        $request = Request::create(
            '/api/game/1/event',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['coach' => 42, 'eventType' => 1, 'minute' => '600'])
        );

        return $this->controller->addEvent(
            $this->makeGameWithHomeTeamId($homeTeamId),
            $request,
            $em,
            $this->createMock(PlayerRepository::class),
            $coachRepo,
            $eventTypeRepo,
            $this->createMock(SubstitutionReasonRepository::class),
            $this->createMock(EventDispatcherInterface::class),
        );
    }

    // ── Spieler-Leihgabe ──────────────────────────────────────────────────────

    /**
     * Regression: Leihgabe mit Enddatum = heute (Mitternacht) muss als aktiv gelten.
     *
     * Vor dem Fix schlug addEvent mit TypeError fehl, weil today-midnight < now() war.
     */
    public function testPlayerLoanEndingTodayIsResolvedAsActiveTeam(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(10);

        $pta = new PlayerTeamAssignment();
        $pta->setTeam($homeTeam);
        $pta->setEndDate(new DateTime('today')); // Mitternacht heute – Doctrine-DATE-Typ

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $response = $this->callAddEventWithPlayer($player, 10);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success'], 'addEvent muss für einen Leihspieler mit Enddatum heute erfolgreich sein');
    }

    /**
     * Eine abgelaufene Zuordnung (Enddatum gestern) darf nicht als aktiv gewertet werden.
     * Da kein Fallback-Team im Request vorhanden ist, wird setTeam(null) auf dem
     * nicht-nullable Feld aufgerufen → TypeError ist das erwartete Verhalten.
     */
    public function testPlayerLoanEndingYesterdayIsNotActive(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(10);

        $pta = new PlayerTeamAssignment();
        $pta->setTeam($homeTeam);
        $pta->setEndDate(new DateTime('yesterday'));

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $this->expectException(TypeError::class);
        $this->callAddEventWithPlayer($player, 10);
    }

    /**
     * Zuordnung ohne Enddatum (unbegrenzt aktiv) muss das Team korrekt auflösen.
     */
    public function testPlayerAssignmentWithNoEndDateIsAlwaysActive(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(10);

        $pta = new PlayerTeamAssignment();
        $pta->setTeam($homeTeam);
        $pta->setEndDate(null);

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $response = $this->callAddEventWithPlayer($player, 10);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    /**
     * Zuordnung mit Enddatum morgen muss als aktiv gelten.
     */
    public function testPlayerLoanEndingTomorrowIsActive(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(10);

        $pta = new PlayerTeamAssignment();
        $pta->setTeam($homeTeam);
        $pta->setEndDate(new DateTime('tomorrow'));

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $response = $this->callAddEventWithPlayer($player, 10);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    // ── Coach-Leihgabe ────────────────────────────────────────────────────────

    /**
     * Regression: Coach-Leihgabe mit Enddatum = heute muss als aktiv gelten.
     */
    public function testCoachLoanEndingTodayIsResolvedAsActiveTeam(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(20);

        $cta = new CoachTeamAssignment();
        $cta->setTeam($homeTeam);
        $cta->setEndDate(new DateTime('today'));

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $response = $this->callAddEventWithCoach($coach, 20);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success'], 'addEvent muss für einen Leih-Coach mit Enddatum heute erfolgreich sein');
    }

    /**
     * Abgelaufene Coach-Zuordnung (Enddatum gestern) darf nicht als aktiv gelten.
     */
    public function testCoachLoanEndingYesterdayIsNotActive(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(20);

        $cta = new CoachTeamAssignment();
        $cta->setTeam($homeTeam);
        $cta->setEndDate(new DateTime('yesterday'));

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $this->expectException(TypeError::class);
        $this->callAddEventWithCoach($coach, 20);
    }

    /**
     * Coach-Zuordnung ohne Enddatum muss immer als aktiv gelten.
     */
    public function testCoachAssignmentWithNoEndDateIsAlwaysActive(): void
    {
        $homeTeam = $this->createMock(Team::class);
        $homeTeam->method('getId')->willReturn(20);

        $cta = new CoachTeamAssignment();
        $cta->setTeam($homeTeam);
        $cta->setEndDate(null);

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $response = $this->callAddEventWithCoach($coach, 20);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }
}
