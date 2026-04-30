<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\KnowledgeBasePostMedia;
use App\Service\MediaUrlParserService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Unit-Tests für MediaUrlParserService.
 *
 * Abgedeckte Fälle:
 *  - Verschiedene YouTube-URL-Formate (watch, embed, shorts, youtu.be)
 *  - Vimeo (standard, /video/-Prefix)
 *  - Spotify (track, playlist, episode, show)
 *  - SoundCloud
 *  - Unbekannte URL → TYPE_GENERIC
 *  - Whitespace wird getrimmt
 */
class MediaUrlParserServiceTest extends TestCase
{
    private MediaUrlParserService $service;

    protected function setUp(): void
    {
        $httpClient = $this->createStub(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $this->service = new MediaUrlParserService($httpClient);
    }

    // ─── YouTube ─────────────────────────────────────────────────────────────

    public function testYoutubeWatchUrl(): void
    {
        $result = $this->service->parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('dQw4w9WgXcQ', $result['externalId']);
    }

    public function testYoutubeEmbedUrl(): void
    {
        $result = $this->service->parse('https://www.youtube.com/embed/dQw4w9WgXcQ');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('dQw4w9WgXcQ', $result['externalId']);
    }

    public function testYoutubeShortsUrl(): void
    {
        $result = $this->service->parse('https://www.youtube.com/shorts/dQw4w9WgXcQ');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('dQw4w9WgXcQ', $result['externalId']);
    }

    public function testYoutubeShortDomainUrl(): void
    {
        $result = $this->service->parse('https://youtu.be/dQw4w9WgXcQ');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('dQw4w9WgXcQ', $result['externalId']);
    }

    public function testYoutubeExtractsExactly11CharacterId(): void
    {
        // ID with underscores and hyphens
        $result = $this->service->parse('https://youtu.be/A1b-C2d_E3f');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('A1b-C2d_E3f', $result['externalId']);
    }

    // ─── Vimeo ───────────────────────────────────────────────────────────────

    public function testVimeoStandardUrl(): void
    {
        $result = $this->service->parse('https://vimeo.com/123456789');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_VIMEO, $result['mediaType']);
        $this->assertSame('123456789', $result['externalId']);
    }

