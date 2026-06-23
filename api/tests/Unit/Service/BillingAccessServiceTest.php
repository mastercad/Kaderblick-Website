<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\BillingExemption;
use App\Entity\BillingSubscription;
use App\Entity\BillingSubscriptionTeam;
use App\Entity\Team;
use App\Entity\User;
use App\Service\BillingAccessService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
final class BillingAccessServiceTest extends TestCase
{
    private EntityManagerInterface & MockObject $em;
    /** @var EntityRepository<BillingExemption>&MockObject */
    private EntityRepository & MockObject $exemptions;
    /** @var EntityRepository<BillingSubscriptionTeam>&MockObject */
    private EntityRepository & MockObject $links;
    private BillingAccessService $service;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->exemptions = $this->createMock(EntityRepository::class);
        $this->links = $this->createMock(EntityRepository::class);
        $this->em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            BillingExemption::class => $this->exemptions,
            BillingSubscriptionTeam::class => $this->links,
            default => $this->createMock(EntityRepository::class),
        });
        $this->service = new BillingAccessService($this->em);
    }

    public function testGlobalTestPhaseHasPriorityAndAllowsAccess(): void
    {
        $trial = new BillingExemption(BillingExemption::SCOPE_PLATFORM, 'Plattform kostenlos', null);
        $this->exemptions->method('findBy')->willReturn([$trial]);

        $status = $this->service->statusFor($this->team());

        self::assertSame('trial', $status['status']);
        self::assertTrue($status['access']);
        self::assertSame('Plattform kostenlos', $status['reason']);
    }

    public function testTeamWithoutSubscriptionIsShownAsUnpaidButNotBlocked(): void
    {
        $this->exemptions->method('findBy')->willReturn([]);
        $this->links->method('findOneBy')->willReturn(null);

        $status = $this->service->statusFor($this->team());

        self::assertSame('unpaid', $status['status']);
        self::assertTrue($status['access']);
    }

    public function testPaidSubscriptionShowsPayerAndPaidThrough(): void
    {
        $team = $this->team();
        $subscription = new BillingSubscription($this->user());
        $subscription->setStatus(BillingSubscription::STATUS_ACTIVE)
            ->setCurrentPeriodEnd(new DateTimeImmutable('2026-07-23 12:00:00+00:00'));
        $this->exemptions->method('findBy')->willReturn([]);
        $this->links->method('findOneBy')->willReturn(new BillingSubscriptionTeam($subscription, $team));

        $status = $this->service->statusFor($team);

        self::assertSame('active', $status['status']);
        self::assertTrue($status['access']);
        self::assertSame('Kim Kasse', $status['payer']);
        self::assertSame('2026-07-23T12:00:00+00:00', $status['paidThrough']);
    }

    public function testTwoMissedBillingCyclesBlockAccess(): void
    {
        $team = $this->team();
        $subscription = new BillingSubscription($this->user());
        $subscription->setStatus(BillingSubscription::STATUS_PAST_DUE)->setMissedBillingCycles(2);
        $this->exemptions->method('findBy')->willReturn([]);
        $this->links->method('findOneBy')->willReturn(new BillingSubscriptionTeam($subscription, $team));

        $status = $this->service->statusFor($team);

        self::assertSame('blocked', $status['status']);
        self::assertFalse($status['access']);
        self::assertSame(2, $status['missedBillingCycles']);
    }

    private function team(): Team
    {
        return (new Team())->setName('U17');
    }

    private function user(): User
    {
        return (new User())->setEmail('kasse@example.test')->setFirstName('Kim')->setLastName('Kasse');
    }
}
