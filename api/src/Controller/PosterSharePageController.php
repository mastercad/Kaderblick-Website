<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Serves the public OG landing page for a shared poster.
 *
 * The page contains og:image / twitter:card meta tags so that WhatsApp,
 * Twitter, Facebook etc. show a proper image preview card instead of a
 * plain URL.
 */
class PosterSharePageController extends AbstractController
{
    #[Route('/poster-share/{filename}', name: 'app_poster_share_page', methods: ['GET'])]
    public function sharePage(string $filename): Response
    {
        // Reject filenames that don't look like our generated share files.
        // uniqid('share_', true) produces e.g. "share_60b8c2a1f3c0d1.12345678"
        if (!preg_match('/^share_[a-zA-Z0-9_.]+\.png$/', $filename)) {
            throw $this->createNotFoundException();
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/poster-share';
        if (!file_exists($uploadDir . '/' . $filename)) {
            throw $this->createNotFoundException('Poster nicht gefunden.');
        }

        return $this->render('poster_share/page.html.twig', [
            'filename' => $filename,
        ]);
    }
}
