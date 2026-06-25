<?php

declare(strict_types=1);

namespace App\Service;

use RuntimeException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\Transport\Receiver\MessageCountAwareInterface;
use Symfony\Component\Messenger\Transport\TransportInterface;

class MessengerQueueHealthService
{
    public function __construct(
        #[Autowire(service: 'messenger.transport.failed')]
        private readonly TransportInterface $failedTransport,
    ) {
    }

    public function failedCount(): int
    {
        if (!$this->failedTransport instanceof MessageCountAwareInterface) {
            throw new RuntimeException('Failed-Transport unterstützt keine Zählung.');
        }

        return $this->failedTransport->getMessageCount();
    }
}
