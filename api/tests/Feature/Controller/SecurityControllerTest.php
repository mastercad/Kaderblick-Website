<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Service\LoginSecurityService;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Functional tests for SecurityController.
 *
 * Uses a mock LoginSecurityService so no database is required.
 */
#[AllowMockObjectsWithoutExpectations]
class SecurityControllerTest extends WebTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        restore_exception_handler();
    }

    private function mockSecurityService(bool $lockResult): LoginSecurityService&MockObject
    {
        /** @var LoginSecurityService&MockObject $mock */
        $mock = $this->createMock(LoginSecurityService::class);
        $mock->method('lockAccountByToken')->willReturn($lockResult);

        return $mock;
    }

    // ── GET /api/security/lock-account ────────────────────────────────────────

    public function testLockAccountWithValidTokenReturns200(): void
    {
        $client = static::createClient();
        static::getContainer()->set(LoginSecurityService::class, $this->mockSecurityService(true));

        $client->request('GET', '/api/security/lock-account?token=abc123valid');

        $this->assertResponseStatusCodeSame(200);
    }

    public function testLockAccountWithValidTokenReturnsSuccessPayload(): void
    {
        $client = static::createClient();
        static::getContainer()->set(LoginSecurityService::class, $this->mockSecurityService(true));

        $client->request('GET', '/api/security/lock-account?token=abc123valid');

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('message', $data);
    }

    public function testLockAccountWithInvalidTokenReturns400(): void
    {
        $client = static::createClient();
        static::getContainer()->set(LoginSecurityService::class, $this->mockSecurityService(false));

        $client->request('GET', '/api/security/lock-account?token=badtoken');

        $this->assertResponseStatusCodeSame(400);
    }

    public function testLockAccountWithInvalidTokenReturnsErrorPayload(): void
    {
        $client = static::createClient();
        static::getContainer()->set(LoginSecurityService::class, $this->mockSecurityService(false));

        $client->request('GET', '/api/security/lock-account?token=badtoken');

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
        $this->assertNotEmpty($data['error']);
    }

    public function testLockAccountWithMissingTokenReturns400(): void
    {
        $client = static::createClient();
        static::getContainer()->set(LoginSecurityService::class, $this->mockSecurityService(false));

        $client->request('GET', '/api/security/lock-account');

        $this->assertResponseStatusCodeSame(400);
    }

    public function testLockAccountPassesTokenToService(): void
    {
        $client = static::createClient();

        /** @var LoginSecurityService&MockObject $mock */
        $mock = $this->createMock(LoginSecurityService::class);
        $mock->expects($this->once())
            ->method('lockAccountByToken')
            ->with('my-specific-token')
            ->willReturn(true);

        static::getContainer()->set(LoginSecurityService::class, $mock);

        $client->request('GET', '/api/security/lock-account?token=my-specific-token');

        $this->assertResponseStatusCodeSame(200);
    }
}
