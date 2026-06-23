<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\BillingSubscription;
use App\Repository\UserRepository;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryClubAssignment;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class BillingNotificationService
{
    public function __construct(
        private NotificationService $notifications,
        private UserRepository $users,
        private MailerInterface $mailer,
        private string $mailerFrom,
        private string $frontendUrl,
        private EntityManagerInterface $em,
    ) {
    }

    public function paymentMissing(BillingSubscription $subscription, string $detail): void
    {
        $teamNames = implode(', ', array_map(static fn ($team) => $team->getName(), $subscription->getTeams()));
        $title = 'Team-Abo: Zahlung nicht eingegangen';
        $message = sprintf('%s (%s). %s', $teamNames, $detail, 'Bitte Zahlungsart und Rechnung prüfen.');
        $recipientsById = [$subscription->getPayer()->getId() => $subscription->getPayer()];
        foreach ($subscription->getTeams() as $team) {
            foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['team' => $team]) as $assignment) {
                if (
                    'Kassenwart' === $assignment->getFunctionaryTeamAssignmentType()?->getName()
                    && $assignment->getUser()
                    && $this->isCurrent($assignment->getStartDate(), $assignment->getEndDate())
                ) {
                    $recipientsById[$assignment->getUser()->getId()] = $assignment->getUser();
                }
            }
            foreach ($team->getClubs() as $club) {
                foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['club' => $club]) as $assignment) {
                    if (
                        'Kassenwart' === $assignment->getFunctionaryClubAssignmentType()?->getName()
                        && $assignment->getUser()
                        && $this->isCurrent($assignment->getStartDate(), $assignment->getEndDate())
                    ) {
                        $recipientsById[$assignment->getUser()->getId()] = $assignment->getUser();
                    }
                }
            }
        }
        foreach ($this->users->findSuperAdmins() as $superAdmin) {
            $recipientsById[$superAdmin->getId()] = $superAdmin;
        }
        $recipients = array_values($recipientsById);
        $this->notifications->createNotificationForUsers($recipients, 'billing', $title, $message, ['url' => '/abrechnung']);
        foreach ($recipients as $recipient) {
            if (!$recipient->getEmail()) {
                continue;
            }
            $email = (new Email())
                ->from($this->mailerFrom)
                ->to($recipient->getEmail())
                ->subject($title)
                ->text($message . "\n\nAbrechnung öffnen: " . rtrim($this->frontendUrl, '/') . '/abrechnung');
            $this->mailer->send($email);
        }
    }

    private function isCurrent(?\DateTimeInterface $start, ?\DateTimeInterface $end): bool
    {
        $today = new \DateTimeImmutable('today');
        return (null === $start || $start <= $today) && (null === $end || $end >= $today);
    }
}
