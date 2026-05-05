<?php

namespace App\Tests\Unit\Service;

use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\CoachTeamPlayerService;
use App\Service\UserTeamAccessService;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use RuntimeException;

#[AllowMockObjectsWithoutExpectations]
class CoachTeamPlayerServiceTest extends TestCase
{
    /** @var \PHPUnit\Framework\MockObject\MockObject&UserTeamAccessService */
    private UserTeamAccessService $accessService;

    private CoachTeamPlayerService $service;

    protected function setUp(): void
    {
        $this->accessService = $this->createMock(UserTeamAccessService::class);
        $this->service = new CoachTeamPlayerService($this->accessService);
    }

    // =========================================================================
    // collectCoachTeams – delegates to UserTeamAccessService::getSelfCoachTeams
    // =========================================================================

    public function testCollectCoachTeamsDelegatesToAccessService(): void
    {
        $user = $this->createMock(User::class);
        $team = $this->createTeam(42);

        $this->accessService
            ->expects(self::once())
            ->method('getSelfCoachTeams')
            ->with($user)
            ->willReturn([42 => $team]);

        $result = $this->service->collectCoachTeams($user);

        $this->assertSame([42 => $team], $result);
    }

    public function testCollectCoachTeamsReturnsEmptyWhenServiceReturnsEmpty(): void
    {
        $user = $this->createMock(User::class);
        $this->accessService->method('getSelfCoachTeams')->willReturn([]);

        $result = $this->service->collectCoachTeams($user);

        $this->assertSame([], $result);
    }

    // =========================================================================
    // collectPlayerTeams – delegates to UserTeamAccessService::getSelfPlayerTeams
    // =========================================================================

    public function testCollectPlayerTeamsDelegatesToAccessService(): void
    {
        $user = $this->createMock(User::class);
        $team = $this->createTeam(7);

        $this->accessService
            ->expects(self::once())
            ->method('getSelfPlayerTeams')
            ->with($user)
            ->willReturn([7 => $team]);

        $result = $this->service->collectPlayerTeams($user);

        $this->assertSame([7 => $team], $result);
    }

    public function testCollectPlayerTeamsReturnsEmptyWhenServiceReturnsEmpty(): void
    {
        $user = $this->createMock(User::class);
        $this->accessService->method('getSelfPlayerTeams')->willReturn([]);

        $result = $this->service->collectPlayerTeams($user);

        $this->assertSame([], $result);
    }

    // =========================================================================
    // collectTeamPlayers
    // =========================================================================

    public function testCollectTeamPlayersReturnsActivePlayer(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(1);
        $player->method('getFullName')->willReturn('Max Mustermann');

        $team = $this->createMock(Team::class);
        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $assignment->method('getEndDate')->willReturn(new DateTime('+1 month'));
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(7);

        $team->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($team);

        $this->assertCount(1, $result);
        $this->assertSame(1, $result[0]['player']['id']);
        $this->assertSame('Max Mustermann', $result[0]['player']['name']);
        $this->assertSame(7, $result[0]['shirtNumber']);
    }

    public function testCollectTeamPlayersExcludesExpiredAssignment(): void
    {
        $player = $this->createMock(Player::class);
        $team = $this->createMock(Team::class);

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-2 months'));
        $assignment->method('getEndDate')->willReturn(new DateTime('-1 day'));
        $assignment->method('getPlayer')->willReturn($player);

        $team->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($team);

        $this->assertSame([], $result);
    }

    public function testCollectTeamPlayersReturnsEmptyForTeamWithoutAssignments(): void
    {
        $team = $this->createMock(Team::class);
        $team->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([]));

        $result = $this->service->collectTeamPlayers($team);

