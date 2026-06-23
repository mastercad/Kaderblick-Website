<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\BillingSubscription;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\BillingNotificationService;
use App\Service\NotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\RawMessage;

#[AllowMockObjectsWithoutExpectations]
final class BillingNotificationServiceTest extends TestCase
{
    private NotificationService & MockObject $notifications;
    private UserRepository & MockObject $users;
    private MailerInterface & MockObject $mailer;
    private EntityManagerInterface & MockObject $em;
    /** @var EntityRepository<FunctionaryTeamAssignment>&MockObject */
    private EntityRepository & MockObject $teamAssignments;
    /** @var EntityRepository<FunctionaryClubAssignment>&MockObject */
    private EntityRepository & MockObject $clubAssignments;

    protected function setUp(): void
    {
        $this->notifications = $this->createMock(NotificationService::class);
        $this->users = $this->createMock(UserRepository::class);
        $this->mailer = $this->createMock(MailerInterface::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->teamAssignments = $this->createMock(EntityRepository::class);
        $this->clubAssignments = $this->createMock(EntityRepository::class);
        $this->em->method('getRepository')->willReturnCallback(fn (string $class) => match ($class) {
            FunctionaryTeamAssignment::class => $this->teamAssignments,
            FunctionaryClubAssignment::class => $this->clubAssignments,
            default => $this->createMock(EntityRepository::class),
        });
        $this->clubAssignments->method('findBy')->willReturn([]);
    }

    public function testMissingPaymentNotifiesPayerCurrentTreasurerAndSuperadmins(): void
    {
        $payer = $this->user(1, 'Zahlender', 'Kassenwart', 'zahler@example.test');
        $currentTreasurer = $this->user(2, 'Aktueller', 'Kassenwart', 'aktuell@example.test');
        $superAdmin = $this->user(3, 'Super', 'Admin', 'admin@example.test');
        $team = (new Team())->setName('U17');
        $subscription = new BillingSubscription($payer);
        $subscription->addTeam($team);
        $this->teamAssignments->method('findBy')->willReturn([$this->assignment($currentTreasurer, $team)]);
        $this->users->method('findSuperAdmins')->willReturn([$superAdmin]);

        $this->notifications->expects(self::once())->method('createNotificationForUsers')
            ->with(
                self::callback(function (array $recipients): bool {
                    $ids = array_map(static fn (User $user) => $user->getId(), $recipients);
                    sort($ids);

                    return [1, 2, 3] === $ids;
                }),
                'billing',
                'Team-Abo: Zahlung nicht eingegangen',
                self::stringContains('U17'),
                ['url' => '/abrechnung'],
            );
        $sentTo = [];
        $this->mailer->expects(self::exactly(3))->method('send')->willReturnCallback(function (RawMessage $message) use (&$sentTo): void {
            if ($message instanceof \Symfony\Component\Mime\Email) {
                $sentTo[] = $message->getTo()[0]->getAddress();
            }
        });

        $this->service()->paymentMissing($subscription, 'Zahlung fehlgeschlagen');

        sort($sentTo);
        self::assertSame(['admin@example.test', 'aktuell@example.test', 'zahler@example.test'], $sentTo);
    }

    public function testExpiredTreasurerAssignmentIsNotNotified(): void
    {
        $payer = $this->user(1, 'Zahlender', 'Kassenwart', 'zahler@example.test');
        $expired = $this->user(2, 'Früherer', 'Kassenwart', 'alt@example.test');
        $team = (new Team())->setName('U15');
        $subscription = (new BillingSubscription($payer))->addTeam($team);
        $assignment = $this->assignment($expired, $team);
        $assignment->setEndDate(new DateTimeImmutable('yesterday'));
        $this->teamAssignments->method('findBy')->willReturn([$assignment]);
        $this->users->method('findSuperAdmins')->willReturn([]);

        $this->notifications->expects(self::once())->method('createNotificationForUsers')
            ->with(
                self::callback(fn (array $recipients) => 1 === count($recipients) && $recipients[0] === $payer),
                self::anything(),
                self::anything(),
                self::anything(),
                self::anything()
            );
        $this->mailer->expects(self::once())->method('send');

        $this->service()->paymentMissing($subscription, 'Zahlung offen');
    }

    private function service(): BillingNotificationService
    {
        return new BillingNotificationService($this->notifications, $this->users, $this->mailer, 'no-reply@example.test', 'https://app.example.test', $this->em);
    }

    private function assignment(User $user, Team $team): FunctionaryTeamAssignment
    {
        $type = new FunctionaryTeamAssignmentType();
        $type->setName('Kassenwart');
        $assignment = new FunctionaryTeamAssignment();
        $assignment->setUser($user);
        $assignment->setTeam($team);
        $assignment->setFunctionaryTeamAssignmentType($type);

        return $assignment;
    }

    private function user(int $id, string $firstName, string $lastName, string $email): User
    {
        $user = (new User())->setFirstName($firstName)->setLastName($lastName)->setEmail($email);
        $property = new ReflectionProperty(User::class, 'id');
        $property->setValue($user, $id);

        return $user;
    }
}
