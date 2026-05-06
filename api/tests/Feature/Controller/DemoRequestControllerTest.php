<?php

namespace App\Tests\Feature\Controller;

use App\Entity\DemoRequest;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for DemoRequestController (POST /api/demo-request).
 *
 * This endpoint is PUBLIC — no authentication required.
 *
 * Covers:
 *  - 201 Created on valid minimal payload (name + email)
 *  - 201 Created on valid full payload (all optional fields)
 *  - 400 Bad Request when name is missing
 *  - 400 Bad Request when email is missing
 *  - 400 Bad Request when email is invalid
 *  - 400 Bad Request on non-JSON body
 *  - 409 Conflict when a pending request with the same email already exists
 *  - Response body structure on success
 *  - Method not allowed (GET)
 */
class DemoRequestControllerTest extends WebTestCase
{
    private EntityManagerInterface $em;
    private KernelBrowser $client;

    /** Unique prefix to isolate test emails from fixture data */
    private const PREFIX = 'demo-ctrl-test-';

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    protected function tearDown(): void
    {
        // Remove all DemoRequests created by this test run
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

    /**
     * @param array<string, mixed> $payload
     */
    private function post(array $payload): KernelBrowser
    {
        $this->client->request(
            'POST',
            '/api/demo-request',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload),
        );

        return $this->client;
    }

    private function uniqueEmail(): string
    {
        return self::PREFIX . uniqid() . '@example.com';
    }

    // ─────────────────────────────────────────────────────────────────────
    // Success cases
    // ─────────────────────────────────────────────────────────────────────

    public function testCreateWithRequiredFieldsReturns201(): void
    {
        $client = $this->post([
            'name' => 'Max Mustermann',
            'email' => $this->uniqueEmail(),
        ]);

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }

    public function testCreateWithAllFieldsReturns201(): void
    {
        $client = $this->post([
            'name' => 'Anna Müller',
            'email' => $this->uniqueEmail(),
            'clubName' => 'SV Musterstadt',
            'league' => 'Bezirksliga',
            'ageGroup' => 'U15',
            'phone' => '+49 170 1234567',
            'message' => 'Ich bin interessiert.',
        ]);

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }

    public function testCreateResponseBodyContainsSuccess(): void
    {
        $client = $this->post([
            'name' => 'Test User',
            'email' => $this->uniqueEmail(),
        ]);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('success', $data);
        $this->assertTrue($data['success']);
    }

    public function testCreatePersistsDemoRequestInDatabase(): void
    {
        $email = $this->uniqueEmail();
        $this->post(['name' => 'Persist Test', 'email' => $email]);

        $stored = $this->em->getRepository(DemoRequest::class)->findOneBy(['email' => $email]);
        $this->assertNotNull($stored);
        $this->assertSame('Persist Test', $stored->getName());
        $this->assertSame(DemoRequest::STATUS_PENDING, $stored->getStatus());
    }

    public function testCreatePersistsOptionalFields(): void
    {
        $email = $this->uniqueEmail();
        $this->post([
            'name' => 'Full Fields',
            'email' => $email,
            'clubName' => 'FC Test',
            'league' => 'Kreisliga A',
            'ageGroup' => 'U17',
            'phone' => '0171 999',
            'message' => 'Kommentar',
        ]);

        $stored = $this->em->getRepository(DemoRequest::class)->findOneBy(['email' => $email]);
        $this->assertNotNull($stored);
        $this->assertSame('FC Test', $stored->getClubName());
        $this->assertSame('Kreisliga A', $stored->getLeague());
        $this->assertSame('U17', $stored->getAgeGroup());
        $this->assertSame('0171 999', $stored->getPhone());
        $this->assertSame('Kommentar', $stored->getMessage());
    }

    public function testCreateTrimsWhitespaceFromNameAndEmail(): void
    {
        $client = $this->post([
            'name' => '  Trimmed Name  ',
            'email' => '  ' . self::PREFIX . 'trim@example.com  ',
        ]);

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $stored = $this->em->getRepository(DemoRequest::class)->findOneBy(['email' => self::PREFIX . 'trim@example.com']);
        $this->assertNotNull($stored);
        $this->assertSame('Trimmed Name', $stored->getName());
    }

    public function testEmptyOptionalStringFieldsStoredAsNull(): void
    {
        $email = $this->uniqueEmail();
        $this->post([
            'name' => 'Nullable Test',
            'email' => $email,
            'clubName' => '',
            'league' => '   ',
            'message' => '',
        ]);

        $stored = $this->em->getRepository(DemoRequest::class)->findOneBy(['email' => $email]);
        $this->assertNotNull($stored);
        $this->assertNull($stored->getClubName());
        $this->assertNull($stored->getLeague());
        $this->assertNull($stored->getMessage());
    }

    public function testEndpointIsPublicNoAuthRequired(): void
    {
        // No authentication — must still return 201
        $this->client->request(
            'POST',
            '/api/demo-request',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Anon User', 'email' => $this->uniqueEmail()]),
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Validation failures → 400
    // ─────────────────────────────────────────────────────────────────────

    public function testCreateWithoutNameReturns400(): void
    {
        $this->post(['email' => $this->uniqueEmail()]);
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateWithBlankNameReturns400(): void
    {
        $this->post(['name' => '   ', 'email' => $this->uniqueEmail()]);
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateWithoutEmailReturns400(): void
    {
        $this->post(['name' => 'No Email']);
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateWithBlankEmailReturns400(): void
    {
        $this->post(['name' => 'Blank Email', 'email' => '']);
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateWithInvalidEmailReturns400(): void
    {
        $this->post(['name' => 'Bad Email', 'email' => 'not-an-email']);
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testValidationErrorResponseContainsErrorKey(): void
    {
        $client = $this->post(['email' => $this->uniqueEmail()]);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
        $this->assertNotEmpty($data['error']);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Duplicate → 409
    // ─────────────────────────────────────────────────────────────────────

    public function testDuplicatePendingEmailReturns409(): void
    {
        $email = $this->uniqueEmail();

        // First request — should succeed
        $this->post(['name' => 'First Request', 'email' => $email]);
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Second request with same email — should return 409
        $this->post(['name' => 'Duplicate', 'email' => $email]);
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }

    public function testDuplicateResponseContainsErrorMessage(): void
    {
        $email = $this->uniqueEmail();
        $this->post(['name' => 'First', 'email' => $email]);

        $client = $this->post(['name' => 'Second', 'email' => $email]);
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('error', $data);
        $this->assertNotEmpty($data['error']);
    }

    public function testNonPendingEmailCanSubmitAgain(): void
    {
        // Create a contacted DemoRequest directly in DB
        $email = $this->uniqueEmail();
        $contacted = new DemoRequest();
        $contacted->setName('Previous')->setEmail($email)->setStatus(DemoRequest::STATUS_CONTACTED);
        $this->em->persist($contacted);
        $this->em->flush();

        // New request with same email — allowed because previous is not pending
        $this->post(['name' => 'New Request', 'email' => $email]);
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }

    // ─────────────────────────────────────────────────────────────────────
    // HTTP method
    // ─────────────────────────────────────────────────────────────────────

    public function testGetMethodReturns405(): void
    {
        $this->client->request('GET', '/api/demo-request');
        $this->assertResponseStatusCodeSame(Response::HTTP_METHOD_NOT_ALLOWED);
    }
}
