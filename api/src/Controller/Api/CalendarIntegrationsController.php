<?php

namespace App\Controller\Api;

use App\Entity\ExternalCalendar;
use App\Entity\User;
use App\Repository\ExternalCalendarRepository;
use DateTime;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

/**
 * Verwaltet:
 *  - Generierung / Rotation des iCal-Tokens für den eingeloggten User
 *  - CRUD für externe Kalender (iCal-URLs die der User einbinden möchte)
 *  - Proxy-Endpoint: liefert gecachte Events externer Kalender als JSON
 */
#[Route('/api/profile/calendar', name: 'api_calendar_integrations_')]
class CalendarIntegrationsController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ExternalCalendarRepository $externalCalendarRepository,
    ) {
    }

    // ─── iCal-Token ──────────────────────────────────────────────────────────

    /** Gibt den aktuellen Token-Status zurück und die drei Feed-URLs */
    #[Route('/token', name: 'token_status', methods: ['GET'])]
    public function tokenStatus(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $token = $user->getCalendarToken();
        $base = $request->getSchemeAndHttpHost();

        return $this->json([
            'hasToken' => null !== $token,
            'createdAt' => $user->getCalendarTokenCreatedAt()?->format('c'),
            'feeds' => $token ? [
                'personal' => "{$base}/ical/{$token}/personal.ics",
                'club' => "{$base}/ical/{$token}/club.ics",
                'platform' => "{$base}/ical/{$token}/platform.ics",
            ] : null,
        ]);
    }

    /**
     * Präfix aller Kalender-Tokens.
     * Damit ist sichergestellt, dass ein gestohlener Kalender-Token
     * niemals als API-Token oder JWT genutzt werden kann – der
     * ApiTokenAuthenticator lehnt alle Tokens ohne "kbak_"-Präfix ab,
     * und dieser Wert beginnt immer mit "kcal_".
     */
    public const CALENDAR_TOKEN_PREFIX = 'kcal_';

    /** Generiert einen neuen Token (rotiert den bestehenden) */
    #[Route('/token', name: 'token_generate', methods: ['POST'])]
    public function generateToken(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $token = self::CALENDAR_TOKEN_PREFIX . bin2hex(random_bytes(28));
        $user->setCalendarToken($token);
        $user->setCalendarTokenCreatedAt(new DateTime());
        $this->em->flush();

        $base = $request->getSchemeAndHttpHost();

        return $this->json([
            'token' => $token,
            'createdAt' => $user->getCalendarTokenCreatedAt()?->format('c'),
            'feeds' => [
                'personal' => "{$base}/ical/{$token}/personal.ics",
                'club' => "{$base}/ical/{$token}/club.ics",
                'platform' => "{$base}/ical/{$token}/platform.ics",
            ],
        ]);
    }

    /** Widerruft den Token */
    #[Route('/token', name: 'token_revoke', methods: ['DELETE'])]
    public function revokeToken(): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $user->setCalendarToken(null);
        $user->setCalendarTokenCreatedAt(null);
        $this->em->flush();

        return $this->json(['message' => 'Token widerrufen']);
    }

    // ─── Externe Kalender (CRUD) ──────────────────────────────────────────────

    #[Route('/external', name: 'external_list', methods: ['GET'])]
    public function listExternal(): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $calendars = $this->externalCalendarRepository->findByUser($user);

        return $this->json(array_map(fn (ExternalCalendar $c) => $c->toArray(), $calendars));
    }

    #[Route('/external', name: 'external_create', methods: ['POST'])]
    public function createExternal(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        $name = trim($data['name'] ?? '');
        $url = trim($data['url'] ?? '');
        $color = $data['color'] ?? '#2196f3';

        if ('' === $name || '' === $url) {
            return $this->json(['error' => 'Name und URL sind Pflichtfelder'], 400);
        }

        if (!filter_var($url, FILTER_VALIDATE_URL) && !str_starts_with($url, 'webcal://')) {
            return $this->json(['error' => 'Ungültige URL'], 400);
        }

        if (!$this->isExternalUrlSafe($url)) {
            return $this->json(['error' => 'Diese URL ist nicht erlaubt (interne Adressen sind gesperrt)'], 400);
        }

        $cal = new ExternalCalendar();
        $cal->setUser($user);
        $cal->setName($name);
        $cal->setUrl($url);
        $cal->setColor($color);

        $this->em->persist($cal);
        $this->em->flush();

        // Sofort versuchen, den Feed zu laden
        $this->fetchAndCache($cal);
        $this->em->flush();

        return $this->json($cal->toArray(), 201);
    }

    #[Route('/external/{id}', name: 'external_update', methods: ['PUT'])]
    public function updateExternal(int $id, Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $cal = $this->externalCalendarRepository->find($id);
        if (!$cal || $cal->getUser()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Nicht gefunden'], 404);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['name'])) {
            $cal->setName(trim($data['name']));
        }
        if (isset($data['url'])) {
            $url = trim($data['url']);
            if (!filter_var($url, FILTER_VALIDATE_URL) && !str_starts_with($url, 'webcal://')) {
                return $this->json(['error' => 'Ungültige URL'], 400);
            }
            if (!$this->isExternalUrlSafe($url)) {
                return $this->json(['error' => 'Diese URL ist nicht erlaubt (interne Adressen sind gesperrt)'], 400);
            }
            $cal->setUrl($url);
            // URL geändert → Cache invalidieren
            $cal->setCachedContent(null);
            $cal->setLastFetchedAt(null);
        }
        if (isset($data['color'])) {
            $cal->setColor($data['color']);
        }
        if (isset($data['isEnabled'])) {
            $cal->setIsEnabled((bool) $data['isEnabled']);
        }

        $this->em->flush();

        return $this->json($cal->toArray());
    }

    #[Route('/external/{id}', name: 'external_delete', methods: ['DELETE'])]
    public function deleteExternal(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $cal = $this->externalCalendarRepository->find($id);
        if (!$cal || $cal->getUser()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Nicht gefunden'], 404);
        }

        $this->em->remove($cal);
        $this->em->flush();

        return $this->json(['message' => 'Kalender entfernt'], Response::HTTP_OK);
    }

    /**
     * Gibt geparste Events eines externen Kalenders als JSON zurück.
     * Aktualisiert den Cache wenn er älter als 60 Minuten ist.
     */
    #[Route('/external/{id}/events', name: 'external_events', methods: ['GET'])]
    public function externalEvents(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $cal = $this->externalCalendarRepository->find($id);
        if (!$cal || $cal->getUser()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Nicht gefunden'], 404);
        }

        if (!$cal->isEnabled()) {
            return $this->json([]);
        }

        // Cache prüfen (60 Minuten)
        $threshold = new DateTime('-60 minutes');
        if (null === $cal->getLastFetchedAt() || $cal->getLastFetchedAt() < $threshold) {
            $this->fetchAndCache($cal);
            $this->em->flush();
        }

        $events = $this->parseIcalToJson($cal);

        return $this->json($events);
    }

    /**
     * Liefert alle externen Kalender-Events des Users als kombiniertes Array.
     * Jedes Event enthält zusätzlich calendarId, calendarName und calendarColor.
     */
    #[Route('/external/events/all', name: 'external_events_all', methods: ['GET'])]
    public function allExternalEvents(): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Nicht authentifiziert'], 401);
        }

        $calendars = $this->externalCalendarRepository->findByUser($user);
        $threshold = new DateTime('-60 minutes');
        $allEvents = [];
        $changed = false;

        foreach ($calendars as $cal) {
            if (!$cal->isEnabled()) {
                continue;
            }
            if (null === $cal->getLastFetchedAt() || $cal->getLastFetchedAt() < $threshold) {
                $this->fetchAndCache($cal);
                $changed = true;
            }
            foreach ($this->parseIcalToJson($cal) as $ev) {
                $ev['calendarId'] = $cal->getId();
                $ev['calendarName'] = $cal->getName();
                $ev['calendarColor'] = $cal->getColor();
                $allEvents[] = $ev;
            }
        }

        if ($changed) {
            $this->em->flush();
        }

        return $this->json($allEvents);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Schützt vor Server-Side Request Forgery (SSRF).
     *
     * Verhindert, dass Benutzer den Server als Proxy für Anfragen an
     * interne Dienste (Localhost, Private IPs, Metadaten-Endpunkte) nutzen.
     */
    private function isExternalUrlSafe(string $url): bool
    {
        // webcal:// → https:// für Host-Auflösung
        $checkUrl = preg_replace('/^webcal:/i', 'https:', $url);

        $host = parse_url($checkUrl, PHP_URL_HOST);
        if (!$host) {
            return false;
        }

        $lowerHost = strtolower(trim($host, '[]')); // IPv6 in URLs: [::1]

        // Localhost-Hostnamen blockieren
        if ('localhost' === $lowerHost || str_ends_with($lowerHost, '.localhost')) {
            return false;
        }

        // Cloud-Metadaten-Endpunkte blockieren
        if ('metadata.google.internal' === $lowerHost || '169.254.169.254' === $lowerHost) {
            return false;
        }

        // IPv4/IPv6 Literale prüfen
        $ip = filter_var($lowerHost, FILTER_VALIDATE_IP);
        if (false !== $ip) {
            // Private und reservierte Ranges blockieren (RFC 1918, Loopback, Link-Local usw.)
            if (false === filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }

        return true;
    }

    private function fetchAndCache(ExternalCalendar $cal): void
    {
        $url = $cal->getUrl();
        // webcal:// → https://
        $fetchUrl = preg_replace('/^webcal:/i', 'https:', $url);

        try {
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'follow_location' => 1,
                    'max_redirects' => 5,
                    'user_agent' => 'FussballvereinPlatform/1.0 iCal-Fetcher',
                ],
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ],
            ]);

            $content = @file_get_contents($fetchUrl, false, $ctx);

            if (false !== $content && strlen($content) > 0) {
                $cal->setCachedContent($content);
            }
        } catch (Throwable) {
            // Fehler beim Laden → alten Cache behalten
        }

        $cal->setLastFetchedAt(new DateTime());
    }

    /**
     * Parst gespeicherten iCal-Inhalt zu einem JSON-kompatiblen Array.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parseIcalToJson(ExternalCalendar $cal): array
    {
        $content = $cal->getCachedContent();
        if (!$content) {
            return [];
        }

        $events = [];
        $lines = preg_split('/\r\n|\n|\r/', $content);

        // Unfold lines (continuation lines start with space/tab)
        $unfolded = [];
        foreach ($lines as $line) {
            if (isset($line[0]) && (' ' === $line[0] || "\t" === $line[0])) {
                if (!empty($unfolded)) {
                    $unfolded[count($unfolded) - 1] .= substr($line, 1);
                }
            } else {
                $unfolded[] = $line;
            }
        }

        $current = null;
        foreach ($unfolded as $line) {
            if ('BEGIN:VEVENT' === $line) {
                $current = [];
                continue;
            }
            if ('END:VEVENT' === $line && null !== $current) {
                $event = $this->buildEventFromVevent($current, $cal);
                if ($event) {
                    $events[] = $event;
                }
                $current = null;
                continue;
            }
            if (null !== $current) {
                // Split property name and value
                $colonPos = strpos($line, ':');
                if (false !== $colonPos) {
                    $prop = substr($line, 0, $colonPos);
                    $value = substr($line, $colonPos + 1);
                    // Handle parameters (DTSTART;TZID=Europe/Berlin:...)
                    $semiPos = strpos($prop, ';');
                    $propName = false !== $semiPos ? substr($prop, 0, $semiPos) : $prop;
                    $current[$propName] = $value;
                }
            }
        }

        return $events;
    }

    /**
     * @param array<string, string> $vevent
     *
     * @return array<string, mixed>|null
     */
    private function buildEventFromVevent(array $vevent, ExternalCalendar $cal): ?array
    {
        $uid = $vevent['UID'] ?? null;
        $summary = $vevent['SUMMARY'] ?? '(Kein Titel)';
        $dtstart = $vevent['DTSTART'] ?? null;
        $dtend = $vevent['DTEND'] ?? $vevent['DURATION'] ?? null;

        if (!$dtstart) {
            return null;
        }

        $start = $this->parseIcalDate($dtstart);
        $end = $dtend ? $this->parseIcalDate($dtend) : (clone $start)->modify('+1 hour');

        if (!$start || !$end) {
            return null;
        }

        return [
            'uid' => $uid ?? uniqid('ext_', true),
            'title' => $this->unescapeIcal($summary),
            'start' => $start->format('c'),
            'end' => $end->format('c'),
            'description' => $this->unescapeIcal($vevent['DESCRIPTION'] ?? ''),
            'location' => $this->unescapeIcal($vevent['LOCATION'] ?? ''),
            'isExternal' => true,
        ];
    }

    private function parseIcalDate(string $value): ?DateTime
    {
        // Entfernt Zeitzone-Parameter falls vorhanden
        if (preg_match('/^(\d{8}T\d{6})(Z?)$/', $value, $m)) {
            $tz = 'Z' === $m[2] ? 'UTC' : 'Europe/Berlin';
            $dt = DateTime::createFromFormat('Ymd\THis', $m[1], new DateTimeZone($tz));

            return $dt ?: null;
        }
        // Ganztätig: 20250315
        if (preg_match('/^\d{8}$/', $value)) {
            return DateTime::createFromFormat('Ymd', $value, new DateTimeZone('Europe/Berlin')) ?: null;
        }

        return null;
    }

    private function unescapeIcal(string $text): string
    {
        return str_replace(['\\n', '\\,', '\\;', '\\\\'], ["\n", ',', ';', '\\'], $text);
    }
}
