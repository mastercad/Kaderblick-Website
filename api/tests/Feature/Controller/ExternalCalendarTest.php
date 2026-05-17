<?php

namespace App\Tests\Feature\Controller;

use App\Entity\ExternalCalendar;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Feature-Tests für die externen Kalender-Endpoints.
 *
 *  – GET    /api/profile/calendar/external              → Liste
 *  – POST   /api/profile/calendar/external              → Anlegen
 *  – PUT    /api/profile/calendar/external/{id}         → Aktualisieren
 *  – DELETE /api/profile/calendar/external/{id}         → Löschen
 *  – GET    /api/profile/calendar/external/{id}/events  → Events eines Kalenders
 *  – GET    /api/profile/calendar/external/events/all   → Alle externen Events
 *
 * Sicherheitstests:
 *  – IDOR: Benutzer B darf Kalender von Benutzer A nicht lesen/ändern/löschen
 *  – SSRF: Interne URLs werden abgelehnt (localhost, private IPs, Metadaten)
 *  – Eingabevalidierung: Pflichtfelder, URL-Format, Farb-Sanitisierung
 *  – Alle Endpoints erfordern Authentifizierung
 */
class ExternalCalendarTest extends WebTestCase
{
    private const BASE_URL = '/api/profile/calendar/external';

    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $userA;
    private User $userB;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        /** @var User $userA */
        $userA = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($userA, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->userA = $userA;
        /** @var User $userB */
        $userB = $this->em->getRepository(User::class)->findOneBy(['email' => 'user7@example.com']);
        $this->assertNotNull($userB, 'Fixture user user7@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->userB = $userB;
    }

    // =========================================================================
    //  Unauthentifiziert → 401
    // =========================================================================

    public function testListRequiresAuth(): void
    {
        $this->client->request('GET', self::BASE_URL);
        $this->assertResponseStatusCodeSame(401);
    }

    public function testCreateRequiresAuth(): void
    {
        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Test', 'url' => 'https://example.com/cal.ics'])
        );
        $this->assertResponseStatusCodeSame(401);
    }

    public function testUpdateRequiresAuth(): void
    {
        $this->client->request(
            'PUT',
            self::BASE_URL . '/1',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Neu'])
        );
        $this->assertResponseStatusCodeSame(401);
    }

    public function testDeleteRequiresAuth(): void
    {
        $this->client->request('DELETE', self::BASE_URL . '/1');
        $this->assertResponseStatusCodeSame(401);
    }

    // =========================================================================
    //  GET /api/profile/calendar/external  – Liste
    // =========================================================================

    public function testListReturnsEmptyArrayInitially(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request('GET', self::BASE_URL);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
        $this->assertEmpty($data);
    }

    public function testListReturnsOnlyOwnCalendars(): void
    {
        $this->createCalendar($this->userA, 'Kalender von A', 'https://example.com/a.ics');
        $this->createCalendar($this->userA, 'Noch einer von A', 'https://example.com/a2.ics');
        $this->createCalendar($this->userB, 'Kalender von B', 'https://example.com/b.ics');

        $this->client->loginUser($this->userA);
        $this->client->request('GET', self::BASE_URL);

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertCount(2, $data, 'User A darf nur seine eigenen 2 Kalender sehen.');

        $names = array_column($data, 'name');
        $this->assertContains('Kalender von A', $names);
        $this->assertContains('Noch einer von A', $names);
        $this->assertNotContains('Kalender von B', $names);
    }

    // =========================================================================
    //  POST /api/profile/calendar/external  – Anlegen
    // =========================================================================

