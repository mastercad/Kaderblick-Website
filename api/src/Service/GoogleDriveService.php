<?php

namespace App\Service;

use DateTime;
use Exception;
use Google\Client;
use Google\Http\MediaFileUpload;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class GoogleDriveService
{
    private Drive $driveService;

    public function __construct()
    {
        $client = new Client();

        $client->setClientId($_ENV['GOOGLE_CLIENT_ID']);
        $client->setClientSecret($_ENV['GOOGLE_CLIENT_SECRET']);
        $client->refreshToken($_ENV['GOOGLE_REFRESH_TOKEN']);

        /*
        $client->setAuthConfig($_ENV['GOOGLE_CREDENTIALS_JSON'] ?? $_SERVER['GOOGLE_CREDENTIALS_JSON'] ?? null);
        $client->addScope(Drive::DRIVE);
        $client->addScope(Drive::DRIVE_FILE);
        */

        $this->driveService = new Drive($client);
    }

    private function findFolderByName(string $name, ?string $parentId = null): ?string
    {
        $safeName = str_replace(['\\', "'"], ['\\\\', "\\'"], $name);
        $query = "mimeType='application/vnd.google-apps.folder' and name='" . $safeName . "' and trashed=false";
        if ($parentId) {
            $query .= " and '" . $parentId . "' in parents";
        } else {
            $query .= " and '" . $_ENV['GOOGLE_FOLDER_ID'] . "' in parents";
        }

        $response = $this->driveService->files->listFiles([
            'q' => $query,
            'spaces' => 'drive',
            'fields' => 'files(id, name)'
        ]);

        if (count($response->getFiles()) > 0) {
            return $response->getFiles()[0]->getId();
        }

        return null;
    }

    public function ensureFolder(string $name, string $parentId): string
    {
        $existing = $this->findFolderByName($name, $parentId);
        if ($existing) {
            return $existing;
        }
        $folder = $this->driveService->files->create(
            /* ( */            new DriveFile(
                [
                    'name' => $name,
                    'mimeType' => 'application/vnd.google-apps.folder',
                    'parents' => [$parentId],
                ]
            ),
            /*)
            ->setName($name)
            ->setMimeType('application/vnd.google-apps.folder')
            ->setParents($parentId)*/

            ['fields' => 'id']
        );

        return (string) $folder->getId();
    }

    public function uploadFilePath(string $path, string $filename, string $mimeType, string $folderId): string
    {
        if (!is_file($path)) {
            throw new Exception('Upload failed: local file not found');
        }
        $uploaded = $this->driveService->files->create(new DriveFile([
            'name' => $filename,
            'parents' => [$folderId],
        ]), [
            'data' => file_get_contents($path),
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id',
            //            'supportsAllDrives' => true,
        ]);

        return (string) $uploaded->getId();
    }

    public function downloadFile(string $fileId): string
    {
        $response = $this->driveService->files->get($fileId, ['alt' => 'media']);

        return (string) $response->getBody();
    }

    public function deleteFile(string $fileId): void
    {
        $this->driveService->files->delete($fileId);
    }

    /**
     * @return array<array<string, string>>
     */
    public function listDocuments(string $env, int $clubId, int $playerId): array
    {
        $rootId = $_ENV['GOOGLE_DOCUMENTS_FOLDER_ID'] ?? $_SERVER['GOOGLE_DOCUMENTS_FOLDER_ID'] ?? null;
        if (!$rootId) {
            throw new Exception('GOOGLE_DOCUMENTS_FOLDER_ID ist nicht konfiguriert.');
        }

        $envFolder = $this->ensureFolder($env, $rootId);
        $clubFolder = $this->ensureFolder('club-' . $clubId, $envFolder);
        $playerFolder = $this->ensureFolder('player-' . $playerId, $clubFolder);

        $response = $this->driveService->files->listFiles([
            'q' => "'{$playerFolder}' in parents and trashed=false",
            'spaces' => 'drive',
            'fields' => 'files(id, name, mimeType, createdTime)',
        ]);

        return array_map(fn (DriveFile $file) => [
            'id' => $file->getId(),
            'name' => $file->getName(),
            'mimeType' => $file->getMimeType(),
            'createdTime' => (new DateTime($file->getCreatedTime()))->format('Y-m-d H:i:s'),
        ], iterator_to_array($response->getFiles()));
    }

    public function createGameFolder(string $gameName, bool $force = false): string
    {
        $existingFolderId = $this->findFolderByName($gameName);

        if ($existingFolderId && !$force) {
            return $existingFolderId;
        }

        $fileMetadata = new DriveFile([
            'name' => $gameName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$_ENV['GOOGLE_FOLDER_ID']]
        ]);

        if ($existingFolderId) {
            // Update existing folder - ohne parents
            $updateMetadata = new DriveFile(['name' => $gameName]);
            $this->driveService->files->update($existingFolderId, $updateMetadata, [
                'addParents' => $_ENV['GOOGLE_FOLDER_ID'],
                'removeParents' => 'root'
            ]);

            return $existingFolderId;
        }

        $folder = $this->driveService->files->create($fileMetadata);

        return $folder->getId();
    }

    public function createDeviceFolder(string $parentFolderId, string $deviceName, bool $force = false): string
    {
        $existingFolderId = $this->findFolderByName($deviceName, $parentFolderId);

        if ($existingFolderId && !$force) {
            return $existingFolderId;
        }

        $fileMetadata = new DriveFile([
            'name' => $deviceName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentFolderId]
        ]);

        if ($existingFolderId) {
            // Update existing folder - ohne parents
            $updateMetadata = new DriveFile(['name' => $deviceName]);
            $this->driveService->files->update($existingFolderId, $updateMetadata, [
                'addParents' => $parentFolderId,
                'removeParents' => 'root'
            ]);

            return $existingFolderId;
        }

        $folder = $this->driveService->files->create($fileMetadata);

        return $folder->getId();
    }

    public function uploadVideo(UploadedFile $file, string $folderId): string
    {
        $fileMetadata = new DriveFile([
            'name' => $file->getClientOriginalName(),
            'parents' => [$folderId]
        ]);

        try {
            $file = $this->driveService->files->create($fileMetadata, [
                'data' => file_get_contents($file->getPathname()),
                'mimeType' => $file->getMimeType(),
                'uploadType' => 'multipart'
            ]);

            return $file->getId();
        } catch (Exception $e) {
            throw new Exception('Upload failed: ' . $e->getMessage());
        }
    }

    public function chunkedUploadVideo(UploadedFile $file, string $folderId, ?callable $progressCallback = null): string
    {
        $fileMetadata = new DriveFile([
            'name' => $file->getClientOriginalName(),
            'parents' => [$folderId],
        ]);

        $client = $this->driveService->getClient();
        $client->setDefer(true);

        try {
            $request = new \GuzzleHttp\Psr7\Request(
                'POST',
                'https://www.googleapis.com/upload/drive/v3/files',
                ['Content-Type' => 'application/json'],
                json_encode($fileMetadata)
            );

            $media = new MediaFileUpload(
                $client,
                $request,
                $file->getMimeType(),
                '',
                true,
                1024 * 1024
            );

            $media->setFileSize($file->getSize());
            $status = false;
            $uploaded = 0;
            $totalSize = $file->getSize();
            $handle = fopen($file->getPathname(), 'rb');

            while (!$status && !feof($handle)) {
                $chunk = fread($handle, 1024 * 1024);
                $status = $media->nextChunk($chunk);
                $uploaded += strlen($chunk);

                if ($progressCallback) {
                    $progress = ($uploaded / $totalSize) * 100;
                    $progressCallback($progress);
                }
            }

            fclose($handle);
            $client->setDefer(false);

            if ($status) {
                return $status->getId();
            }

            throw new Exception('Upload failed: No file ID received');
        } catch (Exception $e) {
            if (isset($handle) && is_resource($handle)) {
                fclose($handle);
            }
            $client->setDefer(false);
            throw new Exception('Upload failed: ' . $e->getMessage());
        }
    }

    public function getFolderUrl(string $folderId): string
    {
        return "https://drive.google.com/drive/folders/{$folderId}";
    }
}
