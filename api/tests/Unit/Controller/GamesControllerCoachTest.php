<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\GamesController;
use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameType;
use App\Entity\Team;
use App\Repository\CameraRepository;
use App\Repository\GameEventRepository;
use App\Service\CoachTeamPlayerService;
use App\Service\GameSchedulePdfService;
use App\Service\GoalCountingService;
use App\Service\TournamentAdvancementService;
use App\Service\UserTitleService;
use App\Service\VideoTimelineService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Testet die Coach-bezogenen Änderungen in GamesController:
 * - details(): $serializeEvent enthält coach und coachId
 * - getCoachesForTeams(): Deduplication und Daten-Mapping
 */
#[AllowMockObjectsWithoutExpectations]
class GamesControllerCoachTest extends TestCase
{
    private GamesController $controller;
    private EntityManagerInterface&MockObject $entityManager;
    private ContainerBuilder $container;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);

        $this->controller = new GamesController(
            $this->entityManager,
            $this->createMock(VideoTimelineService::class),
            $this->createMock(TournamentAdvancementService::class),
            $this->createMock(CoachTeamPlayerService::class),
            $this->createMock(GoalCountingService::class),
            $this->createMock(GameSchedulePdfService::class),
        );

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
        $this->container = $container;
        $this->controller->setContainer($container);
    }

    // ── details(): $serializeEvent enthält coach und coachId ─────────────────

    public function testDetailsContainsCoachAndCoachIdInGameEvent(): void
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getFullName')->willReturn('Hans Trainer');
        $coach->method('getId')->willReturn(42);

        $teamMock = $this->makeTeam();
        $game = $this->makeGame($teamMock);

        $event = new GameEvent();
        $event->setGame($game);
        $event->setCoach($coach);
        $event->setTeam($teamMock);
        $event->setTimestamp(new DateTime('2025-01-01 15:45:00'));

        $goalService = $this->createMock(GoalCountingService::class);
        $goalService->method('collectScores')->willReturn(['home' => 0, 'away' => 0]);

        // GoalCountingService in den Controller injizieren via Neuerstellung
        $controller = new GamesController(
            $this->entityManager,
            $this->createMock(VideoTimelineService::class),
            $this->createMock(TournamentAdvancementService::class),
            $this->createMock(CoachTeamPlayerService::class),
            $goalService,
            $this->createMock(GameSchedulePdfService::class),
        );
        $controller->setContainer($this->container);

        $gameEventRepo = $this->createMock(GameEventRepository::class);
        $gameEventRepo->method('findAllGameEvents')->willReturn([$event]);

        $cameraRepo = $this->createMock(CameraRepository::class);
        $cameraRepo->method('findAll')->willReturn([]);

        $userTitleService = $this->createMock(UserTitleService::class);

        $response = $controller->details($game, $gameEventRepo, $cameraRepo, $userTitleService);

        $data = json_decode($response->getContent(), true);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertArrayHasKey('gameEvents', $data);
        $this->assertNotEmpty($data['gameEvents']);

        $eventData = $data['gameEvents'][0];
        $this->assertSame('Hans Trainer', $eventData['coach'], 'coach fehlt in details()-Antwort');
        $this->assertSame(42, $eventData['coachId'], 'coachId fehlt in details()-Antwort');
    }

    public function testDetailsCoachFelderSindNullWennKeinCoach(): void
    {
        $teamMock = $this->makeTeam();
        $game = $this->makeGame($teamMock);

        $event = new GameEvent();
        $event->setGame($game);
        $event->setTeam($teamMock);
        $event->setTimestamp(new DateTime('2025-01-01 15:45:00'));

        $goalService = $this->createMock(GoalCountingService::class);
        $goalService->method('collectScores')->willReturn(['home' => 0, 'away' => 0]);

        $controller = new GamesController(
            $this->entityManager,
            $this->createMock(VideoTimelineService::class),
            $this->createMock(TournamentAdvancementService::class),
            $this->createMock(CoachTeamPlayerService::class),
            $goalService,
            $this->createMock(GameSchedulePdfService::class),
        );
        $controller->setContainer($this->container);

        $gameEventRepo = $this->createMock(GameEventRepository::class);
        $gameEventRepo->method('findAllGameEvents')->willReturn([$event]);

        $cameraRepo = $this->createMock(CameraRepository::class);
        $cameraRepo->method('findAll')->willReturn([]);

        $response = $controller->details($game, $gameEventRepo, $cameraRepo, $this->createMock(UserTitleService::class));

        $data = json_decode($response->getContent(), true);
        $eventData = $data['gameEvents'][0];

        $this->assertNull($eventData['coach'], 'coach sollte null sein wenn kein Coach gesetzt');
        $this->assertNull($eventData['coachId'], 'coachId sollte null sein wenn kein Coach gesetzt');
    }

    // ── getCoachesForTeams(): Deduplizierung ──────────────────────────────────

    public function testGetCoachesForTeamsReturnsCoachesCorrectly(): void
    {
        $rows = [
            ['id' => 1, 'firstName' => 'Hans', 'lastName' => 'Trainer', 'teamId' => 10],
            ['id' => 2, 'firstName' => 'Karl', 'lastName' => 'Coach',   'teamId' => 20],
        ];

        $query = $this->createMock(\Doctrine\ORM\Query::class);
        $query->method('setParameter')->willReturnSelf();
        $query->method('getArrayResult')->willReturn($rows);

        $this->entityManager->method('createQuery')->willReturn($query);

        $result = $this->callGetCoachesForTeams([10, 20], new DateTime('today'));

        $this->assertCount(2, $result);
        $this->assertSame('Hans Trainer', $result[0]['fullName']);
        $this->assertSame(10, $result[0]['teamId']);
        $this->assertSame('Karl Coach', $result[1]['fullName']);
    }

    public function testGetCoachesForTeamsDedupliziertDuplikate(): void
    {
        // Gleicher Coach in zwei Zeilen (z.B. zwei Abfrage-Treffer)
        $rows = [
            ['id' => 1, 'firstName' => 'Hans', 'lastName' => 'Trainer', 'teamId' => 10],
            ['id' => 1, 'firstName' => 'Hans', 'lastName' => 'Trainer', 'teamId' => 10], // Duplikat
        ];

        $query = $this->createMock(\Doctrine\ORM\Query::class);
        $query->method('setParameter')->willReturnSelf();
        $query->method('getArrayResult')->willReturn($rows);

        $this->entityManager->method('createQuery')->willReturn($query);

        $result = $this->callGetCoachesForTeams([10], new DateTime('today'));

        $this->assertCount(1, $result, 'Duplikate müssen dedupliziert werden');
        $this->assertSame('Hans Trainer', $result[0]['fullName']);
    }

    public function testGetCoachesForTeamsGibtLeereArrayWennKeineTrainer(): void
    {
        $query = $this->createMock(\Doctrine\ORM\Query::class);
        $query->method('setParameter')->willReturnSelf();
        $query->method('getArrayResult')->willReturn([]);

        $this->entityManager->method('createQuery')->willReturn($query);

        $result = $this->callGetCoachesForTeams([10], new DateTime('today'));

        $this->assertSame([], $result);
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * Ruft die private getCoachesForTeams-Methode via Reflection auf.
     *
     * @param int[] $teamIds
     *
     * @return array<int, array{id: int, fullName: string, teamId: int}>
     */
    private function callGetCoachesForTeams(array $teamIds, DateTime $today): array
    {
        $reflection = new ReflectionClass(GamesController::class);
        $method = $reflection->getMethod('getCoachesForTeams');
        $method->setAccessible(true);

        return $method->invoke($this->controller, $teamIds, $today);
    }

    private function makeTeam(): Team&MockObject
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(10);
        $team->method('getName')->willReturn('FC Test');

        return $team;
    }

    private function makeGame(Team $team): Game&MockObject
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getId')->willReturn(1);
        $calendarEvent->method('getStartDate')->willReturn(new DateTime('2025-01-01 15:00:00'));
        $calendarEvent->method('getEndDate')->willReturn(null);
        $calendarEvent->method('getWeatherData')->willReturn(null);
        $calendarEvent->method('getLocation')->willReturn(null);

        $gameType = $this->createMock(GameType::class);
        $gameType->method('getId')->willReturn(1);
        $gameType->method('getName')->willReturn('Liga');

        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn(1);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);
        $game->method('getHomeTeam')->willReturn($team);
        $game->method('getAwayTeam')->willReturn($team);
        $game->method('getMatchPlan')->willReturn(null);
        $game->method('getGameType')->willReturn($gameType);
        $game->method('getLeague')->willReturn(null);
        $game->method('getCup')->willReturn(null);
        $game->method('getTournamentMatch')->willReturn(null);
        $game->method('isFinished')->willReturn(false);
        $game->method('getHalfDuration')->willReturn(45);
        $game->method('getHalftimeBreakDuration')->willReturn(15);
        $game->method('getFirstHalfExtraTime')->willReturn(0);
        $game->method('getSecondHalfExtraTime')->willReturn(0);
        $game->method('getFussballDeUrl')->willReturn(null);

        return $game;
    }
}
