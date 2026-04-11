<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for the Google avatar fields added to GET /api/about-me
 * and PUT /api/update-profile.
 *
 * Coverage:
 *   - /api/about-me exposes googleAvatarUrl and useGoogleAvatar
 *   - PUT /api/update-profile persists useGoogleAvatar = true
 *   - PUT /api/update-profile persists useGoogleAvatar = false
 *   - useGoogleAvatar defaults to false for users without a value set
 */
class ProfileControllerGoogleAvatarTest extends ApiWebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get('doctrine')->getManager();
    }

    protected function tearDown(): void
    {
        // Reset user9 fields to fixture defaults so no test bleeds into the next.
        // Cannot use transaction rollback here because KernelBrowser reboots the
        // kernel (and closes the DB connection) between HTTP requests.
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        if (null !== $user) {
            $user->setUseGoogleAvatar(false);
            $user->setGoogleAvatarUrl(null);
            $user->setFirstName('testuser');
            $this->em->flush();
        }
        parent::tearDown();
    }

    // -- Helpers ------------------------------------------------------------------

    private function getUser9(): User
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        $this->assertNotNull($user, 'Fixture user9@example.com not found. Please load fixtures.');

        return $user;
    }

    // -- GET /api/about-me --------------------------------------------------------

    public function testAboutMeExposesGoogleAvatarFields(): void
    {
        $client = $this->client;
        $this->authenticateUser($client, 'user9@example.com');

        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('googleAvatarUrl', $data, '"googleAvatarUrl" must be present in the about-me response.');
        $this->assertArrayHasKey('useGoogleAvatar', $data, '"useGoogleAvatar" must be present in the about-me response.');
    }

    public function testAboutMeReturnsGoogleAvatarUrlWhenSet(): void
    {
        $client = $this->client;

        $user = $this->getUser9();
        $user->setGoogleAvatarUrl('https://lh3.googleusercontent.com/a/photo.jpg');
        $this->em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('https://lh3.googleusercontent.com/a/photo.jpg', $data['googleAvatarUrl']);
    }

    public function testAboutMeReturnsUseGoogleAvatarTrueWhenEnabled(): void
    {
        $client = $this->client;

        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $this->em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertTrue($data['useGoogleAvatar']);
    }

    public function testAboutMeReturnsUseGoogleAvatarFalseByDefault(): void
    {
        $client = $this->client;
        $this->authenticateUser($client, 'user9@example.com');

        $client->request('GET', '/api/about-me');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertFalse($data['useGoogleAvatar']);
        $this->assertNull($data['googleAvatarUrl']);
    }

    // -- PUT /api/update-profile --------------------------------------------------

    public function testUpdateProfileActivatesUseGoogleAvatar(): void
    {
        $client = $this->client;
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

        // Verify persistence via about-me
        $client->request('GET', '/api/about-me');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['useGoogleAvatar']);
    }

    public function testUpdateProfileDeactivatesUseGoogleAvatar(): void
    {
        $client = $this->client;

        // Start with useGoogleAvatar = true
        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $this->em->flush();

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
    }

    public function testUpdateProfileIgnoresUseGoogleAvatarWhenNotProvided(): void
    {
        $client = $this->client;

        // Pre-set useGoogleAvatar to true
        $user = $this->getUser9();
        $user->setUseGoogleAvatar(true);
        $this->em->flush();

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
    }
}
