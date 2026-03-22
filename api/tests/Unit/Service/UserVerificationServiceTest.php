<?php

namespace App\Tests\Unit\Service;

use App\Entity\User;
use App\Service\UserVerificationService;
use DateTime;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\Mailer\MailerInterface;

#[AllowMockObjectsWithoutExpectations]
class UserVerificationServiceTest extends TestCase
{
    private string $frontendUrl = 'https://example.com';
    private MailerInterface&MockObject $mailer;
    private UserVerificationService $service;

    protected function setUp(): void
    {
        $this->mailer = $this->createMock(MailerInterface::class);
        $this->service = new UserVerificationService($this->frontendUrl, $this->mailer);
    }

    public function testCreateVerificationTokenGeneratesValidToken(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');

        $token = $this->service->createVerificationToken($user);

        // Token should be 64 characters (32 bytes as hex)
        $this->assertEquals(64, strlen($token));
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $token);

        // User should have the token set
        $this->assertEquals($token, $user->getVerificationToken());
    }

    public function testCreateVerificationTokenSetsVerificationExpiration(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');

        $beforeCreation = new DateTime('+1 month');
        $this->service->createVerificationToken($user);
        $afterCreation = new DateTime('+1 month');

        $expirationDate = $user->getVerificationExpires();

        $this->assertNotNull($expirationDate);
        $this->assertGreaterThanOrEqual(
            $beforeCreation->getTimestamp(),
            $expirationDate->getTimestamp()
        );
        $this->assertLessThanOrEqual(
            $afterCreation->getTimestamp(),
            $expirationDate->getTimestamp()
        );
    }

    public function testCreateVerificationTokenSetsIsVerifiedToFalse(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setIsVerified(true);

        $this->service->createVerificationToken($user);

        $this->assertFalse($user->isVerified());
    }

    public function testCreateVerificationTokenSetsIsEnabledToFalse(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setIsEnabled(true);

        $this->service->createVerificationToken($user);

        $this->assertFalse($user->isEnabled());
    }

    public function testCreateVerificationTokenGeneratesUniqueTokens(): void
    {
        $user1 = new User();
        $user1->setEmail('test1@example.com');

        $user2 = new User();
        $user2->setEmail('test2@example.com');

        $token1 = $this->service->createVerificationToken($user1);
        $token2 = $this->service->createVerificationToken($user2);

        // Tokens should be different
        $this->assertNotEquals($token1, $token2);
    }

    public function testSendVerificationEmailGeneratesCorrectUrl(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setVerificationToken('test-token-123');

        $expectedUrl = 'https://example.com/verify-email/test-token-123';

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) use ($expectedUrl) {
                $context = $email->getContext();
                $this->assertEquals($expectedUrl, $context['signedUrl']);

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }

    public function testSendVerificationEmailSendsToCorrectRecipient(): void
    {
        $user = new User();
        $user->setEmail('recipient@example.com');
        $user->setVerificationToken('test-token-123');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $recipients = $email->getTo();
                $this->assertCount(1, $recipients);
                $this->assertEquals('recipient@example.com', $recipients[0]->getAddress());

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }

    public function testSendVerificationEmailHasCorrectSubject(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setVerificationToken('test-token-123');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $this->assertEquals('Bitte bestätige deine E-Mail', $email->getSubject());

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }

    public function testSendVerificationEmailUsesCorrectTemplate(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setVerificationToken('test-token-123');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $this->assertEquals('emails/verification.html.twig', $email->getHtmlTemplate());

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }

    public function testSendVerificationEmailHasCorrectSender(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setVerificationToken('test-token-123');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $from = $email->getFrom();
                $this->assertCount(1, $from);
                $this->assertEquals('no-reply@kaderblick.de', $from[0]->getAddress());

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }

    public function testSendVerificationEmailIncludesUserEmailInContext(): void
    {
        $user = new User();
        $user->setEmail('test@example.com');
        $user->setVerificationToken('test-token-123');

        $this->mailer
            ->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $context = $email->getContext();
                $this->assertArrayHasKey('name', $context);
                $this->assertEquals('test@example.com', $context['name']);

                return true;
            }));

        $this->service->sendVerificationEmail($user);
    }
}
