<?php

namespace App\Service;

use App\Entity\SupporterRequest;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class SupporterRequestNotificationService
{
    public function __construct(
        private EntityManagerInterface $em,
        private NotificationService $notificationService,
        private LoggerInterface $logger
    ) {
    }

    public function notifyAdminsAboutNewRequest(SupporterRequest $request): void
    {
        $admins = $this->findAdmins();
        if (empty($admins)) {
            return;
        }

        $user = $request->getUser();
        $userName = trim($user->getFirstName() . ' ' . $user->getLastName());
        if (!$userName) {
            $userName = $user->getEmail();
        }

        $url = sprintf('/admin/user-relations?tab=supporter-requests&requestId=%d', $request->getId());

        foreach ($admins as $admin) {
            try {
                $this->notificationService->createNotification(
                    $admin,
                    'supporter_request',
                    sprintf('Neue Supporter-Anfrage von %s', $userName),
                    sprintf('%s möchte Supporter-Rechte erhalten.', $userName),
                    ['url' => $url, 'requestId' => $request->getId(), 'userId' => $user->getId()]
                );
            } catch (Throwable $e) {
                $this->logger->error(
                    'Failed to send supporter-request notification to admin ' . $admin->getId(),
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    public function notifyUserAboutApprovedRequest(SupporterRequest $request): void
    {
        $user = $request->getUser();

        try {
            $this->notificationService->createNotification(
                $user,
                'supporter_request_approved',
                'Deine Supporter-Anfrage wurde genehmigt',
                'Du hast jetzt Supporter-Rechte und kannst Events und Videos verwalten.',
                ['url' => '/games']
            );
        } catch (Throwable $e) {
            $this->logger->error(
                'Failed to send supporter-request approval notification to user ' . $user->getId(),
                ['error' => $e->getMessage()]
            );
        }
    }

    public function notifyUserAboutRejectedRequest(SupporterRequest $request, ?string $reason = null): void
    {
        $user = $request->getUser();
        $message = 'Deine Supporter-Anfrage wurde abgelehnt.';
        if ($reason) {
            $message .= ' Grund: ' . $reason;
        }

        try {
            $this->notificationService->createNotification(
                $user,
                'supporter_request_rejected',
                'Deine Supporter-Anfrage wurde abgelehnt',
                $message,
                ['url' => '/games']
            );
        } catch (Throwable $e) {
            $this->logger->error(
                'Failed to send supporter-request rejection notification to user ' . $user->getId(),
                ['error' => $e->getMessage()]
            );
        }
    }

    /**
     * @return User[]
     */
    private function findAdmins(): array
    {
        return array_filter(
            $this->em->getRepository(User::class)->findAll(),
            fn (User $u) => in_array('ROLE_ADMIN', $u->getRoles(), true)
                || in_array('ROLE_SUPERADMIN', $u->getRoles(), true)
        );
    }
}