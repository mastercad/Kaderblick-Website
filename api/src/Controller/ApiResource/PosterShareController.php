<?php

namespace App\Controller\ApiResource;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/api/poster/share', name: 'app_poster_share_')]
class PosterShareController extends AbstractController
{
    #[Route(path: '/upload', name: 'upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_USER');

        $imageFile = $request->files->get('image');
        if (!$imageFile instanceof UploadedFile) {
            return new JsonResponse(['error' => 'Kein Bild übermittelt'], 400);
        }

        $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!in_array($imageFile->getMimeType(), $allowedMimes, true)) {
            return new JsonResponse(['error' => 'Ungültiger Dateityp. Erlaubt: JPG, PNG'], 400);
        }

        if ($imageFile->getSize() > 10 * 1024 * 1024) {
            return new JsonResponse(['error' => 'Bild zu groß. Maximal 10 MB erlaubt'], 400);
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/poster-share';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Dateien älter als 24 Stunden bereinigen
        foreach (glob($uploadDir . '/*.png') ?: [] as $file) {
            if (filemtime($file) < time() - 86400) {
                unlink($file);
            }
        }

        $filename = uniqid('share_', true) . '.png';
        $imageFile->move($uploadDir, $filename);

        return new JsonResponse([
            'url' => '/uploads/poster-share/' . $filename,
        ]);
    }
}
