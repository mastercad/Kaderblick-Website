<?php

namespace Tests\Feature\Controller;

use App\Entity\SystemSetting;
use App\Service\SystemSettingService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Tests for the SystemSetting admin API:
 *   GET  /api/superadmin/system-settings
 *   PATCH /api/superadmin/system-settings/{key}
 */
class SystemSettingControllerTest extends ApiWebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        parent::setUp();
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ────────────────────────────── Auth guards ──────────────────────────────

    public function testListRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testListForbiddenForRegularUser(): void
    {
        $this->authenticateUser($this->client, 'user6@example.com'); // ROLE_USER

        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testListForbiddenForAdmin(): void
    {
        $this->authenticateUser($this->client, 'user16@example.com'); // ROLE_ADMIN

        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateRequiresAuthentication(): void
    {
        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testUpdateForbiddenForAdmin(): void
    {
        $this->authenticateUser($this->client, 'user16@example.com'); // ROLE_ADMIN

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    // ────────────────────────────── GET list ──────────────────────────────

    public function testListReturnSettingsForSuperadmin(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('settings', $data);
        $this->assertArrayHasKey('defaults', $data);
    }

    public function testListContainsRegistrationContextSetting(): void
    {
        // Ensure the setting row exists
        $setting = $this->em->getRepository(SystemSetting::class)
            ->findOneBy(['key' => SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED]);
        if (null === $setting) {
            $setting = new SystemSetting(SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED, 'true');
            $this->em->persist($setting);
            $this->em->flush();
        }

        $this->authenticateUser($this->client, 'user21@example.com');
        $this->client->request('GET', '/api/superadmin/system-settings');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey(
            SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            $data['settings'],
            'registration_context_enabled must appear in the settings list.'
        );
    }

    // ────────────────────────────── PATCH update ──────────────────────────────

    public function testUpdateRegistrationContextToFalse(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('false', $data['value']);
    }

    public function testUpdateRegistrationContextToTrue(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'true'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('true', $data['value']);
    }

    public function testUpdateRejectsUnknownKey(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/totally_unknown_key',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'true'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateRejectsMissingValueField(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com'); // ROLE_SUPERADMIN

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['foo' => 'bar'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateIsPersisted(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        // Set to false
        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );
        $this->assertResponseIsSuccessful();

        // Read back from DB
        $this->em->clear();
        $setting = $this->em->getRepository(SystemSetting::class)
            ->findOneBy(['key' => SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED]);
        $this->assertNotNull($setting);
        $this->assertSame('false', $setting->getValue(), 'Value was not persisted to the database.');

        // Restore
        $this->em->flush();
    }

    // ────────────────────────────── Push notification mode ──────────────────────────────

    public function testListDefaultIncludesPushNotificationsMode(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey(
            SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            $data['defaults'],
            'push_notifications_mode must appear in the defaults list.'
        );
        $this->assertSame(
            SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL,
            $data['defaults'][SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE]
        );
    }

    public function testUpdatePushNotificationsModeToOnlyMe(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME, $data['value']);
    }

    public function testUpdatePushNotificationsModeToDisabled(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED, $data['value']);
    }

    public function testUpdatePushNotificationsModeToAll(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL, $data['value']);
    }

    public function testUpdatePushNotificationsModeRejectsInvalidValue(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'invalid_mode'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    // ────────────────────────────── Matchday lookahead days ──────────────────────────────

    public function testListDefaultIncludesMatchdayLookaheadDays(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey(
            SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            $data['defaults'],
            'matchday_lookahead_days must appear in the defaults list.'
        );
        $this->assertSame(
            (string) SystemSettingService::MATCHDAY_LOOKAHEAD_DAYS_DEFAULT,
            $data['defaults'][SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS]
        );
    }

    public function testUpdateMatchdayLookaheadDaysAcceptsValidValue(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '14'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('14', $data['value']);
    }

    public function testUpdateMatchdayLookaheadDaysAcceptsBoundaryOne(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '1'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('1', $data['value']);
    }

    public function testUpdateMatchdayLookaheadDaysAcceptsBoundaryNinety(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '90'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('90', $data['value']);
    }

    public function testUpdateMatchdayLookaheadDaysRejectsZero(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '0'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateMatchdayLookaheadDaysRejectsNegativeValue(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '-1'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateMatchdayLookaheadDaysRejectsAboveNinety(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '91'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateMatchdayLookaheadDaysRejectsNonIntegerString(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'abc'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateMatchdayLookaheadDaysRejectsFloatValue(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '7.5'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateMatchdayLookaheadDaysIsPersisted(): void
    {
        $this->authenticateUser($this->client, 'user21@example.com');

        $this->client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => '21'])
        );

        $this->assertResponseIsSuccessful();

        // Read back from DB
        $this->em->clear();
        $setting = $this->em->getRepository(SystemSetting::class)
            ->findOneBy(['key' => SystemSettingService::KEY_MATCHDAY_LOOKAHEAD_DAYS]);
        $this->assertNotNull($setting);
        $this->assertSame('21', $setting->getValue(), 'matchday_lookahead_days was not persisted.');
    }
}
