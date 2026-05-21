<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\PublicHolidayController;
use App\Service\PublicHolidayService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

#[AllowMockObjectsWithoutExpectations]
class PublicHolidayControllerTest extends TestCase
{
    private PublicHolidayService&MockObject $service;
    private PublicHolidayController $controller;

    protected function setUp(): void
    {
        $this->service = $this->createMock(PublicHolidayService::class);
        $this->controller = new PublicHolidayController($this->service);

        // Minimal Symfony container so AbstractController::json() works
        $container = new ContainerBuilder();
        $container->set(
            'serializer',
            new class {
                /** @param array<string, mixed> $context */
                public function serialize(mixed $data, string $format, array $context = []): string
                {
                    return json_encode($data, JSON_THROW_ON_ERROR);
                }
            },
        );

        $token = $this->createMock(TokenInterface::class);
        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);
        $container->set('security.token_storage', $tokenStorage);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    /** @param array<string, string> $query */
    private function request(array $query = []): Request
    {
        return new Request($query);
    }

    /** @return array<mixed> */
    private function decodeResponse(string $content): array
    {
        $data = json_decode($content, true);
        $this->assertIsArray($data);

        return $data;
    }

    // ── 200 OK – valid requests ───────────────────────────────────────────────

    public function testValidRequestReturns200(): void
    {
        $this->service->method('getHolidays')->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'BY']));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testServiceIsCalledWithCorrectYearAndState(): void
    {
        $this->service
            ->expects($this->once())
            ->method('getHolidays')
            ->with(2026, 'BY')
            ->willReturn([]);

        $this->controller->list($this->request(['year' => '2026', 'state' => 'BY']));
    }

    public function testResponseContainsHolidayData(): void
    {
        $this->service->method('getHolidays')->willReturn([
            ['name' => 'Neujahr', 'date' => '2026-01-01'],
            ['name' => 'Tag der Arbeit', 'date' => '2026-05-01'],
        ]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'BY']));
        $data = $this->decodeResponse($response->getContent());

        $this->assertCount(2, $data);
        $this->assertSame('Neujahr', $data[0]['name']);
        $this->assertSame('2026-01-01', $data[0]['date']);
    }

    public function testResponseIsJsonArray(): void
    {
        $this->service->method('getHolidays')->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'NATIONAL']));
        $data = $this->decodeResponse($response->getContent());

        $this->assertSame([], $data);
    }

    // ── State code normalisation (uppercase) ──────────────────────────────────

    public function testLowercaseStateIsUppercased(): void
    {
        $this->service
            ->expects($this->once())
            ->method('getHolidays')
            ->with(2026, 'BY')
            ->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'by']));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testMixedCaseStateIsUppercased(): void
    {
        $this->service
            ->expects($this->once())
            ->method('getHolidays')
            ->with(2026, 'NW')
            ->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'Nw']));

        $this->assertSame(200, $response->getStatusCode());
    }

    // ── Default values ────────────────────────────────────────────────────────

    public function testDefaultStateIsNational(): void
    {
        $this->service
            ->expects($this->once())
            ->method('getHolidays')
            ->with($this->anything(), 'NATIONAL')
            ->willReturn([]);

        $this->controller->list($this->request(['year' => '2026']));
    }

    public function testDefaultYearIsCurrentYear(): void
    {
        $this->service
            ->expects($this->once())
            ->method('getHolidays')
            ->with((int) date('Y'), $this->anything())
            ->willReturn([]);

        $this->controller->list($this->request(['state' => 'BY']));
    }

    // ── Year validation ───────────────────────────────────────────────────────

    public function testYearBelow1990Returns400(): void
    {
        $this->service->expects($this->never())->method('getHolidays');

        $response = $this->controller->list($this->request(['year' => '1989', 'state' => 'BY']));

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testYearAbove2100Returns400(): void
    {
        $this->service->expects($this->never())->method('getHolidays');

        $response = $this->controller->list($this->request(['year' => '2101', 'state' => 'BY']));

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testYear1990IsAccepted(): void
    {
        $this->service->method('getHolidays')->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '1990', 'state' => 'BY']));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testYear2100IsAccepted(): void
    {
        $this->service->method('getHolidays')->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2100', 'state' => 'BY']));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testYearErrorResponseContainsErrorKey(): void
    {
        $response = $this->controller->list($this->request(['year' => '1900', 'state' => 'BY']));
        $data = $this->decodeResponse($response->getContent());

        $this->assertArrayHasKey('error', $data);
    }

    // ── State code validation ─────────────────────────────────────────────────

    public function testUnknownStateCodeReturns400(): void
    {
        $this->service->expects($this->never())->method('getHolidays');

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'XX']));

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testStateErrorResponseContainsErrorKey(): void
    {
        $response = $this->controller->list($this->request(['year' => '2026', 'state' => 'INVALID']));
        $data = $this->decodeResponse($response->getContent());

        $this->assertArrayHasKey('error', $data);
    }

    #[DataProvider('validStateCodeProvider')]
    public function testAllValidStateCodesReturn200(string $code): void
    {
        $this->service->method('getHolidays')->willReturn([]);

        $response = $this->controller->list($this->request(['year' => '2026', 'state' => $code]));

        $this->assertSame(200, $response->getStatusCode(), "Expected 200 for state code '{$code}'");
    }

    /** @return array<string, array{string}> */
    public static function validStateCodeProvider(): array
    {
        return [
            'NATIONAL' => ['NATIONAL'],
            'BW' => ['BW'],
            'BY' => ['BY'],
            'BE' => ['BE'],
            'BB' => ['BB'],
            'HB' => ['HB'],
            'HH' => ['HH'],
            'HE' => ['HE'],
            'MV' => ['MV'],
            'NI' => ['NI'],
            'NW' => ['NW'],
            'RP' => ['RP'],
            'SL' => ['SL'],
            'SN' => ['SN'],
            'ST' => ['ST'],
            'SH' => ['SH'],
            'TH' => ['TH'],
        ];
    }
}
