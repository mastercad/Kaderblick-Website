<?php

namespace Tests\Feature;

use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Mailer\MailerInterface;

#[AllowMockObjectsWithoutExpectations]
class RegistrationTest extends WebTestCase
{
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->cleanupTestUsers();
    }

    protected function tearDown(): void
    {
        $this->cleanupTestUsers();
        parent::tearDown();
        restore_exception_handler();
    }

    /**
     * Deletes all users created by this test class so tests are independent.
     * Cannot use transaction rollback because KernelBrowser reboots the kernel
     * (closing the DB connection) between HTTP requests.
     */
    private function cleanupTestUsers(): void
    {
        $testEmails = [
            'test-register@example.com',
            'test-verify@example.com',
            'test-duplicate@example.com',
            'test-hash@example.com',
            'test-resend@example.com',
            'test-new-token@example.com',
            'test-url@example.com',
            'expired@example.com',
        ];
        $conn = $this->em->getConnection();
        $placeholders = implode(',', array_fill(0, count($testEmails), '?'));
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS = 0');
        $conn->executeStatement(
            "DELETE FROM users WHERE email IN ($placeholders)",
            $testEmails
        );
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS = 1');
    }

    private function getEntityManager(): EntityManagerInterface
    {
        return $this->em;
    }

    public function testSuccessfulRegistration(): void
    {
        $client = static::getClient();

        // Mock the mailer
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) {
                $this->assertCount(1, $email->getTo());
                $to = $email->getTo()[0];
                $this->assertEquals('test-register@example.com', $to->getAddress());
                $this->assertEquals('Bitte bestätige deine E-Mail', $email->getSubject());

                // For TemplatedEmail, verify the context contains the verification URL
                $context = $email->getContext();
                $this->assertArrayHasKey('signedUrl', $context);
                $this->assertStringContainsString('/verify-email/', $context['signedUrl']);

                return true;
            }));

        static::getContainer()->set(MailerInterface::class, $mailer);

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-register@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Max Mustermann',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('message', $response);
        $this->assertStringContainsString('Registrierung erfolgreich', $response['message']);

        // Verify user was created in database
        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-register@example.com']);

        $this->assertNotNull($user);
        $this->assertEquals('Max', $user->getFirstName());
        $this->assertEquals('Mustermann', $user->getLastName());
        $this->assertFalse($user->isVerified());
        $this->assertFalse($user->isEnabled());
        $this->assertNotNull($user->getVerificationToken());
        $this->assertNotNull($user->getVerificationExpires());
    }

    public function testRegistrationWithMultipleFirstNames(): void
    {
        $client = static::getClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-verify@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Hans Peter Schmidt',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-verify@example.com']);

        $this->assertNotNull($user);
        $this->assertEquals('Hans Peter', $user->getFirstName());
        $this->assertEquals('Schmidt', $user->getLastName());
    }

    public function testRegistrationWithDuplicateEmail(): void
    {
        $client = static::getClient();

        // First registration
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-duplicate@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'John Doe',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Second registration with same email
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-duplicate@example.com',
            'password' => 'AnotherPassword456!',
            'fullName' => 'Jane Doe',
        ]));

        $this->assertResponseStatusCodeSame(400);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $response);
        $this->assertStringContainsString('bereits registriert', $response['error']);
    }

    public function testRegistrationWithMissingData(): void
    {
        $client = static::getClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'incomplete@example.com',
            // Missing password and fullName
        ]));

        $this->assertResponseStatusCodeSame(400);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $response);
    }

    public function testEmailVerification(): void
    {
        $client = static::getClient();

        // Register user
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-verify@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Test User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Get verification token
        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-verify@example.com']);

        $token = $user->getVerificationToken();
        $this->assertNotNull($token);

        // Verify email with token
        $client->request('GET', '/api/verify-email/' . $token);

        $this->assertResponseStatusCodeSame(200);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('message', $response);
        $this->assertStringContainsString('erfolgreich verifiziert', $response['message']);

        // Get fresh user from database
        $em = $this->getEntityManager();
        $em->clear();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'test-verify@example.com']);
        $this->assertTrue($user->isVerified());
        $this->assertTrue($user->isEnabled());
        $this->assertNull($user->getVerificationToken());
        $this->assertNull($user->getVerificationExpires());
    }

    public function testEmailVerificationWithInvalidToken(): void
    {
        $client = static::getClient();

        $client->request('GET', '/api/verify-email/invalid-token-12345');

        $this->assertResponseStatusCodeSame(404);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $response);
        $this->assertStringContainsString('ungültig oder abgelaufen', $response['error']);
    }

    public function testEmailVerificationWithExpiredToken(): void
    {
        $client = static::getClient();

        // Create user with expired token
        $user = new User();
        $user->setEmail('expired@example.com')
            ->setPassword('hashedpassword')
            ->setFirstName('Expired')
            ->setLastName('User')
            ->setVerificationToken('expired-token')
            ->setIsVerified(false)
            ->setIsEnabled(false)
            ->setVerificationExpires(new DateTime('-1 day')); // Expired yesterday

        $em = $this->getEntityManager();
        $em->persist($user);
        $em->flush();

        $client->request('GET', '/api/verify-email/expired-token');

        $this->assertResponseStatusCodeSame(410);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $response);
        $this->assertStringContainsString('abgelaufen', $response['error']);
    }

    public function testVerificationEmailContainsCorrectUrl(): void
    {
        $client = static::getClient();
        $verificationToken = null;

        // Mock the mailer to capture and verify the email
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects($this->once())
            ->method('send')
            ->with($this->callback(function (TemplatedEmail $email) use (&$verificationToken) {
                $this->assertCount(1, $email->getTo());
                $to = $email->getTo()[0];
                $this->assertEquals('test-url@example.com', $to->getAddress());

                // For TemplatedEmail, we need to check the context instead of the rendered body
                $context = $email->getContext();
                $this->assertArrayHasKey('signedUrl', $context);
                $signedUrl = $context['signedUrl'];

                // Verify the URL pattern exists
                $this->assertStringContainsString('/verify-email/', $signedUrl);

                // Extract the token from the URL
                preg_match('#/verify-email/([a-f0-9]{64})#', $signedUrl, $matches);
                $this->assertNotEmpty($matches, 'Verification URL with token should be in email');
                $verificationToken = $matches[1];

                return true;
            }));

        static::getContainer()->set(MailerInterface::class, $mailer);

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-url@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Test User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Get the user and verify token matches what was sent in email
        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-url@example.com']);

        $this->assertNotNull($user);
        $this->assertNotNull($verificationToken, 'Token should have been extracted from email');
        $this->assertEquals($verificationToken, $user->getVerificationToken());
    }

    public function testPasswordIsHashedCorrectly(): void
    {
        $client = static::getClient();

        $plainPassword = 'SecurePassword123!';

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-hash@example.com',
            'password' => $plainPassword,
            'fullName' => 'Test User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-hash@example.com']);

        // Password should be hashed, not stored in plain text
        $this->assertNotEquals($plainPassword, $user->getPassword());
        $this->assertStringStartsWith('$', $user->getPassword()); // Hashed passwords start with $
        $this->assertGreaterThan(50, strlen($user->getPassword())); // Hashed passwords are long
    }

    public function testResendVerificationWithValidUser(): void
    {
        $client = static::getClient();

        // Create a user first
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-resend@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Test User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-resend@example.com']);

        $oldToken = $user->getVerificationToken();
        $this->assertNotNull($oldToken);

        // Resend verification
        $client->request('POST', '/api/resend-verification/' . $user->getId());

        $this->assertResponseStatusCodeSame(200);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($response['success']);
        $this->assertStringContainsString('erneut gesendet', $response['message']);

        // Verify that a new token was generated
        $em = $this->getEntityManager();
        $em->clear();
        $updatedUser = $em->getRepository(User::class)->findOneBy(['email' => 'test-resend@example.com']);
        $this->assertNotNull($updatedUser->getVerificationToken());
        $this->assertNotEquals($oldToken, $updatedUser->getVerificationToken());
        $this->assertFalse($updatedUser->isVerified());
        $this->assertFalse($updatedUser->isEnabled());
    }

    public function testResendVerificationWithInvalidUser(): void
    {
        $client = static::getClient();

        $client->request('POST', '/api/resend-verification/99999');

        $this->assertResponseStatusCodeSame(404);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $response);
        $this->assertStringContainsString('nicht gefunden', $response['error']);
    }

    public function testResendVerificationGeneratesNewToken(): void
    {
        $client = static::getClient();

        // Create a user
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test-new-token@example.com',
            'password' => 'SecurePassword123!',
            'fullName' => 'Test User',
        ]));

        $user = $this->getEntityManager()->getRepository(User::class)
            ->findOneBy(['email' => 'test-new-token@example.com']);

        $oldToken = $user->getVerificationToken();
        $oldExpires = $user->getVerificationExpires();

        // Wait a moment to ensure timestamp difference
        sleep(1);

        // Resend verification
        $client->request('POST', '/api/resend-verification/' . $user->getId());

        $this->assertResponseStatusCodeSame(200);

        // Get updated user
        $em = $this->getEntityManager();
        $em->clear();
        $updatedUser = $em->getRepository(User::class)->findOneBy(['email' => 'test-new-token@example.com']);

        // Verify new token was generated
        $this->assertNotEquals($oldToken, $updatedUser->getVerificationToken());
        $this->assertEquals(64, strlen($updatedUser->getVerificationToken()));

        // Verify expiration was updated
        $this->assertNotEquals(
            $oldExpires->getTimestamp(),
            $updatedUser->getVerificationExpires()->getTimestamp()
        );
    }

    public function testResendVerificationResetsVerificationStatus(): void
    {
        $client = static::getClient();

        // Create a user and manually verify them
        $user = new User();
        $user->setEmail('test-reset@example.com')
            ->setPassword('hashedpassword')
            ->setFirstName('Test')
            ->setLastName('User')
            ->setVerificationToken('old-token')
            ->setIsVerified(true)  // Already verified
            ->setIsEnabled(true)   // Already enabled
            ->setVerificationExpires(new DateTime('+1 month'));

        $em = $this->getEntityManager();
        $em->persist($user);
        $em->flush();

        // Resend verification
        $client->request('POST', '/api/resend-verification/' . $user->getId());

        $this->assertResponseStatusCodeSame(200);

        // Get updated user
        $em->clear();
        $updatedUser = $em->getRepository(User::class)->findOneBy(['email' => 'test-reset@example.com']);

        // Verify status was reset
        $this->assertFalse($updatedUser->isVerified());
        $this->assertFalse($updatedUser->isEnabled());

        // Cleanup
        $em->remove($updatedUser);
        $em->flush();
    }
}
