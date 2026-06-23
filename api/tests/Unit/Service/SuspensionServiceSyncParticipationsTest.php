<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CoachSuspensionRepository;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameRepository;
use App\Repository\ParticipationRepository;
use App\Repository\ParticipationStatusRepository;
use App\Repository\PlayerRepository;
use App\Repository\PlayerSuspensionRepository;
use App\Service\NotificationService;
use App\Service\SuspensionService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Tests für SuspensionService::syncParticipationsForSuspension()
 * und die interne Hilfsmethode resolveTeamForPlayerInGame().
 */
#[AllowMockObjectsWithoutExpectations]
class SuspensionServiceSyncParticipationsTest extends TestCase
{
    private EntityManagerInterface & MockObject $em;
    private GameEventRepository & MockObject $gameEventRepository;
    private PlayerSuspensionRepository & MockObject $suspensionRepository;
    private CoachSuspensionRepository & MockObject $coachSuspensionRepository;
    private CompetitionCardRuleRepository & MockObject $cardRuleRepository;
    private NotificationService & MockObject $notificationService;
    private GameRepository & MockObject $gameRepository;
    private ParticipationRepository & MockObject $participationRepository;
    private ParticipationStatusRepository & MockObject $participationStatusRepository;
    private PlayerRepository & MockObject $playerRepository;
    private SuspensionService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->gameEventRepository = $this->createMock(GameEventRepository::class);
        $this->suspensionRepository = $this->createMock(PlayerSuspensionRepository::class);
        $this->coachSuspensionRepository = $this->createMock(CoachSuspensionRepository::class);
        $this->cardRuleRepository = $this->createMock(CompetitionCardRuleRepository::class);
        $this->notificationService = $this->createMock(NotificationService::class);
        $this->gameRepository = $this->createMock(GameRepository::class);
        $this->participationRepository = $this->createMock(ParticipationRepository::class);
        $this->participationStatusRepository = $this->createMock(ParticipationStatusRepository::class);
        $this->playerRepository = $this->createMock(PlayerRepository::class);

        $this->service = new SuspensionService(
            $this->em,
            $this->gameEventRepository,
            $this->suspensionRepository,
            $this->coachSuspensionRepository,
            $this->cardRuleRepository,
            $this->notificationService,
            $this->gameRepository,
            $this->participationRepository,
            $this->participationStatusRepository,
            $this->playerRepository,
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeUser(int $id = 1): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);

        return $user;
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

    /** @param UserRelation[] $userRelations */
    private function makePlayer(array $userRelations = [], int $id = 1): Player & MockObject
    {
        $player = $this->createMock(Player::class);
        $player->method('getUserRelations')->willReturn(new ArrayCollection($userRelations));
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection());
        $player->method('getId')->willReturn($id);
        $player->method('getFirstName')->willReturn('Test');
        $player->method('getLastName')->willReturn('Spieler');

