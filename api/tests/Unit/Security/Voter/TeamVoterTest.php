<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\TeamVoter;
use App\Service\CoachTeamPlayerService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class TeamVoterTest extends TestCase
{
    /** @var MockObject&CoachTeamPlayerService */
    private CoachTeamPlayerService $coachTeamPlayerService;
    private TeamVoter $voter;

    protected function setUp(): void
    {
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->voter = new TeamVoter($this->coachTeamPlayerService);
    }

    // -------------------------------------------------------------------------
    // VIEW
    // -------------------------------------------------------------------------

    public function testViewAlwaysGrantedForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------

    public function testCreateGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateDeniedForCoach(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        // Coach darf kein neues Team anlegen, nur bearbeiten
        $result = $this->voter->vote($token, $team, [TeamVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testCreateDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // EDIT
    // -------------------------------------------------------------------------

    public function testEditGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditGrantedForCoachOfThatTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForCoachOfDifferentTeam(): void
    {
        $user = $this->createUser(1);
        $coachTeam = $this->createTeam(10);
        $otherTeam = $this->createTeam(20);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $coachTeam]);

        $result = $this->voter->vote($token, $otherTeam, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditDeniedForCoachWithNoActiveTeams(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // DELETE
    // -------------------------------------------------------------------------

    public function testDeleteGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $team, [TeamVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteGrantedForCoachOfThatTeam(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($token, $team, [TeamVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteDeniedForCoachOfDifferentTeam(): void
    {
        $user = $this->createUser(1);
        $coachTeam = $this->createTeam(10);
        $otherTeam = $this->createTeam(20);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->willReturn([10 => $coachTeam]);

        $result = $this->voter->vote($token, $otherTeam, [TeamVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // SuperAdmin overrides all
    // -------------------------------------------------------------------------

    public function testSuperAdminCanDoAllActions(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $team = $this->createTeam(10);
        $token = $this->createToken($user);

        foreach ([TeamVoter::VIEW, TeamVoter::CREATE, TeamVoter::EDIT, TeamVoter::DELETE] as $action) {
            $result = $this->voter->vote($token, $team, [$action]);
            $this->assertEquals(
                VoterInterface::ACCESS_GRANTED,
                $result,
                "SuperAdmin should be granted for action: $action"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Unauthenticated
    // -------------------------------------------------------------------------

    public function testDeniedForUnauthenticatedUser(): void
    {
        $team = $this->createTeam(10);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $team, [TeamVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @param array<string> $roles */
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

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
