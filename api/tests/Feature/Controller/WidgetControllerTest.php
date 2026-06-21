<?php

namespace App\Tests\Feature\Controller;

use App\Entity\DashboardWidget;
use App\Entity\ReportDefinition;
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

    public function testCreateReportWidgetPersistsReportRelation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $report = (new ReportDefinition())
            ->setUser($user)
            ->setName('Meine Auswertung');
        $this->entityManager->persist($report);
        $this->entityManager->flush();

        $this->client->loginUser($user);
        $this->client->jsonRequest('POST', '/api/widget', [
            'type' => 'report',
            'reportId' => $report->getId(),
        ]);

        $this->assertResponseIsSuccessful();
        $body = json_decode((string) $this->client->getResponse()->getContent(), true);
        $this->assertSame($report->getId(), $body['widget']['reportId']);
        $this->assertSame('Meine Auswertung', $body['widget']['name']);

        $widget = $this->entityManager->getRepository(DashboardWidget::class)->find($body['widget']['id']);
        self::assertNotNull($widget);
        $this->assertSame($report->getId(), $widget->getReportDefinition()?->getId());
        $this->assertSame($user->getId(), $widget->getUser()->getId());
    }

    public function testCreateReportWidgetRequiresReportId(): void
    {
        $user = $this->loadUser('user6@example.com');
        $this->client->loginUser($user);

        $this->client->jsonRequest('POST', '/api/widget', ['type' => 'report']);

        $this->assertResponseStatusCodeSame(400);
    }

    public function testCreateReportWidgetRejectsAnotherUsersPrivateReport(): void
    {
        $owner = $this->loadUser('user7@example.com');
        $requestingUser = $this->loadUser('user6@example.com');
        $report = (new ReportDefinition())
            ->setUser($owner)
            ->setName('Private Auswertung');
        $this->entityManager->persist($report);
        $this->entityManager->flush();

        $this->client->loginUser($requestingUser);
        $this->client->jsonRequest('POST', '/api/widget', [
            'type' => 'report',
            'reportId' => $report->getId(),
        ]);

        $this->assertResponseStatusCodeSame(403);
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
