<?php

namespace App\Tests\Unit\Security\Voter;

use App\Entity\SurveyOption;
use App\Entity\User;
use App\Security\Voter\SurveyOptionVoter;
use ArrayIterator;
use Doctrine\Common\Collections\Collection;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

#[AllowMockObjectsWithoutExpectations]
class SurveyOptionVoterTest extends TestCase
{
    private SurveyOptionVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new SurveyOptionVoter();
    }

    // ========== VIEW ==========

    public function testViewSystemOptionAsAnyUserReturnsGranted(): void
    {
        $user = $this->createUser(1);
        $option = $this->createOption(null, false);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOwnOptionAsOwnerReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherUsersOptionWithoutQuestionsAsDenied(): void
    {
        $owner = $this->createUser(1);
        $otherUser = $this->createUser(2);
        $option = $this->createOption($owner, false); // Keine Fragen zugeordnet
        $token = $this->createToken($otherUser);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testViewOtherUsersOptionWithQuestionsReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $otherUser = $this->createUser(2);
        $option = $this->createOption($owner, true); // Hat Fragen-Zuordnung
        $token = $this->createToken($otherUser);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewOtherUsersOptionAsAdminReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testViewWithoutUserReturnsDenied(): void
    {
        $option = $this->createOption(null, false);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ========== CREATE ==========

    public function testCreateAsRegularUserReturnsGranted(): void
    {
        $user = $this->createUser(1);
        $option = $this->createOption($user, false);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateAsGuestReturnsGranted(): void
    {
        $user = $this->createUser(1, ['ROLE_GUEST']);
        $option = $this->createOption($user, false);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testCreateWithoutUserReturnsDenied(): void
    {
        $option = $this->createOption(null, false);
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::CREATE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ========== EDIT ==========

    public function testEditOwnOptionReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOtherUsersOptionReturnsDenied(): void
    {
        $owner = $this->createUser(1);
        $otherUser = $this->createUser(2);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($otherUser);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testEditOtherUsersOptionAsAdminReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditOtherUsersOptionAsSuperAdminReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $superAdmin = $this->createUser(2, ['ROLE_SUPERADMIN']);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($superAdmin);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testEditSystemOptionAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $option = $this->createOption(null, false); // System-Option
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::EDIT]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ========== DELETE ==========

    public function testDeleteOwnOptionReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($owner);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteOtherUsersOptionReturnsDenied(): void
    {
        $owner = $this->createUser(1);
        $otherUser = $this->createUser(2);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($otherUser);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    public function testDeleteOtherUsersOptionAsAdminReturnsGranted(): void
    {
        $owner = $this->createUser(1);
        $admin = $this->createUser(2, ['ROLE_ADMIN']);
        $option = $this->createOption($owner, false);
        $token = $this->createToken($admin);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_GRANTED, $result);
    }

    public function testDeleteSystemOptionAsRegularUserReturnsDenied(): void
    {
        $user = $this->createUser(1);
        $option = $this->createOption(null, false); // System-Option
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, [SurveyOptionVoter::DELETE]);

        $this->assertEquals(VoterInterface::ACCESS_DENIED, $result);
    }

    // ========== Unsupported ==========

    public function testUnsupportedAttributeReturnsAbstain(): void
    {
        $user = $this->createUser(1);
        $option = $this->createOption(null, false);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, $option, ['SOME_UNSUPPORTED_ATTR']);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    public function testUnsupportedSubjectReturnsAbstain(): void
    {
        $user = $this->createUser(1);
        $token = $this->createToken($user);

        $result = $this->voter->vote($token, new stdClass(), [SurveyOptionVoter::VIEW]);

        $this->assertEquals(VoterInterface::ACCESS_ABSTAIN, $result);
    }

    // ========== Helpers ==========

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

    private function createOption(?User $createdBy, bool $hasQuestions): SurveyOption
    {
        $questions = $this->createMock(Collection::class);
        $questions->method('count')->willReturn($hasQuestions ? 1 : 0);
        $questions->method('getIterator')->willReturn(new ArrayIterator([]));

        $option = $this->createMock(SurveyOption::class);
        $option->method('getCreatedBy')->willReturn($createdBy);
        $option->method('isSystemOption')->willReturn(null === $createdBy);
        $option->method('getQuestions')->willReturn($questions);

        return $option;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
