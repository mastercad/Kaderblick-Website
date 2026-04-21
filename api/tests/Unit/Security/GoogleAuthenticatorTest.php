<?php

declare(strict_types=1);

namespace App\Tests\Unit\Security;

use App\Entity\User;
use App\Security\GoogleAuthenticator;
use App\Service\RefreshTokenService;
use App\Service\RegistrationNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use KnpU\OAuth2ClientBundle\Client\OAuth2Client;
use KnpU\OAuth2ClientBundle\Client\Provider\GoogleClient;
use KnpU\OAuth2ClientBundle\Exception\InvalidStateException;
use League\OAuth2\Client\Provider\ResourceOwnerInterface;
use League\OAuth2\Client\Token\AccessToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
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
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Twig\Environment;

#[AllowMockObjectsWithoutExpectations]
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

    /**
     * Echter Nutzer: Session-State ist gesetzt (z. B. abgelaufene oder doppelte Tab-Session).
     * → Neuer OAuth-Flow wird gestartet, Info-Log wird geschrieben.
     */
    public function testOnAuthenticationFailureRedirectsToGoogleWhenSessionStateIsPresent(): void
    {
        $session = new Session(new MockArraySessionStorage());
        $session->set(OAuth2Client::OAUTH2_SESSION_STATE_KEY, 'valid-session-state');

        $request = Request::create('/connect/google/check');
        $request->setSession($session);
        $request->attributes->set('_route', 'connect_google_check');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->logger->expects($this->once())->method('info')
            ->with($this->stringContains('Retry'));

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        $this->assertNotNull($response);
        $this->assertSame('/connect/google', $response->getTargetUrl());
    }

    /**
     * Bot / Direktaufruf: Kein Session-State vorhanden.
     * → Redirect zu /login, kein neuer OAuth-Flow, Debug-Log statt Info.
     */
    public function testOnAuthenticationFailureRedirectsToLoginWhenNoSessionStatePresent(): void
    {
        // Request ohne Session (Bot oder direkter Probe-Request)
        $request = Request::create('/connect/google/check');
        $request->attributes->set('_route', 'connect_google_check');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->logger->expects($this->never())->method('info');
        $this->logger->expects($this->once())->method('debug')
            ->with($this->stringContains('Bot'));

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        $this->assertNotNull($response);
        $this->assertSame('/login', $response->getTargetUrl());
    }

    /**
     * Bot / Direktaufruf: Session existiert, aber der OAuth-State-Key wurde nie gesetzt
     * (z. B. Session mit anderem Inhalt, aber kein laufender OAuth-Flow).
     * → Wie kein Session-State: Redirect zu /login, kein neuer OAuth-Flow.
     */
    public function testOnAuthenticationFailureRedirectsToLoginWhenSessionExistsButStateKeyMissing(): void
    {
        $session = new Session(new MockArraySessionStorage());
        // Session hat keinen OAUTH2_SESSION_STATE_KEY

        $request = Request::create('/connect/google/check');
        $request->setSession($session);
        $request->attributes->set('_route', 'connect_google_check');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->logger->expects($this->never())->method('info');

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        $this->assertNotNull($response);
        $this->assertSame('/login', $response->getTargetUrl());
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

    // ── authenticate(): Google avatar URL persistence ─────────────────────

    /**
     * Helper: builds a mock GoogleClient that returns a successful OAuth exchange.
     *
     * @param array<string, mixed> $googleUserData Data returned by $googleUser->toArray()
     * @param string               $googleId       The Google user ID
     */
    private function makeSuccessfulGoogleClient(array $googleUserData, string $googleId): GoogleClient&MockObject
    {
        $googleClient = $this->createMock(GoogleClient::class);
        $accessToken = $this->createMock(AccessToken::class);
        $googleUser = $this->createMock(ResourceOwnerInterface::class);

        $googleUser->method('getId')->willReturn($googleId);
        $googleUser->method('toArray')->willReturn($googleUserData);

        $googleClient->method('getAccessToken')->willReturn($accessToken);
        $googleClient->method('fetchUserFromToken')->willReturn($googleUser);

        return $googleClient;
    }

    /**
     * Invokes the UserBadge loader directly so unit tests can exercise the
     * authenticate() closure without going through the full security stack.
     */
    private function invokeAuthenticateLoader(Request $request): User
    {
        $passport = $this->authenticator->authenticate($request);

        /** @var UserBadge $badge */
        $badge = $passport->getBadge(UserBadge::class);
        $loader = $badge->getUserLoader();

        /** @var User $user */
        $user = $loader($badge->getUserIdentifier());

        return $user;
    }

    public function testAuthenticateSetsGoogleAvatarUrlOnExistingUser(): void
    {
        $pictureUrl = 'https://lh3.googleusercontent.com/a/photo.jpg';
        $googleId = 'google-id-existing';

        $existingUser = new User();
        $existingUser->setEmail('existing@gmail.com');
        $existingUser->setGoogleId($googleId);
        $existingUser->setIsVerified(true);

        $googleUserData = [
            'email' => 'existing@gmail.com',
            'given_name' => 'Max',
            'family_name' => 'Mustermann',
            'picture' => $pictureUrl,
        ];

        $this->clientRegistry->method('getClient')->with('google')
            ->willReturn($this->makeSuccessfulGoogleClient($googleUserData, $googleId));

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->with(['googleId' => $googleId])->willReturn($existingUser);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->expects($this->once())->method('flush');

        $user = $this->invokeAuthenticateLoader(Request::create('/connect/google/check'));

        $this->assertSame($existingUser, $user);
        $this->assertSame($pictureUrl, $user->getGoogleAvatarUrl());
    }

    public function testAuthenticateSkipsGoogleAvatarUrlWhenPictureIsMissing(): void
    {
        $googleId = 'google-id-no-picture';

        $existingUser = new User();
        $existingUser->setEmail('nophoto@gmail.com');
        $existingUser->setGoogleId($googleId);
        $existingUser->setIsVerified(true);

        // Google returns no picture field
        $googleUserData = [
            'email' => 'nophoto@gmail.com',
            'given_name' => 'Test',
            'family_name' => 'User',
        ];

        $this->clientRegistry->method('getClient')->with('google')
            ->willReturn($this->makeSuccessfulGoogleClient($googleUserData, $googleId));

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->with(['googleId' => $googleId])->willReturn($existingUser);
        $this->em->method('getRepository')->willReturn($repo);
        // flush must NOT be called when there is no picture to persist
        $this->em->expects($this->never())->method('flush');

        $user = $this->invokeAuthenticateLoader(Request::create('/connect/google/check'));

        $this->assertNull($user->getGoogleAvatarUrl());
    }

    public function testAuthenticateSetsGoogleAvatarUrlOnNewUser(): void
    {
        $pictureUrl = 'https://lh3.googleusercontent.com/a/new-user.jpg';
        $googleId = 'google-id-new';
        $email = 'newuser@gmail.com';

        $googleUserData = [
            'email' => $email,
            'given_name' => 'New',
            'family_name' => 'User',
            'picture' => $pictureUrl,
        ];

        $this->clientRegistry->method('getClient')->with('google')
            ->willReturn($this->makeSuccessfulGoogleClient($googleUserData, $googleId));

        $repo = $this->createMock(EntityRepository::class);
        // Neither by googleId nor by email
        $repo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('persist')->willReturnCallback(fn () => null);
        // flush() is called twice: once after persist (new user) and once for the avatar URL
        $this->em->expects($this->exactly(2))->method('flush');

        $this->params->method('get')->willReturn('https://example.com');
        $this->mailer->method('send')->willReturnCallback(fn () => null);

        $request = Request::create('/connect/google/check');

        $user = $this->invokeAuthenticateLoader($request);

        $this->assertInstanceOf(User::class, $user);
        $this->assertSame($pictureUrl, $user->getGoogleAvatarUrl());
        $this->assertSame($email, $user->getEmail());
    }

    public function testAuthenticateUpdatesGoogleAvatarUrlOnEveryLogin(): void
    {
        $googleId = 'google-id-update';

        $existingUser = new User();
        $existingUser->setEmail('update@gmail.com');
        $existingUser->setGoogleId($googleId);
        $existingUser->setGoogleAvatarUrl('https://old-photo.jpg');

        $newPictureUrl = 'https://new-photo.jpg';
        $googleUserData = [
            'email' => 'update@gmail.com',
            'given_name' => 'Update',
            'family_name' => 'User',
            'picture' => $newPictureUrl,
        ];

        $this->clientRegistry->method('getClient')->with('google')
            ->willReturn($this->makeSuccessfulGoogleClient($googleUserData, $googleId));

        $repo = $this->createMock(EntityRepository::class);
        $repo->method('findOneBy')->willReturn($existingUser);
        $this->em->method('getRepository')->willReturn($repo);
        $this->em->method('flush');

        $user = $this->invokeAuthenticateLoader(Request::create('/connect/google/check'));

        $this->assertSame(
            $newPictureUrl,
            $user->getGoogleAvatarUrl(),
            'The Google avatar URL must be refreshed on every login, not only on first login.'
        );
    }
}
