<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Club;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\Survey;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\SurveyVoter;
use Doctrine\Common\Collections\ArrayCollection;
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

#[AllowMockObjectsWithoutExpectations]
class SurveyVoterTest extends TestCase
{
    private SurveyVoter $voter;
    private MockObject&EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->voter = new SurveyVoter($this->entityManager);
    }

    // --- VIEW ---

    public function testViewAsRegularUserReturnsGranted(): void
    {
        $user = $this->createUser(1);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsGuestReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_GUEST']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewWithoutUserReturnsDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);
        $survey = new Survey();

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // --- CREATE ---

    public function testCreateAsAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateAsSuperAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testCreateAsGuestReturnsDenied(): void
    {
        $user = $this->createUser(1, ['ROLE_GUEST']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // --- EDIT ---

    public function testEditAsAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsSuperAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // --- DELETE ---

    public function testDeleteAsAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsSuperAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // --- VIEW_STATS ---

    public function testViewStatsAsAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewStatsAsSuperAdminReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewStatsAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewStatsWithoutUserReturnsDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);
        $survey = new Survey();

        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewStatsAsCoachOfAssignedTeamReturnsGranted(): void
    {
        $user = $this->createUser(1);
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(10);

        $survey = $this->createMock(Survey::class);
        $survey->method('getTeams')->willReturn(new ArrayCollection([$team]));
        $survey->method('getClubs')->willReturn(new ArrayCollection());

        $this->mockCoachOfTeamQuery(true);

        $token = $this->createToken($user);
        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewStatsAsCoachOfUnrelatedTeamReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(10);

        $survey = $this->createMock(Survey::class);
        $survey->method('getTeams')->willReturn(new ArrayCollection([$team]));
        $survey->method('getClubs')->willReturn(new ArrayCollection());

        $this->mockCoachOfTeamQuery(false);

        $token = $this->createToken($user);
        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewStatsAsCoachOfAssignedClubReturnsGranted(): void
    {
        $user = $this->createUser(1);
        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn(5);

        $survey = $this->createMock(Survey::class);
        $survey->method('getTeams')->willReturn(new ArrayCollection());
        $survey->method('getClubs')->willReturn(new ArrayCollection([$club]));

        $this->mockCoachOfClubQuery(true);

        $token = $this->createToken($user);
        $result = $this->voter->vote($token, $survey, [SurveyVoter::VIEW_STATS]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // --- Unsupported attribute ---

    public function testUnsupportedAttributeReturnsAbstain(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $survey = new Survey();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $survey, ['SOME_UNSUPPORTED_ATTR']);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    public function testUnsupportedSubjectReturnsAbstain(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, new stdClass(), [SurveyVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // --- Helpers ---

    /**
     * @param array<string> $roles
     */
    private function createUser(int $id, array $roles = ['ROLE_USER']): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }

    private function mockCoachOfTeamQuery(bool $found): void
    {
        $this->mockEntityManagerQuery(CoachTeamAssignment::class, $found);
    }

    private function mockCoachOfClubQuery(bool $found): void
    {
        $this->mockEntityManagerQuery(CoachClubAssignment::class, $found);
    }

    private function mockEntityManagerQuery(string $entityClass, bool $found): void
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

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('createQueryBuilder')->willReturn($qb);

        $this->entityManager->method('getRepository')
            ->with($entityClass)
            ->willReturn($repo);
    }
}
