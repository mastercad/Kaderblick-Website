<?php

namespace Tests\Feature\Controller;

use App\Entity\SystemSetting;
use App\Service\SystemSettingService;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Tests for the SystemSetting admin API:
 *   GET  /api/superadmin/system-settings
 *   PATCH /api/superadmin/system-settings/{key}
 */
class SystemSettingControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── Auth guards ──────────────────────────────

    public function testListRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testListForbiddenForRegularUser(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testListForbiddenForAdmin(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request(
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
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request(
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
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('settings', $data);
        $this->assertArrayHasKey('defaults', $data);
    }

    public function testListContainsRegistrationContextSetting(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        // Ensure the setting row exists
        $setting = $em->getRepository(SystemSetting::class)
            ->findOneBy(['key' => SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED]);
        if (null === $setting) {
            $setting = new SystemSetting(SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED, 'true');
            $em->persist($setting);
            $em->flush();
        }

        $this->authenticateUser($client, 'user21@example.com');
        $client->request('GET', '/api/superadmin/system-settings');

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey(
            SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            $data['settings'],
            'registration_context_enabled must appear in the settings list.'
        );
    }

    // ────────────────────────────── PATCH update ──────────────────────────────

    public function testUpdateRegistrationContextToFalse(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('false', $data['value']);
    }

    public function testUpdateRegistrationContextToTrue(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'true'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('true', $data['value']);
    }

    public function testUpdateRejectsUnknownKey(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/totally_unknown_key',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'true'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateRejectsMissingValueField(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['foo' => 'bar'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUpdateIsPersisted(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();
        $this->authenticateUser($client, 'user21@example.com');

        // Set to false
        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'false'])
        );
        $this->assertResponseIsSuccessful();

        // Read back from DB
        $em->clear();
        $setting = $em->getRepository(SystemSetting::class)
            ->findOneBy(['key' => SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED]);
        $this->assertNotNull($setting);
        $this->assertSame('false', $setting->getValue(), 'Value was not persisted to the database.');

        // Restore
        $setting->setValue('true');
        $em->flush();
    }

    // ────────────────────────────── Push notification mode ──────────────────────────────

    public function testListDefaultIncludesPushNotificationsMode(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/superadmin/system-settings');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
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
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ONLY_ME, $data['value']);
    }

    public function testUpdatePushNotificationsModeToDisabled(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_DISABLED, $data['value']);
    }

    public function testUpdatePushNotificationsModeToAll(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(SystemSettingService::PUSH_NOTIFICATIONS_MODE_ALL, $data['value']);
    }

    public function testUpdatePushNotificationsModeRejectsInvalidValue(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request(
            'PATCH',
            '/api/superadmin/system-settings/' . SystemSettingService::KEY_PUSH_NOTIFICATIONS_MODE,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['value' => 'invalid_mode'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }
}
