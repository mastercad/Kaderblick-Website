<?php

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Entity\UserLevel;
use App\Entity\XpRule;
use App\Repository\XpRuleRepository;
use App\Service\XPService;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class XPServiceTest extends TestCase
{
    public function testRetrieveXpForActionReturnsConfiguredRuleValue(): void
    {
        $xpRuleRepository = $this->createMock(XpRuleRepository::class);
        $xpRule = $this->createMock(XpRule::class);
        $xpRule->method('getXpValue')->willReturn(17);

        $xpRuleRepository->expects($this->once())
            ->method('findEnabledByActionType')
            ->with('daily_login')
            ->willReturn($xpRule);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $xpRuleRepository);

        $this->assertSame(17, $service->retrieveXPForAction('daily_login'));
    }

    public function testRetrieveXpForActionReturnsZeroWhenNoRuleExists(): void
    {
        $xpRuleRepository = $this->createMock(XpRuleRepository::class);
        $xpRuleRepository->expects($this->once())
            ->method('findEnabledByActionType')
            ->with('unknown_action')
            ->willReturn(null);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $xpRuleRepository);

        $this->assertSame(0, $service->retrieveXPForAction('unknown_action'));
    }

    public function testAddXpToUserCreatesLevelWhenMissingAndPersistsTwice(): void
    {
        $user = $this->createMock(User::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $this->prepareEntityManagerForXpWrites($entityManager);

        $user->method('getUserLevel')->willReturn(null);
        $user->expects($this->once())->method('setUserLevel')->with($this->isInstanceOf(UserLevel::class));

        $entityManager->expects($this->exactly(2))->method('persist');
        $entityManager->expects($this->once())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 100);
    }

    public function testAddXpToUserAddsXpWithoutLevelUpWhenThresholdNotReached(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $this->prepareEntityManagerForXpWrites($entityManager);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->method('getXpTotal')->willReturn(100);
        $userLevel->method('getLevel')->willReturn(3);
        $userLevel->expects($this->once())->method('setXpTotal')->with(110);
        $userLevel->expects($this->never())->method('setLevel');
        $userLevel->expects($this->atLeastOnce())->method('setUpdatedAt');

        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->once())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 10);
    }

    public function testAddXpToUserUpdatesLevelWhenThresholdIsReached(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $this->prepareEntityManagerForXpWrites($entityManager);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->method('getXpTotal')->willReturn(100);
        $userLevel->method('getLevel')->willReturn(1);
        $userLevel->expects($this->once())->method('setXpTotal')->with(600);
        $userLevel->expects($this->once())->method('setLevel')->with(5);
        $userLevel->expects($this->atLeastOnce())->method('setUpdatedAt');

        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->once())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 500);
    }

    public function testAddXpToUserDoesNotFlushWhenExplicitlyDeferred(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $this->prepareEntityManagerForXpWrites($entityManager);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->method('getXpTotal')->willReturn(50);
        $userLevel->method('getLevel')->willReturn(1);

        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->never())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 10, false);
    }

    public function testAddXpToUserUsesExistingTransactionWhenAlreadyActive(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $connection = $this->prepareEntityManagerForXpWrites($entityManager, true);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->method('getXpTotal')->willReturn(40);
        $userLevel->method('getLevel')->willReturn(1);

        $connection->expects($this->never())->method('transactional');
        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->once())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 5);
    }

    public function testAddXpToUserLocksAndRefreshesUserWhenLevelMissingButUserIdExists(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $this->prepareEntityManagerForXpWrites($entityManager);

        $user->method('getId')->willReturn(42);
        $user->expects($this->exactly(2))
            ->method('getUserLevel')
            ->willReturnOnConsecutiveCalls(null, $userLevel);

        $userLevel->method('getXpTotal')->willReturn(100);
        $userLevel->method('getLevel')->willReturn(1);

        $entityManager->expects($this->exactly(2))
            ->method('lock')
            ->with($this->logicalOr($user, $userLevel), $this->anything());
        $entityManager->expects($this->once())->method('refresh')->with($user);
        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->once())->method('flush');

        $service = new XPService($entityManager, $this->createMock(XpRuleRepository::class));
        $service->addXPToUser($user, 5);
    }

    public function testAddXpForActionCallsAddXpToUserWhenRuleValueIsPositive(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->buildPartialXpService();

        $service->expects($this->once())
            ->method('retrieveXPForAction')
            ->with('training_attended')
            ->willReturn(15);

        $service->expects($this->once())
            ->method('addXPToUser')
            ->with($user, 15);

        $service->addXpForAction($user, 'training_attended');
    }

    public function testAddXpForActionSkipsWhenRuleValueIsZeroOrNegative(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->buildPartialXpService();

        $service->expects($this->exactly(2))
            ->method('retrieveXPForAction')
            ->with($this->logicalOr('unknown_action', 'penalty'))
            ->willReturnOnConsecutiveCalls(0, -5);

        $service->expects($this->never())->method('addXPToUser');

        $service->addXpForAction($user, 'unknown_action');
        $service->addXpForAction($user, 'penalty');
    }

    public function testCalculateUserXpReturnsZeroWhenUserLevelMissing(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserLevel')->willReturn(null);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame(0, $service->calculateUserXP($user));
    }

    public function testCalculateUserXpReturnsStoredValue(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $userLevel->method('getXpTotal')->willReturn(345);
        $user->method('getUserLevel')->willReturn($userLevel);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame(345, $service->calculateUserXP($user));
    }

    public function testCalculateUserLevelReturnsOneWhenUserLevelMissing(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserLevel')->willReturn(null);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame(1, $service->calculateUserLevel($user));
    }

    public function testCalculateUserLevelReturnsStoredLevel(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $userLevel->method('getLevel')->willReturn(7);
        $user->method('getUserLevel')->willReturn($userLevel);

        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame(7, $service->calculateUserLevel($user));
    }

    public function testLevelUpUserIncrementsAndPersistsWhenThresholdReached(): void
    {
        $user = $this->createMock(User::class);
        $userLevel = $this->createMock(UserLevel::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);

        $user->method('getUserLevel')->willReturn($userLevel);
        $userLevel->expects($this->once())->method('setLevel')->with(3);
        $userLevel->expects($this->once())->method('setUpdatedAt');

        $entityManager->expects($this->once())->method('persist')->with($userLevel);
        $entityManager->expects($this->once())->method('flush');

        $service = $this->getMockBuilder(XPService::class)
            ->setConstructorArgs([$entityManager, $this->createMock(XpRuleRepository::class)])
            ->onlyMethods(['calculateUserXP', 'calculateUserLevel', 'retrieveXpForLevel'])
            ->getMock();

        $service->method('calculateUserXP')->willReturn(500);
        $service->method('calculateUserLevel')->willReturn(2);
        $service->method('retrieveXpForLevel')->with(3)->willReturn(400);

        $this->assertTrue($service->levelUpUser($user));
    }

    public function testLevelUpUserReturnsFalseWhenThresholdNotReached(): void
    {
        $user = $this->createMock(User::class);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects($this->never())->method('persist');
        $entityManager->expects($this->never())->method('flush');

        $service = $this->getMockBuilder(XPService::class)
            ->setConstructorArgs([$entityManager, $this->createMock(XpRuleRepository::class)])
            ->onlyMethods(['calculateUserXP', 'calculateUserLevel', 'retrieveXpForLevel'])
            ->getMock();

        $service->method('calculateUserXP')->willReturn(80);
        $service->method('calculateUserLevel')->willReturn(2);
        $service->method('retrieveXpForLevel')->with(3)->willReturn(400);

        $this->assertFalse($service->levelUpUser($user));
    }

    public function testRetrieveXpForLevelUsesExpectedFormula(): void
    {
        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame((int) round(50 * pow(4, 1.5)), $service->retrieveXpForLevel(4));
    }

    public function testRetrieveLevelForXpUsesExpectedFormula(): void
    {
        $service = new XPService($this->createMock(EntityManagerInterface::class), $this->createMock(XpRuleRepository::class));

        $this->assertSame((int) floor(pow(600 / 50, 1 / 1.5)), $service->retrieveLevelForXP(600));
    }

    private function buildPartialXpService(): XPService & MockObject
    {
        return $this->getMockBuilder(XPService::class)
            ->setConstructorArgs([
                $this->createMock(EntityManagerInterface::class),
                $this->createMock(XpRuleRepository::class),
            ])
            ->onlyMethods(['retrieveXPForAction', 'addXPToUser'])
            ->getMock();
    }

    private function prepareEntityManagerForXpWrites(
        EntityManagerInterface & MockObject $entityManager,
        bool $transactionActive = false
    ): Connection & MockObject {
        $connection = $this->createMock(Connection::class);
        $entityManager->method('getConnection')->willReturn($connection);
        $connection->method('isTransactionActive')->willReturn($transactionActive);
        $connection->method('transactional')
            ->willReturnCallback(function (callable $callback): mixed {
                return $callback();
            });

        $entityManager->method('lock');
        $entityManager->method('refresh');

        return $connection;
    }
}
