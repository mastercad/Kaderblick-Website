<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\PlayerVoter;
use App\Service\CoachTeamPlayerService;
use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class PlayerVoterTest extends TestCase
{
    /** @var MockObject&CoachTeamPlayerService */
    private CoachTeamPlayerService $coachTeamPlayerService;
    private PlayerVoter $voter;

    protected function setUp(): void
    {
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->voter = new PlayerVoter($this->coachTeamPlayerService);
    }

    // -------------------------------------------------------------------------
    // VIEW
    // -------------------------------------------------------------------------

    public function testViewAlwaysGrantedForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------

    public function testCreateGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService->expects($this->never())->method('collectCoachTeams');

        $result = $this->voter->vote($token, $player, [PlayerVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateGrantedForActiveCoach(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateDeniedForUserWithNoCoachTeams(): void
    {
        $user = $this->createUser(1);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // EDIT
    // -------------------------------------------------------------------------

    public function testEditGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditGrantedForCoachWhoseTeamContainsPlayer(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $player = $this->createPlayer(99, [10 => $team]);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForCoachWhoseTeamDoesNotContainPlayer(): void
    {
        $user = $this->createUser(1);
        $coachTeam = $this->createTeam(10);
        $otherTeam = $this->createTeam(20);
        $player = $this->createPlayer(99, [20 => $otherTeam]);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $coachTeam]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->willReturn([]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // DELETE
    // -------------------------------------------------------------------------

    public function testDeleteGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $player = $this->createPlayer(99, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $player, [PlayerVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteGrantedForCoachWhoseTeamContainsPlayer(): void
    {
        $user = $this->createUser(1);
        $team = $this->createTeam(10);
        $player = $this->createPlayer(99, [10 => $team]);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([10 => $team]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteDeniedForCoachWhoseTeamDoesNotContainPlayer(): void
    {
        $user = $this->createUser(1);
        $coachTeam = $this->createTeam(10);
        $otherTeam = $this->createTeam(20);
        $player = $this->createPlayer(99, [20 => $otherTeam]);
        $token = $this->createToken($user);

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->willReturn([10 => $coachTeam]);

        $result = $this->voter->vote($token, $player, [PlayerVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // Unauthenticated
    // -------------------------------------------------------------------------

    public function testDeniedForUnauthenticatedUser(): void
    {
        $player = $this->createPlayer(99, []);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $player, [PlayerVoter::EDIT]);

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

    /**
     * @param array<int, Team> $teams map of teamId => Team for which the player has assignments
     */
    private function createPlayer(int $id, array $teams): Player
    {
        $assignments = [];
        foreach ($teams as $teamId => $team) {
            $pta = $this->createMock(PlayerTeamAssignment::class);
            $pta->method('getTeam')->willReturn($team);
            $assignments[] = $pta;
        }

        $collection = new ArrayCollection($assignments);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn($id);
        $player->method('getPlayerTeamAssignments')->willReturn($collection);

        return $player;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
