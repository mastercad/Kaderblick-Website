<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\Club;
use App\Entity\Game;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\TournamentTeam;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use App\Repository\ParticipationRepository;
use App\Service\TeamMembershipService;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * Unit tests for TeamMembershipService.
 *
 * All Doctrine calls are mocked — no database is required.
 */
#[AllowMockObjectsWithoutExpectations]
class TeamMembershipServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private TeamMembershipService $service;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $participationRepository = $this->createMock(ParticipationRepository::class);
        $this->service = new TeamMembershipService($this->entityManager, $participationRepository);
    }

    // ─── isUserTeamMemberForEvent ────────────────────────────────────────────

    public function testIsUserTeamMemberForEventReturnsTrueForGameHomeTeamMember(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->isUserTeamMemberForEvent($user, $event));
    }

    public function testIsUserTeamMemberForEventReturnsTrueForGameAwayTeamMember(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame(null, $team);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->isUserTeamMemberForEvent($user, $event));
    }

    public function testIsUserTeamMemberForEventReturnsTrueForTeamPermissionMember(): void
    {
        $team = $this->createTeam();
        $permission = $this->createPermission(CalendarEventPermissionType::TEAM, team: $team);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->isUserTeamMemberForEvent($user, $event));
    }

    public function testIsUserTeamMemberForEventReturnsFalseForNonMember(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->isUserTeamMemberForEvent($user, $event));
    }

    public function testIsUserTeamMemberForEventReturnsFalseForEventWithNoTeams(): void
    {
        $event = $this->createEvent(null, []);
        $user = $this->createUser(1);

        $this->assertFalse($this->service->isUserTeamMemberForEvent($user, $event));
    }

    // ─── canUserParticipateInEvent ────────────────────────────────────────────

    public function testCanParticipateReturnsTrueForPublicEvent(): void
    {
        $permission = $this->createPermission(CalendarEventPermissionType::PUBLIC);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueForGameTeamMember(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForGameNonTeamMember(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueForTeamPermissionMember(): void
    {
        $team = $this->createTeam();
        $permission = $this->createPermission(CalendarEventPermissionType::TEAM, team: $team);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForTeamPermissionNonMember(): void
    {
        $team = $this->createTeam();
        $permission = $this->createPermission(CalendarEventPermissionType::TEAM, team: $team);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueForClubPermissionMember(): void
    {
        $club = $this->createClub();
        $permission = $this->createPermission(CalendarEventPermissionType::CLUB, club: $club);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->mockClubQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForClubPermissionNonMember(): void
    {
        $club = $this->createClub();
        $permission = $this->createPermission(CalendarEventPermissionType::CLUB, club: $club);
        $event = $this->createEvent(null, [$permission]);
        $user = $this->createUser(1);

        $this->mockClubQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueForUserPermissionMatchingUser(): void
    {
        $user = $this->createUser(42);
        $targetUser = $this->createUser(42); // same ID
        $permission = $this->createPermission(CalendarEventPermissionType::USER, user: $targetUser);
        $event = $this->createEvent(null, [$permission]);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForUserPermissionMismatchedUser(): void
    {
        $user = $this->createUser(1);
        $targetUser = $this->createUser(99);
        $permission = $this->createPermission(CalendarEventPermissionType::USER, user: $targetUser);
        $event = $this->createEvent(null, [$permission]);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueWhenNoPermissionsSet(): void
    {
        $event = $this->createEvent(null, []);
        $user = $this->createUser(1);

        // No restrictions → open to all (public fallback)
        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    // ─── canUserParticipateInEvent – tournament events ────────────────────────

    public function testCanParticipateReturnsTrueForTournamentTeamMember(): void
    {
        $team = $this->createTeam();
        $tournamentTeam = $this->createTournamentTeam($team);
        $tournament = $this->createTournament([$tournamentTeam]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForTournamentNonMember(): void
    {
        $team = $this->createTeam();
        $tournamentTeam = $this->createTournamentTeam($team);
        $tournament = $this->createTournament([$tournamentTeam]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsTrueWhenMemberOfSecondTournamentTeam(): void
    {
        $team1 = $this->createTeam();
        $team2 = $this->createTeam();
        $tt1 = $this->createTournamentTeam($team1);
        $tt2 = $this->createTournamentTeam($team2);
        $tournament = $this->createTournament([$tt1, $tt2]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        // first team: not a member; second team: member
        $this->mockTeamQueryResultSequence([false, true]);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateReturnsFalseForTournamentWithNoTeams(): void
    {
        $tournament = $this->createTournament([]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testTournamentCheckSkipsPermissionsAndGameChecks(): void
    {
        // Even though the event has game and team permissions, the tournament branch
        // must run first and return false (not fall through to the permission fallback).
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $permission = $this->createPermission(CalendarEventPermissionType::PUBLIC);
        $tournamentTeam = $this->createTournamentTeam($team);
        $tournament = $this->createTournament([$tournamentTeam]);
        $event = $this->createEvent($game, [$permission], $tournament);
        $user = $this->createUser(1);

        // membership check returns false → should still be false (not overridden by public permission)
        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    // ─── getEventTeams ────────────────────────────────────────────────────────

    public function testGetEventTeamsReturnsGameHomeAndAwayTeams(): void
    {
        $homeTeam = $this->createTeam();
        $awayTeam = $this->createTeam();
        $game = $this->createGame($homeTeam, $awayTeam);
        $event = $this->createEvent($game);

        $teams = $this->service->getEventTeams($event);

        $this->assertContains($homeTeam, $teams);
        $this->assertContains($awayTeam, $teams);
    }

    public function testGetEventTeamsReturnsTeamPermissions(): void
    {
        $team = $this->createTeam();
        $permission = $this->createPermission(CalendarEventPermissionType::TEAM, team: $team);
        $event = $this->createEvent(null, [$permission]);

        $teams = $this->service->getEventTeams($event);

        $this->assertContains($team, $teams);
    }

    public function testGetEventTeamsIgnoresNonTeamPermissions(): void
    {
        $club = $this->createClub();
        $permission = $this->createPermission(CalendarEventPermissionType::CLUB, club: $club);
        $event = $this->createEvent(null, [$permission]);

        $teams = $this->service->getEventTeams($event);

        $this->assertEmpty($teams);
    }

    public function testGetEventTeamsReturnsEmptyForEventWithNoGameAndNoPermissions(): void
    {
        $event = $this->createEvent(null, []);

        $this->assertEmpty($this->service->getEventTeams($event));
    }

    // ─── isSelfMemberInTeam ───────────────────────────────────────────────────

    public function testIsSelfMemberInTeamReturnsTrueForSelfPlayerAssignment(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        // self_player relation found → eligible
        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->isSelfMemberInTeam($user, $team));
    }

    public function testIsSelfMemberInTeamReturnsTrueForSelfCoachAssignment(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        // No self_player, but self_coach found
        $this->mockTeamQueryResultSequence([false, true]);

        $this->assertTrue($this->service->isSelfMemberInTeam($user, $team));
    }

    public function testIsSelfMemberInTeamReturnsFalseForNonSelfRelation(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        // Neither self_player nor self_coach found → e.g. parent / friend relation
        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->isSelfMemberInTeam($user, $team));
    }

    // ─── canUserParticipateInEvent – game events restricted to self relations ─

    public function testCanParticipateForGameReturnsFalseForParentOrFriendUser(): void
    {
        // A parent has a UserRelation to the player entity, but NOT with self_player identifier.
        // isSelfMemberInTeam must return false → canParticipate = false.
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        // DB query finds no self_player / self_coach relation for this user
        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateForGameReturnsTrueForSelfPlayerInHomeTeam(): void
    {
        $team = $this->createTeam();
        $game = $this->createGame($team, null);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        // DB query confirms self_player relation exists
        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateForGameReturnsTrueForSelfCoachInAwayTeam(): void
    {
        $homeTeam = $this->createTeam();
        $awayTeam = $this->createTeam();
        $game = $this->createGame($homeTeam, $awayTeam);
        $event = $this->createEvent($game);
        $user = $this->createUser(1);

        // home team: no self-member; away team (player check): no match; coach check: match
        $this->mockTeamQueryResultSequence([false, false, false, true]);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    // ─── canUserParticipateInEvent – tournament restricted to self relations ──

    public function testCanParticipateForTournamentReturnsFalseForParentOrFriendUser(): void
    {
        $team = $this->createTeam();
        $tournamentTeam = $this->createTournamentTeam($team);
        $tournament = $this->createTournament([$tournamentTeam]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        // No self_player / self_coach relation found
        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->canUserParticipateInEvent($user, $event));
    }

    public function testCanParticipateForTournamentReturnsTrueForSelfPlayerInTeam(): void
    {
        $team = $this->createTeam();
        $tournamentTeam = $this->createTournamentTeam($team);
        $tournament = $this->createTournament([$tournamentTeam]);
        $event = $this->createEvent(null, [], $tournament);
        $user = $this->createUser(1);

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->canUserParticipateInEvent($user, $event));
    }

    // ─── isUserInTeam ─────────────────────────────────────────────────────────

    public function testIsUserInTeamReturnsTrueForPlayerAssignment(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        $this->mockTeamQueryResult(found: true);

        $this->assertTrue($this->service->isUserInTeam($user, $team));
    }

    public function testIsUserInTeamReturnsTrueForCoachAssignment(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        // First repo call (PlayerTeamAssignment) returns null, second (CoachTeamAssignment) returns match
        $this->mockTeamQueryResultSequence([false, true]);

        $this->assertTrue($this->service->isUserInTeam($user, $team));
    }

    public function testIsUserInTeamReturnsFalseWhenNotInTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam();

        $this->mockTeamQueryResult(found: false);

        $this->assertFalse($this->service->isUserInTeam($user, $team));
    }

    // ─── isUserInClub ─────────────────────────────────────────────────────────

    public function testIsUserInClubReturnsTrueForPlayerAssignment(): void
    {
        $user = $this->createUser(1);
        $club = $this->createClub();

        $this->mockClubQueryResult(found: true);

        $this->assertTrue($this->service->isUserInClub($user, $club));
    }

    public function testIsUserInClubReturnsTrueForCoachAssignment(): void
    {
        $user = $this->createUser(1);
        $club = $this->createClub();

        $this->mockClubQueryResultSequence([false, true]);

        $this->assertTrue($this->service->isUserInClub($user, $club));
    }

    public function testIsUserInClubReturnsFalseWhenNotInClub(): void
    {
        $user = $this->createUser(1);
        $club = $this->createClub();

        $this->mockClubQueryResult(found: false);

        $this->assertFalse($this->service->isUserInClub($user, $club));
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function createUser(int $id): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);

        return $user;
    }

    private int $teamCounter = 0;

    private function createTeam(): Team&MockObject
    {
        $team = $this->createMock(Team::class);
        // Give each mock a unique string so array_unique(SORT_REGULAR) keeps distinct teams
        $name = 'Team_' . (++$this->teamCounter);
        $team->method('__toString')->willReturn($name);

        return $team;
    }

    private function createClub(): Club&MockObject
    {
        return $this->createMock(Club::class);
    }

    private function createGame(?Team $homeTeam, ?Team $awayTeam): Game&MockObject
    {
        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn($homeTeam);
        $game->method('getAwayTeam')->willReturn($awayTeam);

        return $game;
    }

    /**
     * @param CalendarEventPermission[] $permissions
     */
    private function createEvent(?Game $game = null, array $permissions = [], ?Tournament $tournament = null): CalendarEvent&MockObject
    {
        $event = $this->createMock(CalendarEvent::class);
        $event->method('getGame')->willReturn($game);
        $event->method('getPermissions')->willReturn(new ArrayCollection($permissions));
        $event->method('getTournament')->willReturn($tournament);

        return $event;
    }

    private function createPermission(
        CalendarEventPermissionType $type,
        ?Team $team = null,
        ?Club $club = null,
        ?User $user = null,
    ): CalendarEventPermission&MockObject {
        $permission = $this->createMock(CalendarEventPermission::class);
        $permission->method('getPermissionType')->willReturn($type);
        $permission->method('getTeam')->willReturn($team);
        $permission->method('getClub')->willReturn($club);
        $permission->method('getUser')->willReturn($user);

        return $permission;
    }

    private function buildQueryBuilderMock(bool $found): QueryBuilder&MockObject
    {
        $query = $this->createMock(Query::class);
        $query->method('getOneOrNullResult')->willReturn($found ? new stdClass() : null);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('innerJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        return $qb;
    }

    private function mockTeamQueryResult(bool $found): void
    {
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($this->buildQueryBuilderMock($found));

        $this->entityManager->method('getRepository')->willReturn($repo);
    }

    private function mockClubQueryResult(bool $found): void
    {
        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($this->buildQueryBuilderMock($found));

        $this->entityManager->method('getRepository')->willReturn($repo);
    }

    /**
     * Allows different results per consecutive getRepository() call (player first, coach second).
     *
     * @param bool[] $sequence
     */
    private function mockTeamQueryResultSequence(array $sequence): void
    {
        $repos = array_map(function (bool $found): EntityRepository {
            $repo = $this->createMock(EntityRepository::class);
            $repo->method('createQueryBuilder')->willReturn($this->buildQueryBuilderMock($found));

            return $repo;
        }, $sequence);

        $this->entityManager->expects($this->exactly(count($repos)))
            ->method('getRepository')
            ->willReturnOnConsecutiveCalls(...array_values($repos));
    }

    /**
     * @param bool[] $sequence
     */
    private function mockClubQueryResultSequence(array $sequence): void
    {
        $this->mockTeamQueryResultSequence($sequence); // same infrastructure
    }

    // --- Tournament helpers ---

    private function createTournamentTeam(?Team $team): TournamentTeam&MockObject
    {
        $tt = $this->createMock(TournamentTeam::class);
        $tt->method('getTeam')->willReturn($team);

        return $tt;
    }

    /** @param TournamentTeam[] $tournamentTeams */
    private function createTournament(array $tournamentTeams): Tournament&MockObject
    {
        $tournament = $this->createMock(Tournament::class);
        $tournament->method('getTeams')->willReturn(new ArrayCollection($tournamentTeams));

        return $tournament;
    }
}
