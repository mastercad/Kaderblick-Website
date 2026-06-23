<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\BillingExemption;
use App\Entity\BillingSubscription;
use App\Entity\BillingSubscriptionTeam;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use App\Service\BillingAccessService;
use App\Service\BillingManager;
use App\Service\StripeBillingClient;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

#[AllowMockObjectsWithoutExpectations]
final class BillingManagerTest extends TestCase
{
    private EntityManagerInterface & MockObject $em;
    /** @var EntityRepository<FunctionaryTeamAssignment>&MockObject */
    private EntityRepository & MockObject $teamAssignments;
    /** @var EntityRepository<FunctionaryClubAssignment>&MockObject */
    private EntityRepository & MockObject $clubAssignments;
    /** @var EntityRepository<BillingExemption>&MockObject */
    private EntityRepository & MockObject $exemptions;
    /** @var EntityRepository<BillingSubscriptionTeam>&MockObject */
    private EntityRepository & MockObject $links;
    private User $user;
    private Team $team;
    /** @var list<BillingExemption> */
    private array $activeExemptions = [];
    private ?BillingSubscriptionTeam $existingLink = null;

    protected function setUp(): void
    {
        $_ENV['STRIPE_SECRET_KEY'] = 'sk_test_example';
        $_ENV['STRIPE_WEBHOOK_SECRET'] = 'whsec_example';
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->teamAssignments = $this->createMock(EntityRepository::class);
        $this->clubAssignments = $this->createMock(EntityRepository::class);
        $this->exemptions = $this->createMock(EntityRepository::class);
        $this->links = $this->createMock(EntityRepository::class);
        $this->em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            FunctionaryTeamAssignment::class => $this->teamAssignments,
            FunctionaryClubAssignment::class => $this->clubAssignments,
            BillingExemption::class => $this->exemptions,
            BillingSubscriptionTeam::class => $this->links,
            default => $this->createMock(EntityRepository::class),
        });
        $this->user = (new User())->setEmail('kasse@example.test')->setFirstName('Kim')->setLastName('Kasse');
        $this->team = (new Team())->setName('U17');
        $id = new ReflectionProperty(Team::class, 'id');
        $id->setValue($this->team, 17);

        $type = new FunctionaryTeamAssignmentType();
        $type->setName('Kassenwart');
        $assignment = new FunctionaryTeamAssignment();
        $assignment->setUser($this->user);
        $assignment->setTeam($this->team);
        $assignment->setFunctionaryTeamAssignmentType($type);
        $this->teamAssignments->method('findBy')->willReturn([$assignment]);
        $this->clubAssignments->method('findBy')->willReturn([]);
        $this->exemptions->method('findBy')->willReturnCallback(fn () => $this->activeExemptions);
        $this->links->method('findOneBy')->willReturnCallback(fn () => $this->existingLink);
    }

    protected function tearDown(): void
    {
        unset($_ENV['STRIPE_SECRET_KEY'], $_ENV['STRIPE_WEBHOOK_SECRET']);
    }

    public function testKassenwartCanSeeAssignedTeam(): void
    {
        $manager = $this->manager(new MockHttpClient());

        self::assertSame([$this->team], $manager->manageableTeams($this->user));
    }

    public function testDuplicateTeamCoverageIsRejectedBeforePaymentPageIsCreated(): void
    {
        $existing = new BillingSubscription($this->user);
        $existing->setStatus(BillingSubscription::STATUS_ACTIVE);
        $this->existingLink = new BillingSubscriptionTeam($existing, $this->team);
        $http = new MockHttpClient(static fn () => self::fail('Payment API must not be called for duplicate coverage'));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('bereits durch ein Abonnement abgedeckt');
        $this->manager($http)->createCheckout($this->user, [17]);
    }

    public function testCheckoutUsesOneMonthlyUnitPerSelectedTeam(): void
    {
        $this->em->expects(self::once())->method('persist')->with(self::isInstanceOf(BillingSubscription::class));
        $http = new MockHttpClient(static function (string $method, string $url, array $options): MockResponse {
            self::assertSame('POST', $method);
            self::assertStringEndsWith('/checkout/sessions', $url);
            self::assertStringContainsString('line_items%5B0%5D%5Bquantity%5D=1', (string) $options['body']);
            self::assertStringContainsString('unit_amount%5D=1000', (string) $options['body']);
            self::assertStringContainsString('interval%5D=month', (string) $options['body']);

            return new MockResponse('{"url":"https://pay.example.test/session"}');
        });

        $url = $this->manager($http)->createCheckout($this->user, [17]);

        self::assertSame('https://pay.example.test/session', $url);
    }

    public function testTeamInTestPhaseCannotBeCharged(): void
    {
        $trial = (new BillingExemption(BillingExemption::SCOPE_TEAM, 'Kostenlos', null))->setTeam($this->team);
        $this->activeExemptions = [$trial];

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('kostenlosen Testphase');
        $this->manager(new MockHttpClient())->createCheckout($this->user, [17]);
    }

    private function manager(MockHttpClient $http): BillingManager
    {
        $access = new BillingAccessService($this->em);

        return new BillingManager($this->em, $access, new StripeBillingClient($http), 'https://app.example.test');
    }
}
