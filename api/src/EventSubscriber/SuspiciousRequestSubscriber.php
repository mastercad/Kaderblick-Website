<?php

namespace App\EventSubscriber;

use App\Service\AdminAlertService;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Erkennt aktive Scan- und Hack-Versuche anhand typischer URL-Muster
 * und meldet sie als SystemAlert der Kategorie SUSPICIOUS_REQUEST.
 *
 * Erkannte Angriffsmuster:
 *  - Path Traversal     (../  %2e%2e%2f  ..%2F  usw.)
 *  - Sensible Dateien   (/.env  /etc/passwd  /proc/self  …)
 *  - CMS-Scanner        (/wp-admin  /wp-login  /xmlrpc.php  …)
 *  - Admin-Tools        (/phpmyadmin  /adminer  /phpinfo.php  …)
 *  - Script-Injection   (<script>  javascript:  …)
 *  - SQL-Injection      (UNION SELECT  DROP TABLE  …)
 *  - Shell-Injection    (| cat  ; wget  $( curl  …)
 */
class SuspiciousRequestSubscriber implements EventSubscriberInterface
{
    /**
     * Muster: [Label => Regex].
     * Beim ersten Match wird ein Alert ausgelöst und die Schleife verlassen.
     *
     * @var array<string, string>
     */
    private const PATTERNS = [
        'Path Traversal' => '/(\.\.|%2e%2e|%252e|\.%2e|%2e\.)(%2f|%5c|\/|\\\\)/i',
        '.env / Konfiguration' => '/\/(\.env|\.git\/|\.htaccess|\.htpasswd|web\.config|appsettings\.json|settings\.py|config\.php)/i',
        'Sensible Systemdateien' => '/\/(etc\/passwd|etc\/shadow|proc\/self|windows\/win\.ini|boot\.ini|system32\/)/i',
        'CMS-Scan (WP/Joomla)' => '/\/(wp-login|wp-admin|wp-includes|wp-content|xmlrpc\.php|joomla|drupal|typo3|administrator\/)/i',
        'Admin-Tools' => '/\/(phpmyadmin|adminer|pma|myadmin|phpinfo\.php|eval-stdin\.php|info\.php)/i',
        'Script-Injection' => '/<script[\s>]|javascript:|data:text\/html|%3cscript/i',
        'SQL-Injection' => '/\bunion\b.{0,30}\bselect\b|\bselect\b.{0,30}\bfrom\b|\bdrop\b.{0,20}\btable\b/i',
        'Shell-Injection' => '/(\||;|&&|\$\(|`)[ \t]{0,5}(cat|wget|curl|bash|sh\b|python|perl|nc\b)/i',
    ];

    public function __construct(
        private readonly AdminAlertService $adminAlertService,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        // Priorität 100 – sehr früh, vor Routing und Security-Firewall
        return [
            KernelEvents::REQUEST => ['onKernelRequest', 100],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $uri = $request->getRequestUri();
        // rawurldecode um doppelt-enkodierte Sequenzen (%252F → %2F → /) aufzulösen
        $decoded = rawurldecode($uri);

        foreach (self::PATTERNS as $label => $pattern) {
            if (preg_match($pattern, $uri) || ($decoded !== $uri && preg_match($pattern, $decoded))) {
                $this->adminAlertService->trackSuspiciousRequest(
                    requestUri: $uri,
                    method: $request->getMethod(),
                    clientIp: $request->getClientIp() ?? 'unbekannt',
                    matchedPattern: $label,
                );

                // Nur den ersten (spezifischsten) Match pro Request melden
                return;
            }
        }
    }
}
