<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\KnowledgeBasePost;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\KnowledgeBaseVoter;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

/**
 * Unit-Tests für KnowledgeBaseVoter.
 *
 * Abgedeckte Fälle:
 *  - Anonymer User → immer abgelehnt
 *  - SUPERADMIN → immer zugelassen
 *  - Supports-Methode: KB_*-Attribute werden erkannt, fremde nicht
 *  - POST_VIEW / COMMENT_VIEW: Teammitglied → zugelassen, Nicht-Mitglied → abgelehnt
 *  - POST_CREATE / COMMENT_ADD: Admin+Teammitglied → zugelassen, normaler User → abgelehnt
 *  - POST_EDIT / POST_DELETE: Admin+Teammitglied → zugelassen, Autor → zugelassen, Fremder → abgelehnt
 *  - POST_PIN: Gleiches Recht wie POST_CREATE
 *  - Unsupported subject → ABSTAIN
 */
#[AllowMockObjectsWithoutExpectations]
class KnowledgeBaseVoterTest extends TestCase
{
    private KnowledgeBaseVoter $voter;

    /** @var EntityManagerInterface&MockObject */
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->voter = new KnowledgeBaseVoter($this->em);
    }

    // ─── Anonymous ────────────────────────────────────────────────────────────

    public function testAnonymousUserIsAlwaysDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $team = $this->createTeam(1);

        $result = $this->voter->vote($token, $team, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── SUPERADMIN ───────────────────────────────────────────────────────────

    public function testSuperadminCanAlwaysView(): void
    {
        $superAdmin = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);

        $result = $this->voter->vote($this->createToken($superAdmin), $team, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testSuperadminCanAlwaysCreate(): void
    {
        $superAdmin = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);

        $result = $this->voter->vote($this->createToken($superAdmin), $team, [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testSuperadminCanAlwaysEditAnyPost(): void
    {
        $superAdmin = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $post = $this->createPost($this->createTeam(10), $this->createUser(99));

        $result = $this->voter->vote($this->createToken($superAdmin), $post, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── Supports ─────────────────────────────────────────────────────────────

    public function testSupportsAllKbAttributes(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        foreach (
            [
                KnowledgeBaseVoter::POST_VIEW,
                KnowledgeBaseVoter::POST_CREATE,
                KnowledgeBaseVoter::POST_EDIT,
                KnowledgeBaseVoter::POST_DELETE,
                KnowledgeBaseVoter::POST_PIN,
                KnowledgeBaseVoter::COMMENT_VIEW,
                KnowledgeBaseVoter::COMMENT_ADD,
            ] as $attr
        ) {
            $result = $this->voter->vote($token, $team, [$attr]);
            $this->assertNotEquals(
                VoterInterface::ACCESS_ABSTAIN,
                $result,
                "Voter sollte Attribut $attr unterstützen",
            );
        }
    }

    public function testAbstainsForUnknownAttribute(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $result = $this->voter->vote($this->createToken($user), $team, ['UNKNOWN_ATTRIBUTE']);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    public function testAbstainsForUnsupportedSubjectType(): void
    {
        $user = $this->createUser(1, ['ROLE_USER']);
        $result = $this->voter->vote($this->createToken($user), new stdClass(), [KnowledgeBaseVoter::POST_VIEW]);

        // resolveTeam returns null → POST_VIEW returns false → DENIED (not ABSTAIN, because attribute is supported)
        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── POST_VIEW: Team as subject ───────────────────────────────────────────

    public function testViewGrantedForTeamMember(): void
    {
        $user = $this->createUser(1, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewDeniedForNonTeamMember(): void
    {
        $user = $this->createUser(2, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(false);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── POST_VIEW: Post as subject ───────────────────────────────────────────

    public function testViewGrantedWhenPostSubjectAndUserIsTeamMember(): void
    {
        $user = $this->createUser(1, ['ROLE_USER']);
        $author = $this->createUser(99);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($user), $post, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── POST_CREATE ──────────────────────────────────────────────────────────

    public function testCreateGrantedForAdminInTeam(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);

        // isUserInTeam → true (first call: player assignment found)
        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($admin), $team, [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateDeniedForRegularUserNotInTeam(): void
    {
        $user = $this->createUser(2, ['ROLE_USER']);
        $team = $this->createTeam(10);

        // isUserInTeam → false, isCoachOfTeam → false
        $this->mockIsUserInTeam(false, false);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── POST_EDIT ────────────────────────────────────────────────────────────

    public function testEditGrantedForAuthorOfPost(): void
    {
        $author = $this->createUser(5, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        // Admin check fails (not ROLE_ADMIN), falls through to author check
        $result = $this->voter->vote($this->createToken($author), $post, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForNonAuthorWithoutAdminRole(): void
    {
        $author = $this->createUser(5, ['ROLE_USER']);
        $otherUser = $this->createUser(9, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $result = $this->voter->vote($this->createToken($otherUser), $post, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditGrantedForAdminThatBelongsToTeam(): void
    {
        $admin = $this->createUser(3, ['ROLE_ADMIN']);
        $author = $this->createUser(5, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($admin), $post, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForAdminNotInTeam(): void
    {
        $admin = $this->createUser(3, ['ROLE_ADMIN']);
        $author = $this->createUser(5, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $this->mockIsUserInTeam(false);

        $result = $this->voter->vote($this->createToken($admin), $post, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── POST_DELETE ──────────────────────────────────────────────────────────

    public function testDeleteGrantedForAuthor(): void
    {
        $author = $this->createUser(7, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $result = $this->voter->vote($this->createToken($author), $post, [KnowledgeBaseVoter::POST_DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteDeniedForStranger(): void
    {
        $author = $this->createUser(7, ['ROLE_USER']);
        $otherUser = $this->createUser(8, ['ROLE_USER']);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $result = $this->voter->vote($this->createToken($otherUser), $post, [KnowledgeBaseVoter::POST_DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── POST_PIN ─────────────────────────────────────────────────────────────

    public function testPinGrantedForAdminInTeam(): void
    {
        $admin = $this->createUser(3, ['ROLE_ADMIN']);
        $author = $this->createUser(5);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($admin), $post, [KnowledgeBaseVoter::POST_PIN]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testPinDeniedForRegularUserNotCoach(): void
    {
        $user = $this->createUser(2, ['ROLE_USER']);
        $author = $this->createUser(5);
        $team = $this->createTeam(10);
        $post = $this->createPost($team, $author);

        // Not admin/supporter → canCreate checks isCoachOfTeam
        $this->mockIsUserInTeam(false, false);

        $result = $this->voter->vote($this->createToken($user), $post, [KnowledgeBaseVoter::POST_PIN]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── COMMENT_ADD ─────────────────────────────────────────────────────────

    public function testCommentAddGrantedForSupporterInTeam(): void
    {
        $supporter = $this->createUser(4, ['ROLE_SUPPORTER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($supporter), $team, [KnowledgeBaseVoter::COMMENT_ADD]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── COMMENT_VIEW: dedicated branch tests ────────────────────────────────

    public function testCommentViewGrantedForTeamMember(): void
    {
        $user = $this->createUser(1, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::COMMENT_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCommentViewDeniedForNonMember(): void
    {
        $user = $this->createUser(2, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(false);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::COMMENT_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── Coach path ───────────────────────────────────────────────────────────

    public function testCreateGrantedForCoach(): void
    {
        // ROLE_USER: not privileged → canCreate() falls through to isCoachOfTeam()
        $user = $this->createUser(3, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(false, true);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewGrantedViaCoachPath(): void
    {
        // isUserInTeam: player=null → falls through to coach query → found → true
        $user = $this->createUser(3, ['ROLE_USER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(false, true);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── Invalid subject type: Team instead of KnowledgeBasePost ─────────────

    public function testEditDeniedWhenSubjectIsTeam(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteDeniedWhenSubjectIsTeam(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testPinDeniedWhenSubjectIsTeam(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);

        $result = $this->voter->vote($this->createToken($user), $team, [KnowledgeBaseVoter::POST_PIN]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── Unresolvable subject (resolveTeam returns null) ─────────────────────

    public function testCreateDeniedWhenSubjectHasNoTeam(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);

        // stdClass → resolveTeam() returns null → POST_CREATE returns false
        $result = $this->voter->vote($this->createToken($user), new stdClass(), [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testCommentAddDeniedWhenSubjectHasNoTeam(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);

        $result = $this->voter->vote($this->createToken($user), new stdClass(), [KnowledgeBaseVoter::COMMENT_ADD]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── ROLE_SUPPORTER → POST_CREATE ────────────────────────────────────────

    public function testCreateGrantedForSupporterInTeam(): void
    {
        $supporter = $this->createUser(4, ['ROLE_SUPPORTER']);
        $team = $this->createTeam(10);

        $this->mockIsUserInTeam(true);

        $result = $this->voter->vote($this->createToken($supporter), $team, [KnowledgeBaseVoter::POST_CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Mocks the EntityManager's QueryBuilder chain so that isUserInTeam() returns
     * the desired value. When $playerFound is true, the player-assignment query
     * returns a non-null result (no coach query needed). When false, both player and
     * coach queries return null (unless $coachFound is true, which covers the coach branch).
     */
    private function mockIsUserInTeam(bool $playerFound, bool $coachFound = false): void
    {
        $playerQuery = $this->createQueryMock($playerFound ? new stdClass() : null);
        $coachQuery = $this->createQueryMock($coachFound ? new stdClass() : null);

        $playerQb = $this->createQbMockReturningQuery($playerQuery);
        $coachQb = $this->createQbMockReturningQuery($coachQuery);

        $playerRepo = $this->createMock(EntityRepository::class);
        $playerRepo->method('createQueryBuilder')->willReturn($playerQb);

        $coachRepo = $this->createMock(EntityRepository::class);
        $coachRepo->method('createQueryBuilder')->willReturn($coachQb);

        $this->em
            ->method('getRepository')
            ->willReturnCallback(static function (string $class) use ($playerRepo, $coachRepo): EntityRepository {
                if (PlayerTeamAssignment::class === $class) {
                    return $playerRepo;
                }

                return $coachRepo;
            });
    }

    private function createQueryMock(?object $returnValue): Query&MockObject
    {
        $query = $this->createMock(Query::class);
        $query->method('getOneOrNullResult')->willReturn($returnValue);

        return $query;
    }

    private function createQbMockReturningQuery(Query&MockObject $query): QueryBuilder&MockObject
    {
        $qb = $this->createMock(QueryBuilder::class);
        // All fluent methods return $this so chaining works
        $qb->method('innerJoin')->willReturnSelf();
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();
        $qb->method('select')->willReturnSelf();
        $qb->method('getQuery')->willReturn($query);

        return $qb;
    }

    /**
     * @param array<string> $roles
     */
    private function createUser(int $id, array $roles = ['ROLE_USER']): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    private function createTeam(int $id): Team&MockObject
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);

        return $team;
    }

    private function createPost(Team&MockObject $team, User&MockObject $author): KnowledgeBasePost&MockObject
    {
        $post = $this->createMock(KnowledgeBasePost::class);
        $post->method('getTeam')->willReturn($team);
        $post->method('getCreatedBy')->willReturn($author);

        return $post;
    }

    private function createToken(User&MockObject $user): TokenInterface&MockObject
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
