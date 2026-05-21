<?php

namespace App\Controller;

use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class EmailPreviewController extends AbstractController
{
    #[Route('/email-preview', name: 'email_preview_index', methods: ['GET'])]
    public function index(): Response
    {
        $templates = $this->retrieveAvailableTemplates();

        return $this->render('emails/preview_index.html.twig', [
            'templates' => $templates
        ]);
    }

    #[Route('/email-preview/{template}', name: 'email_preview', methods: ['GET'])]
    public function preview(Request $request, string $template): Response
    {
        $templates = $this->retrieveAvailableTemplates();
        if (!in_array($template, $templates, true)) {
            throw $this->createNotFoundException('Template nicht gefunden oder nicht erlaubt.');
        }

        $exampleData = [
            'user' => [
                'name' => 'Max Mustermann',
                'firstName' => 'Max',
            ],
            'verificationUrl' => 'https://kaderblick.de/verify/123456',
            'signedUrl' => 'https://kaderblick.de/verify/abcdef',
            'event' => [
                'title' => 'Testspiel vs. FC Beispiel',
                'startDate' => new DateTime('+2 days'),
                'endDate' => new DateTime('+2 days +2 hours'),
                'location' => ['name' => 'Sportplatz Musterstadt'],
                'description' => 'Bitte pünktlich erscheinen!'
            ],
            'files' => [
                ['name' => 'Highlight 1', 'url' => 'https://kaderblick.de/video/1'],
                ['name' => 'Highlight 2', 'url' => 'https://kaderblick.de/video/2'],
            ],
            'folderUrl' => 'https://kaderblick.de/mediathek',
        ];

        return $this->render(
            'emails/' . $template . '.html.twig',
            $exampleData
        );
    }

    /**
     * @return array<int, string>
     */
    private function retrieveAvailableTemplates(): array
    {
        $dir = __DIR__ . '/../../templates/emails/';
        $files = scandir($dir);
        $templates = [];
        foreach ($files as $file) {
            if (preg_match('/^([a-zA-Z0-9_\-]+)\.html\.twig$/', $file, $matches)) {
                if (!str_starts_with($matches[1], 'base') && 'preview_index' !== $matches[1]) {
                    $templates[] = $matches[1];
                }
            }
        }
        sort($templates);

        return $templates;
    }
}
