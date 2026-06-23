<?php

namespace App\Adapter;

use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class GoogleDriveAdapter
{
    private Drive $driveService;
    private string $folderId;

    public function __construct(
        string $clientId,
        string $clientSecret,
        string $refreshToken,
        string $folderId
    ) {
        $this->folderId = $folderId;

        $client = new Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setAccessType('offline');
        $client->setPrompt('select_account consent');
        $client->fetchAccessTokenWithRefreshToken($refreshToken);

        $this->driveService = new Drive($client);
    }

    public function uploadFile(string | UploadedFile $file, ?string $name = null): string
    {
        if ($file instanceof UploadedFile) {
            $path = $file->getRealPath();
            $name = $name ?? $file->getClientOriginalName();
        } else {
            $path = $file;
            $name = $name ?? basename($file);
        }

        $fileMetadata = new DriveFile([
            'name' => $name,
            'parents' => [$this->folderId]
        ]);

        $mimeType = mime_content_type($path);

        $uploadedFile = $this->driveService->files->create($fileMetadata, [
            'data' => file_get_contents($path),
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id'
        ]);

        return $uploadedFile->id;
    }

    public function deleteFile(string $fileId): void
    {
        $this->driveService->files->delete($fileId);
    }

    /** @return array<int, DriveFile> */
    public function listFiles(): array
    {
        $response = $this->driveService->files->listFiles([
            'q' => "'{$this->folderId}' in parents and trashed = false",
            'fields' => 'files(id, name, mimeType, createdTime)'
        ]);

        return $response->getFiles();
    }
}
