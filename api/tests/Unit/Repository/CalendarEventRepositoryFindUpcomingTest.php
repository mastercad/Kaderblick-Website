<?php

namespace App\Tests\Unit\Repository;

use App\Entity\CalendarEvent;
use App\Repository\CalendarEventRepository;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for CalendarEventRepository::findUpcoming().
 *
 * The QueryBuilder chain is mocked so no real database is required.
 * Key assertions:
 *  - Both `:now` and `:until` parameters must be set.
 *  - `:until` must be a DateTime in the future (now + $withinDays days).
 *  - `setMaxResults($limit)` is called with the given limit.
 *  - The `withinDays` parameter controls the lookahead window.
 */
#[AllowMockObjectsWithoutExpectations]
class CalendarEventRepositoryFindUpcomingTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private CalendarEventRepository $repository;

    /** Parameters captured via setParameter() calls. */
    /** @var array<string, mixed> */
    private array $capturedParameters = [];

    /** The max-results value captured via setMaxResults(). */
    private int $capturedMaxResults = 0;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        // Capture setParameter() calls for later assertions
        $this->qb
            ->method('setParameter')
            ->willReturnCallback(function (string $name, mixed $value) {
                $this->capturedParameters[$name] = $value;

                return $this->qb;
            });

        // Capture setMaxResults()
        $this->qb
            ->method('setMaxResults')
            ->willReturnCallback(function (int $n) {
                $this->capturedMaxResults = $n;

                return $this->qb;
            });

        // All other fluent methods return $this->qb unchanged
        foreach (['select', 'from', 'leftJoin', 'where', 'andWhere', 'orderBy'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }

        $this->qb->method('getQuery')->willReturn($this->query);
        $this->query->method('getResult')->willReturn([]);

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $metadata = $this->createMock(ClassMetadata::class);
        $metadata->name = CalendarEvent::class;
        $this->em->method('getClassMetadata')->willReturn($metadata);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new CalendarEventRepository($registry);
    }

    // ── Parameter presence ─────────────────────────────────────────────────────

    public function testFindUpcomingSetsNowParameter(): void
    {
        $before = new DateTime();
        $this->repository->findUpcoming(5, 7);

        $this->assertArrayHasKey('now', $this->capturedParameters);
        $this->assertInstanceOf(DateTime::class, $this->capturedParameters['now']);
        // :now must be close to the current time (within 5 seconds)
        $this->assertLessThanOrEqual(5, abs(time() - $this->capturedParameters['now']->getTimestamp()));
    }

    public function testFindUpcomingSetsUntilParameter(): void
    {
        $this->repository->findUpcoming(5, 7);

        $this->assertArrayHasKey('until', $this->capturedParameters);
        $this->assertInstanceOf(DateTime::class, $this->capturedParameters['until']);
    }

    // ── Limit ──────────────────────────────────────────────────────────────────

    public function testFindUpcomingAppliesLimit(): void
    {
        $this->repository->findUpcoming(20, 7);

        $this->assertSame(20, $this->capturedMaxResults);
    }

    public function testFindUpcomingAppliesCustomLimit(): void
    {
        $this->repository->findUpcoming(3, 7);

        $this->assertSame(3, $this->capturedMaxResults);
    }

    // ── withinDays ─────────────────────────────────────────────────────────────

    public function testFindUpcomingUntilIsWithinRequestedDays(): void
    {
        $withinDays = 14;
        $beforeCall = new DateTime();
        $this->repository->findUpcoming(5, $withinDays);

        /** @var DateTime $until */
        $until = $this->capturedParameters['until'];
        $expectedUntil = (new DateTime())->modify("+{$withinDays} days");

        // Allow a 5-second tolerance for slow test execution
        $diff = abs($until->getTimestamp() - $expectedUntil->getTimestamp());
        $this->assertLessThanOrEqual(5, $diff, ':until should be now + withinDays days');
    }

    public function testFindUpcomingDefaultSevenDaysWindow(): void
    {
        $this->repository->findUpcoming(); // default withinDays = 7

        /** @var DateTime $until */
        $until = $this->capturedParameters['until'];
        $expectedUntil = (new DateTime())->modify('+7 days');

        $diff = abs($until->getTimestamp() - $expectedUntil->getTimestamp());
        $this->assertLessThanOrEqual(5, $diff, ':until should default to now + 7 days');
    }

    public function testFindUpcomingLargerWindowProducesLaterUntil(): void
    {
        // Call twice: once with 7 days, once with 30 days
        $this->repository->findUpcoming(5, 7);
        $until7 = clone $this->capturedParameters['until'];

        $this->capturedParameters = []; // reset
        $this->repository->findUpcoming(5, 30);
        $this->assertArrayHasKey('until', $this->capturedParameters);
        /** @var array<string, DateTime> $capturedParams */
        $capturedParams = $this->capturedParameters;
        $until30 = $capturedParams['until'];

        $this->assertGreaterThan(
            $until7->getTimestamp(),
            $until30->getTimestamp(),
            '30-day window should produce a later :until than 7-day window'
        );
    }

    // ── Return type ────────────────────────────────────────────────────────────

    public function testFindUpcomingReturnsArray(): void
    {
        $result = $this->repository->findUpcoming(5, 7);

        $this->assertCount(0, $result);
    }

    public function testFindUpcomingDefaultParametersAreApplied(): void
    {
        // findUpcoming() with no args uses limit=5 and withinDays=7
        $this->repository->findUpcoming();

        $this->assertSame(5, $this->capturedMaxResults);
        $this->assertArrayHasKey('now', $this->capturedParameters);
        $this->assertArrayHasKey('until', $this->capturedParameters);
    }
}
