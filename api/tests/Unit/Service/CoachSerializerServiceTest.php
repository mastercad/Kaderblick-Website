<?php

namespace App\Tests\Unit\Service;

use App\Entity\Coach;
use App\Security\Voter\CoachVoter;
use App\Service\CoachSerializerService;
use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;

#[AllowMockObjectsWithoutExpectations]
class CoachSerializerServiceTest extends TestCase
{
    private Security&MockObject $security;
    private CoachSerializerService $service;

    protected function setUp(): void
    {
        $this->security = $this->createMock(Security::class);
        $this->service = new CoachSerializerService($this->security);
    }

    // ─── Helper: minimal Coach mock ───────────────────────────────────────────

    private function makeCoach(int $id = 1): Coach&MockObject
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn($id);
        $coach->method('getFirstName')->willReturn('Thomas');
        $coach->method('getLastName')->willReturn('Müller');
        $coach->method('getEmail')->willReturn('thomas@example.com');
        $coach->method('getBirthdate')->willReturn(null);
        $coach->method('getCoachClubAssignments')->willReturn(new ArrayCollection());
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection());
        $coach->method('getCoachLicenseAssignments')->willReturn(new ArrayCollection());
        $coach->method('getCoachNationalityAssignments')->willReturn(new ArrayCollection());

        return $coach;
    }

    // ─── Structure ────────────────────────────────────────────────────────────

    public function testSerializeReturnsRequiredTopLevelKeys(): void
    {
        $coach = $this->makeCoach();
        $this->security->method('isGranted')->willReturn(false);

        $result = $this->service->serializeForCurrentUser($coach);

        foreach (
            ['id', 'firstName', 'lastName', 'email', 'birthdate',
                'clubAssignments', 'teamAssignments', 'licenseAssignments',
                'nationalityAssignments', 'permissions'] as $key
        ) {
            $this->assertArrayHasKey($key, $result, "Missing key: $key");
        }
    }

    public function testSerializeScalarFields(): void
    {
        $coach = $this->makeCoach(42);
        $this->security->method('isGranted')->willReturn(false);

        $result = $this->service->serializeForCurrentUser($coach);

        $this->assertSame(42, $result['id']);
        $this->assertSame('Thomas', $result['firstName']);
        $this->assertSame('Müller', $result['lastName']);
        $this->assertSame('thomas@example.com', $result['email']);
        $this->assertNull($result['birthdate']);
    }

    public function testSerializeEmptyCollectionsReturnArrays(): void
    {
        $coach = $this->makeCoach();
        $this->security->method('isGranted')->willReturn(false);

        $result = $this->service->serializeForCurrentUser($coach);

        $this->assertIsArray($result['clubAssignments']);
        $this->assertIsArray($result['teamAssignments']);
        $this->assertIsArray($result['licenseAssignments']);
        $this->assertIsArray($result['nationalityAssignments']);
        $this->assertEmpty($result['clubAssignments']);
        $this->assertEmpty($result['teamAssignments']);
    }

    // ─── Permissions ──────────────────────────────────────────────────────────

    public function testPermissionsAllGrantedWhenVoterGrantsAll(): void
    {
        $coach = $this->makeCoach();
        $this->security->method('isGranted')->willReturn(true);

        $result = $this->service->serializeForCurrentUser($coach);

        $this->assertTrue($result['permissions']['canView']);
        $this->assertTrue($result['permissions']['canEdit']);
        $this->assertTrue($result['permissions']['canCreate']);
        $this->assertTrue($result['permissions']['canDelete']);
    }

    public function testPermissionsAllDeniedWhenVoterDenieAll(): void
    {
        $coach = $this->makeCoach();
        $this->security->method('isGranted')->willReturn(false);

        $result = $this->service->serializeForCurrentUser($coach);

        $this->assertFalse($result['permissions']['canView']);
        $this->assertFalse($result['permissions']['canEdit']);
        $this->assertFalse($result['permissions']['canCreate']);
        $this->assertFalse($result['permissions']['canDelete']);
    }

    public function testPermissionsCallsVoterWithCorrectAttributes(): void
    {
        $coach = $this->makeCoach();

        $expectedAttributes = [
            CoachVoter::VIEW,
            CoachVoter::EDIT,
            CoachVoter::CREATE,
            CoachVoter::DELETE,
        ];

        $calledAttributes = [];
        $this->security->method('isGranted')
            ->willReturnCallback(function (string $attr) use (&$calledAttributes): bool {
                $calledAttributes[] = $attr;

                return false;
            });

        $this->service->serializeForCurrentUser($coach);

        foreach ($expectedAttributes as $attr) {
            $this->assertContains($attr, $calledAttributes, "Voter not called with $attr");
        }
    }

    public function testPermissionsStructureHasAllFourKeys(): void
    {
        $coach = $this->makeCoach();
        $this->security->method('isGranted')->willReturn(true);

        $perms = $this->service->serializeForCurrentUser($coach)['permissions'];

        $this->assertArrayHasKey('canView', $perms);
        $this->assertArrayHasKey('canEdit', $perms);
        $this->assertArrayHasKey('canCreate', $perms);
        $this->assertArrayHasKey('canDelete', $perms);
    }
}
