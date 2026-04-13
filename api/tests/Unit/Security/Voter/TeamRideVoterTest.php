<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\CalendarEvent;
use App\Entity\TeamRide;
use App\Entity\User;
use App\Security\Voter\TeamRideVoter;
use App\Service\TeamMembershipService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

/**
 * Unit tests for TeamRideVoter.
 *
 * Exercises all attribute/subject combinations via a mocked TeamMembershipService.
 */
#[AllowMockObjectsWithoutExpectations]
class TeamRideVoterTest extends TestCase
{
    private TeamMembershipService&MockObject $membershipService;
    private TeamRideVoter $voter;

    protected function setUp(): void
    {
        $this->membershipService = $this->createMock(TeamMembershipService::class);
        $this->voter = new TeamRideVoter($this->membershipService);
    }

    // ─── VIEW ────────────────────────────────────────────────────────────────

    public function testViewGrantedForTeamMember(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(true);

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::VIEW);
    }

    public function testViewDeniedForNonTeamMember(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(false);

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::VIEW);
    }

    public function testViewGrantedForSuperadmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->expects($this->never())->method('isUserTeamMemberForEvent');

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::VIEW);
    }

    public function testViewDeniedWhenUnauthenticated(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);
        $ride = $this->createRide(99, $this->createCalendarEvent());

        $result = $this->voter->vote($token, $ride, [TeamRideVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    // ─── CREATE ──────────────────────────────────────────────────────────────

    public function testCreateGrantedForTeamMember(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(true);

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::CREATE);
    }

    public function testCreateDeniedForNonTeamMember(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(false);

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::CREATE);
    }

    public function testCreateGrantedForSuperadmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::CREATE);
    }

    // ─── EDIT ────────────────────────────────────────────────────────────────

    public function testEditGrantedForDriver(): void
    {
        $user = $this->createUser(5);
        $ride = $this->createRide(driverId: 5, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::EDIT);
    }

    public function testEditGrantedForAdminWhoIsTeamMember(): void
    {
        $user = $this->createUser(7, ['ROLE_ADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(true);

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::EDIT);
    }

    public function testEditDeniedForAdminWhoIsNotTeamMember(): void
    {
        $user = $this->createUser(7, ['ROLE_ADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(false);

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::EDIT);
    }

    public function testEditDeniedForRegularUserWhoIsNotDriver(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::EDIT);
    }

    public function testEditGrantedForSuperadmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::EDIT);
    }

    // ─── DELETE ──────────────────────────────────────────────────────────────

    public function testDeleteGrantedForDriver(): void
    {
        $user = $this->createUser(5);
        $ride = $this->createRide(driverId: 5, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::DELETE);
    }

    public function testDeleteGrantedForAdminTeamMember(): void
    {
        $user = $this->createUser(7, ['ROLE_ADMIN']);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(true);

        $this->assertVote(VoterInterface::ACCESS_GRANTED, $user, $ride, TeamRideVoter::DELETE);
    }

    public function testDeleteDeniedForRegularNonDriverUser(): void
    {
        $user = $this->createUser(1);
        $ride = $this->createRide(driverId: 99, event: $this->createCalendarEvent());

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::DELETE);
    }

    // ─── Abstain on unsupported subject ──────────────────────────────────────

    public function testAbstainsOnNonTeamRideSubject(): void
    {
        $user = $this->createUser(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, new stdClass(), [TeamRideVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // ─── EventLess TeamRide (edge-case: no CalendarEvent set) ────────────────

    public function testViewDeniedWhenRideHasNoEvent(): void
    {
        $user = $this->createUser(1);
        // TeamRide with no event → isUserTeamMemberForRide returns false
        $ride = $this->createRide(driverId: 99, event: null);
        $this->membershipService->expects($this->never())->method('isUserTeamMemberForEvent');

        $this->assertVote(VoterInterface::ACCESS_DENIED, $user, $ride, TeamRideVoter::VIEW);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * @param string[] $roles
     */
    private function createUser(int $id, array $roles = ['ROLE_USER']): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    private function createCalendarEvent(): CalendarEvent&MockObject
    {
        return $this->createMock(CalendarEvent::class);
    }

    private function createRide(int $driverId, ?CalendarEvent $event): TeamRide&MockObject
    {
        $driver = $this->createMock(User::class);
        $driver->method('getId')->willReturn($driverId);

        $ride = $this->createMock(TeamRide::class);
        $ride->method('getDriver')->willReturn($driver);
        $ride->method('getEvent')->willReturn($event);

        return $ride;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }

    private function assertVote(int $expected, User $user, TeamRide $ride, string $attribute): void
    {
        $token = $this->createToken($user);
        $result = $this->voter->vote($token, $ride, [$attribute]);
        $this->assertSame($expected, $result, sprintf(
            'Expected %s for attribute %s',
            VoterInterface::ACCESS_GRANTED === $expected ? 'GRANTED' : (VoterInterface::ACCESS_DENIED === $expected ? 'DENIED' : 'ABSTAIN'),
            $attribute,
        ));
    }
}
