<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Notification;
use App\Entity\User;
use App\Security\Voter\NotificationVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class NotificationVoterTest extends TestCase
{
    private NotificationVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new NotificationVoter();
    }

    public function testViewOwnNotificationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $notification = $this->createNotification(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherNotificationReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $notification = $this->createNotification(2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditOwnNotificationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $notification = $this->createNotification(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOtherNotificationReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $notification = $this->createNotification(2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteOwnNotificationReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $notification = $this->createNotification(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $notification = $this->createNotification(2);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsTrueForAdmin(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $notification = new Notification();
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsFalseForRegularUser(): void
    {
        $user = $this->createUser(1);
        $notification = new Notification();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $notification, [NotificationVoter::CREATE]);

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

    private function createNotification(int $userId): Notification
    {
        $user = $this->createUser($userId);

        $notification = $this->createMock(Notification::class);
        $notification->method('getUser')->willReturn($user);

        return $notification;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
