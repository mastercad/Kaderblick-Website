<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Entity\UserXpEvent;
use App\Entity\XpRule;
use App\Repository\XpRuleRepository;
use App\Service\XPRegistrationService;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class XPRegistrationServiceTest extends TestCase
{
    private EntityManagerInterface & MockObject $entityManager;
    private XpRuleRepository & MockObject $xpRuleRepository;
    /** @phpstan-var EntityRepository<UserXpEvent>&MockObject */
    private EntityRepository & MockObject $eventRepository;
    private Connection & MockObject $connection;
    private XPRegistrationService $service;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->xpRuleRepository = $this->createMock(XpRuleRepository::class);
        $this->eventRepository = $this->createMock(EntityRepository::class);
        $this->connection = $this->createMock(Connection::class);

        $this->entityManager->method('getConnection')->willReturn($this->connection);
        $this->connection->method('transactional')
            ->willReturnCallback(function (callable $callback): mixed {
                return $callback();
            });

        $this->entityManager->method('lock');

        $this->entityManager->method('getRepository')
            ->with(UserXpEvent::class)
            ->willReturn($this->eventRepository);

        $this->service = new XPRegistrationService($this->entityManager, $this->xpRuleRepository);
    }

    public function testRegisterXpEventSkipsWhenNoRuleExists(): void
    {
        $user = $this->createMock(User::class);

        $this->xpRuleRepository->expects($this->once())
            ->method('findEnabledByActionType')
            ->with('daily_login')
            ->willReturn(null);

        $this->entityManager->expects($this->never())->method('getRepository');
        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->service->registerXpEvent($user, 'daily_login', 42);
    }

    public function testRegisterXpEventLocksUserWhenIdExists(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);

        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $this->entityManager->expects($this->once())
            ->method('lock')
            ->with($user, LockMode::PESSIMISTIC_WRITE);

        $this->entityManager->expects($this->once())->method('persist')->with($this->isInstanceOf(UserXpEvent::class));
        $this->entityManager->expects($this->once())->method('flush');

        $this->service->registerXpEvent($user, 'daily_login', 1);
    }

    public function testRegisterXpEventSkipsWhenDedupFindsExistingEvent(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_DEDUP, 8);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $existing = $this->createMock(UserXpEvent::class);
        $this->eventRepository->expects($this->once())
            ->method('createQueryBuilder')
            ->willReturn($this->buildEntityQueryBuilder($existing));

        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->service->registerXpEvent($user, 'calendar_event', 99);
    }

    public function testRegisterXpEventPersistsWhenDedupHasNoExistingEvent(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_DEDUP, 10);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);
        $this->eventRepository->method('createQueryBuilder')->willReturn($this->buildEntityQueryBuilder(null));

        $this->entityManager->expects($this->once())
            ->method('persist')
            ->with($this->callback(function (object $entity) use ($user): bool {
                if (!$entity instanceof UserXpEvent) {
                    return false;
                }

                return $entity->getUser() === $user
                    && 'calendar_event' === $entity->getActionType()
                    && 100 === $entity->getActionId()
                    && 10 === $entity->getXpValue()
                    && is_string($entity->getSeason())
                    && 1 === preg_match('/^\d{4}\/\d{4}$/', $entity->getSeason())
                    && false === $entity->isProcessed();
            }));

        $this->entityManager->expects($this->once())->method('flush');

        $this->service->registerXpEvent($user, 'calendar_event', 100);
    }

    public function testRegisterXpEventSkipsWhenCooldownWindowContainsEvent(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(30, 12);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);
        $this->eventRepository->method('createQueryBuilder')
            ->willReturn($this->buildScalarQueryBuilder('1'));

        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->service->registerXpEvent($user, 'match_attended', 7);
    }

    public function testRegisterXpEventSkipsWhenDailyLimitReached(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, 2, null);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);
        $this->eventRepository->method('createQueryBuilder')
            ->willReturn($this->buildScalarQueryBuilder('2'));

        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->service->registerXpEvent($user, 'daily_login', 1);
    }

    public function testRegisterXpEventSkipsWhenMonthlyLimitReached(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, 3, 2);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);
        $this->eventRepository->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls(
                $this->buildScalarQueryBuilder('1'),
                $this->buildScalarQueryBuilder('2')
            );

        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->service->registerXpEvent($user, 'task_completed', 5);
    }

    public function testRegisterXpEventPersistsWhenCooldownAndLimitsAllowIt(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(15, 25, 4, 10);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);
        $this->eventRepository->method('createQueryBuilder')
            ->willReturnOnConsecutiveCalls(
                $this->buildScalarQueryBuilder('0'),
                $this->buildScalarQueryBuilder('1'),
                $this->buildScalarQueryBuilder('2')
            );

        $this->entityManager->expects($this->once())
            ->method('persist')
            ->with($this->isInstanceOf(UserXpEvent::class));
        $this->entityManager->expects($this->once())->method('flush');

        $this->service->registerXpEvent($user, 'training_attended', 1234);
    }

    public function testRegisterXpEventPersistsWhenNoDedupAndNoLimitsConfigured(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 6, null, null);

        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $this->eventRepository->expects($this->never())->method('findOneBy');
        $this->eventRepository->expects($this->never())->method('createQueryBuilder');

        $this->entityManager->expects($this->once())->method('persist')->with($this->isInstanceOf(UserXpEvent::class));
        $this->entityManager->expects($this->once())->method('flush');

        $this->service->registerXpEvent($user, 'profile_update', 77);
    }

    /**
     * Parallelität: Kein Datenbanklock wenn der Benutzer noch keine ID hat (transiente Entität).
     * Ein Lock auf ein Objekt ohne ID wäre ungültig und würde unnötig blockieren.
     */
    public function testNoLockAcquiredForUserWithoutId(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(null);

        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $this->entityManager->expects($this->never())->method('lock');

        $this->service->registerXpEvent($user, 'daily_login', 1);
    }

    /**
     * Parallelität: Der Lock beschränkt sich auf die konkrete Benutzerentität –
     * keine globale oder benutzerübergreifende Sperre.
     */
    public function testLockIsExclusivelyOnTheRegisteredUser(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(42);

        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 10, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $lockedEntities = [];
        $this->entityManager->expects($this->once())
            ->method('lock')
            ->willReturnCallback(function (object $entity) use (&$lockedEntities): void {
                $lockedEntities[] = $entity;
            });

        $this->service->registerXpEvent($user, 'training_attended', 5);

        $this->assertSame(
            [$user],
            $lockedEntities,
            'Lock darf ausschließlich die registrierte Benutzerentität betreffen.'
        );
    }

    /**
     * Parallelität: Der Benutzerlock wird vor dem Dedup-Lesevorgang gesetzt,
     * um TOCTOU-Race-Conditions zu verhindern (Dedup-Modus).
     */
    public function testLockPrecedesDedupReadInDedupMode(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(7);

        $rule = $this->makeRule(XpRule::COOLDOWN_DEDUP, 10);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $callOrder = [];

        $this->entityManager->expects($this->once())
            ->method('lock')
            ->willReturnCallback(function () use (&$callOrder): void {
                $callOrder[] = 'lock';
            });

        $this->eventRepository->method('createQueryBuilder')
            ->willReturnCallback(function () use (&$callOrder): QueryBuilder {
                $callOrder[] = 'createQueryBuilder';

                return $this->buildEntityQueryBuilder(null);
            });

        $this->service->registerXpEvent($user, 'calendar_event', 7);

        $this->assertSame(
            ['lock', 'createQueryBuilder'],
            $callOrder,
            'Der Benutzerlock muss vor dem Dedup-Lesevorgang gesetzt werden.'
        );
    }

    /**
     * Parallelität: Der Benutzerlock wird vor Cooldown-Lesevorgängen gesetzt,
     * um TOCTOU-Race-Conditions zu verhindern (Cooldown-Modus).
     */
    public function testLockPrecedesCooldownReadInCooldownMode(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(8);

        $rule = $this->makeRule(30, 10, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $callOrder = [];

        $this->entityManager->expects($this->once())
            ->method('lock')
            ->willReturnCallback(function () use (&$callOrder): void {
                $callOrder[] = 'lock';
            });

        $this->eventRepository->method('createQueryBuilder')
            ->willReturnCallback(function () use (&$callOrder): QueryBuilder {
                $callOrder[] = 'createQueryBuilder';

                return $this->buildScalarQueryBuilder('0');
            });

        $this->service->registerXpEvent($user, 'match_attended', 8);

        $this->assertSame(
            ['lock', 'createQueryBuilder'],
            $callOrder,
            'Der Benutzerlock muss vor Cooldown-Lesevorgängen gesetzt werden.'
        );
    }

    /**
     * Parallelität: Registrierungen für verschiedene Benutzer sperren unabhängige
     * Zeilen – keine gegenseitige Behinderung zwischen unterschiedlichen Benutzern.
     */
    public function testRegistrationsForDifferentUsersUseIndependentLocks(): void
    {
        $userA = $this->createMock(User::class);
        $userA->method('getId')->willReturn(10);

        $userB = $this->createMock(User::class);
        $userB->method('getId')->willReturn(20);

        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $lockedEntities = [];
        $this->entityManager->expects($this->exactly(2))
            ->method('lock')
            ->willReturnCallback(function (object $entity) use (&$lockedEntities): void {
                $lockedEntities[] = $entity;
            });

        $this->service->registerXpEvent($userA, 'training_attended', 1);
        $this->service->registerXpEvent($userB, 'training_attended', 2);

        $this->assertCount(2, $lockedEntities, 'Jede Registrierung sperrt genau eine Entität.');
        $this->assertSame($userA, $lockedEntities[0], 'Erste Registrierung sperrt userA.');
        $this->assertSame($userB, $lockedEntities[1], 'Zweite Registrierung sperrt userB.');
        $this->assertNotSame(
            $lockedEntities[0],
            $lockedEntities[1],
            'Verschiedene Benutzer verwenden unabhängige Locks.'
        );
    }

    /**
     * Parallelität: Die gesamte Registrierung läuft innerhalb einer Transaktion –
     * der Lock wird nach dem Commit automatisch freigegeben.
     */
    public function testRegistrationRunsInsideTransactionToMinimiseLockDuration(): void
    {
        $user = $this->createMock(User::class);
        $rule = $this->makeRule(XpRule::COOLDOWN_NO_DEDUP, 5, null, null);
        $this->xpRuleRepository->method('findEnabledByActionType')->willReturn($rule);

        $this->connection->expects($this->once())
            ->method('transactional')
            ->willReturnCallback(function (callable $callback): mixed {
                return $callback();
            });

        $this->service->registerXpEvent($user, 'daily_login', 1);
    }

    private function makeRule(int $cooldown, int $xpValue, ?int $dailyLimit = null, ?int $monthlyLimit = null): XpRule & MockObject
    {
        $rule = $this->createMock(XpRule::class);
        $rule->method('getCooldownMinutes')->willReturn($cooldown);
        $rule->method('getXpValue')->willReturn($xpValue);
        $rule->method('getDailyLimit')->willReturn($dailyLimit);
        $rule->method('getMonthlyLimit')->willReturn($monthlyLimit);

        return $rule;
    }

    private function buildScalarQueryBuilder(string $scalar): QueryBuilder & MockObject
    {
        $query = $this->createMock(Query::class);
        $query->method('getSingleScalarResult')->willReturn($scalar);

        $queryBuilder = $this->createMock(QueryBuilder::class);
        $queryBuilder->method('select')->willReturnSelf();
        $queryBuilder->method('where')->willReturnSelf();
        $queryBuilder->method('andWhere')->willReturnSelf();
        $queryBuilder->method('setParameter')->willReturnSelf();
        $queryBuilder->method('getQuery')->willReturn($query);

        return $queryBuilder;
    }

    private function buildEntityQueryBuilder(?object $entity): QueryBuilder & MockObject
    {
        $query = $this->createMock(Query::class);
        $query->method('setLockMode')->willReturnSelf();
        $query->method('getOneOrNullResult')->willReturn($entity);

        $queryBuilder = $this->createMock(QueryBuilder::class);
        $queryBuilder->method('where')->willReturnSelf();
        $queryBuilder->method('andWhere')->willReturnSelf();
        $queryBuilder->method('setParameter')->willReturnSelf();
        $queryBuilder->method('getQuery')->willReturn($query);

        return $queryBuilder;
    }
}
