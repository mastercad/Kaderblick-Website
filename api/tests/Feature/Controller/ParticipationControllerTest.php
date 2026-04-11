<?php

namespace App\Tests\Feature\Controller;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ParticipationControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;

    private User $user1;
    private User $user2;
    private CalendarEventType $eventType;
    private ParticipationStatus $statusYes;
    private ParticipationStatus $statusNo;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $container = static::getContainer();
        $this->entityManager = $container->get(EntityManagerInterface::class);
        $this->entityManager->getConnection()->beginTransaction();

        $this->user1 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->user1, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->user2 = $this->entityManager->getRepository(User::class)->findOneBy(['email' => 'user7@example.com']);
        self::assertNotNull($this->user2, 'Fixture-User user7@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->eventType = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Training']);
        self::assertNotNull($this->eventType, 'Fixture-CalendarEventType Training nicht gefunden. Bitte Fixtures laden.');

        $this->statusYes = $this->entityManager->getRepository(ParticipationStatus::class)->findOneBy(['code' => 'attending']);
        self::assertNotNull($this->statusYes, 'Fixture-ParticipationStatus attending nicht gefunden. Bitte Fixtures laden.');

        $this->statusNo = $this->entityManager->getRepository(ParticipationStatus::class)->findOneBy(['code' => 'not_attending']);
        self::assertNotNull($this->statusNo, 'Fixture-ParticipationStatus not_attending nicht gefunden. Bitte Fixtures laden.');
    }

    public function testGetEventParticipationsReturnsAllEventParticipationsForEligibleUser(): void
    {
        $user1 = $this->user1;
        $user2 = $this->user2;
        $event = $this->createEvent($this->eventType);
        $statusYes = $this->statusYes;
        $statusNo = $this->statusNo;

        // Both users participate in the same event
        $this->createParticipation($event, $user1, $statusYes);
        $this->createParticipation($event, $user2, $statusNo);

        // User1 views the event participations
        $this->client->loginUser($user1);
        $this->client->request('GET', '/api/participation/event/' . $event->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertCount(2, $data['participations']);

        $returnedUserIds = array_column($data['participations'], 'user_id');
        $this->assertContains($user1->getId(), $returnedUserIds);
        $this->assertContains($user2->getId(), $returnedUserIds);
    }

    private function createEvent(CalendarEventType $type): CalendarEvent
    {
        $event = new CalendarEvent();
        $event->setTitle('voter-test-event');
        $event->setCalendarEventType($type);
        $event->setStartDate(new DateTime());
        $event->setEndDate(new DateTime('+2 hours'));
        $this->entityManager->persist($event);
        $this->entityManager->flush();

        return $event;
    }

    private function createParticipation(CalendarEvent $event, User $user, ParticipationStatus $status): Participation
    {
        $participation = new Participation();
        $participation->setEvent($event);
        $participation->setUser($user);
        $participation->setStatus($status);
        $this->entityManager->persist($participation);
        $this->entityManager->flush();

        return $participation;
    }

    protected function tearDown(): void
    {
        if ($this->entityManager->getConnection()->isTransactionActive()) {
            $this->entityManager->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
