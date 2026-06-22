<?php

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Repository\UserClubAdminAssignmentRepository;
use App\Repository\UserTeamAdminAssignmentRepository;
use App\Service\AdminScopeService;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class AdminScopeServiceTest extends TestCase
{
    private AdminScopeService $service;
    /** @var UserTeamAdminAssignmentRepository&MockObject */
    private UserTeamAdminAssignmentRepository $teamAssignments;
    /** @var UserClubAdminAssignmentRepository&MockObject */
    private UserClubAdminAssignmentRepository $clubAssignments;

    protected function setUp(): void
    {
        $this->teamAssignments = $this->createMock(UserTeamAdminAssignmentRepository::class);
        $this->clubAssignments = $this->createMock(UserClubAdminAssignmentRepository::class);
        $this->service = new AdminScopeService($this->teamAssignments, $this->clubAssignments);
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testTeamAssignmentPromotesUserAndRemembersBaseRole(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER']);

        $this->service->synchronizeRole($user, 1, 0);

        self::assertSame('ROLE_TEAM_ADMIN', $user->getRole());
        self::assertSame('ROLE_SUPPORTER', $user->getRoleBeforeScopedAdmin());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testClubAssignmentHasPrecedenceOverTeamAssignment(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);

        $this->service->synchronizeRole($user, 2, 1);

        self::assertSame('ROLE_CLUB_ADMIN', $user->getRole());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testRemovingLastScopeRestoresPreviousRole(): void
    {
        $user = (new User())
            ->setRoles(['ROLE_TEAM_ADMIN'])
            ->setRoleBeforeScopedAdmin('ROLE_SUPPORTER');

        $this->service->synchronizeRole($user, 0, 0);

        self::assertSame('ROLE_SUPPORTER', $user->getRole());
        self::assertNull($user->getRoleBeforeScopedAdmin());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testPlatformAdminRoleIsNeverChangedByScopes(): void
    {
        $user = (new User())->setRoles(['ROLE_ADMIN']);

        $this->service->synchronizeRole($user, 1, 1);

        self::assertSame('ROLE_ADMIN', $user->getRole());
        self::assertNull($user->getRoleBeforeScopedAdmin());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testChangingBaseRoleDoesNotRemoveActiveScopedAdminRole(): void
    {
        $user = (new User())
            ->setRoles(['ROLE_TEAM_ADMIN'])
            ->setRoleBeforeScopedAdmin('ROLE_USER');

        $user->setBaseRole('ROLE_SUPPORTER');

        self::assertSame('ROLE_TEAM_ADMIN', $user->getRole());
        self::assertSame('ROLE_SUPPORTER', $user->getRoleBeforeScopedAdmin());
    }

    public function testSynchronizationUsesOnlyAssignmentsActiveOnRequestedDate(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);
        $date = new DateTimeImmutable('2026-08-01');
        $this->teamAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(0);
        $this->clubAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(1);

        $this->service->synchronizeRoleFromAssignments($user, $date);

        self::assertSame('ROLE_CLUB_ADMIN', $user->getRole());
    }
}
