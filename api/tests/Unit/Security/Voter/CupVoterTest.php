<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Cup;
use App\Entity\User;
use App\Security\Voter\CupVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class CupVoterTest extends TestCase
{
    private CupVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new CupVoter();
    }

    // -------------------------------------------------------------------------
    // VIEW — every authenticated user
    // -------------------------------------------------------------------------

    public function testViewGrantedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------

    public function testCreateGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // EDIT
    // -------------------------------------------------------------------------

    public function testEditGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // DELETE
    // -------------------------------------------------------------------------

    public function testDeleteGrantedForAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteGrantedForSuperAdmin(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteDeniedForRegularUser(): void
    {
        $user = $this->createUser(1);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, [CupVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // -------------------------------------------------------------------------
    // Unauthenticated
    // -------------------------------------------------------------------------

    public function testDeniedForUnauthenticatedUser(): void
    {
        $cup = $this->createCup(10);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        foreach ([CupVoter::VIEW, CupVoter::CREATE, CupVoter::EDIT, CupVoter::DELETE] as $attribute) {
            $result = $this->voter->vote($token, $cup, [$attribute]);
            $this->assertEquals(
                VoterInterface::ACCESS_DENIED,
                $result,
                "Unauthenticated user should be denied for: $attribute"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Unsupported subject/attribute → abstain
    // -------------------------------------------------------------------------

    public function testAbstainsForUnsupportedSubject(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, new stdClass(), [CupVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    public function testAbstainsForUnknownAttribute(): void
    {
        $user = $this->createUser(1, ['ROLE_ADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $cup, ['UNKNOWN_ACTION']);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // -------------------------------------------------------------------------
    // SuperAdmin covers all attributes
    // -------------------------------------------------------------------------

    public function testSuperAdminCanDoAllActions(): void
    {
        $user = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $cup = $this->createCup(10);
        $token = $this->createToken($user);

        foreach ([CupVoter::VIEW, CupVoter::CREATE, CupVoter::EDIT, CupVoter::DELETE] as $attribute) {
            $result = $this->voter->vote($token, $cup, [$attribute]);
            $this->assertEquals(
                VoterInterface::ACCESS_GRANTED,
                $result,
                "SuperAdmin should be granted for: $attribute"
            );
        }
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

    private function createCup(int $id): Cup
    {
        $cup = $this->createMock(Cup::class);
        $cup->method('getId')->willReturn($id);

        return $cup;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
