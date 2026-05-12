<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\QuickEventConfig;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für die Quick-Event-Config-Endpunkte:
 *   GET  /api/users/me/quick-event-config
 *   PUT  /api/users/me/quick-event-config
 *
 * Alle Tests laufen innerhalb einer DB-Transaktion, die am Ende immer
 * zurückgerollt wird – keine Daten werden dauerhaft persistiert.
 */
class UserControllerQuickEventConfigTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $adminUser;
    private User $regularUser;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function getUrl(): string
    {
        return '/api/users/me/quick-event-config';
    }

    /**
     * @return array<string, mixed>
     */
    private function assertJsonResponse(int $expectedStatus): array
    {
        self::assertResponseStatusCodeSame($expectedStatus);
        $content = $this->client->getResponse()->getContent();
        self::assertJson($content);

        return (array) json_decode($content, true);
    }

    // ── GET /me/quick-event-config ─────────────────────────────────────────────

    public function testGetRequiresAuthentication(): void
    {
        $this->client->request('GET', $this->getUrl());
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testGetReturnsNullWhenNoConfigExists(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', $this->getUrl());

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('config', $data);
        self::assertNull($data['config']);
    }

    public function testGetReturnsStoredConfig(): void
    {
        // Konfiguration direkt per Entity anlegen
        $configData = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $entity = new QuickEventConfig($this->regularUser, $configData);
        $this->em->persist($entity);
        $this->em->flush();

        $this->authenticate($this->regularUser);
        $this->client->request('GET', $this->getUrl());

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('config', $data);
        self::assertIsArray($data['config']);
        self::assertSame($configData, $data['config']);
    }

    public function testGetIsUserScoped(): void
    {
        // Admin legt Config an — regularUser soll nichts sehen
        $configData = ['buttons' => [['eventTypeCode' => 'foul', 'label' => 'Foul']]];
        $entity = new QuickEventConfig($this->adminUser, $configData);
        $this->em->persist($entity);
        $this->em->flush();

        $this->authenticate($this->regularUser);
        $this->client->request('GET', $this->getUrl());

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertNull($data['config']);
    }

    // ── PUT /me/quick-event-config ─────────────────────────────────────────────

    public function testPutRequiresAuthentication(): void
    {
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => []])
        );
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testPutCreatesNewConfig(): void
    {
        $configData = ['buttons' => [['eventTypeCode' => 'yellow_card', 'label' => 'Karte']]];

        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => $configData])
        );

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('config', $data);
        self::assertSame($configData, $data['config']);
    }

    public function testPutResponseReflectsCreatedConfig(): void
    {
        // PUT creates a new config and the response immediately contains that config.
        // (Cross-request GET verification is not reliable within a single DB transaction;
        //  see testGetReturnsStoredConfig for GET-side verification.)
        $configData = ['buttons' => [['eventTypeCode' => 'corner', 'label' => 'Ecke']]];

        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => $configData])
        );

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('config', $data);
        self::assertSame($configData, $data['config']);
    }

    public function testPutUpdatesExistingConfig(): void
    {
        // Erst eine Config anlegen
        $initial = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];
        $entity = new QuickEventConfig($this->regularUser, $initial);
        $this->em->persist($entity);
        $this->em->flush();

        // Dann per PUT überschreiben
        $updated = ['buttons' => [['eventTypeCode' => 'assist', 'label' => 'Assist']]];

        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => $updated])
        );

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame($updated, $data['config']);
    }

    public function testPutReturnsBadRequestWhenConfigIsNotAnArray(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => 'invalid-string'])
        );

        $data = $this->assertJsonResponse(Response::HTTP_BAD_REQUEST);
        self::assertArrayHasKey('error', $data);
    }

    public function testPutTreatsNullConfigAsEmptyArray(): void
    {
        // The controller uses `$data['config'] ?? []`, so null coalesces to []
        // and is treated as an empty (valid) config — returns 200 with config: [].
        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => null])
        );

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame([], $data['config']);
    }

    public function testPutAcceptsEmptyConfigArray(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => []])
        );

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame([], $data['config']);
    }

    public function testPutIsUserScoped(): void
    {
        // Admin legt Config an
        $adminConfig = ['buttons' => [['eventTypeCode' => 'foul', 'label' => 'Foul']]];
        $entity = new QuickEventConfig($this->adminUser, $adminConfig);
        $this->em->persist($entity);
        $this->em->flush();

        // regularUser legt seine eigene Config an
        $userConfig = ['buttons' => [['eventTypeCode' => 'corner', 'label' => 'Ecke']]];
        $this->authenticate($this->regularUser);
        $this->client->request(
            'PUT',
            $this->getUrl(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['config' => $userConfig])
        );
        self::assertResponseIsSuccessful();

        // Admin-Config darf nicht verändert worden sein
        $this->em->refresh($entity);
        self::assertSame($adminConfig, $entity->getConfig());
    }
}
