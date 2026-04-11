<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Message;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests für die in dieser Session hinzugefügten Features:
 * – senderId / senderIsSuperAdmin in show() und index()
 * – create()-Validierung: unverknüpfte User dürfen nur an ROLE_SUPERADMIN schreiben
 */
class MessageControllerSenderFlagsTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $this->entityManager->getConnection()->beginTransaction();
    }

    // =========================================================================
    //  show() – senderId + senderIsSuperAdmin
    // =========================================================================

    public function testShowReturnsSenderIdForRegularSender(): void
    {
        $sender = $this->loadUser('user6@example.com');
        $recipient = $this->loadUser('user7@example.com');
        $message = $this->createMessage($sender, [$recipient], 'hello');

        $this->client->loginUser($recipient);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('senderId', $data);
        $this->assertSame($sender->getId(), $data['senderId']);
    }

    public function testShowReturnsSenderIsSuperAdminFalseForRegularUser(): void
    {
        $sender = $this->loadUser('user6@example.com');
        $recipient = $this->loadUser('user7@example.com');
        $message = $this->createMessage($sender, [$recipient], 'hello2');

        $this->client->loginUser($recipient);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertFalse($data['senderIsSuperAdmin']);
    }

    public function testShowReturnsSenderIsSuperAdminTrueWhenSenderIsAdmin(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $recipient = $this->loadUser('user7@example.com');
        $message = $this->createMessage($admin, [$recipient], 'admin-msg');

        $this->client->loginUser($recipient);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['senderIsSuperAdmin']);
    }

    // =========================================================================
    //  index() – senderId in Inbox-Liste
    // =========================================================================

    public function testIndexReturnsSenderIdForEachMessage(): void
    {
        $sender = $this->loadUser('user6@example.com');
        $recipient = $this->loadUser('user7@example.com');
        $this->createMessage($sender, [$recipient], 'inbox-msg');

        $this->client->loginUser($recipient);
        $this->client->request('GET', '/api/messages');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $testMessages = array_values(array_filter(
            $data['messages'],
            fn ($m) => str_starts_with($m['subject'], 'inbox-msg')
        ));

        $this->assertNotEmpty($testMessages);
        $this->assertArrayHasKey('senderId', $testMessages[0]);
        $this->assertSame($sender->getId(), $testMessages[0]['senderId']);
    }

    public function testIndexReturnsSenderIsSuperAdminFlag(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $recipient = $this->loadUser('user7@example.com');
        $this->createMessage($admin, [$recipient], 'admin-inbox');

        $this->client->loginUser($recipient);
        $this->client->request('GET', '/api/messages');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $adminMessages = array_values(array_filter(
            $data['messages'],
            fn ($m) => str_starts_with($m['subject'], 'admin-inbox')
        ));

        $this->assertNotEmpty($adminMessages);
        $this->assertTrue($adminMessages[0]['senderIsSuperAdmin']);
    }

    // =========================================================================
    //  create() – Validierung für unverknüpfte User
    // =========================================================================

    public function testCreateBlocksUnlinkedUserSendingToRegularUser(): void
    {
        // Unverknüpfter User (keine UserRelation mit Spieler/Trainer)
        // user16 (ROLE_ADMIN) has no UserRelation entries in the fixtures and is therefore truly unlinked.
        $unlinked = $this->loadUser('user16@example.com');
        $normalUser = $this->loadUser('user10@example.com');

        $this->client->loginUser($unlinked);
        $this->client->request('POST', '/api/messages', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'subject' => 'blocked',
            'content' => 'Test',
            'recipientIds' => [$normalUser->getId()],
        ]));

        $this->assertResponseStatusCodeSame(403);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testCreateAllowsUnlinkedUserSendingToSuperAdmin(): void
    {
        $unlinked = $this->loadUser('user16@example.com');
        $admin = $this->loadUser('user21@example.com');

        $this->client->loginUser($unlinked);
        $this->client->request('POST', '/api/messages', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'subject' => 'allowed',
            'content' => 'Antwort auf eure Nachricht',
            'recipientIds' => [$admin->getId()],
        ]));

        $this->assertResponseIsSuccessful();
    }

    public function testCreateBlocksUnlinkedUserSendingToMixedRecipients(): void
    {
        // Wenn auch nur EIN Empfänger kein Superadmin ist → 403
        $unlinked = $this->loadUser('user16@example.com');
        $admin = $this->loadUser('user21@example.com');
        $normalUser = $this->loadUser('user10@example.com');

        $this->client->loginUser($unlinked);
        $this->client->request('POST', '/api/messages', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'subject' => 'mixed-blocked',
            'content' => 'Test',
            'recipientIds' => [$admin->getId(), $normalUser->getId()],
        ]));

        $this->assertResponseStatusCodeSame(403);
    }

    public function testCreateAllowsSuperAdminToSendToAnyone(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $recipient = $this->loadUser('user6@example.com');

        $this->client->loginUser($admin);
        $this->client->request('POST', '/api/messages', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'subject' => 'admin-sends',
            'content' => 'Hallo!',
            'recipientIds' => [$recipient->getId()],
        ]));

        $this->assertResponseIsSuccessful();
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    private function loadUser(string $email): User
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found. Please load fixtures.', $email));

        return $user;
    }

    /** @param User[] $recipients */
    private function createMessage(User $sender, array $recipients, string $subject): Message
    {
        $message = new Message();
        $message->setSender($sender);
        $message->setSubject($subject);
        $message->setContent('Test content');
        foreach ($recipients as $r) {
            $message->addRecipient($r);
        }
        $this->entityManager->persist($message);
        $this->entityManager->flush();

        return $message;
    }

    protected function tearDown(): void
    {
        $this->entityManager->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }
}
