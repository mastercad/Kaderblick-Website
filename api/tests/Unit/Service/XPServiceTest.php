<?php

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Entity\UserLevel;
use App\Repository\XpRuleRepository;
use App\Service\XPService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class XPServiceTest extends TestCase
{
    public function testAddXPToUserCreatesUserLevelAndAddsXP(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $em = $this->createMock(EntityManagerInterface::class);

        $user->method('getUserLevel')->willReturn(null);
        $user->expects($this->once())->method('setUserLevel');
        $em->expects($this->atLeastOnce())->method('persist');
        $em->expects($this->once())->method('flush');
        $xpRuleRepository = $this->createMock(XpRuleRepository::class);

        $service = new XPService($em, $xpRuleRepository);
        $service->addXPToUser($user, 100);
    }

    public function testAddXPToUserAddsXPToExistingUserLevel(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $em = $this->createMock(EntityManagerInterface::class);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->method('getXpTotal')->willReturn(50);
        $userLevel->method('getLevel')->willReturn(1);
        $userLevel->expects($this->once())->method('setXpTotal')->with(150);
        $userLevel->expects($this->once())->method('setLevel');
        $userLevel->expects($this->atLeastOnce())->method('setUpdatedAt');
        $em->expects($this->atLeastOnce())->method('persist');
        $em->expects($this->once())->method('flush');
        $xpRuleRepository = $this->createMock(XpRuleRepository::class);

        $service = new XPService($em, $xpRuleRepository);
        $service->addXPToUser($user, 100);
    }
}
