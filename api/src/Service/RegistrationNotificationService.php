<?php

namespace App\Service;

use App\Entity\RegistrationRequest;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class RegistrationNotificationService
{
    public function __construct(
        private EntityManagerInterface $em,
        private NotificationService $notificationService,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Notify all admins about a new user registration.
     * Sends a system push notification and a system message with a direct link.
     */
    public function notifyAdminsAboutNewUser(User $newUser): void
    {
        $admins = $this->findAdmins();
        if (empty($admins)) {
            return;
        }

        $userName = trim($newUser->getFirstName() . ' ' . $newUser->getLastName());
        if (!$userName) {
            $userName = $newUser->getEmail();
        }

        $linkPath = '/admin/user-relations?tab=requests';

        $subject = 'Neuer Benutzer registriert: ' . $userName;

        foreach ($admins as $admin) {
            try {
                $this->notificationService->createNotification(
                    $admin,
                    'new_user_registration',
                    $subject,
                    sprintf(
                        '%s hat sich registriert. Klicke hier, um die Zuordnung zu verwalten.',
                        $userName
                    ),
                    ['url' => $linkPath, 'userId' => $newUser->getId()]
                );
            } catch (Throwable $e) {
                $this->logger->error(
                    'Failed to send new-user push notification to admin ' . $admin->getId(),
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    /**
     * Notify admins about a new registration request (relation request).
     */
    public function notifyAdminsAboutRegistrationRequest(RegistrationRequest $request): void
    {
        $admins = $this->findAdmins();
        if (empty($admins)) {
            return;
        }

        $newUser = $request->getUser();
        $userName = trim($newUser->getFirstName() . ' ' . $newUser->getLastName());
        if (!$userName) {
            $userName = $newUser->getEmail();
        }

        $entityName = $request->getPlayer()?->getFullName() ?? $request->getCoach()?->getFullName() ?? 'unbekannt';
        $relTypeName = $request->getRelationType()->getName();
        $linkPath = '/admin/user-relations?tab=requests';

        $subject = sprintf('Neuer Zuordnungsantrag von %s', $userName);

        foreach ($admins as $admin) {
            try {
                $this->notificationService->createNotification(
                    $admin,
                    'registration_request',
                    $subject,
                    sprintf('%s hat einen Zuordnungsantrag gestellt.', $userName),
                    ['url' => $linkPath, 'requestId' => $request->getId()]
                );
            } catch (Throwable $e) {
                $this->logger->error(
                    'Failed to send registration-request push notification to admin ' . $admin->getId(),
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    /**
     * Notify the requesting user that their registration request was approved.
     */
    public function notifyUserAboutApprovedRequest(RegistrationRequest $request): void
    {
        $user = $request->getUser();
        $relTypeName = $request->getRelationType()->getName();

        if ($request->getPlayer()) {
            $entityLabel = 'Spieler';
            $entityName = $request->getPlayer()->getFullName();
        } elseif ($request->getCoach()) {
            $entityLabel = 'Trainer';
            $entityName = $request->getCoach()->getFullName();
        } else {
            $entityLabel = 'Person';
            $entityName = 'unbekannt';
        }

        try {
            $this->notificationService->createNotification(
                $user,
                'registration_request_approved',
                '🎉 Dein Zuordnungsantrag wurde genehmigt!',
                sprintf(
                    'Du wurdest als %s mit dem %s %s verknüpft.',
                    $relTypeName,
                    $entityLabel,
                    $entityName
                ),
                ['url' => '/profile']
            );
        } catch (Throwable $e) {
            $this->logger->error(
                'Failed to send approval push notification to user ' . $user->getId(),
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
            fn (User $u) => in_array('ROLE_SUPERADMIN', $u->getRoles(), true)
        );
    }
}
