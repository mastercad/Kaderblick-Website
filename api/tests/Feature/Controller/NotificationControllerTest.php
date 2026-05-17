<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Notification;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class NotificationControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private User $u6;
    private User $u7;
    private User $u16;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $container = static::getContainer();
        $this->entityManager = $container->get(EntityManagerInterface::class);
        /** @var User $u6 */
        $u6 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($u6, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u6 = $u6;
        /** @var User $u7 */
        $u7 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user7@example.com']);
        $this->assertNotNull($u7, 'Fixture user user7@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u7 = $u7;
        /** @var User $u16 */
        $u16 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        $this->assertNotNull($u16, 'Fixture user user16@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->u16 = $u16;
    }

    public function testIndexOnlyReturnsOwnNotifications(): void
    {
        $user1 = $this->u6;
        $user2 = $this->u7;

        $this->createNotification($user1, 'voter-test-Notification for user1');
        $this->createNotification($user2, 'voter-test-Notification for user2');

        $this->client->loginUser($user1);
        $this->client->request('GET', '/api/notifications');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $messages = array_column($data['notifications'], 'message');
        $this->assertContains('voter-test-Notification for user1', $messages);
        $this->assertNotContains('voter-test-Notification for user2', $messages);
    }

    public function testMarkReadDeniesAccessToOtherUsersNotification(): void
    {
        $user1 = $this->u6;
        $user2 = $this->u7;
        $notification = $this->createNotification($user2, 'voter-test-For user2');

        $this->client->loginUser($user1);
        $this->client->request('POST', '/api/notifications/' . $notification->getId() . '/read');

        // Controller returns 404 because findOneBy filters by user, not 403
        $this->assertResponseStatusCodeSame(404);
    }

    public function testMarkReadAllowsAccessToOwnNotification(): void
    {
        $user = $this->u6;
        $notification = $this->createNotification($user, 'voter-test-My notification');

        $this->client->loginUser($user);
        $this->client->request('POST', '/api/notifications/' . $notification->getId() . '/read');

        $this->assertResponseIsSuccessful();
    }

    public function testAdminCannotMarkReadOtherUsersNotification(): void
    {
        $admin = $this->u16;
        $user = $this->u6;
        $notification = $this->createNotification($user, 'voter-test-User notification');

        $this->client->loginUser($admin);
        $this->client->request('POST', '/api/notifications/' . $notification->getId() . '/read');

        // Controller returns 404 because findOneBy filters by user
        // Even admins can only mark their own notifications as read
        $this->assertResponseStatusCodeSame(404);
    }

    private function createNotification(User $user, string $message): Notification
    {
        $notification = new Notification();
        $notification->setUser($user);
        $notification->setTitle('voter-test-notification');
        $notification->setMessage($message);
        $notification->setType('info');
        $notification->setIsRead(false);

        $this->entityManager->persist($notification);
        $this->entityManager->flush();

        return $notification;
    }

    protected function tearDown(): void
    {
        $connection = $this->entityManager->getConnection();
        $connection->executeStatement('DELETE FROM notifications WHERE message LIKE "voter-test-%"');
        $this->entityManager->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
