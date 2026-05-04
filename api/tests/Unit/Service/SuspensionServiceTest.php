<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\CompetitionCardRule;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\League;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\TournamentMatch;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\PlayerSuspensionRepository;
use App\Service\NotificationService;
use App\Service\SuspensionService;
use DateTime;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class SuspensionServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private GameEventRepository&MockObject $gameEventRepository;
    private PlayerSuspensionRepository&MockObject $suspensionRepository;
    private CompetitionCardRuleRepository&MockObject $cardRuleRepository;
    private NotificationService&MockObject $notificationService;
    private SuspensionService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->gameEventRepository = $this->createMock(GameEventRepository::class);
        $this->suspensionRepository = $this->createMock(PlayerSuspensionRepository::class);
        $this->cardRuleRepository = $this->createMock(CompetitionCardRuleRepository::class);
        $this->notificationService = $this->createMock(NotificationService::class);

        $this->service = new SuspensionService(
            $this->em,
            $this->gameEventRepository,
            $this->suspensionRepository,
            $this->cardRuleRepository,
            $this->notificationService,
        );
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function makeGameEvent(string $typeCode, ?Player $player = null, ?Team $team = null, ?Game $game = null): GameEvent
    {
        $eventType = $this->createMock(GameEventType::class);
        $eventType->method('getCode')->willReturn($typeCode);

        $event = $this->createMock(GameEvent::class);
        $event->method('getGameEventType')->willReturn($eventType);
        $event->method('getPlayer')->willReturn($player ?? $this->makePlayer());
        $event->method('getTeam')->willReturn($team ?? $this->makeTeam());
        $event->method('getGame')->willReturn($game ?? $this->makeGame());

        return $event;
    }

    /** @param array<int, UserRelation> $userRelations */
    private function makePlayer(array $userRelations = []): Player
    {
        $player = $this->createMock(Player::class);
        $player->method('getUserRelations')->willReturn(new ArrayCollection($userRelations));
        $player->method('getFullName')->willReturn('Test Spieler');
        $player->method('getId')->willReturn(1);

        return $player;
    }

    /** @param array<int, CoachTeamAssignment> $coachAssignments */
    private function makeTeam(array $coachAssignments = []): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getCoachTeamAssignments')->willReturn(new ArrayCollection($coachAssignments));

        return $team;
    }

    private function makeGame(
        ?League $league = null,
        ?Cup $cup = null,
        ?TournamentMatch $tournamentMatch = null,
    ): Game {
        $game = $this->createMock(Game::class);
        $game->method('getLeague')->willReturn($league);
        $game->method('getCup')->willReturn($cup);
        $game->method('getTournamentMatch')->willReturn($tournamentMatch);
        $game->method('getId')->willReturn(100);

        return $game;
    }

    private function makeLeague(int $id = 10): League
    {
        $league = $this->createMock(League::class);
        $league->method('getId')->willReturn($id);
        $league->method('getName')->willReturn('Testliga');

        return $league;
    }

    private function makeCup(int $id = 20): Cup
    {
        $cup = $this->createMock(Cup::class);
        $cup->method('getId')->willReturn($id);
        $cup->method('getName')->willReturn('Testpokal');

        return $cup;
    }

    private function makeTournamentMatch(int $tournamentId = 30): TournamentMatch
    {
        $tournament = $this->createMock(Tournament::class);
        $tournament->method('getId')->willReturn($tournamentId);

        $match = $this->createMock(TournamentMatch::class);
        $match->method('getTournament')->willReturn($tournament);

        return $match;
    }

    private function makeRule(
        int $warningThreshold = 4,
        int $suspensionThreshold = 5,
        int $suspensionGames = 1,
        bool $resetAfterSuspension = false,
    ): CompetitionCardRule {
        $rule = $this->createMock(CompetitionCardRule::class);
        $rule->method('getYellowWarningThreshold')->willReturn($warningThreshold);
        $rule->method('getYellowSuspensionThreshold')->willReturn($suspensionThreshold);
        $rule->method('getSuspensionGames')->willReturn($suspensionGames);
        $rule->method('isResetAfterSuspension')->willReturn($resetAfterSuspension);

        return $rule;
    }

    private function makeUserRelation(string $category, User $user): UserRelation
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn($category);

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getUser')->willReturn($user);

        return $relation;
    }

    // ── handleCardEvent: Keine Aktion bei fehlendem Spieler ───────────────────

    public function testHandleCardEventDoesNothingIfNoPlayer(): void
    {
        $event = $this->createMock(GameEvent::class);
        $event->method('getPlayer')->willReturn(null);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    public function testHandleCardEventDoesNothingIfNoEventType(): void
    {
        $event = $this->createMock(GameEvent::class);
        $event->method('getPlayer')->willReturn($this->makePlayer());
        $event->method('getGameEventType')->willReturn(null);

        $this->notificationService->expects($this->never())->method('createNotification');

        $this->service->handleCardEvent($event);
    }

    public function testHandleCardEventDoesNothingForNonCardEvent(): void
    {
        $event = $this->makeGameEvent('goal');

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    // ── resolveCompetitionType ─────────────────────────────────────────────────

    public function testResolveCompetitionTypeLeague(): void
    {
        $game = $this->makeGame(league: $this->makeLeague());
        $this->assertSame('league', $this->service->resolveCompetitionType($game));
    }

    public function testResolveCompetitionTypeCup(): void
    {
        $game = $this->makeGame(cup: $this->makeCup());
        $this->assertSame('cup', $this->service->resolveCompetitionType($game));
    }

    public function testResolveCompetitionTypeTournament(): void
    {
        $game = $this->makeGame(tournamentMatch: $this->makeTournamentMatch());
        $this->assertSame('tournament', $this->service->resolveCompetitionType($game));
    }

    public function testResolveCompetitionTypeFriendly(): void
    {
        $game = $this->makeGame();
        $this->assertSame('friendly', $this->service->resolveCompetitionType($game));
    }

    public function testResolveCompetitionTypeLeagueTakesPriorityOverCup(): void
    {
        // League wird zuerst geprüft
        $game = $this->makeGame(league: $this->makeLeague(), cup: $this->makeCup());
        $this->assertSame('league', $this->service->resolveCompetitionType($game));
    }

    // ── resolveCompetitionId ───────────────────────────────────────────────────

    public function testResolveCompetitionIdLeague(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(10));
        $this->assertSame(10, $this->service->resolveCompetitionId($game, 'league'));
    }

    public function testResolveCompetitionIdCup(): void
    {
        $game = $this->makeGame(cup: $this->makeCup(20));
        $this->assertSame(20, $this->service->resolveCompetitionId($game, 'cup'));
    }

    public function testResolveCompetitionIdTournament(): void
    {
        $game = $this->makeGame(tournamentMatch: $this->makeTournamentMatch(30));
        $this->assertSame(30, $this->service->resolveCompetitionId($game, 'tournament'));
    }

    public function testResolveCompetitionIdFriendly(): void
    {
        $game = $this->makeGame();
        $this->assertNull($this->service->resolveCompetitionId($game, 'friendly'));
    }

    // ── Gelbe Karte: keine Regel → keine Aktion ───────────────────────────────

    public function testYellowCardWithNoRuleDoesNothing(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $this->cardRuleRepository->method('findApplicableRule')->willReturn(null);
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(4);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    // ── Gelbe Karte: Warnung bei Schwellenwert ────────────────────────────────

    public function testYellowCardWarningIsSentAtWarningThreshold(): void
    {
        $user = $this->createMock(User::class);
        $relation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$relation]);

        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', player: $player, game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        // 4. Gelbe Karte → Warnung
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(4);

        $this->notificationService->expects($this->once())
            ->method('createNotification')
            ->with($user, 'system', $this->stringContains('Warnung'));

        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    public function testYellowCardNoWarningBelowThreshold(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        // 3. Gelbe → noch keine Warnung
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(3);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    // ── Gelbe Karte: Sperre bei Sperrschwellenwert ────────────────────────────

    public function testYellowCardCreatingsSuspensionAtSuspensionThreshold(): void
    {
        $user = $this->createMock(User::class);
        $relation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$relation]);

        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', player: $player, game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, suspensionGames: 1);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        // 5. Gelbe → Sperre
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(5);

        $this->em->expects($this->once())
            ->method('persist')
            ->with($this->isInstanceOf(PlayerSuspension::class));
        $this->em->expects($this->once())->method('flush');

        $this->notificationService->expects($this->once())
            ->method('createNotification')
            ->with($user, 'system', $this->stringContains('Sperre'));

        $this->service->handleCardEvent($event);
    }

    public function testYellowCardAboveSuspensionThresholdAlsoCreatesSuspension(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        // 6. Gelbe (nach Wiederholung) → ebenfalls Sperre
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(6);

        $this->em->expects($this->once())->method('persist');

        $this->service->handleCardEvent($event);
    }

    public function testSuspensionHasCorrectCompetitionContext(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(42));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, suspensionGames: 2);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(5);

        $persistedSuspension = null;
        $this->em->method('persist')->willReturnCallback(function ($entity) use (&$persistedSuspension) {
            if ($entity instanceof PlayerSuspension) {
                $persistedSuspension = $entity;
            }
        });

        $this->service->handleCardEvent($event);

        $this->assertNotNull($persistedSuspension);
        $this->assertSame('league', $persistedSuspension->getCompetitionType());
        $this->assertSame(42, $persistedSuspension->getCompetitionId());
        $this->assertSame(PlayerSuspension::REASON_YELLOW_CARDS, $persistedSuspension->getReason());
        $this->assertSame(2, $persistedSuspension->getGamesSuspended());
    }

    // ── Rote Karte: direkte Sperre ────────────────────────────────────────────

    public function testRedCardCreatesSuspensionImmediately(): void
    {
        $user = $this->createMock(User::class);
        $relation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$relation]);

        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('red_card', player: $player, game: $game);

        $this->em->expects($this->once())->method('persist')
            ->with($this->isInstanceOf(PlayerSuspension::class));
        $this->em->expects($this->once())->method('flush');

        $this->notificationService->expects($this->once())
            ->method('createNotification')
            ->with($user, 'system', $this->stringContains('Sperre'));

        // findApplicableRule wird aufgerufen, um die Sperrdauer aus der Regel zu lesen (Fallback: 1 Spiel)
        $this->cardRuleRepository->method('findApplicableRule')->willReturn(null);

        $this->service->handleCardEvent($event);
    }

    public function testRedCardSuspensionHasCorrectReason(): void
    {
        $game = $this->makeGame(cup: $this->makeCup(20));
        $event = $this->makeGameEvent('red_card', game: $game);

        $persistedSuspension = null;
        $this->em->method('persist')->willReturnCallback(function ($entity) use (&$persistedSuspension) {
            if ($entity instanceof PlayerSuspension) {
                $persistedSuspension = $entity;
            }
        });

        $this->service->handleCardEvent($event);

        $this->assertNotNull($persistedSuspension);
        $this->assertSame(PlayerSuspension::REASON_RED_CARD, $persistedSuspension->getReason());
        $this->assertSame('cup', $persistedSuspension->getCompetitionType());
        $this->assertSame(20, $persistedSuspension->getCompetitionId());
        $this->assertSame(1, $persistedSuspension->getGamesSuspended());
    }

    // ── Gelb-Rote Karte: direkte Sperre ──────────────────────────────────────

    public function testYellowRedCardCreatesSuspensionImmediately(): void
    {
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_red_card', game: $game);

        $persistedSuspension = null;
        $this->em->method('persist')->willReturnCallback(function ($entity) use (&$persistedSuspension) {
            if ($entity instanceof PlayerSuspension) {
                $persistedSuspension = $entity;
            }
        });

        $this->service->handleCardEvent($event);

        $this->assertNotNull($persistedSuspension);
        $this->assertSame(PlayerSuspension::REASON_YELLOW_RED_CARD, $persistedSuspension->getReason());
    }

    // ── Trainer-Benachrichtigung ──────────────────────────────────────────────

    public function testCoachIsAlsoNotifiedOnYellowCardWarning(): void
    {
        $playerUser = $this->createMock(User::class);
        $coachUser = $this->createMock(User::class);

        $playerRelation = $this->makeUserRelation('player', $playerUser);
        $player = $this->makePlayer([$playerRelation]);

        $coachRelation = $this->makeUserRelation('coach', $coachUser);

        $coach = $this->createMock(Coach::class);
        $coach->method('getUserRelations')->willReturn(new ArrayCollection([$coachRelation]));

        $coachAssignment = $this->createMock(CoachTeamAssignment::class);
        $coachAssignment->method('getEndDate')->willReturn(null);
        $coachAssignment->method('getCoach')->willReturn($coach);

        $team = $this->makeTeam([$coachAssignment]);
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', player: $player, team: $team, game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(4);

        // Sowohl Spieler als auch Trainer werden benachrichtigt
        $this->notificationService->expects($this->exactly(2))->method('createNotification');

        $this->service->handleCardEvent($event);
    }

    public function testExpiredCoachAssignmentIsSkipped(): void
    {
        $playerUser = $this->createMock(User::class);
        $playerRelation = $this->makeUserRelation('player', $playerUser);
        $player = $this->makePlayer([$playerRelation]);

        $coachAssignment = $this->createMock(CoachTeamAssignment::class);
        // Enddatum in der Vergangenheit → Trainer wird übersprungen
        $coachAssignment->method('getEndDate')->willReturn(new DateTime('2020-01-01'));

        $team = $this->makeTeam([$coachAssignment]);
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', player: $player, team: $team, game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(4);

        // Nur der Spieler wird benachrichtigt, nicht der abgelaufene Trainer
        $this->notificationService->expects($this->once())
            ->method('createNotification')
            ->with($playerUser);

        $this->service->handleCardEvent($event);
    }

    // ── Friendly: kein Zählen, kein Dispatch ─────────────────────────────────

    public function testFriendlyGameWithNoRuleDoesNothing(): void
    {
        $game = $this->makeGame(); // kein League, Cup, Tournament
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $this->cardRuleRepository->method('findApplicableRule')->willReturn(null);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    // ── resetAfterSuspension-Logik ────────────────────────────────────────────

    public function testYellowCardCountResetsAfterSuspensionWhenResetEnabled(): void
    {
        // Spieler hat bereits eine Gelb-Karten-Sperre erhalten.
        // Seit der Sperre hat er nur 2 Gelbe → keine neue Aktion.
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, resetAfterSuspension: true);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);

        $resetDate = new DateTimeImmutable('2024-06-01');
        $calendarEvent = $this->createMock(\App\Entity\CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn($resetDate);

        $triggerGame = $this->createMock(Game::class);
        $triggerGame->method('getCalendarEvent')->willReturn($calendarEvent);

        $lastSuspension = $this->createMock(PlayerSuspension::class);
        $lastSuspension->method('getTriggeredByGame')->willReturn($triggerGame);

        $this->suspensionRepository->method('findLastYellowCardsSuspension')->willReturn($lastSuspension);
        // Seit der letzten Sperre: nur 2 Gelbe → weder Warnung noch Sperre
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetitionAfterDate')->willReturn(2);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    public function testYellowCardTriggersSuspensionAfterResetThresholdReached(): void
    {
        // Spieler hat bereits eine Gelb-Karten-Sperre; seit dem Reset 5 neue Gelbe → neue Sperre.
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, suspensionGames: 1, resetAfterSuspension: true);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);

        $resetDate = new DateTimeImmutable('2024-06-01');
        $calendarEvent = $this->createMock(\App\Entity\CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn($resetDate);

        $triggerGame = $this->createMock(Game::class);
        $triggerGame->method('getCalendarEvent')->willReturn($calendarEvent);

        $lastSuspension = $this->createMock(PlayerSuspension::class);
        $lastSuspension->method('getTriggeredByGame')->willReturn($triggerGame);

        $this->suspensionRepository->method('findLastYellowCardsSuspension')->willReturn($lastSuspension);
        // Seit der letzten Sperre: 5 Gelbe → neue Sperre auslösen
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetitionAfterDate')->willReturn(5);

        $this->em->expects($this->once())->method('persist')
            ->with($this->isInstanceOf(PlayerSuspension::class));
        $this->em->expects($this->once())->method('flush');

        $this->service->handleCardEvent($event);
    }

    public function testResetAfterSuspensionFalseUsesGlobalCountWithoutQueryingRepository(): void
    {
        // Wenn resetAfterSuspension=false gilt, darf findLastYellowCardsSuspension nicht aufgerufen werden.
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, resetAfterSuspension: false);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(3);

        // Suspension-Repository darf NICHT abgefragt werden
        $this->suspensionRepository->expects($this->never())->method('findLastYellowCardsSuspension');

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }

    public function testResetAfterSuspensionWithNoLastSuspensionFallsBackToGlobalCount(): void
    {
        // resetAfterSuspension=true, aber noch keine Sperre existiert → globaler Zähler.
        $game = $this->makeGame(league: $this->makeLeague(10));
        $event = $this->makeGameEvent('yellow_card', game: $game);

        $rule = $this->makeRule(warningThreshold: 4, suspensionThreshold: 5, resetAfterSuspension: true);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);

        // Keine frühere Sperre
        $this->suspensionRepository->method('findLastYellowCardsSuspension')->willReturn(null);
        // Globaler Zähler: 3 → keine Aktion
        $this->gameEventRepository->method('countYellowCardsForPlayerInCompetition')->willReturn(3);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->em->expects($this->never())->method('persist');

        $this->service->handleCardEvent($event);
    }
}
