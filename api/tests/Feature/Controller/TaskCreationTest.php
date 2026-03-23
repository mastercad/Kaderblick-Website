<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\CalendarEvent;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DomCrawler\Crawler;
use Tests\Feature\ApiWebTestCase;

final class TaskCreationTest extends ApiWebTestCase
{
    public function testCreateTaskForGuestFails(): void
    {
        $client = static::createClient();
        $container = static::getContainer();
        $this->authenticateUser($client, 'user4@example.com'); // ROLE_USER
        $entityManager = $container->get('doctrine')->getManager();
        $user = $entityManager->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'user4@example.com']);
        self::assertNotNull($user);

        $initialCalendarEvents = $this->loadCalendarEvents($entityManager);
        $initialTasks = $this->loadTasks($entityManager);
        $initialTaskAssignments = $this->loadTaskAssignments($entityManager);

        /** @var Crawler $response */
        $response = $client->request('POST', '/api/tasks', [], [], [], json_encode([
            'title' => 'Einzelaufgabe',
            'description' => 'Dies ist eine Einzelaufgabe für einen Benutzer ohne Beziehungen',
            'assignedDate' => '2026-07-10',
            'isRecurring' => false,
            'recurrenceMode' => 'classic',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $jsonContent = $client->getResponse()->getContent();
        $data = json_decode($jsonContent, true, 512, JSON_THROW_ON_ERROR);

        self::assertResponseStatusCodeSame(403);

        $currentCalendarEvents = $this->loadCalendarEvents($entityManager);
        $currentTasks = $this->loadTasks($entityManager);
        $currentTaskAssignments = $this->loadTaskAssignments($entityManager);

        self::assertEquals($currentCalendarEvents, $initialCalendarEvents, 'CalendarEvents should not changed');
        self::assertEquals($currentTasks, $initialTasks, 'Tasks should not changed');
        self::assertEquals($currentTaskAssignments, $initialTaskAssignments, 'TaskAssignments should not changed');
    }

    public function testCreateTaskForUserWithNoRelationsSuccessfully(): void
    {
        $client = static::createClient();
        $container = static::getContainer();
        $this->authenticateUser($client, 'user10@example.com');
        $entityManager = $container->get('doctrine')->getManager();
        $user = $entityManager->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'user10@example.com']);
        self::assertNotNull($user);

        $initialCalendarEvents = $this->loadCalendarEvents($entityManager);
        $initialTasks = $this->loadTasks($entityManager);
        $initialTaskAssignments = $this->loadTaskAssignments($entityManager);

        $client->request('POST', '/api/tasks', [], [], [], json_encode([
            'title' => 'Einzelaufgabe',
            'description' => 'Dies ist eine Einzelaufgabe für einen Benutzer ohne Beziehungen',
            'assignedDate' => '2026-07-10',
            'isRecurring' => false,
            'recurrenceMode' => 'classic',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        self::assertResponseStatusCodeSame(201);
        self::assertResponseHeaderSame('content-type', 'application/json');

        $jsonContent = $client->getResponse()->getContent();
        $data = json_decode($jsonContent, true);

        self::assertArrayHasKey('id', $data);
        self::assertEquals('Einzelaufgabe', $data['title']);
        self::assertEquals('Dies ist eine Einzelaufgabe für einen Benutzer ohne Beziehungen', $data['description']);
        self::assertEquals(false, $data['isRecurring']);
        self::assertNull($data['recurrenceRule']);
        self::assertEquals(1, $data['rotationCount']);
        self::assertEquals('2026-07-10', $data['assignedDate']);

        $currentCalendarEvents = $this->loadCalendarEvents($entityManager);
        $currentTasks = $this->loadTasks($entityManager);
        $currentTaskAssignments = $this->loadTaskAssignments($entityManager);

        self::assertCount(count($initialCalendarEvents) + 1, $currentCalendarEvents, 'A single calendar event should be created for one-off tasks');
        self::assertCount(count($initialTasks) + 1, $currentTasks, 'One Task should be created');
        self::assertCount(count($initialTaskAssignments) + 1, $currentTaskAssignments, 'One assignment should be created for the one-off task');
    }

    public function testCreateTaskWithoutAssignedDateReturnsBadRequest(): void
    {
        $client = static::createClient();
        $container = static::getContainer();
        $this->authenticateUser($client, 'user10@example.com');
        $entityManager = $container->get('doctrine')->getManager();
        $user = $entityManager->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'user10@example.com']);
        self::assertNotNull($user);

        $client->request('POST', '/api/tasks', [], [], [], json_encode([
            'title' => 'Einzelaufgabe ohne Startdatum',
            'isRecurring' => false,
            'recurrenceMode' => 'classic',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        self::assertResponseStatusCodeSame(400);
        self::assertStringContainsString('Startdatum', (string) $client->getResponse()->getContent());
    }

    /**
     * @return CalendarEvent[]
     */
    private function loadCalendarEvents(EntityManagerInterface $entityManager): array
    {
        $currentCalendarEvents = $entityManager->getRepository(CalendarEvent::class)->findAll();

        return $currentCalendarEvents;
    }

    /**
     * @return Task[]
     */
    private function loadTasks(EntityManagerInterface $entityManager): array
    {
        $currentTasks = $entityManager->getRepository(Task::class)->findAll();

        return $currentTasks;
    }

    /**
     * @return TaskAssignment[]
     */
    private function loadTaskAssignments(EntityManagerInterface $entityManager): array
    {
        $currentTaskAssignments = $entityManager->getRepository(TaskAssignment::class)->findAll();

        return $currentTaskAssignments;
    }
}
