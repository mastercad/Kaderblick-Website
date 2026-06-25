<?php

namespace App\Tests\Unit\Service;

use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerDocument;
use App\Service\GoogleDriveService;
use App\Service\PlayerDocumentDriveStorage;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

#[AllowMockObjectsWithoutExpectations]
class PlayerDocumentDriveStorageTest extends TestCase
{
    public function testUploadsIntoPrivateClubAndPlayerFolders(): void
    {
        $previous = $_ENV['GOOGLE_DOCUMENTS_FOLDER_ID'] ?? null;
        $_ENV['GOOGLE_DOCUMENTS_FOLDER_ID'] = 'documents-root';
        try {
            $club = new Club();
            $player = new Player();
            (new ReflectionProperty($club, 'id'))->setValue($club, 8);
            (new ReflectionProperty($player, 'id'))->setValue($player, 23);

            $document = (new PlayerDocument())->setClub($club)->setPlayer($player)
                ->setOriginalFilename('pass.pdf')->setMimeType('application/pdf');

            $drive = $this->createMock(GoogleDriveService::class);
            $drive->expects(self::exactly(3))->method('ensureFolder')->willReturnMap([
                ['test', 'documents-root', 'test'],
                ['club-8', 'test', 'club-folder'],
                ['player-23', 'club-folder', 'player-folder'],
            ]);
            $drive->expects(self::once())->method('uploadFilePath')
                ->with('/tmp/pass.pdf', 'pass.pdf', 'application/pdf', 'player-folder')->willReturn('file-id');
            self::assertSame('file-id', (new PlayerDocumentDriveStorage($drive))->upload($document, '/tmp/pass.pdf'));
        } finally {
            if (null === $previous) {
                unset($_ENV['GOOGLE_DOCUMENTS_FOLDER_ID']);
            } else {
                $_ENV['GOOGLE_DOCUMENTS_FOLDER_ID'] = $previous;
            }
        }
    }
}
