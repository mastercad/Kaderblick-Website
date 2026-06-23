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

            return new MockResponse('{"id":"cs_test_session","url":"https://pay.example.test/session"}');
        });

        $url = $this->manager($http)->createCheckout($this->user, [17]);

        self::assertSame('https://pay.example.test/session', $url);
    }

    public function testPendingCheckoutCanBeDiscardedAndStartedAgain(): void
    {
        $userId = new ReflectionProperty(User::class, 'id');
        $userId->setValue($this->user, 42);
        $authenticatedUser = clone $this->user;
        $userId->setValue($authenticatedUser, 43);
        $pending = new BillingSubscription($this->user);
        $pending->addTeam($this->team);
        $id = new ReflectionProperty(BillingSubscription::class, 'id');
        $id->setValue($pending, 23);
        $this->existingLink = new BillingSubscriptionTeam($pending, $this->team);
        $this->em->expects(self::once())->method('remove')->with($pending)->willReturnCallback(function (): void {
            $this->existingLink = null;
        });
        $http = new MockHttpClient(static fn () => new MockResponse('{"id":"cs_test_retry","url":"https://pay.example.test/retry"}'));

        $url = $this->manager($http)->restartPendingCheckout($authenticatedUser, [17]);

        self::assertSame('https://pay.example.test/retry', $url);
    }

    public function testAnotherAuthorizedTreasurerExpiresOpenCheckoutAndStartsTheirOwn(): void
    {
        $userId = new ReflectionProperty(User::class, 'id');
        $userId->setValue($this->user, 42);
        $otherTreasurer = clone $this->user;
        $userId->setValue($otherTreasurer, 43);
        $pending = (new BillingSubscription($this->user))->setProviderCheckoutSessionId('cs_test_previous_payer');
        $pending->addTeam($this->team);
        $subscriptionId = new ReflectionProperty(BillingSubscription::class, 'id');
        $subscriptionId->setValue($pending, 23);
        $this->existingLink = new BillingSubscriptionTeam($pending, $this->team);
        $this->em->expects(self::once())->method('remove')->with($pending)->willReturnCallback(function (): void {
            $this->existingLink = null;
        });
        $responses = [
            new MockResponse('{"id":"cs_test_previous_payer","status":"open","url":"https://pay.example.test/old"}'),
            new MockResponse('{"id":"cs_test_previous_payer","status":"expired"}'),
            new MockResponse('{"id":"cs_test_new_payer","url":"https://pay.example.test/new"}'),
        ];
        $requests = 0;
        $http = new MockHttpClient(static function (string $method, string $url) use (&$requests, $responses): MockResponse {
            if (0 === $requests) {
                self::assertSame('GET', $method);
                self::assertStringEndsWith('/checkout/sessions/cs_test_previous_payer', $url);
            } elseif (1 === $requests) {
                self::assertSame('POST', $method);
                self::assertStringEndsWith('/checkout/sessions/cs_test_previous_payer/expire', $url);
            } else {
                self::assertSame('POST', $method);
                self::assertStringEndsWith('/checkout/sessions', $url);
            }

            return $responses[$requests++];
        });

        $url = $this->manager($http)->restartPendingCheckout($otherTreasurer, [17]);

        self::assertSame('https://pay.example.test/new', $url);
        self::assertSame(3, $requests);
    }

    public function testOpenStripeCheckoutIsResumedInsteadOfDuplicated(): void
    {
        $pending = (new BillingSubscription($this->user))->setProviderCheckoutSessionId('cs_test_open');
        $this->existingLink = new BillingSubscriptionTeam($pending, $this->team);
        $this->em->expects(self::never())->method('remove');
        $http = new MockHttpClient(static function (string $method, string $url): MockResponse {
            self::assertSame('GET', $method);
            self::assertStringEndsWith('/checkout/sessions/cs_test_open', $url);

            return new MockResponse('{"id":"cs_test_open","status":"open","url":"https://pay.example.test/resume"}');
        });

        $url = $this->manager($http)->restartPendingCheckout($this->user, [17]);

        self::assertSame('https://pay.example.test/resume', $url);
    }

    public function testCompletedStripeCheckoutCannotBeDuplicated(): void
    {
        $pending = (new BillingSubscription($this->user))->setProviderCheckoutSessionId('cs_test_complete');
        $this->existingLink = new BillingSubscriptionTeam($pending, $this->team);
        $this->em->expects(self::never())->method('remove');
        $http = new MockHttpClient(static fn () => new MockResponse('{"id":"cs_test_complete","status":"complete"}'));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('bei Stripe bereits abgeschlossen');
        $this->manager($http)->restartPendingCheckout($this->user, [17]);
    }

    public function testStripeConfirmedPendingCheckoutCannotBeStartedTwice(): void
    {
        $pending = (new BillingSubscription($this->user))->setProviderSubscriptionId('sub_confirmed');
        $this->existingLink = new BillingSubscriptionTeam($pending, $this->team);
        $http = new MockHttpClient(static fn () => self::fail('Payment API must not be called'));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('bereits bestätigt');
        $this->manager($http)->restartPendingCheckout($this->user, [17]);
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
