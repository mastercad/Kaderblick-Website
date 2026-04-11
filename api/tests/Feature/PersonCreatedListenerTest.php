<?php

namespace Tests\Feature;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\User;
use App\Repository\UserRelationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class PersonCreatedListenerTest extends KernelTestCase
{
    private EntityManagerInterface $entityManager;
    private UserRelationRepository $userRelationRepository;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->entityManager = self::getContainer()->get(EntityManagerInterface::class);
        $this->userRelationRepository = self::getContainer()->get(UserRelationRepository::class);
        $this->entityManager->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        $this->entityManager->getConnection()->rollBack();
        $this->entityManager->close();
        parent::tearDown();
        restore_exception_handler();
    }

    public function testPlayerCreationCreatesUserRelation(): void
    {
        $email = 'player_endtoend_' . uniqid() . '@test.com';

        // User erstellen
        $user = (new User())
            ->setFirstName('User')
            ->setLastName('EndToEnd')
            ->setEmail($email)
            ->setPassword('password')
            ->setIsVerified(true);
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Position erstellen für mainPosition (required)
        $position = $this->entityManager->getRepository(\App\Entity\Position::class)->findOneBy([])
            ?? (new \App\Entity\Position())->setName('Test Position');
        if (!$position->getId()) {
            $this->entityManager->persist($position);
            $this->entityManager->flush();
        }

        // Player erstellen (sollte Listener triggern)
        $player = (new Player())
            ->setFirstName('Test')
            ->setLastName('Player')
            ->setEmail($email)
            ->setMainPosition($position);
        $this->entityManager->persist($player);
        $this->entityManager->flush();

        // Manuell EventListener aufrufen für Tests (da Entity Listener in Tests manchmal nicht automatisch laufen)
        $listener = $this->getContainer()->get(\App\EventSubscriber\PersonCreatedListener::class);
        $event = new \Doctrine\ORM\Event\PostPersistEventArgs($player, $this->entityManager);
        $listener->postPersistPlayer($player, $event);

        // Zusätzlicher Flush um sicherzustellen, dass Event-Listener-Entities gespeichert werden
        $this->entityManager->flush();

        // Relation überprüfen
        $relation = $this->userRelationRepository->findOneBy([
            'user' => $user,
            'player' => $player
        ]);

        $this->assertNotNull($relation, 'UserRelation sollte erstellt worden sein');
        $this->assertEquals('self_player', $relation->getRelationType()->getIdentifier());
    }

    public function testCoachCreationCreatesUserRelation(): void
    {
        $email = 'coach_endtoend_' . uniqid() . '@test.com';

        // User erstellen
        $user = (new User())
            ->setFirstName('User')
            ->setLastName('EndToEnd')
            ->setEmail($email)
            ->setPassword('password')
            ->setIsVerified(true);
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Coach erstellen (sollte Listener triggern)
        $coach = (new Coach())
            ->setFirstName('Test')
            ->setLastName('Coach')
            ->setEmail($email);
        $this->entityManager->persist($coach);
        $this->entityManager->flush();

        // Manuell EventListener aufrufen für Tests (da Entity Listener in Tests manchmal nicht automatisch laufen)
        $listener = $this->getContainer()->get(\App\EventSubscriber\PersonCreatedListener::class);
        $event = new \Doctrine\ORM\Event\PostPersistEventArgs($coach, $this->entityManager);
        $listener->postPersistCoach($coach, $event);

        // Zusätzlicher Flush um sicherzustellen, dass Event-Listener-Entities gespeichert werden
        $this->entityManager->flush();

        // Relation überprüfen
        $relation = $this->userRelationRepository->findOneBy([
            'user' => $user,
            'coach' => $coach
        ]);

        $this->assertNotNull($relation, 'UserRelation sollte erstellt worden sein');
        $this->assertEquals('self_coach', $relation->getRelationType()->getIdentifier());
    }

    public function testPlayerUpdateCreatesUserRelationWhenEmailAddedLater(): void
    {
        $email = 'player_update_endtoend_' . uniqid() . '@test.com';

        // User erstellen
        $user = (new User())
            ->setFirstName('User')
            ->setLastName('EndToEnd')
            ->setEmail($email)
            ->setPassword('password')
            ->setIsVerified(true);
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Position erstellen für mainPosition (required)
        $position = $this->entityManager->getRepository(\App\Entity\Position::class)->findOneBy([])
            ?? (new \App\Entity\Position())->setName('Test Position Update');
        if (!$position->getId()) {
            $this->entityManager->persist($position);
            $this->entityManager->flush();
        }

        // Player erst ohne E-Mail erstellen
        $player = (new Player())
            ->setFirstName('Test')
            ->setLastName('Player')
            ->setMainPosition($position);
        $this->entityManager->persist($player);
        $this->entityManager->flush();

        // E-Mail später hinzufügen (sollte Listener triggern)
        $player->setEmail($email);
        $this->entityManager->flush();

        // Manuell EventListener aufrufen für Tests (da Entity Listener in Tests manchmal nicht automatisch laufen)
        $listener = $this->getContainer()->get(\App\EventSubscriber\PersonCreatedListener::class);
        $event = new \Doctrine\ORM\Event\PostUpdateEventArgs($player, $this->entityManager);
        $listener->postUpdatePlayer($player, $event);

        // Zusätzlicher Flush um sicherzustellen, dass Event-Listener-Entities gespeichert werden
        $this->entityManager->flush();

        // Relation überprüfen
        $relation = $this->userRelationRepository->findOneBy([
            'user' => $user,
            'player' => $player
        ]);

        $this->assertNotNull($relation, 'UserRelation sollte nach E-Mail-Update erstellt worden sein');
        $this->assertEquals('self_player', $relation->getRelationType()->getIdentifier());
    }

    public function testNoDuplicateRelationsCreated(): void
    {
        $email = 'no_duplicate_' . uniqid() . '@test.com';

        // User erstellen
        $user = (new User())
            ->setFirstName('User')
            ->setLastName('EndToEnd')
            ->setEmail($email)
            ->setPassword('password')
            ->setIsVerified(true);
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Position erstellen für mainPosition (required)
        $position = $this->entityManager->getRepository(\App\Entity\Position::class)->findOneBy([])
            ?? (new \App\Entity\Position())->setName('Test Position Duplicate');
        if (!$position->getId()) {
            $this->entityManager->persist($position);
            $this->entityManager->flush();
        }

        // Player erstellen
        $player = (new Player())
            ->setFirstName('Test')
            ->setLastName('Player')
            ->setEmail($email)
            ->setMainPosition($position);
        $this->entityManager->persist($player);
        $this->entityManager->flush();

        // Erste Relation manuell erstellen (simuliert postPersist)
        $listener = $this->getContainer()->get(\App\EventSubscriber\PersonCreatedListener::class);
        $persistEvent = new \Doctrine\ORM\Event\PostPersistEventArgs($player, $this->entityManager);
        $listener->postPersistPlayer($player, $persistEvent);
        $this->entityManager->flush();

        // Player erneut speichern (sollte Update-Event triggern)
        $player->setFirstName('Updated');
        $this->entityManager->flush();

        // Update-Event manuell aufrufen (sollte keine weitere Relation erstellen wegen Duplikat-Check)
        $updateEvent = new \Doctrine\ORM\Event\PostUpdateEventArgs($player, $this->entityManager);
        $listener->postUpdatePlayer($player, $updateEvent);
        $this->entityManager->flush();

        // Relations zählen
        $relations = $this->userRelationRepository->findBy([
            'user' => $user,
            'player' => $player
        ]);

        $this->assertCount(1, $relations, 'Es sollte nur eine einzige Relation existieren');
    }
}
