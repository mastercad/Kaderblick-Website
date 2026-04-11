<?php

namespace App\Tests\Feature\Controller;

use App\Entity\MessageGroup;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for MessageGroupController:
 *   GET    /api/message-groups
 *   POST   /api/message-groups
 *   GET    /api/message-groups/{id}
 *   PUT    /api/message-groups/{id}
 *   DELETE /api/message-groups/{id}
 */
class MessageGroupControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();
    }

    // =========================================================================
    // GET /api/message-groups – index
    // =========================================================================

    public function testIndexRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/message-groups');
        $this->assertResponseStatusCodeSame(401);
    }

    public function testIndexReturnsOnlyOwnGroups(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $other = $this->loadUser('user7@example.com');
        $this->createGroup('Owners Group', $owner);
        $this->createGroup('Others Group', $other);

        $this->client->loginUser($owner);
        $this->client->request('GET', '/api/message-groups');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $names = array_column($data['groups'], 'name');
        $this->assertContains('Owners Group', $names);
        $this->assertNotContains('Others Group', $names);
    }

    public function testIndexGroupHasMemberCount(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $member = $this->loadUser('user7@example.com');
        $this->createGroup('Count Group', $owner, [$member]);

        $this->client->loginUser($owner);
        $this->client->request('GET', '/api/message-groups');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $groups = array_values(array_filter($data['groups'], fn ($g) => 'Count Group' === $g['name']));
        $this->assertNotEmpty($groups);
        $this->assertSame(1, $groups[0]['memberCount']);
    }

    // =========================================================================
    // POST /api/message-groups – create
    // =========================================================================

    public function testCreateRequiresAuthentication(): void
    {
        $this->client->request('POST', '/api/message-groups', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'name' => 'Test',
        ]));
        $this->assertResponseStatusCodeSame(401);
    }

    public function testCreateReturnsGroupWithIdAndMembers(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $member = $this->loadUser('user7@example.com');

        $this->client->loginUser($owner);
        $this->client->request(
            'POST',
            '/api/message-groups',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => 'New Group',
                'memberIds' => [$member->getId()],
            ])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('group', $data);
        $this->assertArrayHasKey('id', $data['group']);
        $this->assertSame('New Group', $data['group']['name']);
        $this->assertSame(1, $data['group']['memberCount']);
        $memberIds = array_column($data['group']['members'], 'id');
        $this->assertContains($member->getId(), $memberIds);
    }

    public function testCreateGroupWithNoMembers(): void
    {
        $owner = $this->loadUser('user6@example.com');

        $this->client->loginUser($owner);
        $this->client->request(
            'POST',
            '/api/message-groups',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'Empty Group'])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(0, $data['group']['memberCount']);
        $this->assertSame([], $data['group']['members']);
    }

    // =========================================================================
    // GET /api/message-groups/{id} – show
    // =========================================================================

    public function testShowRequiresAuthentication(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $group = $this->createGroup('Show Auth Group', $owner);

        $this->client->request('GET', '/api/message-groups/' . $group->getId());
        $this->assertResponseStatusCodeSame(401);
    }

    public function testShowReturnsForbiddenForNonOwner(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $outsider = $this->loadUser('user7@example.com');
        $group = $this->createGroup('Private Group', $owner);

        $this->client->loginUser($outsider);
        $this->client->request('GET', '/api/message-groups/' . $group->getId());

        $this->assertResponseStatusCodeSame(403);
    }

    public function testShowReturnsGroupWithMembers(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $member = $this->loadUser('user7@example.com');
        $group = $this->createGroup('Show Group', $owner, [$member]);

        $this->client->loginUser($owner);
        $this->client->request('GET', '/api/message-groups/' . $group->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('group', $data);
        $this->assertSame($group->getId(), $data['group']['id']);
        $this->assertSame('Show Group', $data['group']['name']);
        $this->assertSame(1, $data['group']['memberCount']);
        $this->assertCount(1, $data['group']['members']);

        $memberData = $data['group']['members'][0];
        $this->assertArrayHasKey('id', $memberData);
        $this->assertArrayHasKey('firstName', $memberData);
        $this->assertArrayHasKey('lastName', $memberData);
        $this->assertArrayHasKey('fullName', $memberData);
        $this->assertSame($member->getId(), $memberData['id']);
    }

    public function testShowGroupWithMultipleMembers(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $member1 = $this->loadUser('user7@example.com');
        $member2 = $this->loadUser('user8@example.com');
        $group = $this->createGroup('Multi Member Group', $owner, [$member1, $member2]);

        $this->client->loginUser($owner);
        $this->client->request('GET', '/api/message-groups/' . $group->getId());

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(2, $data['group']['memberCount']);
        $this->assertCount(2, $data['group']['members']);
    }

    // =========================================================================
    // PUT /api/message-groups/{id} – update
    // =========================================================================

    public function testUpdateRequiresAuthentication(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $group = $this->createGroup('Update Auth Group', $owner);

        $this->client->request('PUT', '/api/message-groups/' . $group->getId(), [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'name' => 'New Name',
        ]));
        $this->assertResponseStatusCodeSame(401);
    }

    public function testUpdateReturnsForbiddenForNonOwner(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $outsider = $this->loadUser('user7@example.com');
        $group = $this->createGroup('Update 403 Group', $owner);

        $this->client->loginUser($outsider);
        $this->client->request('PUT', '/api/message-groups/' . $group->getId(), [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
            'name' => 'Hacked Name',
        ]));

        $this->assertResponseStatusCodeSame(403);
    }

    public function testUpdateChangesNameAndReturnsUpdatedGroup(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $group = $this->createGroup('Old Name', $owner);
        $member = $this->loadUser('user7@example.com');

        $this->client->loginUser($owner);
        $this->client->request(
            'PUT',
            '/api/message-groups/' . $group->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => 'New Name',
                'memberIds' => [$member->getId()],
            ])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('New Name', $data['group']['name']);
        $this->assertSame(1, $data['group']['memberCount']);
        $memberIds = array_column($data['group']['members'], 'id');
        $this->assertContains($member->getId(), $memberIds);
    }

    public function testUpdateReplacesMembers(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $old = $this->loadUser('user7@example.com');
        $new = $this->loadUser('user8@example.com');
        $group = $this->createGroup('Replace Group', $owner, [$old]);

        $this->client->loginUser($owner);
        $this->client->request(
            'PUT',
            '/api/message-groups/' . $group->getId(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name' => 'Replace Group',
                'memberIds' => [$new->getId()],
            ])
        );

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $memberIds = array_column($data['group']['members'], 'id');
        $this->assertContains($new->getId(), $memberIds);
        $this->assertNotContains($old->getId(), $memberIds);
    }

    // =========================================================================
    // DELETE /api/message-groups/{id} – delete
    // =========================================================================

    public function testDeleteRequiresAuthentication(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $group = $this->createGroup('Del Auth Group', $owner);

        $this->client->request('DELETE', '/api/message-groups/' . $group->getId());
        $this->assertResponseStatusCodeSame(401);
    }

    public function testDeleteReturnsForbiddenForNonOwner(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $outsider = $this->loadUser('user7@example.com');
        $group = $this->createGroup('Del 403 Group', $owner);

        $this->client->loginUser($outsider);
        $this->client->request('DELETE', '/api/message-groups/' . $group->getId());

        $this->assertResponseStatusCodeSame(403);
    }

    public function testDeleteOwnerCanDeleteGroup(): void
    {
        $owner = $this->loadUser('user6@example.com');
        $group = $this->createGroup('Deletable Group', $owner);
        $id = $group->getId();

        $this->client->loginUser($owner);
        $this->client->request('DELETE', '/api/message-groups/' . $id);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('message', $data);

        // Confirm it's gone from the DB (no second HTTP request needed)
        $this->em->clear();
        $deletedGroup = $this->em->find(MessageGroup::class, $id);
        $this->assertNull($deletedGroup);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function loadUser(string $email): User
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found. Please load fixtures.', $email));

        return $user;
    }

    /** @param User[] $members */
    private function createGroup(string $name, User $owner, array $members = []): MessageGroup
    {
        $group = new MessageGroup();
        $group->setName($name);
        $group->setOwner($owner);
        foreach ($members as $member) {
            $group->addMember($member);
        }
        $this->em->persist($group);
        $this->em->flush();

        return $group;
    }

    protected function tearDown(): void
    {
        $this->em->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }
}
