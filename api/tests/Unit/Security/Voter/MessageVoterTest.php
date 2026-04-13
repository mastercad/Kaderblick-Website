<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Message;
use App\Entity\User;
use App\Security\Voter\MessageVoter;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class MessageVoterTest extends TestCase
{
    private MessageVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new MessageVoter();
    }

    public function testViewAsRecipientReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $message = $this->createMessage(2, [$user]);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsSenderReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $message = $this->createMessage(1, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsUnrelatedUserReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $otherUser = $this->createUser(2);
        $message = $this->createMessage(3, [$otherUser]);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditAsSenderReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $message = $this->createMessage(1, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsRecipientReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $message = $this->createMessage(2, [$user]);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteAsSenderReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $message = $this->createMessage(1, []);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $message = $this->createMessage(2, []);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $message, [MessageVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateReturnsTrueForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $message = new Message();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $message, [MessageVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsSuperAdminReturnsTrue(): void
    {
        $superAdmin = $this->createUser(1, ['ROLE_SUPERADMIN']);
        $message = $this->createMessage(2, []);
        $token = $this->createToken($superAdmin);

        $result = $this->voter->vote($token, $message, [MessageVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testVoteReturnsDeniedWhenTokenUserIsNotUserInstance(): void
    {
        $message = $this->createMessage(1, []);

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $message, [MessageVoter::VIEW]);

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

    /**
     * @param array<User> $recipients
     */
    private function createMessage(int $senderId, array $recipients): Message
    {
        $sender = $this->createUser($senderId);

        $message = $this->createMock(Message::class);
        $message->method('getSender')->willReturn($sender);

        $recipientCollection = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $recipientCollection->method('contains')
            ->willReturnCallback(function ($user) use ($recipients) {
                foreach ($recipients as $recipient) {
                    if ($recipient->getId() === $user->getId()) {
                        return true;
                    }
                }

                return false;
            });

        $message->method('getRecipients')->willReturn($recipientCollection);

        return $message;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
