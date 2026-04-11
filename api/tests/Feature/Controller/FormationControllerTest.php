<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Formation;
use App\Entity\FormationType;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class FormationControllerTest extends WebTestCase
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

    public function testIndexOnlyReturnsOwnFormations(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();

        $this->createFormation($user1, $type, 'voter-test-Own Formation');
        $this->createFormation($user2, $type, 'voter-test-Other Formation');

        $this->client->loginUser($user1);
        $this->client->request('GET', '/formations');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $formationNames = array_column($data['formations'], 'name');
        $this->assertContains('voter-test-Own Formation', $formationNames);
        $this->assertNotContains('voter-test-Other Formation', $formationNames);
    }

    public function testEditDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Formation');

        $this->client->loginUser($user1);
        $this->client->request(
            'POST',
            '/formation/' . $otherFormation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Hacked', 'formationData' => []])
        );

        $this->assertResponseStatusCodeSame(403);
    }

    public function testEditAllowsAccessToOwnFormation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-My Formation');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/' . $formation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Updated', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
    }

    public function testDeleteDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Formation');

        $this->client->loginUser($user1);
        $this->client->request('DELETE', '/formation/' . $otherFormation->getId() . '/delete');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testDeleteAllowsAccessToOwnFormation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-My Formation');

        $this->client->loginUser($user);
        $this->client->request('DELETE', '/formation/' . $formation->getId() . '/delete');

        $this->assertResponseIsSuccessful();
    }

    public function testAdminCanAccessOtherUsersFormation(): void
    {
        $regularUser = $this->loadUser('user6@example.com');
        $admin = $this->loadUser('user16@example.com');
        $type = $this->getFormationType();
        $userFormation = $this->createFormation($regularUser, $type, 'voter-test-User Formation');

        $this->client->loginUser($admin);
        $this->client->request(
            'POST',
            '/formation/' . $userFormation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Admin Modified', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
    }

    private function loadUser(string $email): User
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found. Please load fixtures.', $email));

        return $user;
    }

    private function getFormationType(): FormationType
    {
        $type = $this->entityManager->getRepository(FormationType::class)->findOneBy(['name' => 'fußball']);
        self::assertNotNull($type, 'FormationType "fußball" not found. Please load master fixtures.');

        return $type;
    }

    private function createFormation(User $user, FormationType $type, string $name): Formation
    {
        $formation = new Formation();
        $formation->setUser($user);
        $formation->setFormationType($type);
        $formation->setName($name);
        $formation->setFormationData([]);

        $this->entityManager->persist($formation);
        $this->entityManager->flush();

        return $formation;
    }

    protected function tearDown(): void
    {
        $this->entityManager->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }
}
