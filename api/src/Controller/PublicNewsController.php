<?php

namespace App\Controller;

use App\Entity\News;
use App\Repository\NewsRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\String\Slugger\AsciiSlugger;

final class PublicNewsController extends AbstractController
{
    #[Route('/aktuelles', name: 'public_news_index', methods: ['GET'])]
    public function index(NewsRepository $newsRepository): Response
    {
        $newsEntries = array_map(
            fn (News $news) => $this->buildNewsListEntry($news),
            $newsRepository->findPublicPlatformNews(20)
        );

        return $this->render('public_news/index.html.twig', [
            'newsEntries' => $newsEntries,
        ]);
    }

    #[Route('/aktuelles/{id}-{slug}', name: 'public_news_show', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function show(News $news, string $slug, Request $request): Response
    {
        $this->assertPublicPlatformNews($news);

        $expectedSlug = $this->slugify($news->getTitle());
        if ($slug !== $expectedSlug) {
            return $this->redirectToRoute('public_news_show', [
                'id' => $news->getId(),
                'slug' => $expectedSlug,
            ], Response::HTTP_MOVED_PERMANENTLY);
        }

        return $this->render('public_news/show.html.twig', [
            'news' => $news,
            'description' => $this->buildExcerpt($news->getContent(), 180),
            'canonicalUrl' => $request->getUri(),
        ]);
    }

    #[Route('/api/public/platform-news', name: 'api_public_platform_news_index', methods: ['GET'])]
    public function apiIndex(NewsRepository $newsRepository): JsonResponse
    {
        $payload = array_map(fn (News $news) => $this->serializeNews($news), $newsRepository->findPublicPlatformNews(20));

        return $this->json([
            'items' => $payload,
        ]);
    }

    #[Route('/api/public/platform-news/{id}', name: 'api_public_platform_news_show', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function apiShow(News $news): JsonResponse
    {
        $this->assertPublicPlatformNews($news);

        return $this->json($this->serializeNews($news, true));
    }

    /**
     * @return array<string, int|string>
     */
    private function serializeNews(News $news, bool $includeContent = false): array
    {
        $payload = [
            'id' => $news->getId(),
            'title' => $news->getTitle(),
            'slug' => $this->slugify($news->getTitle()),
            'createdAt' => $news->getCreatedAt()->format(DATE_ATOM),
            'updatedAt' => $news->getUpdatedAt()?->format(DATE_ATOM),
            'createdBy' => trim($news->getCreatedBy()->getFirstName() . ' ' . $news->getCreatedBy()->getLastName()),
            'excerpt' => $this->buildExcerpt($news->getContent()),
            'url' => $this->generateUrl('public_news_show', [
                'id' => $news->getId(),
                'slug' => $this->slugify($news->getTitle()),
            ], UrlGeneratorInterface::ABSOLUTE_URL),
        ];

        if ($includeContent) {
            $payload['content'] = $news->getContent();
        }

        return $payload;
    }

    private function assertPublicPlatformNews(News $news): void
    {
        if ('platform' !== $news->getVisibility()) {
            throw $this->createNotFoundException();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildNewsListEntry(News $news): array
    {
        $slug = $this->slugify($news->getTitle());

        return [
            'id' => $news->getId(),
            'title' => $news->getTitle(),
            'authorName' => trim($news->getCreatedBy()->getFirstName() . ' ' . $news->getCreatedBy()->getLastName()),
            'createdAt' => $news->getCreatedAt(),
            'excerpt' => $this->buildExcerpt($news->getContent(), 220),
            'url' => $this->generateUrl('public_news_show', [
                'id' => $news->getId(),
                'slug' => $slug,
            ]),
        ];
    }

    private function slugify(string $value): string
    {
        $slugger = new AsciiSlugger('de');

        return strtolower($slugger->slug($value)->toString());
    }

    private function buildExcerpt(string $html, int $maxLength = 160): string
    {
        $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
        if (mb_strlen($text) <= $maxLength) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $maxLength - 1)) . '…';
    }
}