        $this->assertSame([], $result);
    }

    // =========================================================================
    // resolveLinkedContext – keine Relationen
    // =========================================================================

    public function testResolveLinkedContextReturnsEmptyForUserWithNoRelations(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection([]));

        $result = $this->service->resolveLinkedContext($user);

        $this->assertSame([], $result['linkedPlayers']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – self_player mit aktivem Team
    // =========================================================================

    public function testResolveLinkedContextSelfPlayerWithActiveTeam(): void
    {
        $team = $this->makeTeamMock(10, 'U19');
        $pta = $this->makeActivePta($team);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Ich selbst');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation = $this->makePlayerRelation($player, 'self_player');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertSame(5, $result['linkedPlayers'][0]['id']);
        $this->assertSame('Ich selbst', $result['linkedPlayers'][0]['fullName']);
        $this->assertSame('U19', $result['linkedPlayers'][0]['teamName']);
        $this->assertTrue($result['linkedPlayers'][0]['isSelf']);

        $this->assertCount(1, $result['linkedTeams']);
        $this->assertSame(10, $result['linkedTeams'][0]['id']);
        $this->assertSame('U19', $result['linkedTeams'][0]['name']);
    }

    // =========================================================================
    // resolveLinkedContext – self_player ohne aktives Team (kein Team in linkedTeams)
    // =========================================================================

    public function testResolveLinkedContextSelfPlayerWithNoActiveAssignment(): void
    {
        $team = $this->makeTeamMock(10, 'U19');
        $pta = $this->makeExpiredPta($team);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Ich selbst');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation = $this->makePlayerRelation($player, 'self_player');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertNull($result['linkedPlayers'][0]['teamName']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – nicht-self Spieler (z.B. Elternteil) mit aktivem Team
    // =========================================================================

    public function testResolveLinkedContextNonSelfPlayerWithActiveTeam(): void
    {
        $team = $this->makeTeamMock(20, 'Senioren I');
        $pta = $this->makeActivePta($team);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(7);
        $player->method('getFullName')->willReturn('Kind Mustermann');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation = $this->makePlayerRelation($player, 'parent');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertSame(7, $result['linkedPlayers'][0]['id']);
        $this->assertFalse($result['linkedPlayers'][0]['isSelf']);
        $this->assertSame('Senioren I', $result['linkedPlayers'][0]['teamName']);

        // Team des verknüpften Spielers muss ebenfalls in linkedTeams erscheinen
        $this->assertCount(1, $result['linkedTeams']);
        $this->assertSame(20, $result['linkedTeams'][0]['id']);
    }

    // =========================================================================
    // resolveLinkedContext – nicht-self Spieler ohne aktives Team
    // =========================================================================

    public function testResolveLinkedContextNonSelfPlayerWithNoActiveAssignment(): void
    {
        $team = $this->makeTeamMock(20, 'Senioren I');
        $pta = $this->makeExpiredPta($team);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(7);
        $player->method('getFullName')->willReturn('Kind Mustermann');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation = $this->makePlayerRelation($player, 'parent');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertNull($result['linkedPlayers'][0]['teamName']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – Duplikat-Spieler wird nur einmal hinzugefügt
    // =========================================================================

    public function testResolveLinkedContextDeduplicatesPlayers(): void
    {
        $team = $this->makeTeamMock(10, 'U19');
        $pta = $this->makeActivePta($team);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Doppelt');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation1 = $this->makePlayerRelation($player, 'self_player');
        $relation2 = $this->makePlayerRelation($player, 'friend');
        $user = $this->makeUser([$relation1, $relation2]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
    }

    // =========================================================================
    // resolveLinkedContext – Duplikat-Team wird nur einmal hinzugefügt
    // =========================================================================

    public function testResolveLinkedContextDeduplicatesTeams(): void
    {
        $team = $this->makeTeamMock(10, 'U19');
        $pta1 = $this->makeActivePta($team);
        $pta2 = $this->makeActivePta($team);

        $player1 = $this->createMock(Player::class);
        $player1->method('getId')->willReturn(1);
        $player1->method('getFullName')->willReturn('Spieler A');
        $player1->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta1]));

        $player2 = $this->createMock(Player::class);
        $player2->method('getId')->willReturn(2);
        $player2->method('getFullName')->willReturn('Spieler B');
        $player2->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta2]));

        $relation1 = $this->makePlayerRelation($player1, 'self_player');
        $relation2 = $this->makePlayerRelation($player2, 'parent');
        $user = $this->makeUser([$relation1, $relation2]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(2, $result['linkedPlayers']);
        $this->assertCount(1, $result['linkedTeams']); // Team nur einmal
    }

    // =========================================================================
    // resolveLinkedContext – self_coach erscheint als Spieler mit type='coach'
    // =========================================================================

    public function testResolveLinkedContextSelfCoachAppearsAsPlayerWithTypeCoach(): void
    {
        $team = $this->makeTeamMock(30, 'Herren');
        $cta = $this->makeActiveCta($team);

        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(99);
        $coach->method('getFullName')->willReturn('Trainer Muster');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $relation = $this->makeCoachRelation($coach, 'self_coach');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertSame(99, $result['linkedPlayers'][0]['id']);
        $this->assertSame('Trainer Muster', $result['linkedPlayers'][0]['fullName']);
        $this->assertSame('Herren', $result['linkedPlayers'][0]['teamName']);
        $this->assertTrue($result['linkedPlayers'][0]['isSelf']);
        $this->assertSame('coach', $result['linkedPlayers'][0]['type'] ?? null);

        $this->assertCount(1, $result['linkedTeams']);
        $this->assertSame(30, $result['linkedTeams'][0]['id']);
    }

    // =========================================================================
    // resolveLinkedContext – nicht-self Coach wird ignoriert
    // =========================================================================

    public function testResolveLinkedContextNonSelfCoachIsIgnored(): void
    {
        $team = $this->makeTeamMock(30, 'Herren');
        $cta = $this->makeActiveCta($team);
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(99);
        $coach->method('getFullName')->willReturn('Anderer Trainer');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $relation = $this->makeCoachRelation($coach, 'friend_coach');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertSame([], $result['linkedPlayers']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – self_coach ohne aktives Team (keine Teams in linkedTeams)
    // =========================================================================

    public function testResolveLinkedContextSelfCoachWithNoActiveAssignment(): void
    {
        $team = $this->makeTeamMock(30, 'Herren');
        $cta = $this->makeExpiredCta($team);

        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(99);
        $coach->method('getFullName')->willReturn('Trainer ohne Team');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $relation = $this->makeCoachRelation($coach, 'self_coach');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertNull($result['linkedPlayers'][0]['teamName']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – self_player kommt vor nicht-self (Sortierung)
    // =========================================================================

    public function testResolveLinkedContextSortsSelfPlayerFirst(): void
    {
        $team1 = $this->makeTeamMock(10, 'A');
        $pta1 = $this->makeActivePta($team1);
        $selfPlayer = $this->createMock(Player::class);
        $selfPlayer->method('getId')->willReturn(1);
        $selfPlayer->method('getFullName')->willReturn('Ich');
        $selfPlayer->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta1]));

        $team2 = $this->makeTeamMock(20, 'B');
        $pta2 = $this->makeActivePta($team2);
        $friendPlayer = $this->createMock(Player::class);
        $friendPlayer->method('getId')->willReturn(2);
        $friendPlayer->method('getFullName')->willReturn('Freund');
        $friendPlayer->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta2]));

        // Freund zuerst in den Relations → trotzdem muss self_player nach vorne sortiert werden
        $relation1 = $this->makePlayerRelation($friendPlayer, 'friend');
        $relation2 = $this->makePlayerRelation($selfPlayer, 'self_player');
        $user = $this->makeUser([$relation1, $relation2]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(2, $result['linkedPlayers']);
        $this->assertTrue($result['linkedPlayers'][0]['isSelf']);
        $this->assertFalse($result['linkedPlayers'][1]['isSelf']);
    }

    // =========================================================================
    // resolveLinkedContext – self_coach kommt vor nicht-self Spieler (Sortierung)
    // =========================================================================

    public function testResolveLinkedContextSortsSelfCoachFirst(): void
    {
        $teamA = $this->makeTeamMock(10, 'A');
        $pta = $this->makeActivePta($teamA);
        $friendPlayer = $this->createMock(Player::class);
        $friendPlayer->method('getId')->willReturn(2);
        $friendPlayer->method('getFullName')->willReturn('Freund');
        $friendPlayer->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $teamB = $this->makeTeamMock(20, 'B');
        $cta = $this->makeActiveCta($teamB);
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(99);
        $coach->method('getFullName')->willReturn('Trainer');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        // Freund zuerst, dann Coach
        $relation1 = $this->makePlayerRelation($friendPlayer, 'friend');
        $relation2 = $this->makeCoachRelation($coach, 'self_coach');
        $user = $this->makeUser([$relation1, $relation2]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(2, $result['linkedPlayers']);
        $this->assertTrue($result['linkedPlayers'][0]['isSelf']);
    }

    // =========================================================================
    // resolveLinkedContext – mehrere Spieler aus verschiedenen Relations, mehrere Teams
    // =========================================================================

    public function testResolveLinkedContextMultiplePlayersFromDifferentRelations(): void
    {
        $team1 = $this->makeTeamMock(10, 'U17');
        $team2 = $this->makeTeamMock(20, 'U19');

        $player1 = $this->createMock(Player::class);
        $player1->method('getId')->willReturn(1);
        $player1->method('getFullName')->willReturn('Spieler 1');
        $player1->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$this->makeActivePta($team1)]));

        $player2 = $this->createMock(Player::class);
        $player2->method('getId')->willReturn(2);
        $player2->method('getFullName')->willReturn('Spieler 2');
        $player2->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$this->makeActivePta($team2)]));

        $user = $this->makeUser([
            $this->makePlayerRelation($player1, 'self_player'),
            $this->makePlayerRelation($player2, 'parent'),
        ]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(2, $result['linkedPlayers']);
        $this->assertCount(2, $result['linkedTeams']);

        $teamIds = array_column($result['linkedTeams'], 'id');
        $this->assertContains(10, $teamIds);
        $this->assertContains(20, $teamIds);
    }

    // =========================================================================
    // resolveLinkedContext – Spieler ohne jegliche Team-Zuordnung
    // =========================================================================

    public function testResolveLinkedContextPlayerWithNoAssignmentsAtAll(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Teamloser Spieler');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([]));

        $relation = $this->makePlayerRelation($player, 'self_player');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertCount(1, $result['linkedPlayers']);
        $this->assertNull($result['linkedPlayers'][0]['teamName']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – Spieler mit null-ID wird ignoriert
    // =========================================================================

    public function testResolveLinkedContextIgnoresPlayerWithNullId(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(null);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([]));

        $relation = $this->makePlayerRelation($player, 'self_player');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertSame([], $result['linkedPlayers']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – Relation ohne Spieler UND ohne Coach → ignoriert
    // =========================================================================

    public function testResolveLinkedContextIgnoresRelationWithNoPlayerAndNoCoach(): void
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getIdentifier')->willReturn('self_player');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getPlayer')->willReturn(null);
        $relation->method('getCoach')->willReturn(null);

        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        $this->assertSame([], $result['linkedPlayers']);
        $this->assertSame([], $result['linkedTeams']);
    }

    // =========================================================================
    // resolveLinkedContext – self_coach mit null-ID wird ignoriert
    // =========================================================================

    public function testResolveLinkedContextIgnoresCoachWithNullId(): void
    {
        $team = $this->makeTeamMock(30, 'Herren');
        $cta = $this->makeActiveCta($team);
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(null);
        $coach->method('getFullName')->willReturn('Trainer ohne ID');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $relation = $this->makeCoachRelation($coach, 'self_coach');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        // Team wird trotzdem gesammelt (das passiert vor der Coach-ID-Prüfung)
        $this->assertCount(1, $result['linkedTeams']);
        // Coach selbst erscheint aber nicht in linkedPlayers
        $this->assertSame([], $result['linkedPlayers']);
    }

    // =========================================================================
    // resolveLinkedContext – Rückgabestruktur enthält immer beide Schlüssel
    // =========================================================================

    public function testResolveLinkedContextAlwaysReturnsBothKeys(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection([]));

        $result = $this->service->resolveLinkedContext($user);

        $this->assertArrayHasKey('linkedPlayers', $result);
        $this->assertArrayHasKey('linkedTeams', $result);
    }

    // =========================================================================
    // resolveLinkedContext – Spieler mit mehreren aktiven Teams (erstes = teamName)
    // =========================================================================

    public function testResolveLinkedContextPlayerWithMultipleActiveTeamsUsesFirstForTeamName(): void
    {
        $team1 = $this->makeTeamMock(10, 'Erstes Team');
        $team2 = $this->makeTeamMock(11, 'Zweites Team');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Viel-Team-Spieler');
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([
            $this->makeActivePta($team1),
            $this->makeActivePta($team2),
        ]));

        $relation = $this->makePlayerRelation($player, 'self_player');
        $user = $this->makeUser([$relation]);

        $result = $this->service->resolveLinkedContext($user);

        // teamName nimmt das erste aktive Team
        $this->assertSame('Erstes Team', $result['linkedPlayers'][0]['teamName']);

        // Beide Teams müssen in linkedTeams sein
        $teamIds = array_column($result['linkedTeams'], 'id');
        $this->assertContains(10, $teamIds);
        $this->assertContains(11, $teamIds);
    }

    // =========================================================================
    // resolveLinkedContext – gemischte Relationen (Spieler + Coach zusammen)
    // =========================================================================

    public function testResolveLinkedContextMixedPlayerAndCoachRelations(): void
    {
        $teamA = $this->makeTeamMock(10, 'U17');
        $pta = $this->makeActivePta($teamA);
        $selfPlayer = $this->createMock(Player::class);
        $selfPlayer->method('getId')->willReturn(1);
        $selfPlayer->method('getFullName')->willReturn('Ich als Spieler');
        $selfPlayer->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $teamB = $this->makeTeamMock(20, 'Herren');
        $cta = $this->makeActiveCta($teamB);
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(99);
        $coach->method('getFullName')->willReturn('Ich als Trainer');
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $teamC = $this->makeTeamMock(30, 'U19');
        $pta2 = $this->makeActivePta($teamC);
        $friendPlayer = $this->createMock(Player::class);
        $friendPlayer->method('getId')->willReturn(2);
        $friendPlayer->method('getFullName')->willReturn('Freund');
        $friendPlayer->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta2]));

        $user = $this->makeUser([
            $this->makePlayerRelation($selfPlayer, 'self_player'),
            $this->makeCoachRelation($coach, 'self_coach'),
            $this->makePlayerRelation($friendPlayer, 'friend'),
        ]);

        $result = $this->service->resolveLinkedContext($user);

        // 3 Einträge in linkedPlayers (self_player, self_coach als Spieler, Freund)
        $this->assertCount(3, $result['linkedPlayers']);

        // self_player und self_coach sind isSelf=true → stehen vorne
        $this->assertTrue($result['linkedPlayers'][0]['isSelf']);
        $this->assertTrue($result['linkedPlayers'][1]['isSelf']);
        $this->assertFalse($result['linkedPlayers'][2]['isSelf']);

        // Alle 3 Teams in linkedTeams
        $this->assertCount(3, $result['linkedTeams']);
        $teamIds = array_column($result['linkedTeams'], 'id');
        $this->assertContains(10, $teamIds);
        $this->assertContains(20, $teamIds);
        $this->assertContains(30, $teamIds);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function createTeam(int $id, string $name = ''): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        if ('' !== $name) {
            $team->method('getName')->willReturn($name);
        }

        return $team;
    }

    private function makeTeamMock(int $id, string $name): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getName')->willReturn($name);

        return $team;
    }

    private function makeActivePta(Team $team): PlayerTeamAssignment
    {
        $pta = $this->createMock(PlayerTeamAssignment::class);
        $pta->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $pta->method('getEndDate')->willReturn(new DateTime('+1 year'));
        $pta->method('getTeam')->willReturn($team);

        return $pta;
    }

    private function makeExpiredPta(Team $team): PlayerTeamAssignment
    {
        $pta = $this->createMock(PlayerTeamAssignment::class);
        $pta->method('getStartDate')->willReturn(new DateTime('-2 months'));
        $pta->method('getEndDate')->willReturn(new DateTime('-1 day'));
        $pta->method('getTeam')->willReturn($team);

        return $pta;
    }

    private function makeActiveCta(Team $team): CoachTeamAssignment
    {
        $cta = $this->createMock(CoachTeamAssignment::class);
        $cta->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $cta->method('getEndDate')->willReturn(new DateTime('+1 year'));
        $cta->method('getTeam')->willReturn($team);

        return $cta;
    }

    private function makeExpiredCta(Team $team): CoachTeamAssignment
    {
        $cta = $this->createMock(CoachTeamAssignment::class);
        $cta->method('getStartDate')->willReturn(new DateTime('-2 months'));
        $cta->method('getEndDate')->willReturn(new DateTime('-1 day'));
        $cta->method('getTeam')->willReturn($team);

        return $cta;
    }

    private function makePlayerRelation(Player $player, string $identifier): UserRelation
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getIdentifier')->willReturn($identifier);

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        return $relation;
    }

    private function makeCoachRelation(Coach $coach, string $identifier): UserRelation
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getIdentifier')->willReturn($identifier);

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getPlayer')->willReturn(null);
        $relation->method('getCoach')->willReturn($coach);

        return $relation;
    }

    /**
     * @param UserRelation[] $relations
     */
    private function makeUser(array $relations): User
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection($relations));

        return $user;
    }

    // =========================================================================
    // collectTeamPlayers – Positions-Branches
    // =========================================================================

    public function testCollectTeamPlayersMainPositionShortName(): void
    {
        $position = $this->createMock(Position::class);
        $position->method('getShortName')->willReturn('ST');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(5);
        $player->method('getFullName')->willReturn('Test Player');
        $player->method('getMainPosition')->willReturn($position);
        $player->method('getAlternativePositions')->willReturn(new ArrayCollection([]));

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(9);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(1, $result);
        $this->assertSame('ST', $result[0]['position']);
    }

    public function testCollectTeamPlayersMainPositionFallsBackToName(): void
    {
        $position = $this->createMock(Position::class);
        $position->method('getShortName')->willReturn(null);
        $position->method('getName')->willReturn('Stürmer');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(6);
        $player->method('getFullName')->willReturn('Another Player');
        $player->method('getMainPosition')->willReturn($position);
        $player->method('getAlternativePositions')->willReturn(new ArrayCollection([]));

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(10);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(1, $result);
        $this->assertSame('Stürmer', $result[0]['position']);
    }

    public function testCollectTeamPlayersAlternativePositionsPopulated(): void
    {
        $pos1 = $this->createMock(Position::class);
        $pos1->method('getShortName')->willReturn('ST');

        $pos2 = $this->createMock(Position::class);
        $pos2->method('getShortName')->willReturn(null);
        $pos2->method('getName')->willReturn('Mittelfeld');

        $mainPos = $this->createMock(Position::class);
        $mainPos->method('getShortName')->willReturn('ST');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(7);
        $player->method('getFullName')->willReturn('Alt Pos Player');
        $player->method('getMainPosition')->willReturn($mainPos);
        $player->method('getAlternativePositions')->willReturn(new ArrayCollection([$pos1, $pos2]));

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(7);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(1, $result);
        $this->assertSame(['ST', 'Mittelfeld'], $result[0]['alternativePositions']);
    }

    public function testCollectTeamPlayersAlternativePositionsThrowsResultsInEmptyArray(): void
    {
        $mainPos = $this->createMock(Position::class);
        $mainPos->method('getShortName')->willReturn('ST');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(8);
        $player->method('getFullName')->willReturn('Throws Player');
        $player->method('getMainPosition')->willReturn($mainPos);
        $player->method('getAlternativePositions')->willThrowException(new RuntimeException('alt throws'));

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(8);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(1, $result);
        $this->assertSame([], $result[0]['alternativePositions']);
    }

    // =========================================================================
    // isCurrentAssignment – Sonderfälle via collectTeamPlayers
    // =========================================================================

    public function testCurrentAssignmentNoStartDateIsActive(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(9);
        $player->method('getFullName')->willReturn('No Start Player');
        $player->method('getAlternativePositions')->willReturn(new ArrayCollection([]));

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(null);
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getShirtNumber')->willReturn(1);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(1, $result);
    }

    public function testCurrentAssignmentFutureStartDateIsInactive(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(10);
        $player->method('getFullName')->willReturn('Future Player');

        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getStartDate')->willReturn(new DateTime('+1 month'));
        $assignment->method('getEndDate')->willReturn(null);
        $assignment->method('getPlayer')->willReturn($player);

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$assignment]));

        $result = $this->service->collectTeamPlayers($teamMock);
        $this->assertCount(0, $result);
    }

    // =========================================================================
    // resolveDefaultTeamId
    // =========================================================================

    public function testResolveDefaultTeamIdNoRelationsReturnsNull(): void
    {
        $user = $this->makeUser([]);
        $this->assertNull($this->service->resolveDefaultTeamId($user));
    }

    public function testResolveDefaultTeamIdSelfPlayerActiveAssignmentReturnsTeamId(): void
    {
        $team = $this->createTeam(42, 'MyTeam');

        $pta = $this->createMock(PlayerTeamAssignment::class);
        $pta->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $pta->method('getEndDate')->willReturn(null);
        $pta->method('getTeam')->willReturn($team);

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $user = $this->makeUser([$this->makePlayerRelation($player, 'self_player')]);
        $this->assertSame(42, $this->service->resolveDefaultTeamId($user));
    }

    public function testResolveDefaultTeamIdSelfPlayerExpiredAssignmentReturnsNull(): void
    {
        $team = $this->createTeam(42, 'MyTeam');

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$this->makeExpiredPta($team)]));

        $user = $this->makeUser([$this->makePlayerRelation($player, 'self_player')]);
        $this->assertNull($this->service->resolveDefaultTeamId($user));
    }

    public function testResolveDefaultTeamIdSelfCoachActiveAssignmentReturnsTeamId(): void
    {
        $team = $this->createTeam(77, 'CoachTeam');

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')
            ->willReturn(new ArrayCollection([$this->makeActiveCta($team)]));

        $user = $this->makeUser([$this->makeCoachRelation($coach, 'self_coach')]);
        $this->assertSame(77, $this->service->resolveDefaultTeamId($user));
    }

    public function testResolveDefaultTeamIdNonSelfPlayerRelationIgnored(): void
    {
        $team = $this->createTeam(99, 'OtherTeam');

        $pta = $this->createMock(PlayerTeamAssignment::class);
        $pta->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $pta->method('getEndDate')->willReturn(null);
        $pta->method('getTeam')->willReturn($team);

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $user = $this->makeUser([$this->makePlayerRelation($player, 'friend_player')]);
        $this->assertNull($this->service->resolveDefaultTeamId($user));
    }

    public function testResolveDefaultTeamIdOldestStartDateWins(): void
    {
        $teamOld = $this->createTeam(1, 'OldTeam');
        $teamNew = $this->createTeam(2, 'NewTeam');

        $ptaOld = $this->createMock(PlayerTeamAssignment::class);
        $ptaOld->method('getStartDate')->willReturn(new DateTime('-3 months'));
        $ptaOld->method('getEndDate')->willReturn(null);
        $ptaOld->method('getTeam')->willReturn($teamOld);

        $ptaNew = $this->createMock(PlayerTeamAssignment::class);
        $ptaNew->method('getStartDate')->willReturn(new DateTime('-1 month'));
        $ptaNew->method('getEndDate')->willReturn(null);
        $ptaNew->method('getTeam')->willReturn($teamNew);

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')
            ->willReturn(new ArrayCollection([$ptaOld, $ptaNew]));

        $user = $this->makeUser([$this->makePlayerRelation($player, 'self_player')]);
        $this->assertSame(1, $this->service->resolveDefaultTeamId($user));
    }

    // =========================================================================
    // resolveAvailablePlayersForCoach
    // =========================================================================

    public function testResolveAvailablePlayersForCoachNoTeams(): void
    {
        $user = $this->createMock(User::class);
        $this->accessService->method('getSelfCoachTeams')->willReturn([]);

        $result = $this->service->resolveAvailablePlayersForCoach($user);
        $this->assertTrue($result['singleTeam']);
        $this->assertSame([], $result['teams']);
        $this->assertSame([], $result['players']);
    }

    public function testResolveAvailablePlayersForCoachOneTeam(): void
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(10);
        $team->method('getName')->willReturn('U17');
        $team->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([]));

        $user = $this->createMock(User::class);
        $this->accessService->method('getSelfCoachTeams')->willReturn([$team]);

        $result = $this->service->resolveAvailablePlayersForCoach($user);
        $this->assertTrue($result['singleTeam']);
        $this->assertCount(1, $result['teams']);
        $this->assertSame(10, $result['teams'][0]['id']);
        $this->assertSame('U17', $result['teams'][0]['name']);
        $this->assertSame([], $result['players']);
    }

    public function testResolveAvailablePlayersForCoachMultipleTeams(): void
    {
        $team1 = $this->createMock(Team::class);
        $team1->method('getId')->willReturn(10);
        $team1->method('getName')->willReturn('U17');
        $team1->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([]));

        $team2 = $this->createMock(Team::class);
        $team2->method('getId')->willReturn(11);
        $team2->method('getName')->willReturn('U19');
        $team2->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([]));

        $user = $this->createMock(User::class);
        $this->accessService->method('getSelfCoachTeams')->willReturn([$team1, $team2]);

        $result = $this->service->resolveAvailablePlayersForCoach($user);
        $this->assertFalse($result['singleTeam']);
        $this->assertCount(2, $result['teams']);
        $this->assertCount(2, $result['players']);
        $this->assertSame(10, $result['players'][0]['team']['id']);
        $this->assertSame(11, $result['players'][1]['team']['id']);
    }

    // =========================================================================
    // resolveUserCoach
    // =========================================================================

    public function testResolveUserCoachNoRelationsReturnsNull(): void
    {
        $user = $this->makeUser([]);
        $this->assertNull($this->service->resolveUserCoach($user));
    }

    public function testResolveUserCoachSelfCoachRelationReturnsCoach(): void
    {
        $coach = $this->createMock(Coach::class);

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('coach');
        $relationType->method('getIdentifier')->willReturn('self_coach');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getCoach')->willReturn($coach);
        $relation->method('getPlayer')->willReturn(null);

        $user = $this->makeUser([$relation]);
        $this->assertSame($coach, $this->service->resolveUserCoach($user));
    }

    public function testResolveUserCoachWrongIdentifierReturnsNull(): void
    {
        $coach = $this->createMock(Coach::class);

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('coach');
        $relationType->method('getIdentifier')->willReturn('other_coach');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getCoach')->willReturn($coach);
        $relation->method('getPlayer')->willReturn(null);

        $user = $this->makeUser([$relation]);
        $this->assertNull($this->service->resolveUserCoach($user));
    }

    public function testResolveUserCoachWrongCategoryReturnsNull(): void
    {
        $coach = $this->createMock(Coach::class);

        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');
        $relationType->method('getIdentifier')->willReturn('self_coach');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getCoach')->willReturn($coach);
        $relation->method('getPlayer')->willReturn(null);

        $user = $this->makeUser([$relation]);
        $this->assertNull($this->service->resolveUserCoach($user));
    }
}
