<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Entity\UserXpEvent;
use App\Service\XPEventProcessor;
use App\Service\XPService;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class XPEventProcessorTest extends TestCase
{
    private EntityManagerInterface & MockObject $entityManager;
    private XPService & MockObject $xpService;
    /** @phpstan-var EntityRepository<UserXpEvent>&MockObject */
    private EntityRepository & MockObject $repository;
    private Connection & MockObject $connection;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->xpService = $this->createMock(XPService::class);
        $this->repository = $this->createMock(EntityRepository::class);
        $this->connection = $this->createMock(Connection::class);

        $this->entityManager
            ->method('getConnection')
            ->willReturn($this->connection);

        $this->connection
            ->method('transactional')
            ->willReturnCallback(function (callable $callback): mixed {
                return $callback();
            });

        $this->entityManager
            ->method('getRepository')
            ->with(UserXpEvent::class)
            ->willReturn($this->repository);

        $this->entityManager->method('lock');
        $this->entityManager->method('refresh');
    }

    public function testProcessPendingXpEventsAppliesStoredXpValueAndMarksProcessed(): void
    {
        $user = $this->createMock(User::class);
        $event = $this->createMock(UserXpEvent::class);

        $event->expects($this->once())
            ->method('getUser')
            ->willReturn($user);

        $event->expects($this->once())
            ->method('getXpValue')
            ->willReturn(25);

        $event->expects($this->once())
            ->method('setIsProcessed')
            ->with(true)
            ->willReturnSelf();

        $event->method('isProcessed')->willReturn(false);

        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([$event]);

        $this->xpService->expects($this->once())
            ->method('addXPToUser')
            ->with($user, 25, false);

        $this->entityManager->expects($this->once())
            ->method('persist')
            ->with($event);

        $this->entityManager->expects($this->once())
            ->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }

    public function testProcessPendingXpEventsHandlesMultipleValidEvents(): void
    {
        $userA = $this->createMock(User::class);
        $userB = $this->createMock(User::class);

        $eventA = $this->createMock(UserXpEvent::class);
        $eventA->method('getUser')->willReturn($userA);
        $eventA->method('getXpValue')->willReturn(10);
        $eventA->expects($this->once())->method('setIsProcessed')->with(true)->willReturnSelf();
        $eventA->method('isProcessed')->willReturn(false);

        $eventB = $this->createMock(UserXpEvent::class);
        $eventB->method('getUser')->willReturn($userB);
        $eventB->method('getXpValue')->willReturn(20);
        $eventB->expects($this->once())->method('setIsProcessed')->with(true)->willReturnSelf();
        $eventB->method('isProcessed')->willReturn(false);

        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([$eventA, $eventB]);

        $this->xpService->expects($this->exactly(2))
            ->method('addXPToUser')
            ->with(
                $this->logicalOr($userA, $userB),
                $this->logicalOr(10, 20),
                false
            );

        $this->entityManager->expects($this->exactly(2))
            ->method('persist')
            ->with($this->logicalOr($eventA, $eventB));

        $this->entityManager->expects($this->once())->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }

    public function testProcessPendingXpEventsSkipsMalformedRowWhenUserIsMissing(): void
    {
        $event = $this->createMock(UserXpEvent::class);
        $event->expects($this->once())->method('getUser')->willReturn(null);
        $event->expects($this->once())->method('getXpValue')->willReturn(50);
        $event->expects($this->once())->method('setIsProcessed')->with(true)->willReturnSelf();
        $event->method('isProcessed')->willReturn(false);

        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([$event]);

        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->entityManager->expects($this->once())->method('persist')->with($event);
        $this->entityManager->expects($this->once())->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }

    public function testProcessPendingXpEventsSkipsNonPositiveXp(): void
    {
        $user = $this->createMock(User::class);
        $event = $this->createMock(UserXpEvent::class);
        $event->expects($this->once())->method('getUser')->willReturn($user);
        $event->expects($this->once())->method('getXpValue')->willReturn(0);
        $event->expects($this->once())->method('setIsProcessed')->with(true)->willReturnSelf();
        $event->method('isProcessed')->willReturn(false);

        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([$event]);

        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->entityManager->expects($this->once())->method('persist')->with($event);
        $this->entityManager->expects($this->once())->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }

    public function testProcessPendingXpEventsFlushesWhenNoEventsExist(): void
    {
        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([]);

        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }

    public function testProcessPendingXpEventsSkipsAlreadyProcessedEventAfterRefresh(): void
    {
        $event = $this->createMock(UserXpEvent::class);
        $event->method('isProcessed')->willReturn(true);

        $this->repository
            ->method('findBy')
            ->with(['isProcessed' => false])
            ->willReturn([$event]);

        $this->xpService->expects($this->never())->method('addXPToUser');
        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $processor = new XPEventProcessor($this->entityManager, $this->xpService);
        $processor->processPendingXpEvents();
    }
}
