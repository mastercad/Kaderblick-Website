<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\User;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for POST /api/users/upload-avatar and DELETE /api/users/remove-avatar.
 *
 * Key invariant: uploading a new avatar file must reset useGoogleAvatar to false so
 * that the newly uploaded file is displayed instead of the Google profile picture.
 */
class UserAvatarControllerTest extends ApiWebTestCase
{
    private string $tmpFile = '';

    protected function setUp(): void
    {
        parent::setUp();

        // Create a minimal valid 1×1 PNG so the upload controller can process the file.
        $this->tmpFile = tempnam(sys_get_temp_dir(), 'avatar_test_') . '.png';
        file_put_contents(
            $this->tmpFile,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==')
        );
    }

    protected function tearDown(): void
    {
        if ($this->tmpFile && file_exists($this->tmpFile)) {
            @unlink($this->tmpFile);
        }

        parent::tearDown();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getUser9(): User
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        $this->assertNotNull($user, 'Fixture user9@example.com not found. Please load fixtures.');

        return $user;
    }

    private function resetUser9(): void
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $this->getUser9();
        $user->setUseGoogleAvatar(false);
        $user->setGoogleAvatarUrl(null);
        $user->setAvatarFilename(null);
        $em->flush();
    }

    // ── POST /api/users/upload-avatar ─────────────────────────────────────────

    public function testUploadAvatarResetsUseGoogleAvatarFlag(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        // Pre-condition: user has the Google avatar toggle enabled
        $user = $this->getUser9();
        $user->setGoogleAvatarUrl('https://lh3.googleusercontent.com/a/photo.jpg');
        $user->setUseGoogleAvatar(true);
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');

        $uploadedFile = new UploadedFile($this->tmpFile, 'avatar.png', 'image/png', null, true);
        $client->request('POST', '/api/users/upload-avatar', [], ['file' => $uploadedFile]);

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('url', $data, 'Upload response must contain a url field.');

        // Verify the flag was reset
        $em->clear();
        $updatedUser = $em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        $this->assertFalse(
            $updatedUser->isUseGoogleAvatar(),
            'useGoogleAvatar must be reset to false when a new avatar file is uploaded.'
        );

        $this->resetUser9();
    }

    public function testUploadAvatarRequiresAuthentication(): void
    {
        $client = static::createClient();

        $uploadedFile = new UploadedFile($this->tmpFile, 'avatar.png', 'image/png', null, true);
        $client->request('POST', '/api/users/upload-avatar', [], ['file' => $uploadedFile]);

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testUploadAvatarReturnsBadRequestWithoutFile(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user9@example.com');

        $client->request('POST', '/api/users/upload-avatar');

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testUploadAvatarReturnsDowloadableUrl(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user9@example.com');

        $uploadedFile = new UploadedFile($this->tmpFile, 'avatar.png', 'image/png', null, true);
        $client->request('POST', '/api/users/upload-avatar', [], ['file' => $uploadedFile]);

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringStartsWith('/uploads/avatar/', $data['url']);

        $this->resetUser9();
    }

    // ── DELETE /api/users/remove-avatar ──────────────────────────────────────

    public function testRemoveAvatarRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('DELETE', '/api/users/remove-avatar');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testRemoveAvatarClearsAvatarFilename(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();

        // Give the user a fake avatar filename
        $user = $this->getUser9();
        $user->setAvatarFilename('avatar_fake.png');
        $em->flush();

        $this->authenticateUser($client, 'user9@example.com');
        $client->request('DELETE', '/api/users/remove-avatar');

        $this->assertResponseIsSuccessful();

        $em->clear();
        $updatedUser = $em->getRepository(User::class)->findOneBy(['email' => 'user9@example.com']);
        $this->assertNull($updatedUser->getAvatarFilename());

        $this->resetUser9();
    }
}
