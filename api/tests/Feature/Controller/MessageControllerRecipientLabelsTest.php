<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\Club;
use App\Entity\Message;
use App\Entity\MessageGroup;
use App\Entity\Team;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for the `recipientLabels` field returned by
 * MessageController::show() and MessageController::outbox().
 *
 * Covers:
 * - Team target → {type:'team', label: team name, detail: role label}
 * - Club target → {type:'club', label: club name, detail: role label}
 * - Direct recipient → {type:'user', label: full name}
 * - Old messages without stored context → recipientLabels === null
 * - outbox() includes recipientLabels
 * - Group members appear as type:'user' entries (not type:'group')
 * - Deduplication: user in group + direct recipient appears only once
 */
class MessageControllerRecipientLabelsTest extends ApiWebTestCase
{
    private const PREFIX = 'rl-test-';

    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $sender;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->sender = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->sender, 'Fixture-User user21@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    // =========================================================================
    // show() – team targets
    // =========================================================================

    public function testShowReturnsTeamLabelWithAllMembersDetail(): void
    {
        $sender = $this->sender;
        $team = $this->createTeam(self::PREFIX . 'Show Team');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-team-msg',
                'content' => 'Test',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'all']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-team-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertCount(1, $labels);
        $this->assertSame('team', $labels[0]['type']);
        $this->assertSame($team->getName(), $labels[0]['label']);
        $this->assertSame('Alle Mitglieder', $labels[0]['detail']);
    }

    public function testShowReturnsTeamLabelWithPlayersOnlyDetail(): void
    {
        $sender = $this->sender;
        $team = $this->createTeam(self::PREFIX . 'Show Team Role');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-team-role-msg',
                'content' => 'Test',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'players']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-team-role-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertCount(1, $labels);
        $this->assertSame('team', $labels[0]['type']);
        $this->assertSame('Nur Spieler', $labels[0]['detail']);
    }

    public function testShowReturnsTeamLabelWithCoachesOnlyDetail(): void
    {
        $sender = $this->sender;
        $team = $this->createTeam(self::PREFIX . 'Show Team Coaches');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-team-coaches-msg',
                'content' => 'Test',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'coaches']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-team-coaches-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertSame('Nur Trainer', $labels[0]['detail']);
    }

    // =========================================================================
    // show() – club targets
    // =========================================================================

    public function testShowReturnsClubLabelWithCoachesOnlyDetail(): void
    {
        $sender = $this->sender;
        $club = $this->createClub(self::PREFIX . 'Show Club');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-club-msg',
                'content' => 'Test',
                'clubTargets' => [['clubId' => $club->getId(), 'role' => 'coaches']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-club-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertCount(1, $labels);
        $this->assertSame('club', $labels[0]['type']);
        $this->assertSame($club->getName(), $labels[0]['label']);
        $this->assertSame('Nur Trainer', $labels[0]['detail']);
    }

    public function testShowReturnsClubLabelWithAllMembersDetail(): void
    {
        $sender = $this->sender;
        $club = $this->createClub(self::PREFIX . 'Show Club All');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-club-all-msg',
                'content' => 'Test',
                'clubTargets' => [['clubId' => $club->getId(), 'role' => 'all']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-club-all-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertSame('Alle Mitglieder', $labels[0]['detail']);
    }

    // =========================================================================
    // show() – direct recipients
    // =========================================================================

    public function testShowReturnsUserLabelForDirectRecipient(): void
    {
        $sender = $this->sender;
        $recipient = $this->createUser(self::PREFIX . 'show-user-recip@example.com', 'Anna', 'Tester');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'show-user-msg',
                'content' => 'Test',
                'recipientIds' => [$recipient->getId()],
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'show-user-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertCount(1, $labels);
        $this->assertSame('user', $labels[0]['type']);
        $this->assertSame($recipient->getFirstName() . ' ' . $recipient->getLastName(), $labels[0]['label']);
    }

    // =========================================================================
    // show() – backwards compatibility: null for old messages
    // =========================================================================

    public function testShowReturnsNullRecipientLabelsForOldMessagesWithoutContext(): void
    {
        $sender = $this->sender;
        $recip = $this->createUser(self::PREFIX . 'show-null-recip@example.com');

        // Simulate an old message created via ORM without any context fields
        $message = new Message();
        $message->setSender($sender);
        $message->setSubject(self::PREFIX . 'show-null-msg');
        $message->setContent('Old message without context');
        $message->addRecipient($recip);
        // Intentionally: NO setTeamTargets / setClubTargets / setGroup / setDirectRecipientIds
        $this->em->persist($message);
        $this->em->flush();

        $this->login($sender);
        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('recipientLabels', $data);
        $this->assertNull($data['recipientLabels']);
    }

    // =========================================================================
    // outbox() – recipientLabels present
    // =========================================================================

    public function testOutboxIncludesRecipientLabelsForSentMessages(): void
    {
        $sender = $this->sender;
        $club = $this->createClub(self::PREFIX . 'Outbox Club');

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'outbox-msg',
                'content' => 'Test',
                'clubTargets' => [['clubId' => $club->getId(), 'role' => 'all']],
            ])
        );
        $this->assertResponseIsSuccessful();

        $this->client->request('GET', '/api/messages/outbox');
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);

        $sent = null;
        foreach ($data['messages'] as $m) {
            if ($m['subject'] === self::PREFIX . 'outbox-msg') {
                $sent = $m;
                break;
            }
        }
        $this->assertNotNull($sent, 'Sent message not found in outbox');
        $this->assertArrayHasKey('recipientLabels', $sent);
        $this->assertIsArray($sent['recipientLabels']);
        $this->assertCount(1, $sent['recipientLabels']);
        $this->assertSame('club', $sent['recipientLabels'][0]['type']);
        $this->assertSame($club->getName(), $sent['recipientLabels'][0]['label']);
        $this->assertSame('Alle Mitglieder', $sent['recipientLabels'][0]['detail']);
    }

    // =========================================================================
    // Group members appear as type:'user' entries (not type:'group')
    // =========================================================================

    public function testGroupMembersAppearAsUserTypeLabels(): void
    {
        $sender = $this->sender;
        $member1 = $this->createUser(self::PREFIX . 'grp-member1@example.com', 'Karl', 'Eins');
        $member2 = $this->createUser(self::PREFIX . 'grp-member2@example.com', 'Lisa', 'Zwei');

        $group = new MessageGroup();
        $group->setName(self::PREFIX . 'Private Group');
        $group->setOwner($sender);
        $group->addMember($member1);
        $group->addMember($member2);
        $this->em->persist($group);
        $this->em->flush();

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'grp-msg',
                'content' => 'Test',
                'groupId' => $group->getId(),
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'grp-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $this->assertCount(2, $labels);

        // All labels must be type:'user' – not type:'group'
        foreach ($labels as $label) {
            $this->assertSame('user', $label['type']);
        }

        // Member names must appear; the private group name must NOT appear
        $names = array_column($labels, 'label');
        $this->assertContains($member1->getFirstName() . ' ' . $member1->getLastName(), $names);
        $this->assertContains($member2->getFirstName() . ' ' . $member2->getLastName(), $names);
        $this->assertNotContains(self::PREFIX . 'Private Group', $names);
    }

    // =========================================================================
    // Deduplication
    // =========================================================================

    public function testGroupMemberListedAsDirectRecipientAppearsOnlyOnce(): void
    {
        $sender = $this->sender;
        $shared = $this->createUser(self::PREFIX . 'dedup-shared@example.com', 'Shared', 'User');

        $group = new MessageGroup();
        $group->setName(self::PREFIX . 'Dedup Group');
        $group->setOwner($sender);
        $group->addMember($shared);
        $this->em->persist($group);
        $this->em->flush();

        $this->login($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'dedup-msg',
                'content' => 'Test',
                'groupId' => $group->getId(),
                'recipientIds' => [$shared->getId()], // same user also as explicit direct recipient
            ])
        );
        $this->assertResponseIsSuccessful();

        $message = $this->findMessageBySubject(self::PREFIX . 'dedup-msg');

        $this->client->request('GET', '/api/messages/' . $message->getId());
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $labels = $data['recipientLabels'];

        $this->assertIsArray($labels);
        $sharedName = $shared->getFirstName() . ' ' . $shared->getLastName();
        $labelsForShared = array_filter($labels, fn ($l) => $l['label'] === $sharedName);
        $this->assertCount(
            1,
            $labelsForShared,
            "User '{$sharedName}' should appear exactly once in recipientLabels, even when both in group and direct recipients"
        );
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function createUser(
        string $email,
        string $firstName = 'Test',
        string $lastName = 'User',
    ): User {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName($firstName);
        $user->setLastName($lastName);
        $user->setPassword('password');
        $user->setRoles(['ROLE_USER']);
        $user->setIsEnabled(true);
        $user->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    private function createTeam(string $name): Team
    {
        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        if (!$ageGroup) {
            throw new RuntimeException('No AgeGroup found in fixtures. Run: bin/console doctrine:fixtures:load --group=master');
        }
        $team = new Team();
        $team->setName($name);
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);
        $this->em->flush();

        return $team;
    }

    private function createClub(string $name): Club
    {
        $club = new Club();
        $club->setName($name);
        $this->em->persist($club);
        $this->em->flush();

        return $club;
    }

    private function login(User $user): void
    {
        /** @var JWTTokenManagerInterface $jwtManager */
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function findMessageBySubject(string $subject): Message
    {
        $this->em->clear();
        $message = $this->em->getRepository(Message::class)->findOneBy(['subject' => $subject]);
        $this->assertNotNull($message, "Message with subject '{$subject}' not found in database after POST request.");

        return $message;
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
    }
}
