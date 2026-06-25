<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\PlayerDocument;
use RuntimeException;

class PlayerDocumentDriveStorage
{
    public function __construct(private readonly GoogleDriveService $drive)
    {
    }

    public function upload(PlayerDocument $document, string $localPath): string
    {
        $rootId = $_ENV['GOOGLE_DOCUMENTS_FOLDER_ID'] ?? $_SERVER['GOOGLE_DOCUMENTS_FOLDER_ID'] ?? null;

        if (!$rootId) {
            throw new RuntimeException('GOOGLE_DOCUMENTS_FOLDER_ID ist nicht konfiguriert.');
        }

        $rootFolder = $_ENV['DEMO_TOKEN'] ?? $_ENV['APP_ENV'] ?? $_SERVER['DEMO_TOKEN'] ?? $_SERVER['APP_ENV'] ?? null;
        $envFolder = $this->drive->ensureFolder($rootFolder, $rootId);
        $clubFolder = $this->drive->ensureFolder('club-' . $document->getClub()->getId(), $envFolder);
        $playerFolder = $this->drive->ensureFolder('player-' . $document->getPlayer()->getId(), $clubFolder);

        return $this->drive->uploadFilePath($localPath, $document->getOriginalFilename(), $document->getMimeType(), $playerFolder);
    }

    public function download(PlayerDocument $document): string
    {
        $fileId = $document->getDriveFileId();

        if (!$fileId) {
            throw new RuntimeException('Das Dokument wurde noch nicht zu Google Drive übertragen.');
        }

        return $this->drive->downloadFile($fileId);
    }

    public function delete(PlayerDocument $document): void
    {
        if ($document->getDriveFileId()) {
            $this->drive->deleteFile($document->getDriveFileId());
        }
    }
}
