<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\MessageGroup;
use App\Entity\User;
use App\Security\Voter\MessageGroupVoter;
use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class MessageGroupVoterTest extends TestCase
{
    private MessageGroupVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new MessageGroupVoter();
    }

    // ── VIEW ──────────────────────────────────────────────────────────────────

    public function testViewAsOwnerGrantsAccess(): void
    {
        $owner = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsMemberGrantsAccess(): void
    {
        $owner = $this->createUser();
        $member = $this->createUser();
        $group = $this->createGroup($owner, [$member]);
        $token = $this->createToken($member);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsNonMemberDeniesAccess(): void
    {
        $owner = $this->createUser();
        $nonMember = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($nonMember);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    // ── EDIT ──────────────────────────────────────────────────────────────────

    public function testEditAsOwnerGrantsAccess(): void
    {
        $owner = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsNonOwnerDeniesAccess(): void
    {
        $owner = $this->createUser();
        $other = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($other);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditAsAdminGrantsAccess(): void
    {
        $owner = $this->createUser();
        $admin = $this->createUser(['ROLE_ADMIN']);
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsSuperAdminGrantsAccess(): void
    {
        $owner = $this->createUser();
        $superAdmin = $this->createUser(['ROLE_SUPERADMIN']);
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($superAdmin);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::EDIT]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    public function testDeleteAsOwnerGrantsAccess(): void
    {
        $owner = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsNonOwnerDeniesAccess(): void
    {
        $owner = $this->createUser();
        $other = $this->createUser();
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($other);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteAsAdminGrantsAccess(): void
    {
        $owner = $this->createUser();
        $admin = $this->createUser(['ROLE_ADMIN']);
        $group = $this->createGroup($owner, []);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::DELETE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── CREATE ────────────────────────────────────────────────────────────────

    public function testCreateAlwaysGrantsAccessForAuthenticatedUser(): void
    {
        $user = $this->createUser();
        $group = $this->createGroup($user, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::CREATE]);

        $this->assertSame(VoterInterface::ACCESS_GRANTED, $result);
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    public function testNonUserTokenDeniesAccess(): void
    {
        $group = new MessageGroup();
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $group, [MessageGroupVoter::VIEW]);

        $this->assertSame(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testUnsupportedAttributeAbstainsFromVoting(): void
    {
        $user = $this->createUser();
        $group = $this->createGroup($user, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $group, ['UNSUPPORTED_ATTRIBUTE']);

        $this->assertSame(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @param string[] $roles */
    private function createUser(array $roles = ['ROLE_USER']): User
    {
        $user = $this->createMock(User::class);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    /** @param User[] $members */
    private function createGroup(User $owner, array $members): MessageGroup
    {
        $group = $this->createMock(MessageGroup::class);
        $group->method('getOwner')->willReturn($owner);
        $group->method('getMembers')->willReturn(new ArrayCollection($members));

        return $group;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
