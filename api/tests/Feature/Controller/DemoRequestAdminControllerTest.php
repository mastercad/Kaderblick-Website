<?php

namespace App\Tests\Feature\Controller;

use App\Entity\DemoRequest;
use App\Entity\User;
use App\Service\DemoProvisioningService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for DemoRequestAdminController (/admin/demo-requests).
 *
 * Fixture users (from test fixtures):
 *   user6@example.com  – ROLE_USER
 *   user16@example.com – ROLE_ADMIN
 *   user21@example.com – ROLE_SUPERADMIN
 *
 * Covers:
 *  GET  /admin/demo-requests — auth, structure, status filter, search, requestId filter, counts
 *  POST /admin/demo-requests/{id}/contact — success, 409 on non-pending
 *  POST /admin/demo-requests/{id}/reject  — success with note, 409 on non-pending
 */
#[AllowMockObjectsWithoutExpectations]
class DemoRequestAdminControllerTest extends WebTestCase
{
    private EntityManagerInterface $em;
    private KernelBrowser $client;
    private const PREFIX = 'demo-admin-test-';

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);

        $mockProvisioning = $this->createMock(DemoProvisioningService::class);
        static::getContainer()->set(DemoProvisioningService::class, $mockProvisioning);
    }

    protected function tearDown(): void
    {
        $repo = $this->em->getRepository(DemoRequest::class);
        foreach ($repo->findAll() as $req) {
            if (str_contains($req->getEmail(), self::PREFIX)) {
                $this->em->remove($req);
            }
        }
        $this->em->flush();
        parent::tearDown();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private function authenticateUser(KernelBrowser $client, string $email): void
    {
        $user = static::getContainer()->get('doctrine')->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found.', $email));

        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function uniqueEmail(): string
    {
        return self::PREFIX . uniqid() . '@example.com';
    }

    private function createDemoRequest(string $status = DemoRequest::STATUS_PENDING, ?string $email = null): DemoRequest
    {
        $req = new DemoRequest();
        $req->setName('Test Requester')
            ->setEmail($email ?? $this->uniqueEmail())
            ->setClubName('FC Test')
            ->setLeague('Kreisliga A')
            ->setStatus($status);

        if (DemoRequest::STATUS_PENDING !== $status) {
            $req->setProcessedAt(new DateTime());
        }

        $this->em->persist($req);
        $this->em->flush();

        return $req;
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /admin/demo-requests — authentication
    // ─────────────────────────────────────────────────────────────────────

    public function testIndexRequiresAuthentication(): void
    {
        $this->client->request('GET', '/admin/demo-requests');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testIndexForbidsRoleUser(): void
    {
        $this->authenticateUser($this->client, 'user6@example.com'); // ROLE_USER

        $this->client->request('GET', '/admin/demo-requests');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testIndexAllowsRoleAdmin(): void
    {
        $this->authenticateUser($this->client, 'user16@example.com'); // ROLE_ADMIN

        $this->client->request('GET', '/admin/demo-requests');
        $this->assertResponseIsSuccessful();
    }

    public function testIndexAllowsRoleSuperadmin(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request('GET', '/admin/demo-requests');
        $this->assertResponseIsSuccessful();
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /admin/demo-requests — response structure
    // ─────────────────────────────────────────────────────────────────────

    public function testIndexResponseHasRequiredTopLevelKeys(): void
    {
        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('requests', $data);
        $this->assertArrayHasKey('counts', $data);
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('limit', $data);
    }

    public function testIndexCountsHaveExpectedKeys(): void
    {
        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('pending', $data['counts']);
        $this->assertArrayHasKey('demo_sent', $data['counts']);
        $this->assertArrayHasKey('contacted', $data['counts']);
        $this->assertArrayHasKey('rejected', $data['counts']);
        $this->assertIsInt($data['counts']['pending']);
        $this->assertIsInt($data['counts']['demo_sent']);
        $this->assertIsInt($data['counts']['contacted']);
        $this->assertIsInt($data['counts']['rejected']);
    }

    public function testIndexRequestItemHasExpectedFields(): void
    {
        $this->createDemoRequest();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?status=pending');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data['requests'], 'Expected at least one pending request.');
        $item = $data['requests'][0];

        foreach (['id', 'name', 'email', 'status', 'createdAt', 'clubName', 'league'] as $key) {
            $this->assertArrayHasKey($key, $item, "Missing key: {$key}");
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /admin/demo-requests — status filter
    // ─────────────────────────────────────────────────────────────────────

    public function testDefaultStatusFilterIsPending(): void
    {
        $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $this->createDemoRequest(DemoRequest::STATUS_DEMO_SENT);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        foreach ($data['requests'] as $item) {
            $this->assertSame('pending', $item['status']);
        }
    }

    public function testStatusFilterDemoSentReturnsOnlyDemoSent(): void
    {
        $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $this->createDemoRequest(DemoRequest::STATUS_DEMO_SENT);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?status=demo_sent');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        foreach ($data['requests'] as $item) {
            $this->assertSame('demo_sent', $item['status']);
        }
    }

    public function testStatusFilterAllReturnsAllStatuses(): void
    {
        $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $this->createDemoRequest(DemoRequest::STATUS_DEMO_SENT);
        $this->createDemoRequest(DemoRequest::STATUS_REJECTED);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?status=all');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $statuses = array_column($data['requests'], 'status');
        $this->assertContains('pending', $statuses);
        $this->assertContains('demo_sent', $statuses);
        $this->assertContains('rejected', $statuses);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /admin/demo-requests — search
    // ─────────────────────────────────────────────────────────────────────

    public function testSearchFiltersByName(): void
    {
        $req = new DemoRequest();
        $req->setName('UniqueSearchableName')->setEmail($this->uniqueEmail());
        $this->em->persist($req);
        $this->em->flush();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?status=pending&search=UniqueSearchableName');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $names = array_column($data['requests'], 'name');
        $this->assertContains('UniqueSearchableName', $names);
    }

    public function testSearchFiltersByEmail(): void
    {
        $uniqueEmail = self::PREFIX . 'searchbyemail-' . uniqid() . '@example.com';
        $req = new DemoRequest();
        $req->setName('SearchByEmail User')->setEmail($uniqueEmail);
        $this->em->persist($req);
        $this->em->flush();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?status=pending&search=searchbyemail');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $emails = array_column($data['requests'], 'email');
        $this->assertContains($uniqueEmail, $emails);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET /admin/demo-requests — requestId filter
    // ─────────────────────────────────────────────────────────────────────

    public function testRequestIdFilterReturnsSingleRequest(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $id = $req->getId();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('GET', '/admin/demo-requests?requestId=' . $id);
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertCount(1, $data['requests']);
        $this->assertSame($id, $data['requests'][0]['id']);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /admin/demo-requests/{id}/contact
    // ─────────────────────────────────────────────────────────────────────

    public function testContactRequiresAuthentication(): void
    {
        $req = $this->createDemoRequest();

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/contact');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testContactForbidsRoleUser(): void
    {
        $req = $this->createDemoRequest();

        $this->authenticateUser($this->client, 'user6@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/contact');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testContactSendsDemoAccessToPendingRequest(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $id = $req->getId();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $id . '/contact', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseIsSuccessful();

        $this->em->clear();
        $stored = $this->em->getRepository(DemoRequest::class)->find($id);
        $this->assertSame(DemoRequest::STATUS_PROVISIONING, $stored->getStatus());
        $this->assertNotNull($stored->getProcessedAt());
        $this->assertNotNull($stored->getProcessedBy());
    }

    public function testContactWithNoteStoresNote(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $id = $req->getId();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request(
            'POST',
            '/admin/demo-requests/' . $id . '/contact',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['note' => 'Per E-Mail kontaktiert']),
        );

        $this->em->clear();
        $stored = $this->em->getRepository(DemoRequest::class)->find($id);
        $this->assertSame('Per E-Mail kontaktiert', $stored->getAdminNote());
    }

    public function testContactReturns409WhenAlreadyDemoSent(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_DEMO_SENT);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/contact', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }

    public function testContactReturns409WhenAlreadyRejected(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_REJECTED);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/contact', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }

    public function testContactResponseContainsSuccess(): void
    {
        $req = $this->createDemoRequest();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/contact', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('success', $data);
        $this->assertTrue($data['success']);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST /admin/demo-requests/{id}/reject
    // ─────────────────────────────────────────────────────────────────────

    public function testRejectRequiresAuthentication(): void
    {
        $req = $this->createDemoRequest();

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/reject');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testRejectForbidsRoleUser(): void
    {
        $req = $this->createDemoRequest();

        $this->authenticateUser($this->client, 'user6@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/reject');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testRejectMarksPendingRequestAsRejected(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $id = $req->getId();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $id . '/reject', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseIsSuccessful();

        $this->em->clear();
        $stored = $this->em->getRepository(DemoRequest::class)->find($id);
        $this->assertSame(DemoRequest::STATUS_REJECTED, $stored->getStatus());
        $this->assertNotNull($stored->getProcessedAt());
        $this->assertNotNull($stored->getProcessedBy());
    }

    public function testRejectWithNoteStoresNote(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_PENDING);
        $id = $req->getId();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request(
            'POST',
            '/admin/demo-requests/' . $id . '/reject',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['note' => 'Kein Interesse']),
        );

        $this->em->clear();
        $stored = $this->em->getRepository(DemoRequest::class)->find($id);
        $this->assertSame('Kein Interesse', $stored->getAdminNote());
    }

    public function testRejectReturns409WhenAlreadyContacted(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_CONTACTED);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/reject', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }

    public function testRejectReturns409WhenAlreadyRejected(): void
    {
        $req = $this->createDemoRequest(DemoRequest::STATUS_REJECTED);

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/reject', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }

    public function testRejectResponseContainsSuccess(): void
    {
        $req = $this->createDemoRequest();

        $this->authenticateUser($this->client, 'user16@example.com');

        $this->client->request('POST', '/admin/demo-requests/' . $req->getId() . '/reject', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('success', $data);
        $this->assertTrue($data['success']);
    }
}
