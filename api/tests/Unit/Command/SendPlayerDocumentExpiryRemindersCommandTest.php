<?php

namespace App\Tests\Unit\Command;

use App\Command\SendPlayerDocumentExpiryRemindersCommand;
use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerDocument;
use App\Entity\User;
use App\Repository\PlayerDocumentRepository;
use App\Repository\UserRelationRepository;
use App\Service\HeartbeatService;
use App\Service\NotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class SendPlayerDocumentExpiryRemindersCommandTest extends TestCase
{
    public function testNotifiesUploaderOnlyOncePerReminderWindow(): void
    {
        $user = new User();
        $player = (new Player())->setFirstName('Kian')->setLastName('Clauss');
        $document = (new PlayerDocument())->setPlayer($player)->setClub(new Club())->setUploadedBy($user)
            ->setDisplayName('Spielerpass')->setExpiresAt(new DateTimeImmutable('today +7 days'));
        $documents = $this->createMock(PlayerDocumentRepository::class);
        $documents->method('findExpiringWithin')->with(30)->willReturn([$document]);
        $relations = $this->createMock(UserRelationRepository::class);
        $relations->method('findAllWithAccessToPlayer')->willReturn([]);
        $notifications = $this->createMock(NotificationService::class);
        $notifications->expects(self::once())->method('createNotificationForUsers')->with([$user], 'document_expiry', self::stringContains('7 Tag'));
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::once())->method('flush');
        $command = new SendPlayerDocumentExpiryRemindersCommand($documents, $relations, $notifications, $em);
        $command->setHeartbeatService($this->createMock(HeartbeatService::class));
        $tester = new CommandTester($command);
        self::assertSame(0, $tester->execute([]));
        self::assertArrayHasKey('7_days', $document->getExpiryNotificationsSent());
    }
}
