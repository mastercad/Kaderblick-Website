<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for POST /api/poster/share/upload.
 *
 * The endpoint accepts a PNG/JPG image (max 10 MB), requires ROLE_USER,
 * stores the file under public/uploads/poster-share/ and returns its relative URL.
 */
class PosterShareControllerTest extends ApiWebTestCase
{
    private KernelBrowser $client;

    /** Path to a minimal valid 1×1 px PNG used across upload tests. */
    private string $tmpPng = '';

    /** Absolute path to the server-side upload directory. */
    private string $uploadDir = '';

    /** Files created during a test (by mtime) are removed in tearDown. */
    private int $testStartedAt = 0;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();

        // Minimal valid 1×1 PNG (base64 encoded)
        $this->tmpPng = tempnam(sys_get_temp_dir(), 'poster_share_test_') . '.png';
        file_put_contents(
            $this->tmpPng,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==')
        );

        $this->uploadDir = static::getContainer()->getParameter('kernel.project_dir')
            . '/public/uploads/poster-share';
        $this->testStartedAt = time();
    }

    protected function tearDown(): void
    {
        if ($this->tmpPng && file_exists($this->tmpPng)) {
            @unlink($this->tmpPng);
        }

        // Remove only files written during this test run (mtime within the last few seconds)
        if (is_dir($this->uploadDir)) {
            foreach (glob($this->uploadDir . '/share_*.png') ?: [] as $file) {
                if ((int) filemtime($file) >= $this->testStartedAt) {
                    @unlink($file);
                }
            }
        }

        parent::tearDown();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function uploadPng(?string $fieldName = 'image'): void
    {
        $uploadedFile = new UploadedFile($this->tmpPng, 'poster.png', 'image/png', null, true);
        $this->client->request('POST', '/api/poster/share/upload', [], [$fieldName => $uploadedFile]);
    }

    // ── Success ───────────────────────────────────────────────────────────────

    public function testUploadReturnsRelativeUrlForAuthenticatedUser(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->uploadPng();

        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('url', $data);
        $this->assertStringStartsWith('/uploads/poster-share/', $data['url']);
        $this->assertStringEndsWith('.png', $data['url']);
    }

    public function testUploadedFileExistsOnDisk(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->uploadPng();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $filename = basename($data['url']);

        $this->assertFileExists($this->uploadDir . '/' . $filename);
    }

    public function testResponseContentTypeIsJson(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->uploadPng();

        $this->assertResponseHeaderSame('content-type', 'application/json');
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function testUploadRequiresAuthentication(): void
    {
        $this->uploadPng();
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    public function testUploadReturnsBadRequestWhenNoFileSubmitted(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->client->request('POST', '/api/poster/share/upload');

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUploadReturnsBadRequestForInvalidMimeType(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');

        $txtFile = tempnam(sys_get_temp_dir(), 'poster_invalid_') . '.txt';
        file_put_contents($txtFile, 'not an image');

        try {
            $uploadedFile = new UploadedFile($txtFile, 'test.txt', 'text/plain', null, true);
            $this->client->request('POST', '/api/poster/share/upload', [], ['image' => $uploadedFile]);
        } finally {
            @unlink($txtFile);
        }

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testUploadReturnsBadRequestWhenFileIsSubmittedUnderWrongFieldName(): void
    {
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->uploadPng('wrong_field');

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    // ── Old-file cleanup ──────────────────────────────────────────────────────

    public function testOldFilesAreRemovedOnNextUpload(): void
    {
        // Create a fake "old" file (mtime set to 2 days ago)
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }

        $staleFile = $this->uploadDir . '/share_stale_test.png';
        file_put_contents($staleFile, 'fake');
        touch($staleFile, time() - 2 * 86400);

        $this->authenticateUser($this->client, 'user9@example.com');
        $this->uploadPng();

        $this->assertResponseIsSuccessful();
        $this->assertFileDoesNotExist($staleFile, 'Stale files older than 24 h must be removed on the next upload.');
    }
}
