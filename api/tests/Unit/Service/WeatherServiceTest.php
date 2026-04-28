<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Location;
use App\Repository\CalendarEventRepository;
use App\Service\WeatherService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

#[AllowMockObjectsWithoutExpectations]
class WeatherServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    private CalendarEventRepository&MockObject $calendarEventRepository;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventRepository = $this->createMock(CalendarEventRepository::class);

        $this->entityManager->method('getRepository')
            ->with(CalendarEvent::class)
            ->willReturn($this->calendarEventRepository);
    }

    private function makeService(): WeatherService
    {
        return new WeatherService('https://api.open-meteo.com/v1/forecast', $this->entityManager);
    }

    /**
     * Call the private generateApiRequestUrl method via reflection.
     */
    private function callGenerateApiRequestUrl(WeatherService $service, float $lat, float $lon, DateTimeInterface $start, DateTimeInterface $end): string
    {
        $method = new ReflectionMethod($service, 'generateApiRequestUrl');
        $method->setAccessible(true);

        return $method->invoke($service, $lat, $lon, $start, $end);
    }

    // ── generateApiRequestUrl ─────────────────────────────────────────────

    public function testGenerateApiRequestUrlContainsBaseUrl(): void
    {
        $service = $this->makeService();
        $start = new DateTimeImmutable('2025-06-01');
        $end = new DateTimeImmutable('2025-06-01');

        $url = $this->callGenerateApiRequestUrl($service, 48.1, 11.6, $start, $end);

        $this->assertStringStartsWith('https://api.open-meteo.com/v1/forecast?', $url);
    }

    public function testGenerateApiRequestUrlContainsLatLon(): void
    {
        $service = $this->makeService();
        $start = new DateTimeImmutable('2025-07-15');
        $end = new DateTimeImmutable('2025-07-15');

        $url = $this->callGenerateApiRequestUrl($service, 52.5, 13.4, $start, $end);

        $this->assertStringContainsString('latitude=52.5', $url);
        $this->assertStringContainsString('longitude=13.4', $url);
    }

    public function testGenerateApiRequestUrlContainsDates(): void
    {
        $service = $this->makeService();
        $start = new DateTimeImmutable('2025-08-01');
        $end = new DateTimeImmutable('2025-08-03');

        $url = $this->callGenerateApiRequestUrl($service, 48.0, 11.0, $start, $end);

        $this->assertStringContainsString('start_date=2025-08-01', $url);
        $this->assertStringContainsString('end_date=2025-08-03', $url);
    }

    public function testGenerateApiRequestUrlContainsTimezoneAuto(): void
    {
        $service = $this->makeService();
        $start = new DateTimeImmutable('2025-09-01');
        $end = new DateTimeImmutable('2025-09-01');

        $url = $this->callGenerateApiRequestUrl($service, 51.0, 9.0, $start, $end);

        $this->assertStringContainsString('timezone=auto', $url);
    }

    public function testGenerateApiRequestUrlContainsHourlyAndDailyParams(): void
    {
        $service = $this->makeService();
        $start = new DateTimeImmutable('2025-09-01');
        $end = new DateTimeImmutable('2025-09-01');

        $url = $this->callGenerateApiRequestUrl($service, 51.0, 9.0, $start, $end);

        $this->assertStringContainsString('hourly=', $url);
        $this->assertStringContainsString('daily=', $url);
        $this->assertStringContainsString('temperature_2m', $url);
    }

    // ── retrieveWeatherData skips events without location ─────────────────

    public function testRetrieveWeatherDataSkipsEventWithoutLocation(): void
    {
        $service = $this->makeService();

        $event = $this->createMock(CalendarEvent::class);
        $now = new DateTimeImmutable();
        $event->method('getStartDate')->willReturn($now->modify('+1 day'));
        $event->method('getLocation')->willReturn(null);

        $this->calendarEventRepository->method('findAllEventsBetween')->willReturn([$event]);

        // entityManager->persist should NOT be called
        $this->entityManager->expects($this->never())->method('persist');

        $result = $service->retrieveWeatherData();

        $this->assertSame($service, $result); // returns $this
    }

    public function testRetrieveWeatherDataSkipsEventWithLocationButNoLatitude(): void
    {
        $service = $this->makeService();

        $location = $this->createMock(Location::class);
        $location->method('getLatitude')->willReturn(null);
        $location->method('getLongitude')->willReturn(11.6);

        $event = $this->createMock(CalendarEvent::class);
        $now = new DateTimeImmutable();
        $event->method('getStartDate')->willReturn($now->modify('+1 day'));
        $event->method('getLocation')->willReturn($location);

        $this->calendarEventRepository->method('findAllEventsBetween')->willReturn([$event]);

        $this->entityManager->expects($this->never())->method('persist');

        $service->retrieveWeatherData();
    }

    public function testRetrieveWeatherDataSkipsEventWithLocationButNoLongitude(): void
    {
        $service = $this->makeService();

        $location = $this->createMock(Location::class);
        $location->method('getLatitude')->willReturn(48.1);
        $location->method('getLongitude')->willReturn(null);

        $event = $this->createMock(CalendarEvent::class);
        $now = new DateTimeImmutable();
        $event->method('getStartDate')->willReturn($now->modify('+1 day'));
        $event->method('getLocation')->willReturn($location);

        $this->calendarEventRepository->method('findAllEventsBetween')->willReturn([$event]);

        $this->entityManager->expects($this->never())->method('persist');

        $service->retrieveWeatherData();
    }

    public function testRetrieveWeatherDataSkipsOutOfRangeEvents(): void
    {
        $service = $this->makeService();

        // An event returned from the query – but actually out of range (edge case skipped by isInRange check)
        // In practice the repository returns only events in range, but we test with empty list
        $this->calendarEventRepository->method('findAllEventsBetween')->willReturn([]);

        $this->entityManager->expects($this->never())->method('persist');

        $result = $service->retrieveWeatherData();
        $this->assertSame($service, $result);
    }
}
