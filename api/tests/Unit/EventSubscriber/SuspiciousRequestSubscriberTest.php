<?php

namespace App\Tests\Unit\EventSubscriber;

use App\EventSubscriber\SuspiciousRequestSubscriber;
use App\Service\AdminAlertService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;

class SuspiciousRequestSubscriberTest extends TestCase
{
    private AdminAlertService&MockObject $alertService;
    private SuspiciousRequestSubscriber $subscriber;
    private HttpKernelInterface&MockObject $kernel;

    protected function setUp(): void
    {
        $this->alertService = $this->createMock(AdminAlertService::class);
        $this->subscriber = new SuspiciousRequestSubscriber($this->alertService);
        $this->kernel = $this->createMock(HttpKernelInterface::class);
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private function makeEvent(string $uri, string $method = 'GET', bool $main = true): RequestEvent
    {
        $request = Request::create($uri, $method);
        $type = $main ? HttpKernelInterface::MAIN_REQUEST : HttpKernelInterface::SUB_REQUEST;

        return new RequestEvent($this->kernel, $request, $type);
    }

    // ── getSubscribedEvents ────────────────────────────────────────────────

    public function testRegistersOnKernelRequestWithHighPriority(): void
    {
        $events = SuspiciousRequestSubscriber::getSubscribedEvents();

        $this->assertArrayHasKey('kernel.request', $events);
        // Eintrag kann [method, priority] sein
        $entry = $events['kernel.request'];
        $priority = is_array($entry) ? ($entry[1] ?? 0) : 0;
        $this->assertGreaterThanOrEqual(50, $priority, 'Subscriber sollte hohe Priorität haben (≥ 50)');
    }

    // ── Ignorieren von Sub-Requests ────────────────────────────────────────

    public function testIgnoresSubRequests(): void
    {
        $this->alertService->expects($this->never())->method('trackSuspiciousRequest');

        $this->subscriber->onKernelRequest(
            $this->makeEvent('/../../../etc/passwd', 'GET', false)
        );
    }

    // ── Reguläre Anfragen werden nicht alarmiert ───────────────────────────

    public function testDoesNotTriggerForNormalApiRequest(): void
    {
        $this->alertService->expects($this->never())->method('trackSuspiciousRequest');

        $this->subscriber->onKernelRequest($this->makeEvent('/api/login'));
    }

    public function testDoesNotTriggerForNormalPageRequest(): void
    {
        $this->alertService->expects($this->never())->method('trackSuspiciousRequest');

        $this->subscriber->onKernelRequest($this->makeEvent('/admin/feedback'));
    }

    public function testDoesNotTriggerForApiWithQueryString(): void
    {
        $this->alertService->expects($this->never())->method('trackSuspiciousRequest');

        $this->subscriber->onKernelRequest($this->makeEvent('/api/superadmin/system-alerts/stats?period=7d'));
    }

    // ── Path Traversal ─────────────────────────────────────────────────────

    public function testDetectsPathTraversalWithEncodedSlash(): void
    {
        // Originale Anfrage aus dem User-Beispiel: GET /..%2F..%2F..%2Fetc%2Fpasswd
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with(
                $this->stringContains('..%2F'),
                'GET',
                $this->anything(),
                'Path Traversal'
            );

        $this->subscriber->onKernelRequest($this->makeEvent('/..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd'));
    }

    public function testDetectsPathTraversalWithDotDotSlash(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Path Traversal');

        $this->subscriber->onKernelRequest($this->makeEvent('/../../../etc/shadow'));
    }

    public function testDetectsDoubleEncodedPathTraversal(): void
    {
        // ..%252F dekodiert zu ..%2F → Path Traversal
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Path Traversal');

        $this->subscriber->onKernelRequest($this->makeEvent('/..%252F..%252Fetc%252Fpasswd'));
    }

    // ── Sensible Dateien ───────────────────────────────────────────────────

    public function testDetectsEnvFile(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), '.env / Konfiguration');

        $this->subscriber->onKernelRequest($this->makeEvent('/.env'));
    }

    public function testDetectsGitDirectory(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), '.env / Konfiguration');

        $this->subscriber->onKernelRequest($this->makeEvent('/.git/config'));
    }

    public function testDetectsEtcPasswd(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Sensible Systemdateien');

        $this->subscriber->onKernelRequest($this->makeEvent('/etc/passwd'));
    }

    // ── CMS-Scanner ────────────────────────────────────────────────────────

    public function testDetectsWpAdmin(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'CMS-Scan (WP/Joomla)');

        $this->subscriber->onKernelRequest($this->makeEvent('/wp-admin/'));
    }

    public function testDetectsXmlrpc(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'CMS-Scan (WP/Joomla)');

        $this->subscriber->onKernelRequest($this->makeEvent('/xmlrpc.php'));
    }

    // ── Admin-Tools ────────────────────────────────────────────────────────

    public function testDetectsPhpMyAdmin(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Admin-Tools');

        $this->subscriber->onKernelRequest($this->makeEvent('/phpmyadmin/'));
    }

    public function testDetectsPhpInfo(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Admin-Tools');

        $this->subscriber->onKernelRequest($this->makeEvent('/phpinfo.php'));
    }

    // ── Injection-Versuche ─────────────────────────────────────────────────

    public function testDetectsScriptInjectionInUri(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'Script-Injection');

        // URL-encodiert: <script> → %3Cscript%3E (browser-encoded)
        $this->subscriber->onKernelRequest($this->makeEvent('/search?q=%3Cscript%3Ealert(1)%3C/script%3E'));
    }

    public function testDetectsSqlInjection(): void
    {
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), 'GET', $this->anything(), 'SQL-Injection');

        $this->subscriber->onKernelRequest($this->makeEvent('/api/users?id=1+UNION+SELECT+password+FROM+users'));
    }

    // ── Nur erster Treffer pro Request ─────────────────────────────────────

    public function testOnlyFirstPatternMatchIsReported(): void
    {
        // URI trifft sowohl Path Traversal als auch etc/passwd – aber nur 1× Aufruf
        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest');

        $this->subscriber->onKernelRequest($this->makeEvent('/..%2F..%2Fetc%2Fpasswd'));
    }

    // ── IP-Adresse wird korrekt übergeben ─────────────────────────────────

    public function testPassesClientIpToService(): void
    {
        $request = Request::create('/.env', 'GET');
        $request->server->set('REMOTE_ADDR', '1.2.3.4');

        $event = new RequestEvent(
            $this->kernel,
            $request,
            HttpKernelInterface::MAIN_REQUEST
        );

        $this->alertService->expects($this->once())
            ->method('trackSuspiciousRequest')
            ->with($this->anything(), $this->anything(), '1.2.3.4', $this->anything());

        $this->subscriber->onKernelRequest($event);
    }
}
