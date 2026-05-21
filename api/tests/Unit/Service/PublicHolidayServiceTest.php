<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\PublicHoliday;
use App\Repository\PublicHolidayRepository;
use App\Service\PublicHolidayService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

#[AllowMockObjectsWithoutExpectations]
class PublicHolidayServiceTest extends TestCase
{
    private PublicHolidayRepository&MockObject $repository;
    private EntityManagerInterface&MockObject $entityManager;
    private HttpClientInterface&MockObject $httpClient;
    private PublicHolidayService $service;

    protected function setUp(): void
    {
        $this->repository = $this->createMock(PublicHolidayRepository::class);
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->httpClient = $this->createMock(HttpClientInterface::class);

        $this->service = new PublicHolidayService(
            $this->repository,
            $this->entityManager,
            $this->httpClient,
        );
    }

    private function makeHoliday(string $name, string $datum): PublicHoliday
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $datum);
        assert(false !== $date);

        return new PublicHoliday(2026, 'BY', $name, $date);
    }

    /** @param array<string, array{datum: string}> $apiData */
    private function mockApiResponse(array $apiData): void
    {
        $response = $this->createMock(ResponseInterface::class);
        $response->method('toArray')->willReturn($apiData);

        $this->httpClient->method('request')->willReturn($response);
    }

    // ── Cache hit: DB hat Daten → kein API-Call ───────────────────────────────

    public function testReturnsCachedDataWithoutCallingApi(): void
    {
        $this->repository
            ->method('findByYearAndState')
            ->with(2026, 'BY')
            ->willReturn([$this->makeHoliday('Neujahr', '2026-01-01')]);

        $this->httpClient->expects($this->never())->method('request');

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertCount(1, $result);
    }

    public function testCachedResultContainsNameAndDate(): void
    {
        $this->repository
            ->method('findByYearAndState')
            ->willReturn([$this->makeHoliday('Neujahr', '2026-01-01')]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertSame('Neujahr', $result[0]['name']);
        $this->assertSame('2026-01-01', $result[0]['date']);
    }

    public function testCachedResultReturnsMultipleHolidays(): void
    {
        $this->repository
            ->method('findByYearAndState')
            ->willReturn([
                $this->makeHoliday('Neujahr', '2026-01-01'),
                $this->makeHoliday('Tag der Arbeit', '2026-05-01'),
                $this->makeHoliday('Tag der Deutschen Einheit', '2026-10-03'),
            ]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertCount(3, $result);
    }

    // ── Cache miss: API wird aufgerufen, Ergebnis persistiert ─────────────────

    public function testFetchesFromApiWhenCacheIsEmpty(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'Neujahr' => ['datum' => '2026-01-01', 'hinweis' => ''],
        ]);

        $this->httpClient->expects($this->once())->method('request');
        $this->entityManager->method('persist');
        $this->entityManager->method('flush');

        $this->service->getHolidays(2026, 'NATIONAL');
    }

    public function testApiIsCalledWithCorrectParameters(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse(['Neujahr' => ['datum' => '2026-01-01']]);

        $this->httpClient
            ->expects($this->once())
            ->method('request')
            ->with(
                'GET',
                'https://feiertage-api.de/api/',
                $this->callback(function (array $options): bool {
                    return isset($options['query']['jahr'])
                        && 2026 === $options['query']['jahr']
                        && isset($options['query']['nur_land'])
                        && 'BY' === $options['query']['nur_land'];
                }),
            );

        $this->entityManager->method('persist');
        $this->entityManager->method('flush');

        $this->service->getHolidays(2026, 'BY');
    }

    public function testPersistsEachHolidayFromApi(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'Neujahr' => ['datum' => '2026-01-01'],
            'Tag der Arbeit' => ['datum' => '2026-05-01'],
        ]);

        $this->entityManager->expects($this->exactly(2))->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $this->service->getHolidays(2026, 'BY');
    }

    public function testReturnsFetchedDataAfterPersisting(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'Neujahr' => ['datum' => '2026-01-01'],
            'Tag der Arbeit' => ['datum' => '2026-05-01'],
        ]);

        $this->entityManager->method('persist');
        $this->entityManager->method('flush');

        $result = $this->service->getHolidays(2026, 'NATIONAL');

        $this->assertCount(2, $result);
        $this->assertSame('Neujahr', $result[0]['name']);
        $this->assertSame('2026-01-01', $result[0]['date']);
        $this->assertSame('Tag der Arbeit', $result[1]['name']);
        $this->assertSame('2026-05-01', $result[1]['date']);
    }

    // ── Ungültiges Datumsformat wird übersprungen ─────────────────────────────

    public function testSkipsEntriesWithInvalidDateFormat(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'Neujahr' => ['datum' => '2026-01-01'],
            'Kaputt' => ['datum' => 'not-a-date'],
        ]);

        // Nur 1 von 2 Einträgen darf persistiert werden
        $this->entityManager->expects($this->exactly(1))->method('persist');
        $this->entityManager->method('flush');

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertCount(1, $result);
        $this->assertSame('Neujahr', $result[0]['name']);
    }

    public function testDoesNotCrashWhenAllDatesAreInvalid(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'Kaputt1' => ['datum' => 'invalid'],
            'Kaputt2' => ['datum' => ''],
        ]);

        $this->entityManager->expects($this->never())->method('persist');
        $this->entityManager->method('flush');

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertSame([], $result);
    }

    // ── Output-Format ─────────────────────────────────────────────────────────

    public function testOutputContainsNameKey(): void
    {
        $this->repository->method('findByYearAndState')
            ->willReturn([$this->makeHoliday('Pfingstmontag', '2026-05-25')]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertArrayHasKey('name', $result[0]);
    }

    public function testOutputContainsDateKey(): void
    {
        $this->repository->method('findByYearAndState')
            ->willReturn([$this->makeHoliday('Pfingstmontag', '2026-05-25')]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertArrayHasKey('date', $result[0]);
    }

    public function testDateIsFormattedAsYmd(): void
    {
        $this->repository->method('findByYearAndState')
            ->willReturn([$this->makeHoliday('Heiligabend', '2026-12-24')]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result[0]['date']);
        $this->assertSame('2026-12-24', $result[0]['date']);
    }

    public function testOutputContainsOnlyTwoKeys(): void
    {
        $this->repository->method('findByYearAndState')
            ->willReturn([$this->makeHoliday('Neujahr', '2026-01-01')]);

        $result = $this->service->getHolidays(2026, 'BY');

        $this->assertCount(2, $result[0]);
    }

    // ── Leerer Cache → API → flush immer aufgerufen ───────────────────────────

    public function testFlushCalledExactlyOnceAfterFetch(): void
    {
        $this->repository->method('findByYearAndState')->willReturn([]);

        $this->mockApiResponse([
            'A' => ['datum' => '2026-01-01'],
            'B' => ['datum' => '2026-03-20'],
            'C' => ['datum' => '2026-10-03'],
        ]);

        $this->entityManager->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $this->service->getHolidays(2026, 'BY');
    }
}
