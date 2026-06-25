<?php

declare(strict_types=1);

namespace App\MessageHandler;

use App\Message\ProcessPlayerDocumentMessage;
use App\Repository\PlayerDocumentRepository;
use App\Service\PlayerDocumentDriveStorage;
use App\Service\PlayerDocumentOcrService;
use App\Service\PlayerDocumentStagingStorage;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Throwable;

#[AsMessageHandler]
class ProcessPlayerDocumentHandler
{
    public function __construct(
        private readonly PlayerDocumentRepository $documents,
        private readonly PlayerDocumentOcrService $ocr,
        private readonly PlayerDocumentDriveStorage $driveStorage,
        private readonly PlayerDocumentStagingStorage $stagingStorage,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function __invoke(ProcessPlayerDocumentMessage $message): void
    {
        $document = $this->documents->find($message->documentId);
        if (!$document || 'ready' === $document->getProcessingStatus()) {
            return;
        }
        $document->setProcessingStatus('processing')->setProcessingError(null);
        $this->em->flush();

        $path = sys_get_temp_dir() . '/player-document-' . bin2hex(random_bytes(12)) . $this->extension($document->getMimeType());
        try {
            $storageKey = $document->getStorageKey();
            if ($storageKey) {
                try {
                    $this->stagingStorage->downloadTo($storageKey, $path);
                } catch (Throwable $exception) {
                    if (!$document->getDriveFileId()) {
                        throw $exception;
                    }
                    file_put_contents($path, $this->driveStorage->download($document));
                }
            } elseif ($document->getDriveFileId()) {
                file_put_contents($path, $this->driveStorage->download($document));
            } else {
                throw new RuntimeException('Temporäre Dokumentdatei fehlt.');
            }

            $analysis = $this->ocr->analyse($path, $document->getMimeType());
            if (!$document->getDriveFileId()) {
                $document->setDriveFileId($this->driveStorage->upload($document, $path));
                $this->em->flush(); // macht Retries idempotent und verhindert doppelte Drive-Dateien
            }
            if ($document->isAutomaticClassification()) {
                $document->setCategory($analysis['category']);
            }
            if (!$document->getIssuedAt()) {
                $document->setIssuedAt($analysis['issuedAt']);
            }
            if (!$document->getExpiresAt()) {
                $document->setExpiresAt($analysis['expiresAt']);
            }
            if ($storageKey) {
                $this->stagingStorage->delete($storageKey);
            }
            $document->setOcrText($analysis['text'])->setProcessingStatus('ready')->setProcessingError(null)->setStorageKey(null);
            $this->em->flush();
        } catch (Throwable $exception) {
            $document->setProcessingStatus('failed')->setProcessingError(mb_substr($exception->getMessage(), 0, 2000));
            $this->em->flush();
            throw $exception;
        } finally {
            @unlink($path);
        }
    }

    private function extension(string $mimeType): string
    {
        return match ($mimeType) {
            'application/pdf' => '.pdf', 'image/png' => '.png', 'image/webp' => '.webp', default => '.jpg'
        };
    }
}
