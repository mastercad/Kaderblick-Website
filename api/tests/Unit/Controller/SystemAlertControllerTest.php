<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Admin\SystemAlertController;
use App\Entity\SystemAlert;
use App\Enum\SystemAlertCategory;
use App\Repository\SystemAlertOccurrenceRepository;
use App\Repository\SystemAlertRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;

class SystemAlertControllerTest extends TestCase
{
    private SystemAlertRepository&MockObject $alertRepository;
    private SystemAlertOccurrenceRepository&MockObject $occurrenceRepository;
    private EntityManagerInterface&MockObject $em;
    private SystemAlertController $controller;

    protected function setUp(): void
    {
        $this->alertRepository = $this->createMock(SystemAlertRepository::class);
        $this->occurrenceRepository = $this->createMock(SystemAlertOccurrenceRepository::class);
        $this->em = $this->createMock(EntityManagerInterface::class);

        $this->controller = new SystemAlertController(
            $this->alertRepository,
            $this->occurrenceRepository,
            $this->em
        );

        // AbstractController benötigt einen Container mit dem Serializer-Service
        $container = new ContainerBuilder();
        $container->set(
            'serializer',
            new class {
                /** @param array<string, mixed> $context */
                public function serialize(mixed $data, string $format, array $context = []): string
                {
                    return json_encode($data, JSON_THROW_ON_ERROR);
                }
            }
        );
        $this->controller->setContainer($container);
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private function makeAlert(
        SystemAlertCategory $category = SystemAlertCategory::SERVER_ERROR,
        string $fingerprint = 'fp1',
        string $message = 'Fehler'
    ): SystemAlert {
        return new SystemAlert($category, $fingerprint, $message);
    }

    // ── list() ─────────────────────────────────────────────────────────────

    public function testListCallsFindGroupedAndCountMethods(): void
    {
        $open = [$this->makeAlert(SystemAlertCategory::SERVER_ERROR, 'fp1', 'Error 1')];
        $resolved = [$this->makeAlert(SystemAlertCategory::LOGIN_FAILURE, 'fp2', 'Login fail')];

        $this->alertRepository->expects($this->once())
            ->method('findGrouped')
            ->willReturn(['open' => $open, 'resolved' => $resolved]);

        $this->alertRepository->expects($this->once())
            ->method('countOpenByCategory')
            ->willReturn(['server_error' => 1]);

        $this->alertRepository->expects($this->once())
            ->method('countOpen')
            ->willReturn(1);

        $response = $this->controller->list();

        $this->assertSame(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('open', $data);
        $this->assertArrayHasKey('resolved', $data);
        $this->assertArrayHasKey('stats', $data);
        $this->assertArrayHasKey('total', $data['stats']);
        $this->assertArrayHasKey('byCategory', $data['stats']);
    }

    public function testListReturnsEmptyArraysWhenNoAlerts(): void
    {
        $this->alertRepository->method('findGrouped')
            ->willReturn(['open' => [], 'resolved' => []]);
        $this->alertRepository->method('countOpenByCategory')->willReturn([]);
        $this->alertRepository->method('countOpen')->willReturn(0);

        $response = $this->controller->list();
        $data = json_decode($response->getContent(), true);

        $this->assertSame([], $data['open']);
        $this->assertSame([], $data['resolved']);
        $this->assertSame(0, $data['stats']['total']);
    }

    public function testListMapsAlertsToArray(): void
    {
        $alert = $this->makeAlert(SystemAlertCategory::BRUTE_FORCE, 'fp3', 'Angriff');

        $this->alertRepository->method('findGrouped')
            ->willReturn(['open' => [$alert], 'resolved' => []]);
        $this->alertRepository->method('countOpenByCategory')->willReturn([]);
        $this->alertRepository->method('countOpen')->willReturn(1);

        $response = $this->controller->list();
        $data = json_decode($response->getContent(), true);

        $this->assertCount(1, $data['open']);
        $this->assertSame('brute_force', $data['open'][0]['category']);
        $this->assertSame('Angriff', $data['open'][0]['message']);
    }

    // ── stats() ────────────────────────────────────────────────────────────

    public function testStatsReturnsDefaultPeriod7d(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $request = new Request();
        $response = $this->controller->stats($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame('7d', $data['period']);
        $this->assertSame('day', $data['bucketSize']);
    }

    public function testStats24hReturnsHourBuckets(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $request = new Request(['period' => '24h']);
        $response = $this->controller->stats($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame('24h', $data['period']);
        $this->assertSame('hour', $data['bucketSize']);
    }

    public function testStats30dReturnsDayBuckets(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $request = new Request(['period' => '30d']);
        $response = $this->controller->stats($request);
        $data = json_decode($response->getContent(), true);

        $this->assertSame('30d', $data['period']);
        $this->assertSame('day', $data['bucketSize']);
    }

    public function testStatsContainsRequiredResponseKeys(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $response = $this->controller->stats(new Request());
        $data = json_decode($response->getContent(), true);

        foreach (['period', 'bucketSize', 'timeSeries', 'trends', 'totals'] as $key) {
            $this->assertArrayHasKey($key, $data, "Response should contain key '$key'");
        }
    }

    public function testStatsTrendDirectionCalculation(): void
    {
        // current > previous * 1.1 → 'up'
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([
            'server_error' => ['current' => 20, 'previous' => 10],
            'login_failure' => ['current' => 5, 'previous' => 20],
            'brute_force' => ['current' => 10, 'previous' => 10],
        ]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $response = $this->controller->stats(new Request());
        $data = json_decode($response->getContent(), true);

        $this->assertSame('up', $data['trends']['server_error']['direction']);
        $this->assertSame('down', $data['trends']['login_failure']['direction']);
        $this->assertSame('neutral', $data['trends']['brute_force']['direction']);
    }

    public function testStatsTrendDirectionNeutralWhenPreviousIsZeroAndCurrentIsZero(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([
            'server_error' => ['current' => 0, 'previous' => 0],
        ]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $response = $this->controller->stats(new Request());
        $data = json_decode($response->getContent(), true);

        $this->assertSame('neutral', $data['trends']['server_error']['direction']);
        $this->assertSame(0, $data['trends']['server_error']['changePercent']);
    }

    public function testStatsTrendDirectionUpWhenPreviousIsZeroAndCurrentGtZero(): void
    {
        $this->occurrenceRepository->method('getTimeSeries')->willReturn([]);
        $this->occurrenceRepository->method('getTrendComparison')->willReturn([
            'server_error' => ['current' => 5, 'previous' => 0],
        ]);
        $this->occurrenceRepository->method('countSince')->willReturn([]);

        $response = $this->controller->stats(new Request());
        $data = json_decode($response->getContent(), true);

        $this->assertSame('up', $data['trends']['server_error']['direction']);
        $this->assertSame(100, $data['trends']['server_error']['changePercent']);
    }

    // ── detail() ───────────────────────────────────────────────────────────

    public function testDetailReturns404WhenAlertNotFound(): void
    {
        $this->alertRepository->method('find')->with(99)->willReturn(null);

        $response = $this->controller->detail(99);

        $this->assertSame(404, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testDetailReturnsAlertData(): void
    {
        $alert = $this->makeAlert(SystemAlertCategory::SERVER_ERROR, 'fp5', 'Server-Fehler Detail');
        $alert->setClientIp('192.168.1.1');

        $this->alertRepository->method('find')->with(1)->willReturn($alert);

        $response = $this->controller->detail(1);
        $data = json_decode($response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('server_error', $data['category']);
        $this->assertSame('Server-Fehler Detail', $data['message']);
        $this->assertSame('192.168.1.1', $data['clientIp']);
    }

    // ── resolve() ──────────────────────────────────────────────────────────

    public function testResolveReturns404WhenAlertNotFound(): void
    {
        $this->alertRepository->method('find')->with(77)->willReturn(null);

        $request = new Request([], [], [], [], [], [], json_encode(['note' => 'done']));
        $response = $this->controller->resolve(77, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testResolveCallsResolveOnAlertAndFlushes(): void
    {
        $alert = $this->makeAlert();
        $this->alertRepository->method('find')->with(5)->willReturn($alert);
        $this->em->expects($this->once())->method('flush');

        $request = new Request([], [], [], [], [], [], json_encode(['note' => 'Problem gelöst']));
        $response = $this->controller->resolve(5, $request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($alert->isResolved());
        $this->assertSame('Problem gelöst', $alert->getResolvedNote());
    }

    public function testResolveWithoutNotePassesNullNote(): void
    {
        $alert = $this->makeAlert();
        $this->alertRepository->method('find')->willReturn($alert);
        $this->em->method('flush');

        $request = new Request([], [], [], [], [], [], '{}');
        $response = $this->controller->resolve(1, $request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($alert->isResolved());
        $this->assertNull($alert->getResolvedNote());
    }

    // ── reopen() ───────────────────────────────────────────────────────────

    public function testReopenReturns404WhenAlertNotFound(): void
    {
        $this->alertRepository->method('find')->with(88)->willReturn(null);

        $response = $this->controller->reopen(88);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testReopenCallsReopenOnAlertAndFlushes(): void
    {
        $alert = $this->makeAlert();
        $alert->resolve('done');

        $this->assertTrue($alert->isResolved());

        $this->alertRepository->method('find')->with(3)->willReturn($alert);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->reopen(3);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertFalse($alert->isResolved());
    }

    public function testReopenResponseContainsAlertData(): void
    {
        $alert = $this->makeAlert(SystemAlertCategory::BRUTE_FORCE, 'fp9', 'Reopen test');
        $alert->resolve('old note');

        $this->alertRepository->method('find')->willReturn($alert);
        $this->em->method('flush');

        $response = $this->controller->reopen(9);
        $data = json_decode($response->getContent(), true);

        $this->assertSame('brute_force', $data['category']);
        $this->assertFalse($data['isResolved']);
    }
}
