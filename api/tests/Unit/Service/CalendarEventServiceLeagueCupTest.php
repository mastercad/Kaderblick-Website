<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameEventType;
use App\Entity\League;
use App\Service\CalendarEventService;
use App\Service\TaskEventGeneratorService;
use App\Service\TeamMembershipService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Unit tests for the league / cup clearing logic inside
 * CalendarEventService::updateEventFromData().
 *
 * Key invariant (array_key_exists pattern):
 *  - key present + truthy value  → set the reference
 *  - key present + falsy value   → set null  (clearing)
 *  - key absent                  → leave unchanged
 */
class CalendarEventServiceLeagueCupTest extends TestCase
{
    private CalendarEventService $service;
    /** @var EntityManagerInterface&MockObject */
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);

        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('validate')->willReturn(new ConstraintViolationList());

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn(null);

        $this->service = new CalendarEventService(
            $this->em,
            $validator,
            $this->createMock(EventDispatcherInterface::class),
            $this->createMock(TaskEventGeneratorService::class),
            $security,
            $this->createMock(TeamMembershipService::class),
        );
    }

    // ── leagueId ─────────────────────────────────────────────────────────────

    public function testLeagueIsSetOnGameWhenLeagueIdIsTruthy(): void
    {
        $game = $this->createMock(Game::class);

        $game->expects($this->once())
            ->method('setLeague')
            ->with($this->isInstanceOf(League::class));

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['leagueId' => 7]);
    }

    public function testLeagueIsClearedOnGameWhenLeagueIdIsNull(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->once())->method('setLeague')->with(null);

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['leagueId' => null]);
    }

    public function testLeagueIsClearedOnGameWhenLeagueIdIsZero(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->once())->method('setLeague')->with(null);

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['leagueId' => 0]);
    }

    public function testLeagueIsNotTouchedWhenKeyIsAbsent(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->never())->method('setLeague');

        $event = $this->buildCalendarEventWithGame($game);

        // No 'leagueId' key in the payload at all.
        $this->callUpdateEventFromData($event, []);
    }

    // ── cupId ─────────────────────────────────────────────────────────────────

    public function testCupIsSetOnGameWhenCupIdIsTruthy(): void
    {
        $game = $this->createMock(Game::class);

        $game->expects($this->once())
            ->method('setCup')
            ->with($this->isInstanceOf(Cup::class));

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['cupId' => 3]);
    }

    public function testCupIsClearedOnGameWhenCupIdIsNull(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->once())->method('setCup')->with(null);

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['cupId' => null]);
    }

    public function testCupIsClearedOnGameWhenCupIdIsZero(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->once())->method('setCup')->with(null);

        $event = $this->buildCalendarEventWithGame($game);

        $this->callUpdateEventFromData($event, ['cupId' => 0]);
    }

    public function testCupIsNotTouchedWhenKeyIsAbsent(): void
    {
        $game = $this->createMock(Game::class);
        $game->expects($this->never())->method('setCup');

        $event = $this->buildCalendarEventWithGame($game);

        // No 'cupId' key in the payload at all.
        $this->callUpdateEventFromData($event, []);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Build a CalendarEvent whose getGame() returns the given mock.
     * The event type is pre-set to the "Spiel" stub so isGameEvent becomes true.
     */
    private function buildCalendarEventWithGame(Game $game): CalendarEvent
    {
        $spielType = $this->createMock(CalendarEventType::class);
        $spielType->method('getId')->willReturn(1);
        $spielType->method('getName')->willReturn('Spiel');

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getGame')->willReturn($game);
        $event->method('getCalendarEventType')->willReturn($spielType);
        $event->method('getTitle')->willReturn('Test Event');
        $event->method('getStartDate')->willReturn(null);
        $event->method('getId')->willReturn(42);

        return $event;
    }

    /**
     * Wire up the EntityManager and call updateEventFromData with a minimal
     * "Spiel" payload so that the isGameEvent + !isTournamentPayload branch runs.
     *
     * @param array<string, mixed> $extraData keys merged into the base payload
     */
    private function callUpdateEventFromData(CalendarEvent $event, array $extraData): void
    {
        $spielType = $this->createMock(CalendarEventType::class);
        $spielType->method('getId')->willReturn(1);

        $tournamentType = $this->createMock(CalendarEventType::class);
        $tournamentType->method('getId')->willReturn(2);

        $gameEventTypeTournament = $this->createMock(GameEventType::class);

        // Repositories
        $calendarEventTypeRepo = $this->createMock(EntityRepository::class);
        $calendarEventTypeRepo->method('findOneBy')->willReturnCallback(
            function (array $criteria) use ($spielType, $tournamentType) {
                return match ($criteria['name'] ?? '') {
                    'Spiel' => $spielType,
                    'Turnier' => $tournamentType,
                    default => null,
                };
            },
        );

        $gameEventTypeRepo = $this->createMock(EntityRepository::class);
        $gameEventTypeRepo->method('findOneBy')->willReturn($gameEventTypeTournament);

        $this->em->method('getRepository')->willReturnMap([
            [CalendarEventType::class, $calendarEventTypeRepo],
            [GameEventType::class, $gameEventTypeRepo],
        ]);

        $this->em->method('getReference')->willReturnCallback(
            function (string $class, int $id): object {
                return match ($class) {
                    League::class => $this->createMock(League::class),
                    Cup::class => $this->createMock(Cup::class),
                    CalendarEventType::class => $this->createMock(CalendarEventType::class),
                    default => $this->createMock(stdClass::class),
                };
            }
        );

        $this->em->method('flush');

        $baseData = [
            'eventTypeId' => 1,   // matches $spielType->getId() → isGameEvent = true
            'title' => 'Test Event',
            'startDate' => '2026-05-01 15:00:00',
            // No pendingTournamentMatches → isTournamentPayload = false
        ];

        $this->service->updateEventFromData($event, array_merge($baseData, $extraData));
    }
}
