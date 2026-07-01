<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\UserXpEvent;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

class XPEventProcessor
{
    public function __construct(private EntityManagerInterface $entityManager, private XPService $xpService)
    {
    }

    public function processPendingXpEvents(): void
    {
        $this->entityManager->getConnection()->transactional(function (): void {
            $pendingXpEvents = $this->entityManager->getRepository(UserXpEvent::class)
                ->findBy(['isProcessed' => false]);

            foreach ($pendingXpEvents as $xpEvent) {
                $this->entityManager->lock($xpEvent, LockMode::PESSIMISTIC_WRITE);
                $this->entityManager->refresh($xpEvent);

                // Another worker may have already processed this row while we waited for the lock.
                if ($xpEvent->isProcessed()) {
                    continue;
                }

                $user = $xpEvent->getUser();
                $xpValue = $xpEvent->getXpValue();
                $season = $xpEvent->getSeason();

                // Keep processing resilient when historical/legacy rows are malformed.
                if (null === $user || $xpValue <= 0) {
                    $xpEvent->setIsProcessed(true);
                    $this->entityManager->persist($xpEvent);
                    continue;
                }

                // Apply the value captured at registration time to keep pending events
                // independent from later rule changes (disabled/edited/deleted rules).
                $this->xpService->addXPToUser($user, $xpValue, false, $season);
                $xpEvent->setIsProcessed(true);

                $this->entityManager->persist($xpEvent);
            }

            $this->entityManager->flush();
        });
    }
}