        return $player;
    }

    private function makeTeam(int $id = 10): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getCoachTeamAssignments')->willReturn(new ArrayCollection());

        return $team;
    }

    private function makeCalendarEvent(): CalendarEvent
    {
        $ce = $this->createMock(CalendarEvent::class);
        $ce->method('getStartDate')->willReturn(new DateTimeImmutable('2026-06-01 15:00:00'));

        return $ce;
    }

    private function makeGame(
        ?CalendarEvent $calendarEvent = null,
        ?Team $homeTeam = null,
        ?Team $awayTeam = null,
        int $id = 100,
    ): Game {
        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn($id);
        $game->method('getCalendarEvent')->willReturn($calendarEvent ?? $this->makeCalendarEvent());
        $game->method('getHomeTeam')->willReturn($homeTeam);
        $game->method('getAwayTeam')->willReturn($awayTeam);

        return $game;
    }

    private function makeSuspension(
        Player $player,
        Game $game,
        string $competitionType = 'league',
        ?int $competitionId = 1,
        int $gamesSuspended = 1,
    ): PlayerSuspension {
        $suspension = $this->createMock(PlayerSuspension::class);
        $suspension->method('getPlayer')->willReturn($player);
        $suspension->method('getTriggeredByGame')->willReturn($game);
        $suspension->method('getCompetitionType')->willReturn($competitionType);
        $suspension->method('getCompetitionId')->willReturn($competitionId);
        $suspension->method('getGamesSuspended')->willReturn($gamesSuspended);

        return $suspension;
    }

    private function makeSuspendedStatus(): ParticipationStatus
    {
        $status = $this->createMock(ParticipationStatus::class);
        $status->method('getCode')->willReturn('suspended');

        return $status;
    }

    // ── Tests: syncParticipationsForSuspension() ──────────────────────────────

    /**
     * Hauptfall: Spieler hat einen User-Account, Team wird via GameEvent gefunden,
     * kein bestehende Participation → neues Participation-Objekt wird persistiert.
     */
    public function testSyncCreatesParticipationWhenTeamFoundViaGameEvent(): void
    {
        $user = $this->makeUser(1);
        $userRelation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$userRelation]);
        $team = $this->makeTeam(10);

        $triggerGame = $this->makeGame(homeTeam: $team, id: 100);

        $nextCalendarEvent = $this->makeCalendarEvent();
        $nextGame = $this->makeGame(calendarEvent: $nextCalendarEvent, id: 101);

        $suspendedStatus = $this->makeSuspendedStatus();
        $suspension = $this->makeSuspension($player, $triggerGame);

        // Team wird über GameEvent ermittelt (Strategie 1)
        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getTeam')->willReturn($team);

        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => $gameEvent,
            ]));

        $this->participationStatusRepository
            ->method('findByCode')
            ->with('suspended')
            ->willReturn($suspendedStatus);

        $this->gameRepository
            ->method('findNextGamesForTeamInCompetition')
            ->willReturn([$nextGame]);

        $this->participationRepository
            ->method('findByUserAndEvent')
            ->with($user, $nextCalendarEvent)
            ->willReturn(null);

        $this->em->expects($this->once())->method('persist')
            ->with($this->isInstanceOf(Participation::class));
        $this->em->expects($this->once())->method('flush');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Fallback-Strategie: kein GameEvent vorhanden, Team wird über
     * PlayerTeamAssignment (homeTeam des Spiels) ermittelt.
     */
    public function testSyncFindsTeamViaPlayerTeamAssignmentFallback(): void
    {
        $user = $this->makeUser(1);
        $userRelation = $this->makeUserRelation('player', $user);

        $team = $this->makeTeam(10);

        // PlayerTeamAssignment zeigt auf homeTeam
        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getTeam')->willReturn($team);

        $player = $this->createMock(Player::class);
        $player->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));
        $player->method('getId')->willReturn(1);

        $triggerGame = $this->makeGame(homeTeam: $team, awayTeam: $this->makeTeam(99), id: 100);

        $nextCalendarEvent = $this->makeCalendarEvent();
        $nextGame = $this->makeGame(calendarEvent: $nextCalendarEvent, id: 101);

        $suspendedStatus = $this->makeSuspendedStatus();
        $suspension = $this->makeSuspension($player, $triggerGame);

        // Kein GameEvent → null zurück (Fallback greift)
        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => null,
            ]));

        $this->participationStatusRepository
            ->method('findByCode')
            ->willReturn($suspendedStatus);

        $this->gameRepository
            ->method('findNextGamesForTeamInCompetition')
            ->with($team, 'league', 1, $this->anything(), 1)
            ->willReturn([$nextGame]);

        $this->participationRepository
            ->method('findByUserAndEvent')
            ->willReturn(null);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Wenn kein Team ermittelt werden kann (kein GameEvent, Spieler nicht im
     * home- oder awayTeam), passiert nichts.
     */
    public function testSyncDoesNothingWhenTeamCannotBeResolved(): void
    {
        $player = $this->makePlayer([], 1);
        $triggerGame = $this->makeGame(homeTeam: $this->makeTeam(10), awayTeam: $this->makeTeam(20), id: 100);
        $suspension = $this->makeSuspension($player, $triggerGame);

        // Kein GameEvent gefunden
        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => null,
            ]));

        // PlayerTeamAssignments zeigen auf ein drittes Team (nicht home/away)
        $otherTeam = $this->makeTeam(99);
        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getTeam')->willReturn($otherTeam);

        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->never())->method('flush');
        $this->participationRepository->expects($this->never())->method('findByUserAndEvent');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Wenn die Sperre kein triggeredByGame hat, passiert nichts.
     */
    public function testSyncSkipsWhenNoTriggeredByGame(): void
    {
        $player = $this->makePlayer();
        $suspension = $this->createMock(PlayerSuspension::class);
        $suspension->method('getTriggeredByGame')->willReturn(null);
        $suspension->method('getPlayer')->willReturn($player);

        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->never())->method('flush');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Wenn eine Participation für den User+Event bereits existiert,
     * wird sie aktualisiert (Status gesetzt), aber nicht erneut persistiert.
     */
    public function testSyncUpdatesExistingParticipationInsteadOfCreatingNew(): void
    {
        $user = $this->makeUser(1);
        $userRelation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$userRelation]);
        $team = $this->makeTeam(10);
        $triggerGame = $this->makeGame(homeTeam: $team, id: 100);

        $nextCalendarEvent = $this->makeCalendarEvent();
        $nextGame = $this->makeGame(calendarEvent: $nextCalendarEvent, id: 101);

        $suspendedStatus = $this->makeSuspendedStatus();
        $suspension = $this->makeSuspension($player, $triggerGame);

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getTeam')->willReturn($team);

        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => $gameEvent,
            ]));

        $this->participationStatusRepository->method('findByCode')->willReturn($suspendedStatus);
        $this->gameRepository->method('findNextGamesForTeamInCompetition')->willReturn([$nextGame]);

        $existingParticipation = $this->createMock(Participation::class);
        $existingParticipation->expects($this->once())->method('setStatus')->with($suspendedStatus);

        $this->participationRepository
            ->method('findByUserAndEvent')
            ->willReturn($existingParticipation);

        // persist wird NICHT für Participation aufgerufen (nur flush)
        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Wenn der Spieler keinen verknüpften User-Account hat (UserRelation fehlt),
     * wird kein Participation angelegt.
     */
    public function testSyncSkipsWhenPlayerHasNoLinkedUser(): void
    {
        $player = $this->makePlayer([]); // keine UserRelations
        $team = $this->makeTeam(10);
        $triggerGame = $this->makeGame(homeTeam: $team, id: 100);
        $suspension = $this->makeSuspension($player, $triggerGame);

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getTeam')->willReturn($team);

        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => $gameEvent,
            ]));

        $this->participationStatusRepository->method('findByCode')->willReturn($this->makeSuspendedStatus());
        $this->gameRepository->method('findNextGamesForTeamInCompetition')
            ->willReturn([$this->makeGame(id: 101)]);

        $this->em->expects($this->never())->method('persist');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Wenn suspended-Status nicht in der DB konfiguriert ist, passiert nichts.
     */
    public function testSyncSkipsWhenSuspendedStatusNotFound(): void
    {
        $user = $this->makeUser(1);
        $userRelation = $this->makeUserRelation('player', $user);
        $player = $this->makePlayer([$userRelation]);
        $team = $this->makeTeam(10);
        $triggerGame = $this->makeGame(homeTeam: $team, id: 100);
        $suspension = $this->makeSuspension($player, $triggerGame);

        $gameEvent = $this->createMock(GameEvent::class);
        $gameEvent->method('getTeam')->willReturn($team);

        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => $gameEvent,
            ]));

        $this->participationStatusRepository->method('findByCode')->willReturn(null);

        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->never())->method('flush');
        $this->participationRepository->expects($this->never())->method('findByUserAndEvent');

        $this->service->syncParticipationsForSuspension($suspension);
    }

    /**
     * Spieler ist Auswärtsteam → awayTeam wird über GameEvent-Fallback korrekt ermittelt.
     */
    public function testSyncFindsAwayTeamViaPlayerTeamAssignment(): void
    {
        $user = $this->makeUser(1);
        $userRelation = $this->makeUserRelation('player', $user);

        $homeTeam = $this->makeTeam(10);
        $awayTeam = $this->makeTeam(20);

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getTeam')->willReturn($awayTeam);

        $player = $this->createMock(Player::class);
        $player->method('getUserRelations')->willReturn(new ArrayCollection([$userRelation]));
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));
        $player->method('getId')->willReturn(1);

        $triggerGame = $this->makeGame(homeTeam: $homeTeam, awayTeam: $awayTeam, id: 100);
        $suspension = $this->makeSuspension($player, $triggerGame);

        $nextCalendarEvent = $this->makeCalendarEvent();
        $nextGame = $this->makeGame(calendarEvent: $nextCalendarEvent, id: 101);

        // Kein GameEvent → Fallback auf PlayerTeamAssignment
        $this->em->method('getRepository')
            ->with(GameEvent::class)
            ->willReturn($this->createConfiguredMock(\Doctrine\ORM\EntityRepository::class, [
                'findOneBy' => null,
            ]));

        $this->participationStatusRepository->method('findByCode')->willReturn($this->makeSuspendedStatus());

        // Muss mit awayTeam aufgerufen werden
        $this->gameRepository
            ->expects($this->once())
            ->method('findNextGamesForTeamInCompetition')
            ->with($awayTeam, $this->anything(), $this->anything(), $this->anything(), $this->anything())
            ->willReturn([$nextGame]);

        $this->participationRepository->method('findByUserAndEvent')->willReturn(null);
        $this->em->method('persist');
        $this->em->method('flush');

        $this->service->syncParticipationsForSuspension($suspension);
    }
}
