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
    public function testTeamAssignmentAddsTeamAdminMarker(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPPORTER']);

        $this->service->synchronizeRole($user, 1, 0);

        self::assertSame(['ROLE_SUPPORTER', 'ROLE_TEAM_ADMIN'], $user->getRoles());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testClubAndTeamAssignmentsCanCoexist(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);

        $this->service->synchronizeRole($user, 2, 1);

        self::assertSame(['ROLE_USER', 'ROLE_TEAM_ADMIN', 'ROLE_CLUB_ADMIN'], $user->getRoles());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testRemovingScopesRemovesAdminMarkersOnly(): void
    {
        $user = (new User())
            ->setRoles(['ROLE_USER', 'ROLE_SUPPORTER', 'ROLE_TEAM_ADMIN', 'ROLE_CLUB_ADMIN']);

        $this->service->synchronizeRole($user, 0, 0);

        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER'], $user->getRoles());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testPlatformAdminRoleIsNeverChangedByScopes(): void
    {
        $user = (new User())->setRoles(['ROLE_SUPERADMIN']);

        $this->service->synchronizeRole($user, 1, 1);

        self::assertSame(['ROLE_SUPERADMIN'], $user->getRoles());
        self::assertNull($user->getRoleBeforeScopedAdmin());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testChangingBaseRoleDoesNotRemoveActiveScopedAdminRole(): void
    {
        $user = (new User())
            ->setRoles(['ROLE_USER', 'ROLE_TEAM_ADMIN'])
            ->setRoleBeforeScopedAdmin('ROLE_USER');

        $user->setBaseRole('ROLE_USER');

        self::assertSame(['ROLE_USER', 'ROLE_TEAM_ADMIN'], $user->getRoles());
    }

    public function testSynchronizationUsesOnlyAssignmentsActiveOnRequestedDate(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);
        $date = new DateTimeImmutable('2026-08-01');
        $this->teamAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(0);
        $this->clubAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(1);

        $this->service->synchronizeRoleFromAssignments($user, $date);

        self::assertSame(['ROLE_USER', 'ROLE_CLUB_ADMIN'], $user->getRoles());
    }
}
