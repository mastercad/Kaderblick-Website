<?php

namespace App\Controller;

use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/news/image', name: 'app_news_image_')]
class NewsImageUploadController extends AbstractController
{
    #[Route(path: '/upload', name: 'upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $imageFile = $request->files->get('image');
        if (!$imageFile instanceof UploadedFile) {
            return new JsonResponse(['error' => 'Kein Bild übermittelt'], 400);
        }

        // MIME-Typ prüfen
        $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!in_array($imageFile->getMimeType(), $allowedMimes, true)) {
            return new JsonResponse(['error' => 'Ungültiger Dateityp. Erlaubt: JPG, PNG, GIF, WebP'], 400);
        }

        // Maximale Dateigröße: 8 MB
        if ($imageFile->getSize() > 8 * 1024 * 1024) {
            return new JsonResponse(['error' => 'Bild zu groß. Maximal 8 MB erlaubt'], 400);
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/news';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = $imageFile->guessExtension() ?? 'jpg';
        $filename = uniqid('news_', true) . '.' . $ext;
        $imageFile->move($uploadDir, $filename);

        $url = '/uploads/news/' . $filename;

        return new JsonResponse([
            'success' => true,
            'url' => $url,
        ]);
    }
}
