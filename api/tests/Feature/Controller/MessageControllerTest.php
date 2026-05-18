<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Message;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class MessageControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private User $u1;
    private User $u2;
    private User $u3;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $container = static::getContainer();
        $this->entityManager = $container->get(EntityManagerInterface::class);
        /** @var User $u1 */
        $u1 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($u1, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u1 = $u1;
        /** @var User $u2 */
        $u2 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user7@example.com']);
        $this->assertNotNull($u2, 'Fixture user user7@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u2 = $u2;
        /** @var User $u3 */
        $u3 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user8@example.com']);
        $this->assertNotNull($u3, 'Fixture user user8@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u3 = $u3;
    }

    public function testIndexIncludesSnippetField(): void
    {
        $user = $this->u1;
        $sender = $this->u2;

        $this->createMessageWithContent($sender, [$user], 'voter-test-Snippet subject', 'Hello World Content');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/messages');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $msg = $data['messages'][0];
        $this->assertArrayHasKey('snippet', $msg);
        $this->assertSame('Hello World Content', $msg['snippet']);
    }

    public function testSnippetTruncatesLongContent(): void
    {
        $user = $this->u1;
        $sender = $this->u2;

        $longContent = str_repeat('A', 200);
        $this->createMessageWithContent($sender, [$user], 'voter-test-Long subject', $longContent);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/messages');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $snippet = $data['messages'][0]['snippet'];
        $this->assertLessThanOrEqual(161, mb_strlen($snippet)); // 157 chars + ellipsis (1 char UTF-8)
    }

    public function testMarkAsUnreadRequiresAuthentication(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Unread auth');

        $this->client->request('PATCH', '/api/messages/' . $message->getId() . '/unread');

        $this->assertResponseStatusCodeSame(401);
    }

    public function testMarkAsUnreadDeniesNonRecipient(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $outsider = $this->u3;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Unread denied');

        $this->client->loginUser($outsider);
        $this->client->request('PATCH', '/api/messages/' . $message->getId() . '/unread');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testMarkAsUnreadSucceedsForRecipient(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Mark unread');

        // Mark as read directly via ORM (no HTTP request needed for setup)
        $message->markAsRead($recipient);
        $this->entityManager->flush();

        $this->assertTrue($message->isReadBy($recipient));

        // Mark as unread via API
        $this->client->loginUser($recipient);
        $this->client->request('PATCH', '/api/messages/' . $message->getId() . '/unread');
        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        // Verify in DB
        $this->entityManager->refresh($message);
        $this->assertFalse($message->isReadBy($recipient));
    }

    public function testMarkAsUnreadIsIdempotentOnAlreadyUnreadMessage(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Idempotent unread');

        // Message is unread by default – marking it as unread again must not error
        $this->client->loginUser($recipient);
        $this->client->request('PATCH', '/api/messages/' . $message->getId() . '/unread');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
    }

    public function testMarkAllAsReadRequiresAuthentication(): void
    {
        $this->client->request('PATCH', '/api/messages/read-all');
        $this->assertResponseStatusCodeSame(401);
    }

    public function testMarkAllAsReadMarksOnlyCurrentUsersMessages(): void
    {
        $user1 = $this->u1;
        $user2 = $this->u2;
        $sender = $this->u3;

        $this->createMessage($sender, [$user1], 'voter-test-MAR msg1');
        $this->createMessage($sender, [$user1], 'voter-test-MAR msg2');
        $this->createMessage($sender, [$user2], 'voter-test-MAR msg3');

        $this->client->loginUser($user1);
        $this->client->request('PATCH', '/api/messages/read-all');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(2, $data['marked']);

        // Verify user1 messages are now read
        $this->client->request('GET', '/api/messages');
        $messages = json_decode($this->client->getResponse()->getContent(), true)['messages'];
        foreach ($messages as $msg) {
            $this->assertTrue($msg['isRead'], "Message \"{$msg['subject']}\" should be read");
        }
    }

    public function testMarkAllAsReadIsIdempotent(): void
    {
        $user = $this->u1;
        $sender = $this->u2;
        $message = $this->createMessage($sender, [$user], 'voter-test-Idempotent read-all');

        // Pre-set all messages as read via ORM (simulates state after a first read-all call)
        $message->markAsRead($user);
        $this->entityManager->flush();

        // Now call read-all: nothing left to mark → should return 0
        $this->client->loginUser($user);
        $this->client->request('PATCH', '/api/messages/read-all');
        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(0, $data['marked']); // Nothing to mark – idempotent
    }

    public function testIndexOnlyReturnsMessagesForRecipient(): void
    {
        $user1 = $this->u1;
        $user2 = $this->u2;
        $sender = $this->u3;

        $this->createMessage($sender, [$user1], 'voter-test-Message for user1');
        $this->createMessage($sender, [$user2], 'voter-test-Message for user2');

        $this->client->loginUser($user1);
        $this->client->request('GET', '/api/messages');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $subjects = array_column($data['messages'], 'subject');
        $this->assertContains('voter-test-Message for user1', $subjects);
        $this->assertNotContains('voter-test-Message for user2', $subjects);
    }

    public function testShowDeniesAccessToMessageForNonRecipient(): void
    {
        $user1 = $this->u1;
        $user2 = $this->u2;
        $sender = $this->u3;

        $message = $this->createMessage($sender, [$user2], 'voter-test-Private message');

        $this->client->loginUser($user1);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $this->assertResponseStatusCodeSame(403);
    }

    public function testShowAllowsAccessToMessageForRecipient(): void
    {
        $user = $this->u1;
        $sender = $this->u2;

        $message = $this->createMessage($sender, [$user], 'voter-test-Message for user');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertEquals('voter-test-Message for user', $data['subject']);
    }

    public function testShowAllowsAccessToMessageForSender(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;

        $message = $this->createMessage($sender, [$recipient], 'voter-test-Sent message');

        $this->client->loginUser($sender);
        $this->client->request('GET', '/api/messages/' . $message->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertEquals('voter-test-Sent message', $data['subject']);
    }

    // ── DELETE endpoint ───────────────────────────────────────────────────────

    public function testDeleteRequiresAuthentication(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Delete auth');

        $this->client->request('DELETE', '/api/messages/' . $message->getId());

        $this->assertResponseStatusCodeSame(401);
    }

    public function testDeleteReturns404ForUnknownMessage(): void
    {
        $user = $this->u1;

        $this->client->loginUser($user);
        $this->client->request('DELETE', '/api/messages/99999999');

        $this->assertResponseStatusCodeSame(404);
    }

    public function testDeleteReturnsForbiddenForNonParticipant(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $outsider = $this->u3;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Delete forbidden');

        $this->client->loginUser($outsider);
        $this->client->request('DELETE', '/api/messages/' . $message->getId());

        $this->assertResponseStatusCodeSame(403);
    }

    public function testSenderCanDeleteMessageEntirely(): void
    {
        $sender = $this->u1;
        $recipient = $this->u2;
        $message = $this->createMessage($sender, [$recipient], 'voter-test-Sender deletes');
        $messageId = $message->getId();

        $this->client->loginUser($sender);
        $this->client->request('DELETE', '/api/messages/' . $messageId);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('Nachricht gelöscht', $data['message']);

        // Message must be fully removed from DB
        $this->entityManager->clear();
        $found = $this->entityManager->getRepository(Message::class)->find($messageId);
        $this->assertNull($found);
    }

    public function testRecipientCanRemoveSelfFromMessage(): void
    {
        $sender = $this->u1;
        $recipient1 = $this->u2;
        $recipient2 = $this->u3;
        $message = $this->createMessage($sender, [$recipient1, $recipient2], 'voter-test-Recipient removes self');
        $messageId = $message->getId();

        $this->client->loginUser($recipient1);
        $this->client->request('DELETE', '/api/messages/' . $messageId);

        $this->assertResponseIsSuccessful();

        // Message itself still exists
        $this->entityManager->clear();
        $found = $this->entityManager->getRepository(Message::class)->find($messageId);
        $this->assertNotNull($found);
    }

    /**
     * @param array<User> $recipients
     */
    private function createMessage(User $sender, array $recipients, string $subject): Message
    {
        return $this->createMessageWithContent($sender, $recipients, $subject, 'Test content');
    }

    /**
     * @param array<User> $recipients
     */
    private function createMessageWithContent(User $sender, array $recipients, string $subject, string $content): Message
    {
        $message = new Message();
        $message->setSender($sender);
        $message->setSubject($subject);
        $message->setContent($content);

        foreach ($recipients as $recipient) {
            $message->addRecipient($recipient);
        }

        $this->entityManager->persist($message);
        $this->entityManager->flush();

        return $message;
    }

    protected function tearDown(): void
    {
        $connection = $this->entityManager->getConnection();

        // Delete only test data with voter-test- prefix
        $connection->executeStatement('DELETE FROM message_recipients WHERE message_id IN (SELECT id FROM messages WHERE subject LIKE "voter-test-%")');
        $connection->executeStatement('DELETE FROM messages WHERE subject LIKE "voter-test-%"');

        $this->entityManager->close();

        parent::tearDown();
        restore_exception_handler();
    }
}
