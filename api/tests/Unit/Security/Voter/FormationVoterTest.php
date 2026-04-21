<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Formation;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\FormationVoter;
use App\Service\UserTeamAccessService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class FormationVoterTest extends TestCase
{
    private FormationVoter $voter;

    /** @var UserTeamAccessService&MockObject */
    private UserTeamAccessService $teamAccessService;

    protected function setUp(): void
    {
        $this->teamAccessService = $this->createMock(UserTeamAccessService::class);
        $this->voter = new FormationVoter($this->teamAccessService);
    }

    // ─── Anonymous user ───────────────────────────────────────────────────────

    public function testAnonymousUserIsDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $formation = $this->createFormationWithTeam($this->createTeam(1));

        $result = $this->voter->vote($token, $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── Admin always wins ────────────────────────────────────────────────────

    public function testAdminCanViewAnyFormation(): void
    {
        $admin = $this->createUser(99, ['ROLE_ADMIN']);
        $formation = $this->createFormationWithTeam($this->createTeam(1));

        $result = $this->voter->vote($this->createToken($admin), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testAdminCanEditAnyFormation(): void
    {
        $admin = $this->createUser(99, ['ROLE_ADMIN']);
        $formation = $this->createFormationWithTeam($this->createTeam(1));

        $result = $this->voter->vote($this->createToken($admin), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testAdminCanDeleteAnyFormation(): void
    {
        $admin = $this->createUser(99, ['ROLE_ADMIN']);
        $formation = $this->createFormationWithTeam($this->createTeam(1));

        $result = $this->voter->vote($this->createToken($admin), $formation, [FormationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testSuperadminCanEditAnyFormation(): void
    {
        $superadmin = $this->createUser(99, ['ROLE_SUPERADMIN']);
        $formation = $this->createFormationWithTeam($this->createTeam(1));

        $result = $this->voter->vote($this->createToken($superadmin), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── CREATE is always granted ─────────────────────────────────────────────

    public function testCreateIsAlwaysGrantedForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $formation = new Formation();

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ─── Formation WITH team – team-based access ──────────────────────────────

    public function testViewGrantedIfUserIsCoachOfFormationTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewDeniedIfUserIsNotCoachOfFormationTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        // User coaches a *different* team
        $otherTeam = $this->createTeam(99);
        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->with($user)
            ->willReturn([99 => $otherTeam]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewDeniedIfUserHasNoCoachTeamsAtAll(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditGrantedIfUserIsCoachOfFormationTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedIfUserIsNotCoachOfFormationTeam(): void
    {
        $user = $this->createUser(2);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteGrantedIfUserIsCoachOfFormationTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteDeniedIfUserIsNotCoachOfFormationTeam(): void
    {
        $user = $this->createUser(2);
        $team = $this->createTeam(10);
        $formation = $this->createFormationWithTeam($team);

        $this->teamAccessService
            ->method('getSelfCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── Formation WITHOUT team – legacy user-ID fallback ─────────────────────

    public function testViewGrantedForCreatorWhenNoTeamSet(): void
    {
        $user = $this->createUser(5);
        $formation = $this->createFormationWithoutTeam($user);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewDeniedForOtherUserWhenNoTeamSet(): void
    {
        $creator = $this->createUser(5);
        $otherUser = $this->createUser(9);
        $formation = $this->createFormationWithoutTeam($creator);

        $result = $this->voter->vote($this->createToken($otherUser), $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditGrantedForCreatorWhenNoTeamSet(): void
    {
        $user = $this->createUser(5);
        $formation = $this->createFormationWithoutTeam($user);

        $result = $this->voter->vote($this->createToken($user), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForOtherUserWhenNoTeamSet(): void
    {
        $creator = $this->createUser(5);
        $otherUser = $this->createUser(9);
        $formation = $this->createFormationWithoutTeam($creator);

        $result = $this->voter->vote($this->createToken($otherUser), $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── Unsupported subject is abstained ─────────────────────────────────────

    public function testVoteAbstainsForUnsupportedSubject(): void
    {
        $user = $this->createUser(1);
        $result = $this->voter->vote($this->createToken($user), new stdClass(), [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

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

    private function createTeam(int $id): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);

        return $team;
    }

    private function createFormationWithTeam(Team $team): Formation
    {
        $formation = $this->createMock(Formation::class);
        $formation->method('getTeam')->willReturn($team);

        return $formation;
    }

    private function createFormationWithoutTeam(User $creator): Formation
    {
        $formation = $this->createMock(Formation::class);
        $formation->method('getTeam')->willReturn(null);
        $formation->method('getUser')->willReturn($creator);

        return $formation;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
