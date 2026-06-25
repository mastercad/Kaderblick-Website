<?php

namespace App\Tests\Unit\MessageHandler;

use App\Entity\PlayerDocument;
use App\Message\ProcessPlayerDocumentMessage;
use App\MessageHandler\ProcessPlayerDocumentHandler;
use App\Repository\PlayerDocumentRepository;
use App\Service\PlayerDocumentDriveStorage;
use App\Service\PlayerDocumentOcrService;
use App\Service\PlayerDocumentStagingStorage;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class ProcessPlayerDocumentHandlerTest extends TestCase
{
    public function testWorkerRunsOcrUploadsToDriveAndRemovesStagingFile(): void
    {
        $document = (new PlayerDocument())->setStorageKey('documents/scan.pdf')->setMimeType('application/pdf')
                ->setCategory('other')->setAutomaticClassification(true)->setProcessingStatus('pending');
        $repository = $this->createMock(PlayerDocumentRepository::class);
        $repository->method('find')->with(42)->willReturn($document);
        $ocr = $this->createMock(PlayerDocumentOcrService::class);
        $ocr->expects(self::once())->method('analyse')->with(self::callback(fn (string $path) => str_ends_with($path, '.pdf')
            && is_file($path)), 'application/pdf')->willReturn([
                'text' => 'Spielerpass gültig bis 30.06.2027', 'category' => 'pass',
                'issuedAt' => null, 'expiresAt' => new DateTimeImmutable('2027-06-30'),
            ]);
        $drive = $this->createMock(PlayerDocumentDriveStorage::class);
        $drive->expects(self::once())->method('upload')->with($document, self::isString())->willReturn('drive-file-1');
        $staging = $this->createMock(PlayerDocumentStagingStorage::class);
        $staging->expects(self::once())->method('downloadTo')->with('documents/scan.pdf', self::isString())
            ->willReturnCallback(static function (string $key, string $path): void {
                file_put_contents($path, 'test');
            });
        $staging->expects(self::once())->method('delete')->with('documents/scan.pdf');
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::exactly(3))->method('flush');

        (new ProcessPlayerDocumentHandler($repository, $ocr, $drive, $staging, $em))(new ProcessPlayerDocumentMessage(42));

        self::assertSame('ready', $document->getProcessingStatus());
        self::assertSame('drive-file-1', $document->getDriveFileId());
        self::assertSame('pass', $document->getCategory());
        self::assertSame('2027-06-30', $document->getExpiresAt()?->format('Y-m-d'));
        self::assertNull($document->getStorageKey());
    }
}
