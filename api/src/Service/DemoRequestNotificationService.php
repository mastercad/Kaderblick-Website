<?php

namespace App\Service;

use App\Entity\DemoRequest;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Throwable;

class DemoRequestNotificationService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly NotificationService $notificationService,
        private readonly EmailService $emailService,
        private readonly ParameterBagInterface $params,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function notifySuperadminsAboutNewRequest(DemoRequest $demoRequest): void
    {
        $superadmins = $this->findSuperadmins();

        $adminUrl = sprintf(
            '%s/admin/user-relations?tab=demo-requests&requestId=%d',
            rtrim((string) $this->params->get('app.frontend_url'), '/'),
            (int) $demoRequest->getId()
        );

        foreach ($superadmins as $superadmin) {
            try {
                $this->notificationService->createNotification(
                    $superadmin,
                    'demo_request',
                    sprintf('Neue Demo-Anfrage von %s', $demoRequest->getName()),
                    sprintf('%s möchte einen Demo-Zugang für Kaderblick erhalten.', $demoRequest->getName()),
                    ['url' => '/admin/user-relations?tab=demo-requests&requestId=' . $demoRequest->getId(), 'requestId' => $demoRequest->getId()]
                );
            } catch (Throwable $e) {
                $this->logger->error(
                    'Failed to send demo-request notification to superadmin ' . $superadmin->getId(),
                    ['error' => $e->getMessage()]
                );
            }

            try {
                $this->emailService->sendTemplatedEmail(
                    $superadmin->getEmail(),
                    sprintf('Neue Demo-Anfrage von %s', $demoRequest->getName()),
                    'demo_request_notification',
                    ['demoRequest' => $demoRequest, 'adminUrl' => $adminUrl]
                );
            } catch (Throwable $e) {
                $this->logger->error(
                    'Failed to send demo-request notification email to superadmin ' . $superadmin->getId(),
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    public function sendConfirmationToRequester(DemoRequest $demoRequest): void
    {
        try {
            $this->emailService->sendTemplatedEmail(
                $demoRequest->getEmail(),
                'Deine Demo-Anfrage bei Kaderblick',
                'demo_request_confirmation',
                ['demoRequest' => $demoRequest]
            );
        } catch (Throwable $e) {
            $this->logger->error(
                'Failed to send demo-request confirmation email to ' . $demoRequest->getEmail(),
                ['error' => $e->getMessage()]
            );
        }
    }

    /**
     * @return User[]
     */
    private function findSuperadmins(): array
    {
        return array_filter(
            $this->em->getRepository(User::class)->findAll(),
            fn (User $u) => in_array('ROLE_SUPERADMIN', $u->getRoles(), true)
        );
    }
}
