<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Game;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\MatchPlanVoter;
use App\Service\CoachTeamPlayerService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class MatchPlanVoterTest extends TestCase
{
    /** @var MockObject&CoachTeamPlayerService */
    private CoachTeamPlayerService $coachTeamPlayerService;
    private MatchPlanVoter $voter;

    protected function setUp(): void
    {
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->voter = new MatchPlanVoter($this->coachTeamPlayerService);
    }

    public function testManageGrantedForAdmin(): void
    {
        $user = $this->createUser(['ROLE_ADMIN']);
        $game = $this->createGame();

        $result = $this->voter->vote($this->createToken($user), $game, [MatchPlanVoter::MANAGE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testPublishGrantedForCoachOfParticipatingTeam(): void
    {
        $user = $this->createUser();
        $homeTeam = $this->createTeam(1);
        $game = $this->createGame($homeTeam, $this->createTeam(2));

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([$homeTeam]);

        $result = $this->voter->vote($this->createToken($user), $game, [MatchPlanVoter::PUBLISH]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewGrantedForPlayerOfPublishedSelectedTeam(): void
    {
        $user = $this->createUser();
        $playerTeam = $this->createTeam(9);
        $game = $this->createGame(
            $this->createTeam(1),
            $this->createTeam(2),
            ['published' => true, 'selectedTeamId' => 9]
        );

        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn([]);

        $this->coachTeamPlayerService
            ->method('collectPlayerTeams')
            ->with($user)
            ->willReturn([$playerTeam]);

        $result = $this->voter->vote($this->createToken($user), $game, [MatchPlanVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewDeniedForUnpublishedPlan(): void
    {
        $user = $this->createUser();
        $playerTeam = $this->createTeam(9);
        $game = $this->createGame(
            $this->createTeam(1),
            $this->createTeam(2),
            ['published' => false, 'selectedTeamId' => 9]
        );

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);
        $this->coachTeamPlayerService->method('collectPlayerTeams')->willReturn([$playerTeam]);

        $result = $this->voter->vote($this->createToken($user), $game, [MatchPlanVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewDeniedForPlayerOfDifferentTeam(): void
    {
        $user = $this->createUser();
        $playerTeam = $this->createTeam(11);
        $game = $this->createGame(
            $this->createTeam(1),
            $this->createTeam(2),
            ['published' => true, 'selectedTeamId' => 9]
        );

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);
        $this->coachTeamPlayerService->method('collectPlayerTeams')->willReturn([$playerTeam]);

        $result = $this->voter->vote($this->createToken($user), $game, [MatchPlanVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    /**
     * @param string[] $roles
     */
    private function createUser(array $roles = ['ROLE_USER']): User
    {
        $user = $this->createMock(User::class);
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
     * @param array<string, mixed>|null $matchPlan
     */
    private function createGame(?Team $homeTeam = null, ?Team $awayTeam = null, ?array $matchPlan = null): Game
    {
        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn($homeTeam ?? $this->createTeam(1));
        $game->method('getAwayTeam')->willReturn($awayTeam ?? $this->createTeam(2));
        $game->method('getMatchPlan')->willReturn($matchPlan);

        return $game;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
