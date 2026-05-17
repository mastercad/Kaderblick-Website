<?php

namespace App\Tests\Feature\Controller;

use App\Entity\CalendarEventType;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class CalendarEventTypesControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private User $user;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $container = static::getContainer();
        $this->entityManager = $container->get(EntityManagerInterface::class);
        /** @var User $user */
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($user, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->user = $user;
    }

    public function testListReturnsAllEventTypesForAuthenticatedUser(): void
    {
        $this->createEventType('voter-test-Training');
        $this->createEventType('voter-test-Match');

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/calendar-event-types');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('entries', $data);
        $this->assertGreaterThanOrEqual(2, count($data['entries']));
    }

    private function createEventType(string $name): CalendarEventType
    {
        $eventType = new CalendarEventType();
        $eventType->setName($name);
        $eventType->setColor('#000000');

        $this->entityManager->persist($eventType);
        $this->entityManager->flush();

        return $eventType;
    }

    protected function tearDown(): void
    {
        $connection = $this->entityManager->getConnection();

        // Delete only test data with voter-test- prefix
        $connection->executeStatement('DELETE FROM calendar_event_types WHERE name LIKE "voter-test-%"');

        $this->entityManager->close();

        parent::tearDown();
        restore_exception_handler();
    }
}
