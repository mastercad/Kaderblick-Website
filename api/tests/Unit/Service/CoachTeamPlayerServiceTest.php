<?php

namespace App\Tests\Unit\Service;

use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use App\Service\UserTeamAccessService;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\TestCase;

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
    // Helpers
    // =========================================================================

    private function createTeam(int $id): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);

        return $team;
    }
}
