<?php

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Repository\UserClubSupporterAssignmentRepository;
use App\Repository\UserTeamSupporterAssignmentRepository;
use App\Service\SupporterScopeService;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class SupporterScopeServiceTest extends TestCase
{
    private SupporterScopeService $service;
    /** @var UserTeamSupporterAssignmentRepository&MockObject */
    private UserTeamSupporterAssignmentRepository $teamAssignments;
    /** @var UserClubSupporterAssignmentRepository&MockObject */
    private UserClubSupporterAssignmentRepository $clubAssignments;

    protected function setUp(): void
    {
        $this->teamAssignments = $this->createMock(UserTeamSupporterAssignmentRepository::class);
        $this->clubAssignments = $this->createMock(UserClubSupporterAssignmentRepository::class);
        $this->service = new SupporterScopeService($this->teamAssignments, $this->clubAssignments);
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testActiveScopeAddsSupporterMarker(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);

        $this->service->synchronizeRole($user, 1, 0);

        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER'], $user->getRoles());
    }

    #[AllowMockObjectsWithoutExpectations]
    public function testRemovingLastScopeRemovesSupporterMarkerOnly(): void
    {
        $user = (new User())->setRoles(['ROLE_USER', 'ROLE_SUPPORTER', 'ROLE_TEAM_ADMIN']);

        $this->service->synchronizeRole($user, 0, 0);

        self::assertSame(['ROLE_USER', 'ROLE_TEAM_ADMIN'], $user->getRoles());
    }

    public function testSynchronizationUsesOnlyAssignmentsActiveOnRequestedDate(): void
    {
        $user = (new User())->setRoles(['ROLE_USER']);
        $date = new DateTimeImmutable('2026-08-01');
        $this->teamAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(0);
        $this->clubAssignments->expects(self::once())->method('countActiveForUser')->with($user, $date)->willReturn(1);

        $this->service->synchronizeRoleFromAssignments($user, $date);

        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER'], $user->getRoles());
    }
}
