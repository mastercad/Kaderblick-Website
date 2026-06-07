<?php

namespace App\Tests\Unit\Service;

use App\Entity\DemoRequest;
use App\Service\DemoProvisioningService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

#[AllowMockObjectsWithoutExpectations]
class DemoProvisioningServiceTest extends TestCase
{
    private HttpClientInterface&\PHPUnit\Framework\MockObject\MockObject $httpClient;
    private LoggerInterface&\PHPUnit\Framework\MockObject\MockObject $logger;
    private DemoProvisioningService $service;

    protected function setUp(): void
    {
        $this->httpClient = $this->createMock(HttpClientInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(204);
        $this->httpClient->method('request')->willReturn($response);

        $this->service = new DemoProvisioningService(
            $this->httpClient,
            $this->logger,
            'test-github-token',
            'test-owner',
            'test-repo',
        );
    }

    private function makeDemoRequest(): DemoRequest
    {
        $req = new DemoRequest();
        $req->setName('Max Muster')->setEmail('max@example.com')->setClubName('FC Test');

        return $req;
    }

    public function testSendDemoAccessDispatchesGitHubWorkflow(): void
    {
        $this->httpClient->expects($this->once())
            ->method('request')
            ->with(
                'POST',
                $this->stringContains('test-owner/test-repo/actions/workflows/provision-demo-instance.yml/dispatches'),
                $this->arrayHasKey('headers'),
            );

        $this->service->sendDemoAccess($this->makeDemoRequest());
    }

    public function testSendDemoAccessThrowsOnNon204Response(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(422);
        $httpClient->method('request')->willReturn($response);

        $service = new DemoProvisioningService(
            $httpClient,
            $this->logger,
            'test-github-token',
            'test-owner',
            'test-repo',
        );

        $this->expectException(RuntimeException::class);
        $service->sendDemoAccess($this->makeDemoRequest());
    }

    public function testSendDemoAccessRethrowsAndLogsHttpClientException(): void
    {
        $this->httpClient->method('request')->willThrowException(new RuntimeException('connection refused'));
        $this->logger->expects($this->once())->method('error');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('connection refused');

        $this->service->sendDemoAccess($this->makeDemoRequest());
    }

    public function testGetDemoAccountsReturnsFourAccounts(): void
    {
        $accounts = $this->service->getDemoAccounts();
        $this->assertCount(4, $accounts);
    }

    public function testGetDemoAccountsHaveRequiredKeys(): void
    {
        foreach ($this->service->getDemoAccounts() as $account) {
            $this->assertArrayHasKey('role', $account);
            $this->assertArrayHasKey('email', $account);
            $this->assertArrayHasKey('description', $account);
        }
    }

    public function testGetDemoPasswordReturnsNonEmptyString(): void
    {
        $password = $this->service->getDemoPassword();
        $this->assertNotEmpty($password);
    }
}
