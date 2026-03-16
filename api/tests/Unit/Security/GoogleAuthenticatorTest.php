<?php

declare(strict_types=1);

namespace App\Tests\Unit\Security;

use App\Security\GoogleAuthenticator;
use App\Service\RefreshTokenService;
use App\Service\RegistrationNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use KnpU\OAuth2ClientBundle\Client\OAuth2Client;
use KnpU\OAuth2ClientBundle\Client\Provider\GoogleClient;
use KnpU\OAuth2ClientBundle\Exception\InvalidStateException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Twig\Environment;

class GoogleAuthenticatorTest extends TestCase
{
    private ClientRegistry&MockObject $clientRegistry;
    private EntityManagerInterface&MockObject $em;
    private JWTTokenManagerInterface&MockObject $jwtManager;
    private RefreshTokenService&MockObject $refreshTokenService;
    private Environment&MockObject $twig;
    private MailerInterface&MockObject $mailer;
    private ParameterBagInterface&MockObject $params;
    private RegistrationNotificationService&MockObject $registrationNotificationService;
    private LoggerInterface&MockObject $logger;
    private GoogleAuthenticator $authenticator;

    protected function setUp(): void
    {
        $this->clientRegistry = $this->createMock(ClientRegistry::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->jwtManager = $this->createMock(JWTTokenManagerInterface::class);
        $this->refreshTokenService = $this->createMock(RefreshTokenService::class);
        $this->twig = $this->createMock(Environment::class);
        $this->mailer = $this->createMock(MailerInterface::class);
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->registrationNotificationService = $this->createMock(RegistrationNotificationService::class);
        $this->logger = $this->createMock(LoggerInterface::class);

        $this->authenticator = new GoogleAuthenticator(
            $this->clientRegistry,
            $this->em,
            $this->jwtManager,
            $this->refreshTokenService,
            $this->twig,
            $this->mailer,
            $this->params,
            $this->registrationNotificationService,
            $this->logger,
        );
    }

    // ── supports() ────────────────────────────────────────────────────────

    public function testSupportsTrueOnGoogleCheckRoute(): void
    {
        $request = Request::create('/connect/google/check');
        $request->attributes->set('_route', 'connect_google_check');

        $this->assertTrue($this->authenticator->supports($request));
    }

    public function testSupportsFalseOnOtherRoutes(): void
    {
        $request = Request::create('/api/login');
        $request->attributes->set('_route', 'api_login');

        $this->assertFalse($this->authenticator->supports($request));
    }

    // ── authenticate(): InvalidStateException handling ────────────────────

    public function testAuthenticateThrowsCustomExceptionOnInvalidState(): void
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $googleClient->method('getAccessToken')
            ->willThrowException(new InvalidStateException('Invalid state'));

        $this->clientRegistry->method('getClient')->with('google')->willReturn($googleClient);

        $request = Request::create('/connect/google/check', 'GET', ['state' => 'url-state-abc']);

        $this->expectException(CustomUserMessageAuthenticationException::class);

        $this->authenticator->authenticate($request);
    }

    public function testAuthenticateLogsWarningWhenStateIsInvalid(): void
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $googleClient->method('getAccessToken')
            ->willThrowException(new InvalidStateException('Invalid state'));

        $this->clientRegistry->method('getClient')->willReturn($googleClient);

        $this->logger->expects($this->once())
            ->method('warning')
            ->with(
                $this->stringContains('Invalid state'),
                $this->arrayHasKey('url_state')
            );

        $request = Request::create('/connect/google/check', 'GET', ['state' => 'bad-state']);

        try {
            $this->authenticator->authenticate($request);
        } catch (CustomUserMessageAuthenticationException) {
            // expected
        }
    }

    public function testAuthenticateLogsSessionStateWhenSessionExists(): void
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $googleClient->method('getAccessToken')
            ->willThrowException(new InvalidStateException('Invalid state'));

        $this->clientRegistry->method('getClient')->willReturn($googleClient);

        $session = new Session(new MockArraySessionStorage());
        $session->set(OAuth2Client::OAUTH2_SESSION_STATE_KEY, 'stored-session-state');

        $request = Request::create('/connect/google/check', 'GET', ['state' => 'different-url-state']);
        $request->setSession($session);

        $this->logger->expects($this->once())
            ->method('warning')
            ->with(
                $this->anything(),
                $this->callback(static function (array $context): bool {
                    return 'stored-session-state' === $context['session_state']
                        && 'different-url-state' === $context['url_state'];
                })
            );

        try {
            $this->authenticator->authenticate($request);
        } catch (CustomUserMessageAuthenticationException) {
            // expected
        }
    }

    public function testAuthenticateLogsNotSetWhenNoSession(): void
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $googleClient->method('getAccessToken')
            ->willThrowException(new InvalidStateException('Invalid state'));

        $this->clientRegistry->method('getClient')->willReturn($googleClient);

        // Request without session
        $request = Request::create('/connect/google/check', 'GET', ['state' => 'any-state']);

        $this->logger->expects($this->once())
            ->method('warning')
            ->with(
                $this->anything(),
                $this->callback(static function (array $context): bool {
                    return str_contains((string) $context['session_state'], 'nicht gesetzt')
                        || 'keine Session' === $context['session_id'];
                })
            );

        try {
            $this->authenticator->authenticate($request);
        } catch (CustomUserMessageAuthenticationException) {
            // expected
        }
    }

    public function testAuthenticateExceptionMessageKeyIsInvalidState(): void
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $googleClient->method('getAccessToken')
            ->willThrowException(new InvalidStateException('Invalid state'));

        $this->clientRegistry->method('getClient')->willReturn($googleClient);

        $request = Request::create('/connect/google/check');

        try {
            $this->authenticator->authenticate($request);
            $this->fail('Expected CustomUserMessageAuthenticationException');
        } catch (CustomUserMessageAuthenticationException $e) {
            $this->assertSame('invalid_state', $e->getMessageKey());
        }
    }

    // ── onAuthenticationFailure() ─────────────────────────────────────────

    public function testOnAuthenticationFailureRedirectsToGoogleOnInvalidState(): void
    {
        $request = Request::create('/connect/google/check');
        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->logger->expects($this->once())->method('info')
            ->with($this->stringContains('Retry'));

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        $this->assertNotNull($response);
        $this->assertSame('/connect/google', $response->getTargetUrl());
    }

    public function testOnAuthenticationFailureRedirectsToLoginForOtherErrors(): void
    {
        $request = Request::create('/connect/google/check');
        $exception = new AuthenticationException('some other error');

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        $this->assertNotNull($response);
        $this->assertStringContainsString('/login', $response->getTargetUrl());
        $this->assertStringContainsString('error=google', $response->getTargetUrl());
    }

    public function testOnAuthenticationFailureDoesNotLogRetryForOtherErrors(): void
    {
        $request = Request::create('/connect/google/check');
        $exception = new AuthenticationException('credentials wrong');

        $this->logger->expects($this->never())->method('info');

        $this->authenticator->onAuthenticationFailure($request, $exception);
    }
}
