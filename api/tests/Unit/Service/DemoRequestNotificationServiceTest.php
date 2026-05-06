<?php

namespace App\Tests\Unit\Service;

use App\Entity\DemoRequest;
use App\Entity\User;
use App\Service\DemoRequestNotificationService;
use App\Service\EmailService;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

/**
 * Unit tests for DemoRequestNotificationService.
 *
 * Covers:
 *  - notifySuperadminsAboutNewRequest(): notification + email sent to each superadmin
 *  - notifySuperadminsAboutNewRequest(): graceful handling when notification or email fails
 *  - notifySuperadminsAboutNewRequest(): no-op when no superadmins exist
 *  - sendConfirmationToRequester(): confirmation email sent to requester
 *  - sendConfirmationToRequester(): graceful handling when email fails
 */
#[AllowMockObjectsWithoutExpectations]
class DemoRequestNotificationServiceTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private NotificationService&MockObject $notificationService;
    private EmailService&MockObject $emailService;
    private ParameterBagInterface&MockObject $params;
    private LoggerInterface&MockObject $logger;
    private DemoRequestNotificationService $service;

    /** @var EntityRepository<User>&MockObject */
    private EntityRepository&MockObject $userRepository;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->notificationService = $this->createMock(NotificationService::class);
        $this->emailService = $this->createMock(EmailService::class);
        $this->params = $this->createMock(ParameterBagInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->userRepository = $this->createMock(EntityRepository::class);

        $this->params->method('get')
            ->with('app.frontend_url')
            ->willReturn('https://kaderblick.de');

        $this->em->method('getRepository')
            ->with(User::class)
            ->willReturn($this->userRepository);

        $this->service = new DemoRequestNotificationService(
            $this->em,
            $this->notificationService,
            $this->emailService,
            $this->params,
            $this->logger,
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private function makeDemoRequest(int $fakeId = 42): DemoRequest
    {
        $req = new DemoRequest();
        $req->setName('Anna Müller')->setEmail('anna@example.com');
        // Inject the id via reflection (id is set by Doctrine normally)
        $ref = new ReflectionProperty(DemoRequest::class, 'id');
        $ref->setValue($req, $fakeId);

        return $req;
    }

    /** Creates a mock User that appears to have ROLE_SUPERADMIN in getRoles(). */
    private function makeSuperadmin(int $id = 1, string $email = 'admin@example.com'): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getRoles')->willReturn(['ROLE_SUPERADMIN', 'ROLE_USER']);
        $user->method('getId')->willReturn($id);
        $user->method('getEmail')->willReturn($email);

        return $user;
    }

    /** Creates a mock User that does NOT have ROLE_SUPERADMIN. */
    private function makeRegularUser(): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('getId')->willReturn(99);
        $user->method('getEmail')->willReturn('regular@example.com');

        return $user;
    }

    // ─────────────────────────────────────────────────────────────────────
    // notifySuperadminsAboutNewRequest
    // ─────────────────────────────────────────────────────────────────────

    public function testNotifySuperadminsSendsInAppNotificationToEachSuperadmin(): void
    {
        $superadmin1 = $this->makeSuperadmin(1, 'sa1@example.com');
        $superadmin2 = $this->makeSuperadmin(2, 'sa2@example.com');
        $regular = $this->makeRegularUser();

        $this->userRepository->method('findAll')->willReturn([$superadmin1, $regular, $superadmin2]);

        $this->notificationService->expects($this->exactly(2))
            ->method('createNotification')
            ->with(
                $this->logicalOr($this->identicalTo($superadmin1), $this->identicalTo($superadmin2)),
                'demo_request',
                $this->stringContains('Anna Müller'),
                $this->anything(),
                $this->anything(),
            );

        $this->emailService->method('sendTemplatedEmail'); // allow any calls

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest(42));
    }

    public function testNotifySuperadminsSendsEmailToEachSuperadmin(): void
    {
        $superadmin1 = $this->makeSuperadmin(1, 'sa1@example.com');
        $superadmin2 = $this->makeSuperadmin(2, 'sa2@example.com');

        $this->userRepository->method('findAll')->willReturn([$superadmin1, $superadmin2]);
        $this->notificationService->method('createNotification');

        $this->emailService->expects($this->exactly(2))
            ->method('sendTemplatedEmail')
            ->with(
                $this->logicalOr('sa1@example.com', 'sa2@example.com'),
                $this->stringContains('Anna Müller'),
                'demo_request_notification',
                $this->arrayHasKey('demoRequest'),
            );

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest(42));
    }

    public function testNotifySuperadminsSkipsRegularUsers(): void
    {
        $regular = $this->makeRegularUser();
        $this->userRepository->method('findAll')->willReturn([$regular]);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->emailService->expects($this->never())->method('sendTemplatedEmail');

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest());
    }

    public function testNotifySuperadminsWhenNoUsersExist(): void
    {
        $this->userRepository->method('findAll')->willReturn([]);

        $this->notificationService->expects($this->never())->method('createNotification');
        $this->emailService->expects($this->never())->method('sendTemplatedEmail');

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest());
    }

    public function testNotifySuperadminsContinuesIfNotificationThrows(): void
    {
        $superadmin = $this->makeSuperadmin();
        $this->userRepository->method('findAll')->willReturn([$superadmin]);

        $this->notificationService->method('createNotification')
            ->willThrowException(new RuntimeException('SMTP error'));

        // Should log the error and still attempt email
        $this->logger->expects($this->atLeastOnce())->method('error');

        // Email should still be attempted even though notification failed
        $this->emailService->expects($this->once())->method('sendTemplatedEmail');

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest());
    }

    public function testNotifySuperadminsContinuesIfEmailThrows(): void
    {
        $superadmin = $this->makeSuperadmin();
        $this->userRepository->method('findAll')->willReturn([$superadmin]);

        $this->notificationService->method('createNotification');
        $this->emailService->method('sendTemplatedEmail')
            ->willThrowException(new RuntimeException('SMTP error'));

        $this->logger->expects($this->atLeastOnce())->method('error');

        // Should not throw — exception is caught and logged
        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest());
    }

    public function testNotifyPassesCorrectAdminUrlWithRequestId(): void
    {
        $superadmin = $this->makeSuperadmin(1, 'sa@example.com');
        $this->userRepository->method('findAll')->willReturn([$superadmin]);
        $this->notificationService->method('createNotification');

        $this->emailService->expects($this->once())
            ->method('sendTemplatedEmail')
            ->with(
                $this->anything(),
                $this->anything(),
                $this->anything(),
                $this->callback(function (array $context) {
                    return isset($context['adminUrl'])
                        && str_contains($context['adminUrl'], '/admin/user-relations?tab=demo-requests&requestId=42');
                }),
            );

        $this->service->notifySuperadminsAboutNewRequest($this->makeDemoRequest(42));
    }

    // ─────────────────────────────────────────────────────────────────────
    // sendConfirmationToRequester
    // ─────────────────────────────────────────────────────────────────────

    public function testSendConfirmationSendsEmailToRequester(): void
    {
        $req = $this->makeDemoRequest();

        $this->emailService->expects($this->once())
            ->method('sendTemplatedEmail')
            ->with(
                'anna@example.com',
                $this->stringContains('Demo-Anfrage'),
                'demo_request_confirmation',
                $this->arrayHasKey('demoRequest'),
            );

        $this->service->sendConfirmationToRequester($req);
    }

    public function testSendConfirmationLogsAndDoesNotThrowWhenEmailFails(): void
    {
        $req = $this->makeDemoRequest();

        $this->emailService->method('sendTemplatedEmail')
            ->willThrowException(new RuntimeException('SMTP error'));

        $this->logger->expects($this->once())->method('error');

        // Must not propagate the exception
        $this->service->sendConfirmationToRequester($req);
    }
}
