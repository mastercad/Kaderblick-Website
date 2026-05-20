<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for GET /poster-share/{filename}
 *
 * Covered behaviour:
 *  - 200 with correct HTML / OG meta tags for existing file
 *  - 404 when file does not exist on disk (but filename is valid)
 *  - 404 / 405 for invalid filenames (path traversal, wrong prefix, wrong extension)
 *  - Route is publicly accessible without JWT
 *  - Only GET is accepted; POST/DELETE → 405
 */
class PosterSharePageControllerTest extends ApiWebTestCase
{
    private KernelBrowser $client;

    /** Absolute path to the server-side upload directory. */
    private string $uploadDir = '';

    /** Filenames of files created during a test, cleaned up in tearDown. */
    private array $createdFiles = [];

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();

        $this->uploadDir = static::getContainer()->getParameter('kernel.project_dir')
            . '/public/uploads/poster-share';
    }

    protected function tearDown(): void
    {
        foreach ($this->createdFiles as $filename) {
            $path = $this->uploadDir . '/' . $filename;
            if (file_exists($path)) {
                @unlink($path);
            }
        }
        $this->createdFiles = [];

        parent::tearDown();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Creates a minimal valid 1×1 PNG inside the upload directory and returns its filename.
     */
    private function createPosterFile(string $filename = 'share_test_phpunit.png'): string
    {
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }

        file_put_contents(
            $this->uploadDir . '/' . $filename,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==')
        );

        $this->createdFiles[] = $filename;

        return $filename;
    }

    // ── Success ───────────────────────────────────────────────────────────────

    public function testReturns200ForValidExistingFile(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    public function testResponseContentTypeIsHtml(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertStringContainsString('text/html', $this->client->getResponse()->headers->get('Content-Type') ?? '');
    }

    public function testOgImageMetaTagContainsFilename(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertSelectorExists('meta[property="og:image"]');

        $crawler = $this->client->getCrawler();
        $ogImage = $crawler->filter('meta[property="og:image"]')->attr('content');

        $this->assertStringContainsString($filename, $ogImage);
        $this->assertStringContainsString('/uploads/poster-share/', $ogImage);
    }

    public function testOgImageUrlIsAbsolute(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $crawler = $this->client->getCrawler();
        $ogImage = $crawler->filter('meta[property="og:image"]')->attr('content');

        $this->assertStringStartsWith('http', $ogImage, 'og:image must be an absolute URL');
    }

    public function testOgTitleMetaTagIsPresent(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertSelectorExists('meta[property="og:title"]');
    }

    public function testOgDescriptionMetaTagIsPresent(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertSelectorExists('meta[property="og:description"]');
    }

    public function testOgUrlMetaTagContainsSharePath(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $crawler = $this->client->getCrawler();
        $ogUrl = $crawler->filter('meta[property="og:url"]')->attr('content');

        $this->assertStringContainsString('/poster-share/' . $filename, $ogUrl);
    }

    public function testTwitterCardMetaTagIsSummaryLargeImage(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertSelectorExists('meta[name="twitter:card"]');

        $crawler = $this->client->getCrawler();
        $twitterCard = $crawler->filter('meta[name="twitter:card"]')->attr('content');

        $this->assertSame('summary_large_image', $twitterCard);
    }

    public function testTwitterImageMetaTagContainsFilename(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $crawler = $this->client->getCrawler();
        $twitterImage = $crawler->filter('meta[name="twitter:image"]')->attr('content');

        $this->assertStringContainsString($filename, $twitterImage);
    }

    public function testPageBodyContainsImgTag(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertSelectorExists('img');

        $crawler = $this->client->getCrawler();
        $imgSrc = $crawler->filter('img')->attr('src');

        $this->assertStringContainsString($filename, $imgSrc);
    }

    // ── Public access (no JWT required) ──────────────────────────────────────

    public function testRouteIsAccessibleWithoutAuthentication(): void
    {
        $filename = $this->createPosterFile();

        // No authenticateUser() call → anonymous request
        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    public function testRouteDoesNotRequireJwtToken(): void
    {
        $filename = $this->createPosterFile();

        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->client->request('GET', '/poster-share/' . $filename);

        // Must not be 401
        $this->assertNotSame(Response::HTTP_UNAUTHORIZED, $this->client->getResponse()->getStatusCode());
    }

    // ── 404 – file not found on disk ──────────────────────────────────────────

    public function testReturns404WhenFileDoesNotExistOnDisk(): void
    {
        // Valid filename format, but no file written to disk
        $this->client->request('GET', '/poster-share/share_doesnotexist12345.png');

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    // ── 404 – invalid filename formats ────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\DataProvider('invalidFilenameProvider')]
    public function testReturns404ForInvalidFilename(string $filename): void
    {
        $this->client->request('GET', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidFilenameProvider(): array
    {
        return [
            'missing share_ prefix'     => ['poster_abc123.png'],
            'wrong extension'           => ['share_abc123.jpg'],
            'no extension'              => ['share_abc123'],
            'php extension'             => ['share_abc123.php'],
            'shell injection'           => ['share_abc;rm -rf /.png'],
            'space in name'             => ['share_abc 123.png'],
            'null byte'                 => ["share_abc\x00.png"],
        ];
    }

    // ── Path traversal protection ─────────────────────────────────────────────

    public function testReturns404ForPathTraversalWithDotDot(): void
    {
        // Symfony routing will normalise ".." away; the controller regex blocks anything left
        $this->client->request('GET', '/poster-share/../../../etc/passwd');

        $status = $this->client->getResponse()->getStatusCode();
        $this->assertContains($status, [Response::HTTP_NOT_FOUND, Response::HTTP_MOVED_PERMANENTLY, Response::HTTP_FOUND]);
    }

    public function testReturns404ForFilenameWithLeadingDot(): void
    {
        $this->client->request('GET', '/poster-share/.htaccess');

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    // ── HTTP method validation ────────────────────────────────────────────────

    public function testPostMethodIsNotAllowed(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('POST', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_METHOD_NOT_ALLOWED);
    }

    public function testDeleteMethodIsNotAllowed(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('DELETE', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_METHOD_NOT_ALLOWED);
    }

    public function testPutMethodIsNotAllowed(): void
    {
        $filename = $this->createPosterFile();

        $this->client->request('PUT', '/poster-share/' . $filename);

        $this->assertResponseStatusCodeSame(Response::HTTP_METHOD_NOT_ALLOWED);
    }
}
