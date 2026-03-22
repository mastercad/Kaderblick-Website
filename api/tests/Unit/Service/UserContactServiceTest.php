<?php

namespace App\Tests\Unit\Service;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\Player;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\UserContactService;
use DateTime;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class UserContactServiceTest extends TestCase
{
    private UserContactService $service;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $this->service = new UserContactService($em);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – no active relations
    // =========================================================================

    public function testCollectMyTeamsAndClubsReturnsEmptyForUserWithNoRelations(): void
    {
        $user = $this->makeUser([]);

        $result = $this->service->collectMyTeamsAndClubs($user);

        $this->assertSame([], $result['teamIds']);
        $this->assertSame([], $result['clubIds']);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – expired / future UserRelation itself
    // =========================================================================

    public function testCollectMyTeamsAndClubsIgnoresExpiredUserRelation(): void
    {
        $team = $this->makeTeam(1, 'A-Jugend');
        // A relation where all assignments are expired → isRelationActive returns false
        $relation = $this->makePlayerRelationWithTeams(
            [$this->makePTA($team, new DateTime('-2 months'), new DateTime('-1 day'))],
        );

        $user = $this->makeUser([$relation]);
        $result = $this->service->collectMyTeamsAndClubs($user);

        $this->assertSame([], $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsIgnoresFutureUserRelation(): void
    {
        $team = $this->makeTeam(1, 'B-Jugend');
        // A relation where all assignments start in the future → isRelationActive returns false
        $relation = $this->makePlayerRelationWithTeams(
            [$this->makePTA($team, new DateTime('+1 day'), null)],
        );

        $user = $this->makeUser([$relation]);
        $result = $this->service->collectMyTeamsAndClubs($user);

        $this->assertSame([], $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsIncludesRelationWithNullDates(): void
    {
        $team = $this->makeTeam(5, 'C-Jugend');
        $relation = $this->makePlayerRelationWithTeams(
            [$this->makePTA($team, null, null)],
        );

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertArrayHasKey(5, $result['teamIds']);
        $this->assertSame('C-Jugend', $result['teamIds'][5]);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – player team assignments
    // =========================================================================

    public function testCollectMyTeamsAndClubsIncludesActivePlayerTeamAssignment(): void
    {
        $team = $this->makeTeam(10, '1. Mannschaft');
        $relation = $this->makePlayerRelationWithTeams([
            $this->makePTA($team, new DateTime('-1 month'), new DateTime('+1 month')),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertArrayHasKey(10, $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsExcludesExpiredPlayerTeamAssignment(): void
    {
        $team = $this->makeTeam(10, '1. Mannschaft');
        $relation = $this->makePlayerRelationWithTeams([
            $this->makePTA($team, new DateTime('-2 months'), new DateTime('-1 day')),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertSame([], $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsExcludesFuturePlayerTeamAssignment(): void
    {
        $team = $this->makeTeam(10, '1. Mannschaft');
        $relation = $this->makePlayerRelationWithTeams([
            $this->makePTA($team, new DateTime('+1 day'), null),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertSame([], $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsDeduplicatesTeams(): void
    {
        $team = $this->makeTeam(7, 'Reserve');
        $relation = $this->makePlayerRelationWithTeams([
            $this->makePTA($team, null, null),
            $this->makePTA($team, null, null),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertCount(1, $result['teamIds']);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – player club assignments
    // =========================================================================

    public function testCollectMyTeamsAndClubsIncludesActivePlayerClubAssignment(): void
    {
        $club = $this->makeClub(20, 'TSV München');
        $relation = $this->makePlayerRelationWithClubs([
            $this->makePCA($club, new DateTime('-1 month'), new DateTime('+1 year')),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertArrayHasKey(20, $result['clubIds']);
        $this->assertSame('TSV München', $result['clubIds'][20]);
    }

    public function testCollectMyTeamsAndClubsExcludesExpiredPlayerClubAssignment(): void
    {
        $club = $this->makeClub(20, 'TSV München');
        $relation = $this->makePlayerRelationWithClubs([
            $this->makePCA($club, new DateTime('-2 months'), new DateTime('-1 day')),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertSame([], $result['clubIds']);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – coach team assignments
    // =========================================================================

    public function testCollectMyTeamsAndClubsIncludesActiveCoachTeamAssignment(): void
    {
        $team = $this->makeTeam(3, 'U17');
        $relation = $this->makeCoachRelationWithTeams([
            $this->makeCTA($team, new DateTime('-1 month'), null),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertArrayHasKey(3, $result['teamIds']);
    }

    public function testCollectMyTeamsAndClubsExcludesExpiredCoachTeamAssignment(): void
    {
        $team = $this->makeTeam(3, 'U17');
        $relation = $this->makeCoachRelationWithTeams([
            $this->makeCTA($team, new DateTime('-3 months'), new DateTime('-1 day')),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertSame([], $result['teamIds']);
    }

    // =========================================================================
    // collectMyTeamsAndClubs – coach club assignments
    // =========================================================================

    public function testCollectMyTeamsAndClubsIncludesActiveCoachClubAssignment(): void
    {
        $club = $this->makeClub(99, 'FC Test');
        $relation = $this->makeCoachRelationWithClubs([
            $this->makeCCA($club, new DateTime('-1 month'), null),
        ]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$relation]));

        $this->assertArrayHasKey(99, $result['clubIds']);
    }

    public function testCollectMyTeamsAndClubsMergesTeamsAndClubs(): void
    {
        $team1 = $this->makeTeam(1, 'U15');
        $team2 = $this->makeTeam(2, 'U17');
        $club = $this->makeClub(10, 'VfB');

        $rel1 = $this->makePlayerRelationWithTeams([$this->makePTA($team1, null, null)]);
        $rel2 = $this->makeCoachRelationWithTeams([$this->makeCTA($team2, null, null)]);
        $rel3 = $this->makePlayerRelationWithClubs([$this->makePCA($club, null, null)]);

        $result = $this->service->collectMyTeamsAndClubs($this->makeUser([$rel1, $rel2, $rel3]));

        $this->assertCount(2, $result['teamIds']);
        $this->assertCount(1, $result['clubIds']);
    }

    // =========================================================================
    // collectSharedContexts
    // =========================================================================

    public function testCollectSharedContextsReturnsEmptyWhenNoOverlap(): void
    {
        $team = $this->makeTeam(1, 'A');
        $relation = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)]);

        $shared = $this->service->collectSharedContexts($relation, [999 => 'Other'], [], new DateTimeImmutable());

        $this->assertSame([], $shared);
    }

    public function testCollectSharedContextsPlayerTeamOverlap(): void
    {
        $team = $this->makeTeam(1, '1. Mannschaft');
        $relation = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)]);

        $shared = $this->service->collectSharedContexts($relation, [1 => '1. Mannschaft'], [], new DateTimeImmutable());

        $this->assertSame(['Spieler · 1. Mannschaft'], $shared);
    }

    public function testCollectSharedContextsPlayerClubOverlap(): void
    {
        $club = $this->makeClub(5, 'FC Bayern');
        $relation = $this->makePlayerRelationWithClubs([$this->makePCA($club, null, null)]);

        $shared = $this->service->collectSharedContexts($relation, [], [5 => 'FC Bayern'], new DateTimeImmutable());

        $this->assertSame(['Spieler · FC Bayern'], $shared);
    }

    public function testCollectSharedContextsCoachTeamOverlap(): void
    {
        $team = $this->makeTeam(2, 'U19');
        $relation = $this->makeCoachRelationWithTeams([$this->makeCTA($team, null, null)]);

        $shared = $this->service->collectSharedContexts($relation, [2 => 'U19'], [], new DateTimeImmutable());

        $this->assertSame(['Trainer · U19'], $shared);
    }

    public function testCollectSharedContextsCoachClubOverlap(): void
    {
        $club = $this->makeClub(7, 'Borussia');
        $relation = $this->makeCoachRelationWithClubs([$this->makeCCA($club, null, null)]);

        $shared = $this->service->collectSharedContexts($relation, [], [7 => 'Borussia'], new DateTimeImmutable());

        $this->assertSame(['Trainer · Borussia'], $shared);
    }

    public function testCollectSharedContextsIgnoresExpiredAssignment(): void
    {
        $team = $this->makeTeam(1, 'X');
        $relation = $this->makePlayerRelationWithTeams([
            $this->makePTA($team, new DateTime('-2 months'), new DateTime('-1 day')),
        ]);

        $shared = $this->service->collectSharedContexts($relation, [1 => 'X'], [], new DateTimeImmutable());

        $this->assertSame([], $shared);
    }

    public function testCollectSharedContextsReturnsMultipleContexts(): void
    {
        $team = $this->makeTeam(1, 'U15');
        $club = $this->makeClub(2, 'TSV');

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([
            $this->makePTA($team, null, null),
        ]));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection([
            $this->makePCA($club, null, null),
        ]));

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        $shared = $this->service->collectSharedContexts(
            $relation,
            [1 => 'U15'],
            [2 => 'TSV'],
            new DateTimeImmutable()
        );

        $this->assertCount(2, $shared);
        $this->assertContains('Spieler · U15', $shared);
        $this->assertContains('Spieler · TSV', $shared);
    }

    // =========================================================================
    // findContacts – using mocked EntityManager
    // =========================================================================

    public function testFindContactsReturnsEmptyWhenCurrentUserHasNoTeamsOrClubs(): void
    {
        $me = $this->makeUser([]);

        $em = $this->createMock(EntityManagerInterface::class);
        $service = new UserContactService($em);

        $result = $service->findContacts($me);

        $this->assertSame([], $result);
    }

    public function testFindContactsReturnsContactWithContextFromMockedQuery(): void
    {
        $now = new DateTimeImmutable();
        $team = $this->makeTeam(1, '1. Mannschaft');

        // me: has an active player-team assignment
        $myRelation = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)]);
        $me = $this->makeUser([$myRelation]);

        // other user: also in team 1
        $otherUser = $this->createMock(User::class);
        $otherUser->method('getId')->willReturn(99);
        $otherUser->method('getFullName')->willReturn('Max Muster');

        $otherRelation = $this->makePlayerRelationWithTeams(
            [$this->makePTA($team, null, null)],
            user: $otherUser,
        );

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$otherRelation]);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('select')->willReturnSelf();
        $qb->method('from')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('createQueryBuilder')->willReturn($qb);

        $service = new UserContactService($em);
        $result = $service->findContacts($me, $now);

        $this->assertCount(1, $result);
        $this->assertSame(99, $result[0]['id']);
        $this->assertSame('Max Muster', $result[0]['fullName']);
        $this->assertStringContainsString('Spieler', $result[0]['context']);
        $this->assertStringContainsString('1. Mannschaft', $result[0]['context']);
    }

    public function testFindContactsDeduplicatesUserAppearingInMultipleRelations(): void
    {
        $now = new DateTimeImmutable();
        $team = $this->makeTeam(1, 'Mix');
        $club = $this->makeClub(2, 'VfB');

        $myRelation = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)]);
        $me = $this->makeUser([$myRelation]);

        $otherUser = $this->createMock(User::class);
        $otherUser->method('getId')->willReturn(42);
        $otherUser->method('getFullName')->willReturn('Lisa Müller');

        // Two separate relations for the same user — one via team, one via club
        $rel1 = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)], user: $otherUser);
        $rel2 = $this->makeCoachRelationWithClubs([$this->makeCCA($club, null, null)], user: $otherUser);

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$rel1, $rel2]);

        $qb = $this->buildQbMock($query);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('createQueryBuilder')->willReturn($qb);

        $service = new UserContactService($em);

        // Club not in my list, so only team overlap is shared
        $result = $service->findContacts($me, $now);

        $this->assertCount(1, $result);
        $this->assertSame(42, $result[0]['id']);
    }

    public function testFindContactsSortsResultsAlphabetically(): void
    {
        $now = new DateTimeImmutable();
        $team = $this->makeTeam(1, 'T');

        $me = $this->makeUser([$this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)])]);

        foreach (['Zara', 'Anna', 'Max'] as $idx => $name) {
            $u = $this->createMock(User::class);
            $u->method('getId')->willReturn($idx + 1);
            $u->method('getFullName')->willReturn($name);
            $users[] = $this->makePlayerRelationWithTeams([$this->makePTA($team, null, null)], user: $u);
        }

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn($users);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('createQueryBuilder')->willReturn($this->buildQbMock($query));

        $result = (new UserContactService($em))->findContacts($me, $now);

        $this->assertSame(['Anna', 'Max', 'Zara'], array_column($result, 'fullName'));
    }

    // =========================================================================
    // findAllUsers – context built from own assignments
    // =========================================================================

    public function testFindAllUsersReturnsEmptyWhenNoRelationsAndNoUsers(): void
    {
        $em = $this->buildEmForFindAllUsers([], []);
        $service = new UserContactService($em);

        $result = $service->findAllUsers($this->createMock(User::class));

        $this->assertSame([], $result);
    }

    public function testFindAllUsersIncludesUserWithoutRelationWithEmptyContext(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(7);
        $user->method('getFullName')->willReturn('Standalone User');

        $em = $this->buildEmForFindAllUsers([], [$user]);
        $service = new UserContactService($em);

        $result = $service->findAllUsers($this->createMock(User::class));

        $this->assertCount(1, $result);
        $this->assertSame(7, $result[0]['id']);
        $this->assertSame('Standalone User', $result[0]['fullName']);
        $this->assertSame('', $result[0]['context']);
    }

    public function testFindAllUsersBuildsPlayerContextFromActiveTeamAssignment(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $pta = $this->makePTA($team, null, null);

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $userMock = $this->createMock(User::class);
        $userMock->method('getId')->willReturn(42);
        $userMock->method('getFullName')->willReturn('Max Mustermann');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getUser')->willReturn($userMock);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        $em = $this->buildEmForFindAllUsers([$relation], [$userMock]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertCount(1, $result);
        $this->assertSame('Spieler · U17', $result[0]['context']);
    }

    public function testFindAllUsersBuildsCoachContextFromActiveTeamAssignment(): void
    {
        $team = $this->makeTeam(2, '1. Mannschaft');
        $cta = $this->makeCTA($team, null, null);

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));
        $coach->method('getCoachClubAssignments')->willReturn(new ArrayCollection());

        $userMock = $this->createMock(User::class);
        $userMock->method('getId')->willReturn(55);
        $userMock->method('getFullName')->willReturn('Klaus Trainer');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getUser')->willReturn($userMock);
        $relation->method('getPlayer')->willReturn(null);
        $relation->method('getCoach')->willReturn($coach);

        $em = $this->buildEmForFindAllUsers([$relation], [$userMock]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertCount(1, $result);
        $this->assertSame('Trainer · 1. Mannschaft', $result[0]['context']);
    }

    public function testFindAllUsersExcludesExpiredTeamAssignment(): void
    {
        $team = $this->makeTeam(3, 'U15');
        $pta = $this->makePTA($team, new DateTime('-2 months'), new DateTime('-1 day'));

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $userMock = $this->createMock(User::class);
        $userMock->method('getId')->willReturn(77);
        $userMock->method('getFullName')->willReturn('Alt Spieler');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getUser')->willReturn($userMock);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        $em = $this->buildEmForFindAllUsers([$relation], [$userMock]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertCount(1, $result);
        $this->assertSame('', $result[0]['context'], 'Expired assignment must not appear in context');
    }

    public function testFindAllUsersDeduplicatesIdenticalContextStrings(): void
    {
        $team = $this->makeTeam(1, 'U17');

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([
            $this->makePTA($team, null, null),
            $this->makePTA($team, null, null), // duplicate
        ]));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $userMock = $this->createMock(User::class);
        $userMock->method('getId')->willReturn(10);
        $userMock->method('getFullName')->willReturn('Doppel User');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getUser')->willReturn($userMock);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        $em = $this->buildEmForFindAllUsers([$relation], [$userMock]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertSame('Spieler · U17', $result[0]['context'], 'Duplicate contexts must be collapsed');
    }

    public function testFindAllUsersCombinesMultipleContextsWithPipe(): void
    {
        $teamA = $this->makeTeam(1, 'U17');
        $teamB = $this->makeTeam(2, 'Reservemannschaft');

        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([
            $this->makePTA($teamA, null, null),
            $this->makePTA($teamB, null, null),
        ]));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $userMock = $this->createMock(User::class);
        $userMock->method('getId')->willReturn(20);
        $userMock->method('getFullName')->willReturn('Multi Team User');

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getUser')->willReturn($userMock);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        $em = $this->buildEmForFindAllUsers([$relation], [$userMock]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertStringContainsString('Spieler · U17', $result[0]['context']);
        $this->assertStringContainsString('Spieler · Reservemannschaft', $result[0]['context']);
        $this->assertStringContainsString(' | ', $result[0]['context']);
    }

    public function testFindAllUsersSortedAlphabetically(): void
    {
        $userZ = $this->createMock(User::class);
        $userZ->method('getId')->willReturn(1);
        $userZ->method('getFullName')->willReturn('Zara');

        $userA = $this->createMock(User::class);
        $userA->method('getId')->willReturn(2);
        $userA->method('getFullName')->willReturn('Anna');

        $em = $this->buildEmForFindAllUsers([], [$userZ, $userA]);
        $result = (new UserContactService($em))->findAllUsers($this->createMock(User::class));

        $this->assertSame(['Anna', 'Zara'], array_column($result, 'fullName'));
    }

    // =========================================================================
    // Factories
    // =========================================================================

    /**
     * @param UserRelation[] $relations
     * @param User[]         $users
     */
    private function buildEmForFindAllUsers(array $relations, array $users): EntityManagerInterface
    {
        $relQuery = $this->createMock(Query::class);
        $relQuery->method('getResult')->willReturn($relations);
        $relQb = $this->buildQbMock($relQuery);

        $userQuery = $this->createMock(Query::class);
        $userQuery->method('getResult')->willReturn($users);
        $userQb = $this->createMock(QueryBuilder::class);
        $userQb->method('where')->willReturnSelf();
        $userQb->method('andWhere')->willReturnSelf();
        $userQb->method('setParameter')->willReturnSelf();
        $userQb->method('getQuery')->willReturn($userQuery);

        $userRepo = $this->createMock(EntityRepository::class);
        $userRepo->method('createQueryBuilder')->willReturn($userQb);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('createQueryBuilder')->willReturn($relQb);
        $em->method('getRepository')->willReturn($userRepo);

        return $em;
    }

    /** @param UserRelation[] $relations */
    private function makeUser(array $relations): User
    {
        /** @var User&\PHPUnit\Framework\MockObject\MockObject $user */
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection($relations));

        return $user;
    }

    private function makeTeam(int $id, string $name): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getName')->willReturn($name);

        return $team;
    }

    private function makeClub(int $id, string $name): Club
    {
        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn($id);
        $club->method('getName')->willReturn($name);

        return $club;
    }

    /** @param PlayerTeamAssignment[] $assignments */
    private function makePlayerRelationWithTeams(
        array $assignments,
        ?User $user = null,
    ): UserRelation {
        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection($assignments));
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        return $this->makeRelation($player, null, $user);
    }

    /** @param PlayerClubAssignment[] $assignments */
    private function makePlayerRelationWithClubs(
        array $assignments,
        ?User $user = null,
    ): UserRelation {
        $player = $this->createMock(Player::class);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection());
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection($assignments));

        return $this->makeRelation($player, null, $user);
    }

    /** @param CoachTeamAssignment[] $assignments */
    private function makeCoachRelationWithTeams(
        array $assignments,
        ?User $user = null,
    ): UserRelation {
        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection($assignments));
        $coach->method('getCoachClubAssignments')->willReturn(new ArrayCollection());

        return $this->makeRelation(null, $coach, $user);
    }

    /** @param CoachClubAssignment[] $assignments */
    private function makeCoachRelationWithClubs(
        array $assignments,
        ?User $user = null,
    ): UserRelation {
        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection());
        $coach->method('getCoachClubAssignments')->willReturn(new ArrayCollection($assignments));

        return $this->makeRelation(null, $coach, $user);
    }

    private function makeRelation(
        ?Player $player,
        ?Coach $coach,
        ?User $user,
    ): UserRelation {
        $relation = $this->createMock(UserRelation::class);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn($coach);

        $u = $user ?? $this->createMock(User::class);
        $relation->method('getUser')->willReturn($u);

        return $relation;
    }

    private function makePTA(Team $team, ?DateTime $start, ?DateTime $end): PlayerTeamAssignment
    {
        $a = $this->createMock(PlayerTeamAssignment::class);
        $a->method('getTeam')->willReturn($team);
        $a->method('getStartDate')->willReturn($start);
        $a->method('getEndDate')->willReturn($end);

        return $a;
    }

    private function makePCA(Club $club, ?DateTime $start, ?DateTime $end): PlayerClubAssignment
    {
        $a = $this->createMock(PlayerClubAssignment::class);
        $a->method('getClub')->willReturn($club);
        $a->method('getStartDate')->willReturn($start);
        $a->method('getEndDate')->willReturn($end);

        return $a;
    }

    private function makeCTA(Team $team, ?DateTime $start, ?DateTime $end): CoachTeamAssignment
    {
        $a = $this->createMock(CoachTeamAssignment::class);
        $a->method('getTeam')->willReturn($team);
        $a->method('getStartDate')->willReturn($start);
        $a->method('getEndDate')->willReturn($end);

        return $a;
    }

    private function makeCCA(Club $club, ?DateTime $start, ?DateTime $end): CoachClubAssignment
    {
        $a = $this->createMock(CoachClubAssignment::class);
        $a->method('getClub')->willReturn($club);
        $a->method('getStartDate')->willReturn($start);
        $a->method('getEndDate')->willReturn($end);

        return $a;
    }

    private function buildQbMock(Query $query): QueryBuilder
    {
        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('select')->willReturnSelf();
        $qb->method('from')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('leftJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        return $qb;
    }
}
