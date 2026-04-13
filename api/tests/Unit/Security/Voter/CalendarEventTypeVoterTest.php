<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\CalendarEventType;
use App\Entity\User;
use App\Security\Voter\CalendarEventTypeVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class CalendarEventTypeVoterTest extends TestCase
{
    private CalendarEventTypeVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new CalendarEventTypeVoter();
    }

    public function testViewReturnsTrueForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $eventType = new CalendarEventType();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsTrueForAdmin(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $eventType = new CalendarEventType();
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsFalseForRegularUser(): void
    {
        $user = $this->createUser(1);
        $eventType = new CalendarEventType();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditReturnsTrueForAdmin(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $eventType = new CalendarEventType();
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditReturnsFalseForRegularUser(): void
    {
        $user = $this->createUser(1);
        $eventType = new CalendarEventType();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteReturnsTrueForSuperAdmin(): void
    {
        $superAdmin = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $eventType = new CalendarEventType();
        $token = $this->createToken($superAdmin);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteReturnsTrueForAdmin(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $eventType = new CalendarEventType();
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteReturnsFalseForRegularUser(): void
    {
        $user = $this->createUser(1);
        $eventType = new CalendarEventType();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $eventType, [CalendarEventTypeVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
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

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
