<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\Coach;
use App\Entity\QuickEventPreset;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für QuickEventPresetController:
 *   GET    /api/quick-event-presets
 *   POST   /api/quick-event-presets
 *   PUT    /api/quick-event-presets/{id}
 *   DELETE /api/quick-event-presets/{id}
 *   POST   /api/quick-event-presets/{id}/activate
 *   POST   /api/quick-event-presets/{id}/deactivate
 *   POST   /api/quick-event-presets/{id}/share
 *   POST   /api/quick-event-presets/{id}/copy
 *
 * Alle Tests laufen innerhalb einer DB-Transaktion, die am Ende immer
 * zurückgerollt wird — keine Daten werden dauerhaft persistiert.
 */
class QuickEventPresetControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $adminUser;
    private User $coachUser;
    private User $coachUserB;
    private User $regularUser;

    private RelationType $selfCoachType;

    private string $suffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->suffix = bin2hex(random_bytes(4));

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user21@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->selfCoachType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_coach']);
        self::assertNotNull($this->selfCoachType, 'RelationType "self_coach" nicht gefunden. Bitte Fixtures laden.');

        $this->coachUser = $this->makeCoachUser('qep-coach-a');
        $this->coachUserB = $this->makeCoachUser('qep-coach-b');

        $this->em->flush();
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function makeCoachUser(string $prefix): User
    {
        $coach = (new Coach())
            ->setFirstName(ucfirst($prefix))
            ->setLastName('Test')
            ->setEmail("{$prefix}-{$this->suffix}@test.example.com");
        $this->em->persist($coach);

        $user = (new User())
            ->setEmail("{$prefix}-{$this->suffix}@test.example.com")
            ->setFirstName(ucfirst($prefix))
            ->setLastName('Test')
            ->setPassword('test')
            ->setRoles(['ROLE_USER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        $relation = (new UserRelation())
            ->setUser($user)
            ->setCoach($coach)
            ->setRelationType($this->selfCoachType)
            ->setPermissions([]);
        $this->em->persist($relation);
        $user->addUserRelation($relation);
        $coach->addUserRelation($relation);

        return $user;
    }

    private function makePreset(User $owner, string $name = 'Test Preset', bool $active = false): QuickEventPreset
    {
        $preset = new QuickEventPreset($owner, $name, ['buttons' => []]);
        $preset->setActive($active);
        $this->em->persist($preset);
        $this->em->flush();

        return $preset;
    }

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    /**
     * @return array<string, mixed>
     */
    private function assertJsonResponse(int $expectedStatus): array
    {
        self::assertResponseStatusCodeSame($expectedStatus);
        $content = $this->client->getResponse()->getContent();
        self::assertIsString($content);
        self::assertJson($content);

        return (array) json_decode($content, true);
    }

    private function request(string $method, string $url, mixed $body = null): void
    {
        $this->client->request(
            $method,
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            null !== $body ? json_encode($body) : null
        );
    }

    // ── Authentication ─────────────────────────────────────────────────────

    public function testListRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/quick-event-presets');
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testListDeniedForRegularUser(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/quick-event-presets');
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    // ── GET /list ─────────────────────────────────────────────────────────

    public function testListReturnsOnlyOwnPresetsForCoach(): void
    {
        $ownPreset = $this->makePreset($this->coachUser, 'Own');
        $otherPreset = $this->makePreset($this->coachUserB, 'Other');

        $this->authenticate($this->coachUser);
        $this->client->request('GET', '/api/quick-event-presets');

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        $ids = array_column($data['presets'], 'id');

        self::assertContains($ownPreset->getId(), $ids);
        self::assertNotContains($otherPreset->getId(), $ids);
    }

    public function testListReturnsSharedPresetsForCoach(): void
    {
        $sharedPreset = $this->makePreset($this->coachUserB, 'Shared');
        $sharedPreset->addSharedWith($this->coachUser);
        $this->em->flush();

        $this->authenticate($this->coachUser);
        $this->client->request('GET', '/api/quick-event-presets');

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        $ids = array_column($data['presets'], 'id');

        self::assertContains($sharedPreset->getId(), $ids);
    }

    public function testListReturnsAllPresetsForAdmin(): void
    {
        $presetA = $this->makePreset($this->coachUser, 'A');
        $presetB = $this->makePreset($this->coachUserB, 'B');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/quick-event-presets');

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        $ids = array_column($data['presets'], 'id');

        self::assertContains($presetA->getId(), $ids);
        self::assertContains($presetB->getId(), $ids);
    }

    public function testListResponseContainsExpectedPresetKeys(): void
    {
        $this->makePreset($this->coachUser, 'Struktur');

        $this->authenticate($this->coachUser);
        $this->client->request('GET', '/api/quick-event-presets');

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertNotEmpty($data['presets']);

        $preset = $data['presets'][0];
        foreach (['id', 'name', 'config', 'isActive', 'ownerId', 'sharedWithUserIds', 'createdAt', 'updatedAt'] as $key) {
            self::assertArrayHasKey($key, $preset, "Missing key: {$key}");
        }
    }

    // ── POST /create ──────────────────────────────────────────────────────

    public function testCreateRequiresAuthentication(): void
    {
        $this->request('POST', '/api/quick-event-presets', ['name' => 'X', 'config' => []]);
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testCreateReturnsBadRequestWhenNameMissing(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets', ['config' => []]);
        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateReturnsBadRequestWhenConfigMissing(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets', ['name' => 'X']);
        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testCreateReturns201AndSetsOwner(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets', [
            'name' => 'Mein Preset',
            'config' => ['buttons' => []],
        ]);

        $data = $this->assertJsonResponse(Response::HTTP_CREATED);
        self::assertSame('Mein Preset', $data['name']);
        self::assertSame($this->coachUser->getId(), $data['ownerId']);
        self::assertSame([], $data['sharedWithUserIds']);
        self::assertFalse($data['isActive']);
    }

    // ── PUT /update ───────────────────────────────────────────────────────

    public function testUpdateReturns404ForUnknownPreset(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('PUT', '/api/quick-event-presets/99999999', ['name' => 'X']);
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testUpdateReturns403ForNonOwner(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'B Preset');

        $this->authenticate($this->coachUser);
        $this->request('PUT', '/api/quick-event-presets/' . $preset->getId(), ['name' => 'Stolen']);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateNameByOwner(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Alt');

        $this->authenticate($this->coachUser);
        $this->request('PUT', '/api/quick-event-presets/' . $preset->getId(), ['name' => 'Neu']);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame('Neu', $data['name']);
    }

    public function testUpdateConfigByOwner(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Config Preset');
        $newConfig = ['buttons' => [['eventTypeCode' => 'goal', 'label' => 'Tor']]];

        $this->authenticate($this->coachUser);
        $this->request('PUT', '/api/quick-event-presets/' . $preset->getId(), ['config' => $newConfig]);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame($newConfig, $data['config']);
    }

    public function testUpdateAllowedForAdmin(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Admin edits this');

        $this->authenticate($this->adminUser);
        $this->request('PUT', '/api/quick-event-presets/' . $preset->getId(), ['name' => 'Admin edit']);

        self::assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    // ── DELETE ────────────────────────────────────────────────────────────

    public function testDeleteReturns404ForUnknownPreset(): void
    {
        $this->authenticate($this->coachUser);
        $this->client->request('DELETE', '/api/quick-event-presets/99999999');
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testDeleteReturns403ForNonOwner(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'Other Preset');

        $this->authenticate($this->coachUser);
        $this->client->request('DELETE', '/api/quick-event-presets/' . $preset->getId());
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteReturns204ForOwner(): void
    {
        $preset = $this->makePreset($this->coachUser, 'To Delete');

        $this->authenticate($this->coachUser);
        $this->client->request('DELETE', '/api/quick-event-presets/' . $preset->getId());
        self::assertResponseStatusCodeSame(Response::HTTP_NO_CONTENT);
    }

    public function testDeleteAllowedForAdmin(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Admin deletes');

        $this->authenticate($this->adminUser);
        $this->client->request('DELETE', '/api/quick-event-presets/' . $preset->getId());
        self::assertResponseStatusCodeSame(Response::HTTP_NO_CONTENT);
    }

    // ── POST /activate ────────────────────────────────────────────────────

    public function testActivateReturns404ForUnknownPreset(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/99999999/activate', []);
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testActivateReturns403ForNonOwner(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'B Preset');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/activate', []);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testActivateSetsPresetActiveForOwner(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Activate Me');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/activate', []);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertTrue($data['isActive']);
    }

    // ── POST /deactivate ──────────────────────────────────────────────────

    public function testDeactivateReturns403ForNonOwner(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'B Active', true);

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/deactivate', []);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeactivateSetsPresetInactiveForOwner(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Deactivate Me', true);

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/deactivate', []);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertFalse($data['isActive']);
    }

    // ── POST /share ───────────────────────────────────────────────────────

    public function testShareReturns404ForUnknownPreset(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/99999999/share', ['userIds' => []]);
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testShareReturns403ForNonOwner(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'B Preset');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/share', ['userIds' => []]);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testShareReturnsBadRequestWhenUserIdsNotArray(): void
    {
        $preset = $this->makePreset($this->coachUser, 'My Preset');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/share', ['userIds' => 'bad']);
        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testShareAddsUserToSharedWithList(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Shareable');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/share', [
            'userIds' => [$this->coachUserB->getId()],
        ]);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertContains($this->coachUserB->getId(), $data['sharedWithUserIds']);
    }

    public function testShareReplacesExistingSharedList(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Shared');
        $preset->addSharedWith($this->coachUserB);
        $this->em->flush();

        // Now share with no one — should clear coachUserB
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/share', ['userIds' => []]);

        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame([], $data['sharedWithUserIds']);
    }

    public function testShareByAdminAllowed(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Admin Shares');

        $this->authenticate($this->adminUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/share', [
            'userIds' => [$this->coachUserB->getId()],
        ]);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    // ── POST /copy ────────────────────────────────────────────────────────

    public function testCopyReturns404ForUnknownPreset(): void
    {
        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/99999999/copy', []);
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testCopyReturns403WhenNotOwnerAndNotShared(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'Private');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/copy', []);
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testCopyByOwnerCreatesNewPresetWithSuffix(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Original');

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/copy', []);

        $data = $this->assertJsonResponse(Response::HTTP_CREATED);
        self::assertNotSame($preset->getId(), $data['id']);
        self::assertStringContainsString('Kopie', $data['name']);
        self::assertSame($this->coachUser->getId(), $data['ownerId']);
        self::assertSame([], $data['sharedWithUserIds']);
    }

    public function testCopyOfSharedPresetAllowed(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'Shared Original');
        $preset->addSharedWith($this->coachUser);
        $this->em->flush();

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/copy', []);

        $data = $this->assertJsonResponse(Response::HTTP_CREATED);
        self::assertSame($this->coachUser->getId(), $data['ownerId']);
    }

    public function testCopiedPresetIsNotSharedWithAnyone(): void
    {
        $preset = $this->makePreset($this->coachUser, 'Original');
        $preset->addSharedWith($this->coachUserB);
        $this->em->flush();

        $this->authenticate($this->coachUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/copy', []);

        $data = $this->assertJsonResponse(Response::HTTP_CREATED);
        self::assertSame([], $data['sharedWithUserIds']);
    }

    public function testCopyByAdminAllowed(): void
    {
        $preset = $this->makePreset($this->coachUserB, 'Admin Copies');

        $this->authenticate($this->adminUser);
        $this->request('POST', '/api/quick-event-presets/' . $preset->getId() . '/copy', []);
        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }
}
