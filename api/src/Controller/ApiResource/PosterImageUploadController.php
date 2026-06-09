<?php

namespace App\Controller\ApiResource;

use App\Repository\PosterTemplateRepository;
use FilesystemIterator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/api/admin/poster-images', name: 'app_admin_poster_images_')]
class PosterImageUploadController extends AbstractController
{
    #[Route(path: '/upload', name: 'upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $imageFile = $request->files->get('image');
        if (!$imageFile instanceof UploadedFile) {
            return new JsonResponse(['error' => 'Kein Bild übermittelt'], 400);
        }

        $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!in_array($imageFile->getMimeType(), $allowedMimes, true)) {
            return new JsonResponse(['error' => 'Ungültiger Dateityp. Erlaubt: JPG, PNG, GIF, WebP'], 400);
        }

        if ($imageFile->getSize() > 8 * 1024 * 1024) {
            return new JsonResponse(['error' => 'Bild zu groß. Maximal 8 MB erlaubt'], 400);
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/poster';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = $imageFile->guessExtension() ?? 'jpg';
        $filename = uniqid('poster_', true) . '.' . $ext;
        $imageFile->move($uploadDir, $filename);

        return new JsonResponse([
            'success' => true,
            'url' => '/uploads/poster/' . $filename,
        ]);
    }

    #[Route(path: '', name: 'list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/poster';
        if (!is_dir($uploadDir)) {
            return new JsonResponse([]);
        }

        $files = [];

        foreach (new FilesystemIterator($uploadDir) as $file) {
            if (!$file->isFile()) {
                continue;
            }

            if (in_array(
                strtolower($file->getExtension()),
                ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                true
            )) {
                $files[] = '/uploads/poster/' . $file->getFilename();
            }
        }

        return new JsonResponse($files);
    }

    #[Route(path: '/{filename}', name: 'delete', methods: ['DELETE'])]
    public function delete(string $filename, PosterTemplateRepository $repository): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        // Path-Traversal verhindern
        if ('' === $filename || str_contains($filename, '/') || str_contains($filename, '\\') || str_starts_with($filename, '.')) {
            return new JsonResponse(['error' => 'Ungültiger Dateiname'], 400);
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/poster';
        $filePath = $uploadDir . '/' . $filename;

        if (!is_file($filePath)) {
            return new JsonResponse(['error' => 'Datei nicht gefunden'], 404);
        }

        $usedIn = $repository->findTemplatesUsingImageFilename($filename);
        if (count($usedIn) > 0) {
            return new JsonResponse([
                'error' => 'Das Bild wird noch in Vorlagen verwendet.',
                'templates' => array_map(static fn ($t) => $t->getName(), $usedIn),
            ], 409);
        }

        unlink($filePath);

        return new JsonResponse(null, 204);
    }
}
