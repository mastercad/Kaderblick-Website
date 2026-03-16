<?php

namespace App\EventSubscriber;

use App\Service\AdminAlertService;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Fängt unbehandelte Server-Fehler (5xx) ab und benachrichtigt den Admin
 * proaktiv per E-Mail – damit kritische Fehler nicht unbemerkt bleiben.
 *
 * 4xx-Fehler (401, 403, 404 …) werden bewusst nicht gemeldet,
 * da sie im normalen Betrieb erwartet werden.
 */
class CriticalErrorSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly AdminAlertService $adminAlertService,
        private readonly LoggerInterface $securityLogger,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        // Priorität -100: nach allen anderen Exception-Listenern laufen,
        // damit bereits behandelte Ausnahmen nicht doppelt gemeldet werden.
        return [
            KernelEvents::EXCEPTION => ['onKernelException', -100],
        ];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $exception = $event->getThrowable();

        // Nur 5xx-Fehler melden; 4xx sind erwartet und kein Admin-Alert nötig
        if ($exception instanceof HttpExceptionInterface) {
            if ($exception->getStatusCode() < 500) {
                return;
            }
        }

        $request = $event->getRequest();

        $this->securityLogger->error(
            sprintf(
                '[CriticalError] %s: %s – %s %s – IP: %s',
                get_class($exception),
                $exception->getMessage(),
                $request->getMethod(),
                $request->getRequestUri(),
                $request->getClientIp() ?? 'n/a'
            ),
            ['exception' => $exception]
        );

        $this->adminAlertService->sendCriticalError(
            errorMessage: $exception->getMessage(),
            requestUri: $request->getRequestUri(),
            method: $request->getMethod(),
            clientIp: $request->getClientIp() ?? 'unbekannt',
            exception: $exception
        );
    }
}
