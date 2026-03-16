<?php

namespace App\EventSubscriber;

use App\Service\AdminAlertService;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Security\Http\Event\LoginFailureEvent;

/**
 * Überwacht Authentifizierungsfehler bei allen Symfony-Authenticatoren
 * (Google OAuth, API-Token, …) und benachrichtigt den Admin.
 *
 * Einfache Passwort-Login-Fehler werden direkt im AuthController getrackt,
 * da dieser eine eigene JsonResponse zurückgibt statt eine Exception zu werfen.
 */
class SecurityAlertSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly AdminAlertService $adminAlertService,
        private readonly LoggerInterface $securityLogger,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            LoginFailureEvent::class => 'onLoginFailure',
        ];
    }

    public function onLoginFailure(LoginFailureEvent $event): void
    {
        $request = $event->getRequest();
        $exception = $event->getException();
        $clientIp = $request->getClientIp() ?? 'unbekannt';

        // Versuche, die betroffene E-Mail/Kennung aus dem Request zu extrahieren
        $identifier = $this->extractIdentifier($request);

        $reason = '' !== $exception->getMessageKey()
            ? rtrim($exception->getMessageKey(), '.')
            : get_class($exception);

        $this->securityLogger->warning(
            sprintf(
                '[SecurityAlert] Login-Fehler – Identifier: %s | IP: %s | Grund: %s | Route: %s',
                $identifier,
                $clientIp,
                $reason,
                $request->attributes->get('_route', 'n/a')
            )
        );

        $this->adminAlertService->trackLoginFailure(
            email: $identifier,
            clientIp: $clientIp,
            reason: sprintf('%s [Route: %s]', $reason, $request->attributes->get('_route', 'n/a'))
        );
    }

    private function extractIdentifier(\Symfony\Component\HttpFoundation\Request $request): string
    {
        // JSON-Body (z. B. {"email": "..."})
        $body = (string) $request->getContent();
        if ('' !== $body) {
            $decoded = json_decode($body, true);
            if (is_array($decoded)) {
                return (string) ($decoded['email'] ?? $decoded['username'] ?? $decoded['identifier'] ?? '');
            }
        }

        // Query-Parameter als Fallback
        return (string) ($request->query->get('email') ?? $request->query->get('username') ?? '');
    }
}
