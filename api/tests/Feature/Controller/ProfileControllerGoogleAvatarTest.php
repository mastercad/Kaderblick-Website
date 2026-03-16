<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\User;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for the Google avatar fields added to GET /api/about-me
 * and PUT /api/update-profile.
 *
 * Coverage:
 *   – /api/about-me exposes googleAvatarUrl and useGoogleAvatar
 *   – PUT /api/update-profile persists useGoogleAvatar = true
 *   – PUT /api/update-profile persists useGoogleAvatar = false
 *   – useGoogleAvatar defaults to false for users without a value set
 */
class ProfileControllerGoogleAvatarTest extends ApiWebTestCase
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getUser9(): User
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        $this->assertNotNull($user, 'Fixture user9@example.com not found. Please load fixtures.');

        return $user;
    }

    private function resetUser9GoogleFields(): void
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $this->getUser9();
        $user->setGoogleAvatarUrl(null);
        $user->setUseGoogleAvatar(false);
        $em->flush();
    }

    // ── GET /api/about-me ─────────────────────────────────────────────────────

    public function testAboutMeExposesGoogleAvatarFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user9@example.com');

        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('googleAvatarUrl', $data, '"googleAvatarUrl" must be present in the about-me response.');
        $this->assertArrayHasKey('useGoogleAvatar', $data, '"useGoogleAvatar" must be present in the about-me response.');
    }

    public function testAboutMeReturnsGoogleAvatarUrlWhenSet(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        $user = $this->getUser9();
        $user->setGoogleAvatarUrl('https://lh3.googleusercontent.com/a/photo.jpg');
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('https://lh3.googleusercontent.com/a/photo.jpg', $data['googleAvatarUrl']);

        $this->resetUser9GoogleFields();
    }

    public function testAboutMeReturnsUseGoogleAvatarTrueWhenEnabled(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertTrue($data['useGoogleAvatar']);

        $this->resetUser9GoogleFields();
    }

    public function testAboutMeReturnsUseGoogleAvatarFalseByDefault(): void
    {
        $client = static::createClient();
        $this->resetUser9GoogleFields();
        $this->authenticateUser($client, 'user9@example.com');

        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertFalse($data['useGoogleAvatar']);
        $this->assertNull($data['googleAvatarUrl']);
    }

    // ── PUT /api/update-profile ───────────────────────────────────────────────

    public function testUpdateProfileActivatesUseGoogleAvatar(): void
    {
        $client = static::createClient();
        $this->resetUser9GoogleFields();
        $this->authenticateUser($client, 'user9@example.com');

        $client->request(
            'PUT',
            '/api/update-profile',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['useGoogleAvatar' => true])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Verify persistence
        $client->request('GET', '/api/about-me');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['useGoogleAvatar']);

        $this->resetUser9GoogleFields();
    }

    public function testUpdateProfileDeactivatesUseGoogleAvatar(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        // Start with useGoogleAvatar = true
        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request(
            'PUT',
            '/api/update-profile',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['useGoogleAvatar' => false])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        $client->request('GET', '/api/about-me');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertFalse($data['useGoogleAvatar']);

        $this->resetUser9GoogleFields();
    }

    public function testUpdateProfileIgnoresUseGoogleAvatarWhenNotProvided(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        // Pre-set useGoogleAvatar to true
        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        // Send a profile update WITHOUT useGoogleAvatar
        $client->request(
            'PUT',
            '/api/update-profile',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['firstName' => 'Test'])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // useGoogleAvatar should remain true (unchanged)
        $client->request('GET', '/api/about-me');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue(
            $data['useGoogleAvatar'],
            'useGoogleAvatar must stay unchanged when the field is omitted from the request.'
        );

        $this->resetUser9GoogleFields();
    }
}
