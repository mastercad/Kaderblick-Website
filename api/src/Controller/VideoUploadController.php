<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\EmailNotificationService;
use App\Service\GoogleDriveService;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/videos', name: 'videos_')]
class VideoUploadController extends AbstractController
{
    public function __construct(
        private readonly GoogleDriveService $googleDriveService,
        private readonly EmailNotificationService $emailService
    ) {
    }

    #[Route('/upload', name: 'upload', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $videoFile = $request->files->get('video');
        if (!$videoFile instanceof UploadedFile) {
            return new JsonResponse(['error' => 'No video file provided'], 400);
        }

        try {
            $fileId = $this->googleDriveService->uploadVideo($videoFile, $_ENV['GOOGLE_FOLDER_ID']);

            return new JsonResponse([
                'success' => true,
                'fileId' => $fileId,
                'url' => "https://drive.google.com/file/d/{$fileId}/view"
            ]);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('', name: 'upload_form', methods: ['GET'])]
    public function showUploadForm(EntityManagerInterface $em): Response
    {
        // Hole alle User-Emails aus der Datenbank
        $emails = $em->getRepository(User::class)
            ->createQueryBuilder('u')
            ->select('u.email')
            ->where('u.isVerified = true')
            ->getQuery()
            ->getArrayResult();

        return $this->render('videos/upload.html.twig', [
            'systemEmails' => array_column($emails, 'email')
        ]);
    }

    #[Route('/create-folder', name: 'create_folder', methods: ['POST'])]
    public function createFolder(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = json_decode($request->getContent(), true);
        $gameName = $data['gameName'] ?? null;
        $force = $data['force'] ?? false;

        if (!$gameName) {
            return new JsonResponse(['error' => 'Game name required'], 400);
        }

        try {
            $folderId = $this->googleDriveService->createGameFolder($gameName, $force);

            return new JsonResponse([
                'folderId' => $folderId,
                'message' => 'Folder ' . ($force ? 'created/updated' : 'created') . ' successfully'
            ]);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/create-device-folder', name: 'create_device_folder', methods: ['POST'])]
    public function createDeviceFolder(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = json_decode($request->getContent(), true);
        $parentFolderId = $data['parentFolderId'] ?? null;
        $deviceName = $data['deviceName'] ?? null;
        $force = $data['force'] ?? false;

        if (!$parentFolderId || !$deviceName) {
            return new JsonResponse(['error' => 'Parent folder ID and device name required'], 400);
        }

        try {
            $folderId = $this->googleDriveService->createDeviceFolder($parentFolderId, $deviceName, $force);

            return new JsonResponse([
                'folderId' => $folderId,
                'message' => 'Device folder ' . ($force ? 'created/updated' : 'created') . ' successfully'
            ]);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/upload-batch', name: 'upload_batch', methods: ['POST'])]
    public function uploadBatch(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $video = $request->files->get('video');
        $folderId = $request->request->get('folderId');

        if (!$video instanceof UploadedFile || !$folderId) {
            return new JsonResponse(['error' => 'Invalid request data'], 400);
        }

        try {
            // Erst den Upload durchführen
            $fileId = $this->googleDriveService->uploadVideo($video, $folderId);

            // Wenn der Upload erfolgreich war, senden wir die Erfolgsantwort
            return new JsonResponse([
                'success' => true,
                'fileId' => $fileId,
                'name' => $video->getClientOriginalName(),
                'url' => "https://drive.google.com/file/d/{$fileId}/view"
            ]);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    #[Route('/upload-batch-chunked', name: 'upload_batch_chunked', methods: ['POST'])]
    public function uploadBatchChunked(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $video = $request->files->get('video');
        $folderId = $request->request->get('folderId');
        $force = 'true' === $request->request->get('force');

        if (!$video instanceof UploadedFile || !$folderId) {
            return new JsonResponse(['error' => 'Invalid request data'], 400);
        }

        try {
            $fileId = $this->googleDriveService->chunkedUploadVideo(
                $video,
                $folderId,
                function ($progress) {
                    return new JsonResponse(['progress' => $progress]);
                }
            );

            return new JsonResponse([
                'success' => true,
                'fileId' => $fileId,
                'name' => $video->getClientOriginalName(),
                'url' => "https://drive.google.com/file/d/{$fileId}/view"
            ]);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    #[Route('/notify', name: 'notify', methods: ['POST'])]
    public function notify(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $folderId = $request->request->get('folderId');
        $notifyEmails = json_decode($request->request->get('notifyEmails', '[]'), true);
        $uploadedFiles = json_decode($request->request->get('uploadedFiles', '[]'), true);

        if (!$folderId || empty($notifyEmails) || empty($uploadedFiles)) {
            return new JsonResponse(['error' => 'Folder ID, emails and uploaded files required'], 400);
        }

        try {
            $folderUrl = $this->googleDriveService->getFolderUrl($folderId);
            $this->emailService->sendUploadNotification($notifyEmails, $folderUrl, $uploadedFiles);

            return new JsonResponse([
                'success' => true,
                'message' => 'Notification sent'
            ]);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
