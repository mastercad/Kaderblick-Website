<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\ReportDefinition;
use App\Entity\User;
use App\Security\Voter\ReportVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class ReportVoterTest extends TestCase
{
    private ReportVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new ReportVoter();
    }

    // ── VIEW ──────────────────────────────────────────────────────────

    public function testViewTemplateGrantedForAnyUser(): void
    {
        $user = $this->createUser(1);
        $report = $this->createReport(null, true);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOwnReportGranted(): void
    {
        $owner = $this->createUser(1);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherUsersReportDenied(): void
    {
        $owner = $this->createUser(1);
        $stranger = $this->createUser(2);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($stranger);

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewOtherUsersReportGrantedForAdmin(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherUsersReportGrantedForSuperadmin(): void
    {
        $owner = $this->createUser(1);
        $superadmin = $this->createUser(2, ['ROLE_SUPERADMIN']);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($superadmin);

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── EDIT ──────────────────────────────────────────────────────────

    public function testEditOwnReportGranted(): void
    {
        $owner = $this->createUser(1);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $report, [ReportVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOtherUsersReportDenied(): void
    {
        $owner = $this->createUser(1);
        $stranger = $this->createUser(2);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($stranger);

        $result = $this->voter->vote($token, $report, [ReportVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditOtherUsersReportGrantedForAdmin(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $report, [ReportVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── DELETE ─────────────────────────────────────────────────────────

    public function testDeleteOwnReportGranted(): void
    {
        $owner = $this->createUser(1);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $report, [ReportVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteOtherUsersReportDenied(): void
    {
        $owner = $this->createUser(1);
        $stranger = $this->createUser(2);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($stranger);

        $result = $this->voter->vote($token, $report, [ReportVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteOtherUsersReportGrantedForAdmin(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $report = $this->createReport($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $report, [ReportVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── CREATE ─────────────────────────────────────────────────────────

    public function testCreateGrantedForAnyAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $report = new ReportDefinition();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $report, [ReportVoter::CREATE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── UNAUTHENTICATED ────────────────────────────────────────────────

    public function testDeniedForUnauthenticatedUser(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $report = new ReportDefinition();

        $result = $this->voter->vote($token, $report, [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    // ── UNSUPPORTED ATTRIBUTE ──────────────────────────────────────────

    public function testAbstainsOnUnsupportedAttribute(): void
    {
        $user = $this->createUser(1);
        $report = new ReportDefinition();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $report, ['SOME_OTHER_ATTRIBUTE']);

        $this->assertSame(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    public function testAbstainsOnWrongSubject(): void
    {
        $user = $this->createUser(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, new stdClass(), [ReportVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // ── Helpers ────────────────────────────────────────────────────────

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

    private function createReport(?User $user, bool $isTemplate): ReportDefinition
    {
        $report = $this->createMock(ReportDefinition::class);
        $report->method('getUser')->willReturn($user);
        $report->method('isTemplate')->willReturn($isTemplate);

        return $report;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
