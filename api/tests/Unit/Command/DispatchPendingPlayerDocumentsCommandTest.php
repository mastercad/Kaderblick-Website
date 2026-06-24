<?php

namespace App\Tests\Unit\Command;

use App\Command\DispatchPendingPlayerDocumentsCommand;
use App\Entity\PlayerDocument;
use App\Message\ProcessPlayerDocumentMessage;
use App\Repository\PlayerDocumentRepository;
use App\Service\HeartbeatService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\MessageBusInterface;

#[AllowMockObjectsWithoutExpectations]
class DispatchPendingPlayerDocumentsCommandTest extends TestCase
{
    public function testRelaysUndispatchedDocumentAndMarksIt(): void
    {
        $document = (new PlayerDocument())->setProcessingStatus('pending');
        (new ReflectionProperty($document, 'id'))->setValue($document, 42);
        $repository = $this->createMock(PlayerDocumentRepository::class);
        $repository->method('findUndispatchedPending')->willReturn([$document]);
        $bus = $this->createMock(MessageBusInterface::class);
        $bus->expects(self::once())->method('dispatch')->with(self::callback(
            fn (object $message) => $message instanceof ProcessPlayerDocumentMessage && 42 === $message->documentId
        ))->willReturn(new Envelope(new ProcessPlayerDocumentMessage(42)));
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::once())->method('flush');
        $command = new DispatchPendingPlayerDocumentsCommand($repository, $bus, $em);
        $command->setHeartbeatService($this->createMock(HeartbeatService::class));
        self::assertSame(0, (new CommandTester($command))->execute([]));
        self::assertNotNull($document->getProcessingDispatchedAt());
    }
}