    public function testCreateWithValidDataReturns201(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => 'Mein Google-Kalender',
                'url' => 'https://calendar.google.com/calendar/ical/test/basic.ics',
                'color' => '#4CAF50',
            ])
        );

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('id', $data);
        $this->assertSame('Mein Google-Kalender', $data['name']);
        $this->assertSame('#4CAF50', $data['color']);
        $this->assertTrue($data['isEnabled']);
    }

    public function testCreateWithWebcalUrlIsAccepted(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => 'Apple iCloud',
                'url' => 'webcal://p12-caldav.icloud.com/published/2/test.ics',
            ])
        );

        $this->assertResponseStatusCodeSame(201);
    }

    public function testCreateWithoutNameReturns400(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['url' => 'https://example.com/cal.ics'])
        );

        $this->assertResponseStatusCodeSame(400);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testCreateWithoutUrlReturns400(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Test'])
        );

        $this->assertResponseStatusCodeSame(400);
    }

    public function testCreateWithInvalidUrlFormatReturns400(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Test', 'url' => 'not-a-url'])
        );

        $this->assertResponseStatusCodeSame(400);
    }

    // =========================================================================
    //  SICHERHEIT: SSRF – Interne URLs werden blockiert
    // =========================================================================

    #[\PHPUnit\Framework\Attributes\DataProvider('ssrfUrlProvider')]
    public function testCreateBlocksSsrfUrls(string $maliciousUrl, string $description): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'POST',
            self::BASE_URL,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'SSRF Test', 'url' => $maliciousUrl])
        );

        $this->assertResponseStatusCodeSame(
            400,
            "SSRF-URL '{$maliciousUrl}' ({$description}) muss mit 400 abgelehnt werden."
        );

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    /** @return array<string, array{string, string}> */
    public static function ssrfUrlProvider(): array
    {
        return [
            'localhost http' => ['http://localhost/admin', 'localhost'],
            'localhost https' => ['https://localhost:8080/api', 'localhost-https'],
            'loopback 127.0.0.1' => ['http://127.0.0.1/config', 'loopback-ipv4'],
            'loopback IPv6' => ['http://[::1]/config', 'loopback-ipv6'],
            'private 10.x' => ['http://10.0.0.1/calendar', 'priv-10'],
            'private 192.168.x' => ['http://192.168.1.100/cal.ics', 'priv-192'],
            'private 172.16.x' => ['http://172.16.0.1/feed.ics', 'priv-172'],
            'metadata endpoint' => ['http://169.254.169.254/latest/meta-data', 'metadata-aws'],
            'metadata google' => ['http://metadata.google.internal/', 'metadata-gcp'],
            'webcal localhost' => ['webcal://localhost/sec/feed.ics', 'webcal-localhost'],
        ];
    }

    public function testUpdateBlocksSsrfUrls(): void
    {
        $cal = $this->createCalendar($this->userA, 'Legit', 'https://calendar.google.com/safe.ics');

        $this->client->loginUser($this->userA);
        $this->client->request(
            'PUT',
            self::BASE_URL . '/' . $cal->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['url' => 'http://192.168.1.1/internal-config'])
        );

        $this->assertResponseStatusCodeSame(
            400,
            'Auch beim Update muss eine interne URL blockiert werden.'
        );
    }

    // =========================================================================
    //  SICHERHEIT: IDOR – Benutzer B darf Kalender von A nicht manipulieren
    // =========================================================================

    public function testOtherUserCannotUpdateCalendar(): void
    {
        $cal = $this->createCalendar($this->userA, 'Geheimkalender', 'https://private.example.com/cal.ics');

        $this->client->loginUser($this->userB);
        $this->client->request(
            'PUT',
            self::BASE_URL . '/' . $cal->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Von B überschrieben'])
        );

        $this->assertResponseStatusCodeSame(
            404,
            'Benutzer B darf Kalender von A nicht aktualisieren (IDOR-Schutz).'
        );

        // Name muss unverändert in der DB sein
        $this->em->clear();
        $unchanged = $this->em->find(ExternalCalendar::class, $cal->getId());
        $this->assertSame('Geheimkalender', $unchanged->getName());
    }

    public function testOtherUserCannotDeleteCalendar(): void
    {
        $cal = $this->createCalendar($this->userA, 'Kalender A', 'https://example.com/a.ics');

        $this->client->loginUser($this->userB);
        $this->client->request('DELETE', self::BASE_URL . '/' . $cal->getId());

        $this->assertResponseStatusCodeSame(
            404,
            'Benutzer B darf Kalender von A nicht löschen (IDOR-Schutz).'
        );

        // Kalender muss noch vorhanden sein
        $this->em->clear();
        $this->assertNotNull($this->em->find(ExternalCalendar::class, $cal->getId()));
    }

    public function testOtherUserCannotReadCalendarEvents(): void
    {
        $cal = $this->createCalendar($this->userA, 'Privater Kalender', 'https://example.com/priv.ics');

        $this->client->loginUser($this->userB);
        $this->client->request('GET', self::BASE_URL . '/' . $cal->getId() . '/events');

        $this->assertResponseStatusCodeSame(
            404,
            'Benutzer B darf Events aus dem Kalender von A nicht lesen (IDOR-Schutz).'
        );
    }

    // =========================================================================
    //  PUT – Aktualisieren (Eigentümer)
    // =========================================================================

    public function testOwnerCanUpdateCalendar(): void
    {
        $cal = $this->createCalendar($this->userA, 'Alt', 'https://example.com/old.ics');

        $this->client->loginUser($this->userA);
        $this->client->request(
            'PUT',
            self::BASE_URL . '/' . $cal->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Neu', 'color' => '#FF0000'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('Neu', $data['name']);
        $this->assertSame('#FF0000', $data['color']);
    }

    public function testUpdateNonExistentReturns404(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request(
            'PUT',
            self::BASE_URL . '/999999',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Test'])
        );

        $this->assertResponseStatusCodeSame(404);
    }

    // =========================================================================
    //  DELETE – Löschen (Eigentümer)
    // =========================================================================

    public function testOwnerCanDeleteCalendar(): void
    {
        $cal = $this->createCalendar($this->userA, 'Zu löschen', 'https://example.com/del.ics');
        $id = $cal->getId();

        $this->client->loginUser($this->userA);
        $this->client->request('DELETE', self::BASE_URL . '/' . $id);

        $this->assertResponseIsSuccessful();

        $this->em->clear();
        $this->assertNull($this->em->find(ExternalCalendar::class, $id), 'Kalender muss aus der DB entfernt sein.');
    }

    public function testDeleteNonExistentReturns404(): void
    {
        $this->client->loginUser($this->userA);

        $this->client->request('DELETE', self::BASE_URL . '/999999');

        $this->assertResponseStatusCodeSame(404);
    }

    // =========================================================================
    //  GET /external/{id}/events – Deaktivierter Kalender
    // =========================================================================

    public function testDisabledCalendarReturnsEmptyEvents(): void
    {
        $cal = $this->createCalendar($this->userA, 'Deaktiviert', 'https://example.com/dis.ics');
        $cal->setIsEnabled(false);
        $this->em->flush();

        $this->client->loginUser($this->userA);
        $this->client->request('GET', self::BASE_URL . '/' . $cal->getId() . '/events');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
        $this->assertEmpty($data, 'Deaktivierter Kalender muss leeres Events-Array zurückgeben.');
    }

    public function testEventsEndpointReturnsArrayWhenNoCache(): void
    {
        $cal = $this->createCalendar($this->userA, 'Ohne Cache', 'https://example.com/nocache.ics');
        // cachedContent ist null → parseIcalToJson gibt [] zurück

        $this->client->loginUser($this->userA);
        $this->client->request('GET', self::BASE_URL . '/' . $cal->getId() . '/events');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
    }

    // =========================================================================
    //  GET /external/events/all
    // =========================================================================

    public function testAllEventsRequiresAuth(): void
    {
        $this->client->request('GET', self::BASE_URL . '/events/all');
        $this->assertResponseStatusCodeSame(401);
    }

    public function testAllEventsReturnsCombinedResults(): void
    {
        // Kalender mit gecachtem iCal-Inhalt anlegen
        $ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
              . "UID:test-uid-1@example.com\r\nSUMMARY:Testtermin\r\n"
              . "DTSTART:20260401T100000Z\r\nDTEND:20260401T110000Z\r\n"
              . "END:VEVENT\r\nEND:VCALENDAR\r\n";

        $cal = $this->createCalendar($this->userA, 'Gefüllter Kalender', 'https://example.com/filled.ics');
        $cal->setCachedContent($ical);
        $cal->setLastFetchedAt(new DateTime('+1 hour')); // nicht veraltet → kein refetch
        $this->em->flush();

        $this->client->loginUser($this->userA);
        $this->client->request('GET', self::BASE_URL . '/events/all');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
        // Mindestens ein Event vom gecachten Feed
        $this->assertCount(1, $data);
        $this->assertSame('Testtermin', $data[0]['title']);
        $this->assertArrayHasKey('calendarId', $data[0]);
        $this->assertArrayHasKey('calendarName', $data[0]);
        $this->assertArrayHasKey('calendarColor', $data[0]);
    }

    public function testAllEventsExcludesDisabledCalendars(): void
    {
        $ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
              . "UID:dis-uid@example.com\r\nSUMMARY:Disabled\r\n"
              . "DTSTART:20260401T100000Z\r\nDTEND:20260401T110000Z\r\n"
              . "END:VEVENT\r\nEND:VCALENDAR\r\n";

        $cal = $this->createCalendar($this->userA, 'Deaktiviert', 'https://example.com/dis.ics');
        $cal->setCachedContent($ical);
        $cal->setLastFetchedAt(new DateTime('+1 hour'));
        $cal->setIsEnabled(false);
        $this->em->flush();

        $this->client->loginUser($this->userA);
        $this->client->request('GET', self::BASE_URL . '/events/all');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertEmpty($data, 'Deaktivierte Kalender dürfen keine Events liefern.');
    }

    // =========================================================================
    //  Helper
    // =========================================================================

    private function createCalendar(User $user, string $name, string $url): ExternalCalendar
    {
        $cal = new ExternalCalendar();
        $cal->setUser($user);
        $cal->setName($name);
        $cal->setUrl($url);
        $cal->setColor('#2196f3');
        $this->em->persist($cal);
        $this->em->flush();

        return $cal;
    }

    protected function tearDown(): void
    {
        $conn = $this->em->getConnection();
        $conn->executeStatement(
            'DELETE FROM external_calendars WHERE user_id = :ua OR user_id = :ub',
            ['ua' => $this->userA->getId(), 'ub' => $this->userB->getId()]
        );

        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
