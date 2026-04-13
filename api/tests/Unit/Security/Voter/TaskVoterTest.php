<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\Task;
use App\Entity\User;
use App\Security\Voter\TaskVoter;
use ArrayIterator;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class TaskVoterTest extends TestCase
{
    private TaskVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new TaskVoter();
    }

    public function testViewAsAssigneeReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(2, 1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsCreatorReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(1, 2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $task = $this->createTask(2, 3);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $task, [TaskVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewAsUnrelatedUserReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(2, 3);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditAsCreatorReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(1, 2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsAssigneeReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(2, 1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditAsAdminReturnsTrue(): void
    {
        $admin = $this->createUser(1, ['ROLE_ADMIN']);
        $task = $this->createTask(2, 3);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $task, [TaskVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsCreatorReturnsTrue(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(1, 2);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteAsAssigneeReturnsFalse(): void
    {
        $user = $this->createUser(1);
        $task = $this->createTask(2, 1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testCreateReturnsTrueForAuthenticatedUser(): void
    {
        $user = $this->createUser(1);
        $task = new Task();
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $task, [TaskVoter::CREATE]);

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

    private function createTask(int $createdById, int $assignedToId): Task
    {
        $createdBy = $this->createUser($createdById);
        $assignedTo = $this->createUser($assignedToId);

        $assignment = $this->createMock(\App\Entity\TaskAssignment::class);
        $assignment->method('getUser')->willReturn($assignedTo);

        $assignments = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $assignments->method('toArray')->willReturn([$assignment]);
        $assignments->method('getIterator')->willReturn(new ArrayIterator([$assignment]));

        $task = $this->createMock(Task::class);
        $task->method('getCreatedBy')->willReturn($createdBy);
        $task->method('getAssignments')->willReturn($assignments);

        return $task;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
