<?php

namespace App\Tests\Feature\Controller;

use App\Entity\DashboardWidget;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class WidgetControllerTest extends WebTestCase
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

    public function testDeleteDeniesAccessToOtherUsersWidget(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $widget = $this->createWidget($user2, 'voter-test-calendar');

        $this->client->loginUser($user1);
        $this->client->request('DELETE', '/api/widget/' . $widget->getId());

        $this->assertResponseStatusCodeSame(403);
    }

    public function testDeleteAllowsAccessToOwnWidget(): void
    {
        $user = $this->loadUser('user6@example.com');
        $widget = $this->createWidget($user, 'voter-test-calendar');

        $this->client->loginUser($user);
        $this->client->request('DELETE', '/api/widget/' . $widget->getId());

        $this->assertResponseIsSuccessful();
    }

    private function loadUser(string $email): User
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found. Please load fixtures.', $email));

        return $user;
    }

    private function createWidget(User $user, string $type): DashboardWidget
    {
        $widget = new DashboardWidget();
        $widget->setUser($user);
        $widget->setType($type);
        $widget->setPosition(1);

        $this->entityManager->persist($widget);
        $this->entityManager->flush();

        return $widget;
    }

    protected function tearDown(): void
    {
        $this->entityManager->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }
}
