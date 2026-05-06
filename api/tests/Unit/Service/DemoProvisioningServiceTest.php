<?php

namespace App\Tests\Unit\Service;

use App\Entity\DemoRequest;
use App\Service\DemoProvisioningService;
use App\Service\EmailService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

#[AllowMockObjectsWithoutExpectations]
class DemoProvisioningServiceTest extends TestCase
{
    private EmailService&\PHPUnit\Framework\MockObject\MockObject $emailService;
    private ParameterBagInterface&\PHPUnit\Framework\MockObject\MockObject $params;
    private LoggerInterface&\PHPUnit\Framework\MockObject\MockObject $logger;
    private DemoProvisioningService $service;

    protected function setUp(): void
    {
        $this->emailService = $this->createMock(EmailService::class);
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $this->params->method('get')->with('app.demo_url')->willReturn('https://demo.kaderblick.de');

        $this->service = new DemoProvisioningService(
            $this->emailService,
            $this->params,
            $this->logger,
        );
    }

    private function makeDemoRequest(): DemoRequest
    {
        $req = new DemoRequest();
        $req->setName('Max Muster')->setEmail('max@example.com')->setClubName('FC Test');

        return $req;
    }

    public function testSendDemoAccessCallsEmailServiceWithCorrectTemplate(): void
    {
        $demoRequest = $this->makeDemoRequest();

        $this->emailService->expects($this->once())
            ->method('sendTemplatedEmail')
            ->with(
                'max@example.com',
                $this->isString(),
                'demo_access_credentials',
                $this->arrayHasKey('demoRequest'),
            );

        $this->service->sendDemoAccess($demoRequest);
    }

    public function testSendDemoAccessPassesAllContextKeys(): void
    {
        $demoRequest = $this->makeDemoRequest();

        $this->emailService->expects($this->once())
            ->method('sendTemplatedEmail')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(function (array $context): bool {
                    return array_key_exists('demoRequest', $context)
                        && array_key_exists('demoUrl', $context)
                        && array_key_exists('accounts', $context)
                        && array_key_exists('password', $context);
                }),
            );

        $this->service->sendDemoAccess($demoRequest);
    }

    public function testSendDemoAccessIncludesDemoUrlWithoutTrailingSlash(): void
    {
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->params->method('get')->with('app.demo_url')->willReturn('https://demo.kaderblick.de/');

        $service = new DemoProvisioningService($this->emailService, $this->params, $this->logger);

        $demoRequest = $this->makeDemoRequest();

        $this->emailService->expects($this->once())
            ->method('sendTemplatedEmail')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(fn (array $ctx) => 'https://demo.kaderblick.de' === $ctx['demoUrl']),
            );

        $service->sendDemoAccess($demoRequest);
    }

    public function testSendDemoAccessRethrowsEmailException(): void
    {
        $demoRequest = $this->makeDemoRequest();

        $this->emailService->method('sendTemplatedEmail')->willThrowException(new RuntimeException('SMTP failed'));
        $this->logger->expects($this->once())->method('error');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SMTP failed');

        $this->service->sendDemoAccess($demoRequest);
    }

    public function testGetDemoAccountsReturnsFiveAccounts(): void
    {
        $accounts = $this->service->getDemoAccounts();
        $this->assertCount(5, $accounts);
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