    public function testVimeoVideoUrl(): void
    {
        $result = $this->service->parse('https://vimeo.com/video/987654321');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_VIMEO, $result['mediaType']);
        $this->assertSame('987654321', $result['externalId']);
    }

    // ─── Spotify ─────────────────────────────────────────────────────────────

    public function testSpotifyTrackUrl(): void
    {
        $result = $this->service->parse('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SPOTIFY, $result['mediaType']);
        $this->assertSame('track/4uLU6hMCjMI75M1A2tKUQC', $result['externalId']);
    }

    public function testSpotifyPlaylistUrl(): void
    {
        $result = $this->service->parse('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SPOTIFY, $result['mediaType']);
        $this->assertSame('playlist/37i9dQZF1DXcBWIGoYBM5M', $result['externalId']);
    }

    public function testSpotifyEpisodeUrl(): void
    {
        $result = $this->service->parse('https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SPOTIFY, $result['mediaType']);
        $this->assertSame('episode/7makk4oTQel546B0PZlDM5', $result['externalId']);
    }

    public function testSpotifyShowUrl(): void
    {
        $result = $this->service->parse('https://open.spotify.com/show/6ShFMYiBHPxMaulw6cldkE');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SPOTIFY, $result['mediaType']);
        $this->assertSame('show/6ShFMYiBHPxMaulw6cldkE', $result['externalId']);
    }

    // ─── SoundCloud ──────────────────────────────────────────────────────────

    public function testSoundCloudUrl(): void
    {
        $result = $this->service->parse('https://soundcloud.com/artist/track-name');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SOUNDCLOUD, $result['mediaType']);
        $this->assertNull($result['externalId']);
    }

    public function testSoundCloudSetUrl(): void
    {
        $result = $this->service->parse('https://soundcloud.com/artist/sets/my-playlist');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_SOUNDCLOUD, $result['mediaType']);
        $this->assertNull($result['externalId']);
    }

    // ─── Generic ─────────────────────────────────────────────────────────────

    public function testUnknownUrlIsGeneric(): void
    {
        $result = $this->service->parse('https://example.com/some-resource');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_GENERIC, $result['mediaType']);
        $this->assertNull($result['externalId']);
    }

    public function testPlainHttpsUrlIsGeneric(): void
    {
        $result = $this->service->parse('https://myvideo.org/embed/42');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_GENERIC, $result['mediaType']);
        $this->assertNull($result['externalId']);
    }

    // ─── Whitespace handling ─────────────────────────────────────────────────

    public function testWhitespaceIsTrimmed(): void
    {
        $result = $this->service->parse('  https://youtu.be/dQw4w9WgXcQ  ');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_YOUTUBE, $result['mediaType']);
        $this->assertSame('dQw4w9WgXcQ', $result['externalId']);
    }

    // ─── Thumbnail URLs ───────────────────────────────────────────────────────

    public function testYoutubeThumbnailUrlIsCorrectFormat(): void
    {
        $result = $this->service->parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        $this->assertSame(
            'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            $result['thumbnailUrl']
        );
    }

    public function testSpotifyThumbnailUrlIsNull(): void
    {
        $result = $this->service->parse('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');

        $this->assertNull($result['thumbnailUrl']);
    }

    public function testSoundCloudThumbnailUrlIsNull(): void
    {
        $result = $this->service->parse('https://soundcloud.com/artist/track-name');

        $this->assertNull($result['thumbnailUrl']);
    }

    // ─── probeUrl branches ────────────────────────────────────────────────────

    public function testNonHttpSchemeIsGeneric(): void
    {
        $result = $this->service->parse('ftp://example.com/resource');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_GENERIC, $result['mediaType']);
        $this->assertNull($result['externalId']);
        $this->assertNull($result['thumbnailUrl']);
    }

    public function testEmptyStringIsGeneric(): void
    {
        $result = $this->service->parse('');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_GENERIC, $result['mediaType']);
        $this->assertNull($result['externalId']);
        $this->assertNull($result['thumbnailUrl']);
    }

    public function testImageUrlReturnsTypeImage(): void
    {
        $headResponse = $this->createStub(\Symfony\Contracts\HttpClient\ResponseInterface::class);
        $headResponse->method('getHeaders')->willReturn(['content-type' => ['image/jpeg']]);

        $httpClient = $this->createStub(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $httpClient->method('request')->willReturn($headResponse);

        $service = new MediaUrlParserService($httpClient);
        $result = $service->parse('https://example.com/photo.jpg');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_IMAGE, $result['mediaType']);
        $this->assertNull($result['externalId']);
        $this->assertSame('https://example.com/photo.jpg', $result['thumbnailUrl']);
    }

    public function testVideoUrlReturnsTypeVideo(): void
    {
        $headResponse = $this->createStub(\Symfony\Contracts\HttpClient\ResponseInterface::class);
        $headResponse->method('getHeaders')->willReturn(['content-type' => ['video/mp4']]);

        $oembedResponse = $this->createStub(\Symfony\Contracts\HttpClient\ResponseInterface::class);
        $oembedResponse->method('toArray')->willReturn([]);

        $httpClient = $this->createStub(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $httpClient->method('request')->willReturnOnConsecutiveCalls($headResponse, $oembedResponse);

        $service = new MediaUrlParserService($httpClient);
        $result = $service->parse('https://example.com/video.mp4');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_VIDEO, $result['mediaType']);
        $this->assertNull($result['externalId']);
        $this->assertNull($result['thumbnailUrl']);
    }

    public function testNetworkExceptionFallsBackToGeneric(): void
    {
        $httpClient = $this->createStub(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $httpClient->method('request')->willThrowException(new RuntimeException('Network error'));

        $service = new MediaUrlParserService($httpClient);
        $result = $service->parse('https://example.com/resource');

        $this->assertSame(KnowledgeBasePostMedia::TYPE_GENERIC, $result['mediaType']);
        $this->assertNull($result['externalId']);
        $this->assertNull($result['thumbnailUrl']);
    }

    // ─── Return-Shape ────────────────────────────────────────────────────────

    public function testReturnAlwaysHasBothKeys(): void
    {
        foreach (
            [
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://vimeo.com/123456789',
                'https://open.spotify.com/track/abc123ABC12',
                'https://soundcloud.com/x/y',
                'https://example.com',
            ] as $url
        ) {
            $result = $this->service->parse($url);
            $this->assertArrayHasKey('mediaType', $result, "URL: $url");
            $this->assertArrayHasKey('externalId', $result, "URL: $url");
            $this->assertArrayHasKey('thumbnailUrl', $result, "URL: $url");
        }
    }
}
