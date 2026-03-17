<?php

declare(strict_types=1);

namespace App\Tests\Unit\EventSubscriber;

use App\EventSubscriber\SecurityAlertSubscriber;
use App\Service\AdminAlertService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AuthenticatorInterface;
use Symfony\Component\Security\Http\Event\LoginFailureEvent;

class SecurityAlertSubscriberTest extends TestCase
{
    private AdminAlertService&MockObject $adminAlertService;
    private LoggerInterface&MockObject $securityLogger;
    private SecurityAlertSubscriber $subscriber;

    protected function setUp(): void
    {
        $this->adminAlertService = $this->createMock(AdminAlertService::class);
        $this->securityLogger = $this->createMock(LoggerInterface::class);

        $this->subscriber = new SecurityAlertSubscriber(
            $this->adminAlertService,
            $this->securityLogger,
        );
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private function makeEvent(
        Request $request,
        AuthenticationException $exception
    ): LoginFailureEvent {
        $authenticator = $this->createMock(AuthenticatorInterface::class);

        return new LoginFailureEvent($exception, $authenticator, $request, null, 'main');
    }

    // ── getSubscribedEvents ────────────────────────────────────────────────

    public function testSubscribesToLoginFailureEvent(): void
    {
        $events = SecurityAlertSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey(LoginFailureEvent::class, $events);
    }

    // ── invalid_state auf connect_google_check wird übersprungen ───────────

    /**
     * Bots treffen /connect/google/check ohne vorherigen OAuth-Flow.
     * Dies erzeugt invalid_state – das ist kein Angriff und darf keinen
     * Admin-Alert oder WARNING-Log auslösen.
     */
    public function testInvalidStateOnGoogleCheckRouteIsIgnored(): void
    {
        $request = Request::create('/connect/google/check');
        $request->attributes->set('_route', 'connect_google_check');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->securityLogger->expects($this->never())->method('warning');
        $this->adminAlertService->expects($this->never())->method('trackLoginFailure');

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    /**
     * Echter Nutzer mit abgelaufener Session erzeugt ebenfalls invalid_state.
     * Da der Grund identisch ist und die Route dieselbe, wird auch dieser Fall
     * ignoriert – der GoogleAuthenticator leitet ihn bereits korrekt weiter.
     */
    public function testInvalidStateOnGoogleCheckRouteIsIgnoredEvenWithSessionHint(): void
    {
        $request = Request::create('/connect/google/check', 'GET', ['state' => 'old-state']);
        $request->attributes->set('_route', 'connect_google_check');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->securityLogger->expects($this->never())->method('warning');
        $this->adminAlertService->expects($this->never())->method('trackLoginFailure');

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    // ── Normale Fehler werden weiterhin geloggt und gemeldet ──────────────

    /**
     * Ein echter Login-Fehler (falsche Zugangsdaten) muss geloggt und dem
     * AdminAlertService gemeldet werden.
     */
    public function testRegularLoginFailureIsLoggedAndTracked(): void
    {
        $request = Request::create('/api/auth/login', 'POST');
        $request->attributes->set('_route', 'api_auth_login');

        $exception = new AuthenticationException('Bad credentials.');

        $this->securityLogger->expects($this->once())->method('warning')
            ->with($this->stringContains('[SecurityAlert]'));

        $this->adminAlertService->expects($this->once())->method('trackLoginFailure');

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    /**
     * invalid_state auf einer anderen Route als connect_google_check ist
     * ungewöhnlich und muss geloggt werden (möglicher Replay-Angriff).
     */
    public function testInvalidStateOnOtherRouteIsStillLogged(): void
    {
        $request = Request::create('/some/other/check');
        $request->attributes->set('_route', 'some_other_route');

        $exception = new CustomUserMessageAuthenticationException('invalid_state');

        $this->securityLogger->expects($this->once())->method('warning')
            ->with($this->stringContains('[SecurityAlert]'));

        $this->adminAlertService->expects($this->once())->method('trackLoginFailure');

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    /**
     * ip-adresse wird korrekt an den AdminAlertService weitergegeben.
     */
    public function testClientIpIsPassedToAdminAlertService(): void
    {
        $request = Request::create('/api/auth/login', 'POST');
        $request->attributes->set('_route', 'api_auth_login');
        $request->server->set('REMOTE_ADDR', '1.2.3.4');

        $exception = new AuthenticationException('Bad credentials.');

        $this->adminAlertService->expects($this->once())
            ->method('trackLoginFailure')
            ->with(
                $this->anything(),
                $this->stringContains('1.2.3.4'),
                $this->anything()
            );

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    /**
     * Route wird als Teil des Grundes an den AdminAlertService übergeben.
     */
    public function testRouteIsIncludedInReason(): void
    {
        $request = Request::create('/api/auth/login', 'POST');
        $request->attributes->set('_route', 'api_auth_login');

        $exception = new AuthenticationException('Bad credentials.');

        $this->adminAlertService->expects($this->once())
            ->method('trackLoginFailure')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->stringContains('api_auth_login')
            );

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }

    /**
     * E-Mail aus JSON-Body wird als Identifier extrahiert.
     */
    public function testEmailFromJsonBodyIsExtractedAsIdentifier(): void
    {
        $request = Request::create(
            '/api/auth/login',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => 'user@example.com']) ?: ''
        );
        $request->attributes->set('_route', 'api_auth_login');

        $exception = new AuthenticationException('Bad credentials.');

        $this->adminAlertService->expects($this->once())
            ->method('trackLoginFailure')
            ->with('user@example.com', $this->anything(), $this->anything());

        $this->subscriber->onLoginFailure($this->makeEvent($request, $exception));
    }
}
