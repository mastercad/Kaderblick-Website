<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Formation;
use App\Entity\User;
use App\Security\Voter\FormationVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class FormationVoterTest extends TestCase
{
    private FormationVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new FormationVoter();
    }

    public function testViewOwnFormationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $formation = $this->createFormation(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherFormationReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $formation = $this->createFormation(2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $formation = $this->createFormation(2);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $formation, [FormationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOwnFormationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $formation = $this->createFormation(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOtherFormationReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $formation = $this->createFormation(2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $formation = $this->createFormation(2);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $formation, [FormationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteOwnFormationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $formation = $this->createFormation(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $formation = $this->createFormation(2);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $formation, [FormationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsTrueForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $formation = new Formation();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $formation, [FormationVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

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

    private function createFormation(int $userId): Formation
    {
        $user = $this->createUser($userId);

        $formation = $this->createMock(Formation::class);
        $formation->method('getUser')->willReturn($user);

        return $formation;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
