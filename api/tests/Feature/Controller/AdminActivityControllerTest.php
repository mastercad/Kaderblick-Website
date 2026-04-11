<?php

namespace Tests\Feature\Controller;

use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tests für GET /api/admin/activity und GET /api/admin/activity/trend.
 *
 * Prüft Authentifizierung, Autorisierung, Paginierung, Suche, Sortierung
 * und korrekte Berechnung der Statistiken.
 */
class AdminActivityControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    // Test-Users (inline, mit spezifischen Attributen)
    private User $superAdmin;
    private User $userActive;
    private User $userNever;
    private User $userSearchable;
    private User $regularUser;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        // ── SUPERADMIN (für Authentifizierung) — aus Fixtures laden ──────────
        $this->superAdmin = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->superAdmin, 'Fixture-User user21@example.com nicht gefunden. Bitte Fixtures laden.');

        // ── ROLE_USER (für 403-Tests) — aus Fixtures laden ───────────────────
        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');

        // ── User mit aktueller Aktivität ──────────────────────────────────────
        $this->userActive = new User();
        $this->userActive->setEmail('test-activity-active@test.example.com');
        $this->userActive->setFirstName('Test');
        $this->userActive->setLastName('ActiveUser');
        $this->userActive->setPassword('test');
        $this->userActive->setRoles(['ROLE_USER']);
        $this->userActive->setIsEnabled(true);
        $this->userActive->setIsVerified(true);
        $this->userActive->setLastActivityAt(new DateTime());
        $this->em->persist($this->userActive);

        // ── User ohne Aktivität ───────────────────────────────────────────────
        $this->userNever = new User();
        $this->userNever->setEmail('test-activity-never@test.example.com');
        $this->userNever->setFirstName('Test');
        $this->userNever->setLastName('NeverUser');
        $this->userNever->setPassword('test');
        $this->userNever->setRoles(['ROLE_USER']);
        $this->userNever->setIsEnabled(true);
        $this->userNever->setIsVerified(true);
        // kein setLastActivityAt → bleibt NULL
        $this->em->persist($this->userNever);

        // ── User mit eindeutigem Suchbegriff ──────────────────────────────────
        $this->userSearchable = new User();
        $this->userSearchable->setEmail('test-activity-searchable@test.example.com');
        $this->userSearchable->setFirstName('UniqueSearchableName');
        $this->userSearchable->setLastName('Xyz');
        $this->userSearchable->setPassword('test');
        $this->userSearchable->setRoles(['ROLE_USER']);
        $this->userSearchable->setIsEnabled(true);
        $this->userSearchable->setIsVerified(true);
        $this->em->persist($this->userSearchable);

        $this->em->flush();
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwt = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwt->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function authenticateAsSuperAdmin(): void
    {
        $this->authenticate($this->superAdmin);
    }

    /** @return array<string, mixed> */
    private function getJson(string $url): array
    {
        $this->client->request('GET', $url);

        return json_decode($this->client->getResponse()->getContent(), true);
    }

    // ── Authentifizierung / Autorisierung ─────────────────────────────────────

    public function testActivityRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/admin/activity');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testActivityRequiresSuperAdminRole(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/admin/activity');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testTrendRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/admin/activity/trend');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testTrendRequiresSuperAdminRole(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/admin/activity/trend');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    // ── Struktur der Antwort ──────────────────────────────────────────────────

    public function testActivityReturnsExpectedTopLevelKeys(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity');

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('users', $data);
        $this->assertArrayHasKey('stats', $data);
        $this->assertArrayHasKey('pagination', $data);
    }

    public function testActivityStatsContainExpectedKeys(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity');

        $stats = $data['stats'];
        $this->assertArrayHasKey('totalCount', $stats);
        $this->assertArrayHasKey('activeToday', $stats);
        $this->assertArrayHasKey('activeLast7Days', $stats);
        $this->assertArrayHasKey('neverActive', $stats);
    }

    public function testActivityPaginationContainsExpectedKeys(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?limit=5');

        $pagination = $data['pagination'];
        $this->assertArrayHasKey('page', $pagination);
        $this->assertArrayHasKey('limit', $pagination);
        $this->assertArrayHasKey('total', $pagination);
        $this->assertArrayHasKey('totalPages', $pagination);
        $this->assertSame(5, $pagination['limit']);
    }

    public function testUserEntryContainsExpectedFields(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?limit=100&search=test-activity-active');
        $users = $data['users'];

        $this->assertNotEmpty($users, 'Der aktive Testuser sollte in den Ergebnissen erscheinen.');
        $first = $users[0];
        $this->assertArrayHasKey('id', $first);
        $this->assertArrayHasKey('email', $first);
        $this->assertArrayHasKey('fullName', $first);
        $this->assertArrayHasKey('roles', $first);
        $this->assertArrayHasKey('lastActivityAt', $first);
        $this->assertArrayHasKey('minutesAgo', $first);
    }

    // ── Statistiken ───────────────────────────────────────────────────────────

    public function testStatsReflectActiveAndNeverActiveUsers(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity');
        $stats = $data['stats'];

        // userActive hat lastActivityAt = jetzt → muss in activeToday enthalten sein
        $this->assertGreaterThanOrEqual(1, $stats['activeToday']);
        $this->assertGreaterThanOrEqual(1, $stats['activeLast7Days']);

        // userNever hat NULL → muss in neverActive gezählt werden
        $this->assertGreaterThanOrEqual(1, $stats['neverActive']);

        // Summe muss konsistent sein: total >= activeToday + neverActive
        $this->assertGreaterThanOrEqual(
            $stats['activeToday'] + $stats['neverActive'],
            $stats['totalCount']
        );
    }

    public function testStatsAggregateAllUsersRegardlessOfPage(): void
    {
        $this->authenticateAsSuperAdmin();

        // Seite 1 mit kleiner Limit
        $page1 = $this->getJson('/api/admin/activity?page=1&limit=5');
        // Seite 2 falls vorhanden – Stats müssen identisch sein
        if ($page1['pagination']['totalPages'] > 1) {
            $page2 = $this->getJson('/api/admin/activity?page=2&limit=5');
            $this->assertSame($page1['stats']['totalCount'], $page2['stats']['totalCount']);
            $this->assertSame($page1['stats']['activeToday'], $page2['stats']['activeToday']);
            $this->assertSame($page1['stats']['neverActive'], $page2['stats']['neverActive']);
        }

        $this->assertSame($page1['pagination']['limit'], 5);
    }

    // ── Paginierung ───────────────────────────────────────────────────────────

    public function testPaginationLimitIsRespected(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?limit=5');

        $this->assertLessThanOrEqual(5, count($data['users']));
    }

    public function testPaginationTotalPagesIsCalculatedCorrectly(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?limit=5');
        $pagination = $data['pagination'];

        $expectedPages = max(1, (int) ceil($pagination['total'] / 5));
        $this->assertSame($expectedPages, $pagination['totalPages']);
    }

    // ── Suche ─────────────────────────────────────────────────────────────────

    public function testSearchByEmailReturnsMatchingUser(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?search=test-activity-searchable');
        $emails = array_column($data['users'], 'email');

        $this->assertContains('test-activity-searchable@test.example.com', $emails);
    }

    public function testSearchByNameReturnsMatchingUser(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?search=UniqueSearchableName');
        $emails = array_column($data['users'], 'email');

        $this->assertContains('test-activity-searchable@test.example.com', $emails);
    }

    public function testSearchWithNoMatchReturnsEmptyList(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity?search=ThisStringDefinitelyDoesNotMatchAnyUser12345XYZ');

        $this->assertEmpty($data['users']);
        $this->assertSame(0, $data['pagination']['total']);
    }

    // ── Sortierung ────────────────────────────────────────────────────────────

    public function testDefaultSortPutsActiveUsersBeforeNeverActiveUsers(): void
    {
        $this->authenticateAsSuperAdmin();
        // Standard: last_activity_at DESC → Aktive zuerst, NULL zuletzt
        $data = $this->getJson('/api/admin/activity?limit=100');
        $users = $data['users'];

        $activeIndex = null;
        $neverIndex = null;
        foreach ($users as $idx => $u) {
            if ('test-activity-active@test.example.com' === $u['email']) {
                $activeIndex = $idx;
            }
            if ('test-activity-never@test.example.com' === $u['email']) {
                $neverIndex = $idx;
            }
        }

        $this->assertNotNull($activeIndex, 'Aktiver User nicht in Ergebnissen gefunden.');
        $this->assertNotNull($neverIndex, 'Nie-aktiver User nicht in Ergebnissen gefunden.');
        $this->assertLessThan($neverIndex, $activeIndex, 'Aktiver User sollte vor nie-aktivem User erscheinen.');
    }

    // ── Trend ─────────────────────────────────────────────────────────────────

    public function testTrendReturnsExpectedStructure(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity/trend');

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('range', $data);
        $this->assertArrayHasKey('data', $data);
        $this->assertSame('month', $data['range']); // Default
        $this->assertIsArray($data['data']);
    }

    public function testTrendRangeParameterIsPassedThrough(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity/trend?range=week');

        $this->assertSame('week', $data['range']);
    }

    public function testTrendDataContainsActiveUserFromToday(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity/trend?range=today');
        $buckets = array_column($data['data'], 'label');

        // userActive hat lastActivityAt = jetzt → heutiger Bucket muss existieren
        $todayPrefix = (new DateTime())->format('Y-m-d');
        $found = false;
        foreach ($buckets as $bucket) {
            if (str_starts_with($bucket, $todayPrefix)) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Heutiger Aktivitätsbucket nicht im Trend gefunden.');
    }

    public function testTrendDataPointsHaveLabelAndCount(): void
    {
        $this->authenticateAsSuperAdmin();
        $data = $this->getJson('/api/admin/activity/trend?range=month');

        foreach ($data['data'] as $point) {
            $this->assertArrayHasKey('label', $point);
            $this->assertArrayHasKey('count', $point);
            $this->assertIsInt($point['count']);
            $this->assertGreaterThanOrEqual(1, $point['count']);
        }
    }

    // ── Teardown ──────────────────────────────────────────────────────────────

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
