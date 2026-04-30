<?php

namespace App\Service;

use App\Entity\KnowledgeBasePostMedia;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Throwable;

class MediaUrlParserService
{
    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    /**
     * Detects the platform type, external ID and – crucially – a preview thumbnail URL
     * for the given media URL.
     *
     * Strategy (in order):
     *  1. Known embed platforms (YouTube, Vimeo) → compute thumbnail directly, no HTTP needed.
     *  2. Spotify / SoundCloud → no visual thumbnail.
     *  3. Unknown URL:
     *     a. HTTP HEAD → if Content-Type is image/* the URL itself is the thumbnail.
     *     b. HTTP HEAD → if Content-Type is video/* try oEmbed via noembed.com.
     *     c. Any other Content-Type (text/html, unknown) → try oEmbed via noembed.com.
     *     d. Fallback: generic, no thumbnail.
     *
     * @return array{mediaType: string, externalId: ?string, thumbnailUrl: ?string}
     */
    public function parse(string $url): array
    {
        $url = trim($url);

        // ── 1. YouTube ──────────────────────────────────────────────────────
        if (
            preg_match(
                '/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_\-]{11})/',
                $url,
                $m
            )
        ) {
            $id = $m[1];

            return [
                'mediaType' => KnowledgeBasePostMedia::TYPE_YOUTUBE,
                'externalId' => $id,
                'thumbnailUrl' => "https://img.youtube.com/vi/{$id}/hqdefault.jpg",
            ];
        }

        // ── 2. Vimeo ─────────────────────────────────────────────────────────
        if (preg_match('/vimeo\.com\/(?:video\/)?(\d+)/', $url, $m)) {
            $id = $m[1];
            $thumbnailUrl = $this->fetchOembedThumbnail(
                'https://vimeo.com/api/oembed.json?url=' . urlencode($url)
            );

            return [
                'mediaType' => KnowledgeBasePostMedia::TYPE_VIMEO,
                'externalId' => $id,
                'thumbnailUrl' => $thumbnailUrl,
            ];
        }

        // ── 3. Spotify ────────────────────────────────────────────────────────
        if (preg_match('/open\.spotify\.com\/([a-z]+)\/([A-Za-z0-9]+)/', $url, $m)) {
            return [
                'mediaType' => KnowledgeBasePostMedia::TYPE_SPOTIFY,
                'externalId' => $m[1] . '/' . $m[2],
                'thumbnailUrl' => null,
            ];
        }

        // ── 4. SoundCloud ─────────────────────────────────────────────────────
        if (str_contains($url, 'soundcloud.com')) {
            return [
                'mediaType' => KnowledgeBasePostMedia::TYPE_SOUNDCLOUD,
                'externalId' => null,
                'thumbnailUrl' => null,
            ];
        }

        // ── 5. Unknown URL: probe via HTTP ────────────────────────────────────
        return $this->probeUrl($url);
    }

    /**
     * Probes an unknown URL to determine its media type and whether a thumbnail is available.
     *
     * @return array{mediaType: string, externalId: ?string, thumbnailUrl: ?string}
     */
    private function probeUrl(string $url): array
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return ['mediaType' => KnowledgeBasePostMedia::TYPE_GENERIC, 'externalId' => null, 'thumbnailUrl' => null];
        }

        try {
            $response = $this->httpClient->request('HEAD', $url, ['timeout' => 5, 'max_redirects' => 5]);
            $contentType = strtolower(explode(';', $response->getHeaders(false)['content-type'][0] ?? '')[0]);

            // Direct image URL → the URL itself is the preview
            if (str_starts_with($contentType, 'image/')) {
                return [
                    'mediaType' => KnowledgeBasePostMedia::TYPE_IMAGE,
                    'externalId' => null,
                    'thumbnailUrl' => $url,
                ];
            }

            // Direct video stream → try oEmbed for a thumbnail, otherwise just mark as video
            if (str_starts_with($contentType, 'video/')) {
                $thumbnailUrl = $this->fetchOembedThumbnail('https://noembed.com/embed?url=' . urlencode($url));

                return [
                    'mediaType' => KnowledgeBasePostMedia::TYPE_VIDEO,
                    'externalId' => null,
                    'thumbnailUrl' => $thumbnailUrl,
                ];
            }
        } catch (Throwable) {
            // network error or timeout during HEAD — still try oEmbed below
        }

        // HTML page or unknown → try noembed.com as a universal oEmbed proxy
        $thumbnailUrl = $this->fetchOembedThumbnail('https://noembed.com/embed?url=' . urlencode($url));

        return [
            'mediaType' => KnowledgeBasePostMedia::TYPE_GENERIC,
            'externalId' => null,
            'thumbnailUrl' => $thumbnailUrl,
        ];
    }

    /**
     * Fetches an oEmbed endpoint and returns the thumbnail_url, or null on failure.
     */
    private function fetchOembedThumbnail(string $oembedUrl): ?string
    {
        try {
            $response = $this->httpClient->request('GET', $oembedUrl, ['timeout' => 5, 'max_redirects' => 3]);
            $data = $response->toArray(false);

            return isset($data['thumbnail_url']) && is_string($data['thumbnail_url'])
                ? $data['thumbnail_url']
                : null;
        } catch (Throwable) {
            return null;
        }
    }
}
