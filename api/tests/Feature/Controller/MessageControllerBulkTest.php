<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\Player;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature tests for bulk messaging via teamTargets / clubTargets.
 *
 * These tests verify that MessageController::create() correctly resolves
 * bulk targets through BulkRecipientResolverService and adds the resolved
 * users as message recipients.
 */
class MessageControllerBulkTest extends ApiWebTestCase
{
    private const PREFIX = 'msgbulk-test-';

    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $fixtureSuperAdmin;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->fixtureSuperAdmin = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->fixtureSuperAdmin, 'Fixture-User user21@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    // =========================================================================
    // Team targets
    // =========================================================================

    public function testSendToTeamAllRoleAddsPlayersAndCoaches(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Team All');

        $playerUser = $this->createUser(self::PREFIX . 'player-all@example.com');
        $coachUser = $this->createUser(self::PREFIX . 'coach-all@example.com');

        $this->addPlayerToTeam($playerUser, $team);
        $this->addCoachToTeam($coachUser, $team);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-all',
                'content' => 'Hallo Team',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'all']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserReceivedMessage($playerUser, self::PREFIX . 'send-all');
        $this->assertUserReceivedMessage($coachUser, self::PREFIX . 'send-all');
    }

    public function testSendToTeamPlayersRoleAddsOnlyPlayers(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Team Players');

        $playerUser = $this->createUser(self::PREFIX . 'player-pr@example.com');
        $coachUser = $this->createUser(self::PREFIX . 'coach-pr@example.com');

        $this->addPlayerToTeam($playerUser, $team);
        $this->addCoachToTeam($coachUser, $team);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-players',
                'content' => 'Nur Spieler',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'players']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserReceivedMessage($playerUser, self::PREFIX . 'send-players');
        $this->assertUserDidNotReceiveMessage($coachUser, self::PREFIX . 'send-players');
    }

    public function testSendToTeamCoachesRoleAddsOnlyCoaches(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Team Coaches');

        $playerUser = $this->createUser(self::PREFIX . 'player-cr@example.com');
        $coachUser = $this->createUser(self::PREFIX . 'coach-cr@example.com');

        $this->addPlayerToTeam($playerUser, $team);
        $this->addCoachToTeam($coachUser, $team);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-coaches',
                'content' => 'Nur Trainer',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'coaches']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserDidNotReceiveMessage($playerUser, self::PREFIX . 'send-coaches');
        $this->assertUserReceivedMessage($coachUser, self::PREFIX . 'send-coaches');
    }

    public function testSendToTeamExcludesUsersWithExpiredAssignment(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Team Expired');

        $expiredUser = $this->createUser(self::PREFIX . 'expired-player@example.com');
        $this->addPlayerToTeam($expiredUser, $team, new DateTime('-2 months'), new DateTime('-1 day'));

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-exp',
                'content' => 'Test',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'all']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserDidNotReceiveMessage($expiredUser, self::PREFIX . 'send-exp');
    }

    public function testSendToTeamExcludesDisabledUsers(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Team Disabled');

        $disabledUser = $this->createUser(self::PREFIX . 'disabled-player@example.com', enabled: false);
        $this->addPlayerToTeam($disabledUser, $team);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-disabled',
                'content' => 'Test',
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'all']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserDidNotReceiveMessage($disabledUser, self::PREFIX . 'send-disabled');
    }

    public function testSendToMultipleTeamsDeduplicatesRecipients(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team1 = $this->createTeam(self::PREFIX . 'Team Dedup 1');
        $team2 = $this->createTeam(self::PREFIX . 'Team Dedup 2');

        // Same player in both teams
        $sharedUser = $this->createUser(self::PREFIX . 'shared-player@example.com');
        $this->addPlayerToTeam($sharedUser, $team1);
        $this->addPlayerToTeam($sharedUser, $team2);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-dedup',
                'content' => 'Test',
                'teamTargets' => [
                    ['teamId' => $team1->getId(), 'role' => 'all'],
                    ['teamId' => $team2->getId(), 'role' => 'all'],
                ],
            ])
        );

        $this->assertResponseIsSuccessful();
        // User should be a recipient exactly once
        $this->assertUserReceivedMessageExactlyOnce($sharedUser, self::PREFIX . 'send-dedup');
    }

    // =========================================================================
    // Club targets
    // =========================================================================

    public function testSendToClubAllRoleAddsPlayersAndCoaches(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $club = $this->createClub(self::PREFIX . 'Club All');

        $playerUser = $this->createUser(self::PREFIX . 'club-player-all@example.com');
        $coachUser = $this->createUser(self::PREFIX . 'club-coach-all@example.com');

        $this->addPlayerToClub($playerUser, $club);
        $this->addCoachToClub($coachUser, $club);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-club-all',
                'content' => 'Hallo Verein',
                'clubTargets' => [['clubId' => $club->getId(), 'role' => 'all']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserReceivedMessage($playerUser, self::PREFIX . 'send-club-all');
        $this->assertUserReceivedMessage($coachUser, self::PREFIX . 'send-club-all');
    }

    public function testSendToClubPlayersRoleAddsOnlyPlayers(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $club = $this->createClub(self::PREFIX . 'Club Players');

        $playerUser = $this->createUser(self::PREFIX . 'club-player-pr@example.com');
        $coachUser = $this->createUser(self::PREFIX . 'club-coach-pr@example.com');

        $this->addPlayerToClub($playerUser, $club);
        $this->addCoachToClub($coachUser, $club);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-club-players',
                'content' => 'Nur Club-Spieler',
                'clubTargets' => [['clubId' => $club->getId(), 'role' => 'players']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserReceivedMessage($playerUser, self::PREFIX . 'send-club-players');
        $this->assertUserDidNotReceiveMessage($coachUser, self::PREFIX . 'send-club-players');
    }

    // =========================================================================
    // Combined team + direct recipients
    // =========================================================================

    public function testSendCombinesTeamTargetsWithDirectRecipients(): void
    {
        $sender = $this->fixtureSuperAdmin;
        $team = $this->createTeam(self::PREFIX . 'Combo Team');
        $teamPlayer = $this->createUser(self::PREFIX . 'combo-team-player@example.com');
        $directUser = $this->createUser(self::PREFIX . 'combo-direct@example.com');

        $this->addPlayerToTeam($teamPlayer, $team);

        $this->client->loginUser($sender);
        $this->client->request(
            'POST',
            '/api/messages',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'subject' => self::PREFIX . 'send-combo',
                'content' => 'Test',
                'recipientIds' => [$directUser->getId()],
                'teamTargets' => [['teamId' => $team->getId(), 'role' => 'players']],
            ])
        );

        $this->assertResponseIsSuccessful();
        $this->assertUserReceivedMessage($teamPlayer, self::PREFIX . 'send-combo');
        $this->assertUserReceivedMessage($directUser, self::PREFIX . 'send-combo');
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function createUser(
        string $email,
        bool $enabled = true,
        bool $verified = true,
    ): User {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('password');
        $user->setRoles(['ROLE_USER']);
        $user->setIsEnabled($enabled);
        $user->setIsVerified($verified);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    private function createTeam(string $name): Team
    {
        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        if (!$ageGroup) {
            throw new RuntimeException('No AgeGroup found in fixtures');
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

    private function addPlayerToTeam(
        User $user,
        Team $team,
        ?DateTime $start = null,
        ?DateTime $end = null,
    ): void {
        $relType = $this->getOrCreateRelationType('player');

        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        $player = new Player();
        $player->setFirstName($user->getFirstName() ?? 'P');
        $player->setLastName($user->getLastName() ?? 'X');
        if ($position) {
            $player->setMainPosition($position);
        }
        $this->em->persist($player);

        $pta = new PlayerTeamAssignment();
        $pta->setPlayer($player);
        $pta->setTeam($team);
        $pta->setStartDate($start ?? new DateTime('-1 month'));
        $pta->setEndDate($end);
        $this->em->persist($pta);
        $player->addPlayerTeamAssignment($pta);
        $team->addPlayerTeamAssignment($pta);

        $ur = new UserRelation();
        $ur->setUser($user);
        $ur->setPlayer($player);
        $ur->setRelationType($relType);
        $this->em->persist($ur);
        $user->addUserRelation($ur);
        $player->addUserRelation($ur);

        $this->em->flush();
    }

    private function addCoachToTeam(User $user, Team $team): void
    {
        $relType = $this->getOrCreateRelationType('coach');

        $coach = new Coach();
        $coach->setFirstName($user->getFirstName() ?? 'C');
        $coach->setLastName($user->getLastName() ?? 'X');
        $this->em->persist($coach);

        $cta = new CoachTeamAssignment();
        $cta->setCoach($coach);
        $cta->setTeam($team);
        $cta->setStartDate(new DateTime('-1 month'));
        $this->em->persist($cta);
        $coach->addCoachTeamAssignment($cta);
        $team->addCoachTeamAssignment($cta);

        $ur = new UserRelation();
        $ur->setUser($user);
        $ur->setCoach($coach);
        $ur->setRelationType($relType);
        $this->em->persist($ur);
        $user->addUserRelation($ur);
        $coach->addUserRelation($ur);

        $this->em->flush();
    }

    private function addPlayerToClub(User $user, Club $club): void
    {
        $relType = $this->getOrCreateRelationType('player');

        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        $player = new Player();
        $player->setFirstName($user->getFirstName() ?? 'P');
        $player->setLastName($user->getLastName() ?? 'X');
        if ($position) {
            $player->setMainPosition($position);
        }
        $this->em->persist($player);

        $pca = new PlayerClubAssignment();
        $pca->setPlayer($player);
        $pca->setClub($club);
        $pca->setStartDate(new DateTime('-1 month'));
        $this->em->persist($pca);
        $player->addPlayerClubAssignment($pca);
        $club->addPlayerClubAssignment($pca);

        $ur = new UserRelation();
        $ur->setUser($user);
        $ur->setPlayer($player);
        $ur->setRelationType($relType);
        $this->em->persist($ur);
        $user->addUserRelation($ur);
        $player->addUserRelation($ur);

        $this->em->flush();
    }

    private function addCoachToClub(User $user, Club $club): void
    {
        $relType = $this->getOrCreateRelationType('coach');

        $coach = new Coach();
        $coach->setFirstName($user->getFirstName() ?? 'C');
        $coach->setLastName($user->getLastName() ?? 'X');
        $this->em->persist($coach);

        $cca = new CoachClubAssignment();
        $cca->setCoach($coach);
        $cca->setClub($club);
        $cca->setStartDate(new DateTime('-1 month'));
        $this->em->persist($cca);
        $coach->addCoachClubAssignment($cca);
        $club->addCoachClubAssignment($cca);

        $ur = new UserRelation();
        $ur->setUser($user);
        $ur->setCoach($coach);
        $ur->setRelationType($relType);
        $this->em->persist($ur);
        $user->addUserRelation($ur);
        $coach->addUserRelation($ur);

        $this->em->flush();
    }

    private function getOrCreateRelationType(string $identifier): RelationType
    {
        $existing = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => $identifier]);
        if ($existing) {
            return $existing;
        }
        $rt = new RelationType();
        $rt->setIdentifier($identifier);
        $rt->setName(ucfirst($identifier));
        $rt->setCategory('direct');
        $this->em->persist($rt);
        $this->em->flush();

        return $rt;
    }

    private function assertUserReceivedMessage(User $user, string $subject): void
    {
        $count = (int) $this->em->createQuery(
            'SELECT COUNT(m.id) FROM App\Entity\Message m JOIN m.recipients r WHERE r.id = :userId AND m.subject = :subject'
        )->setParameters(['userId' => $user->getId(), 'subject' => $subject])
         ->getSingleScalarResult();

        $this->assertGreaterThan(0, $count, "User {$user->getEmail()} should have received the message '{$subject}'");
    }

    private function assertUserDidNotReceiveMessage(User $user, string $subject): void
    {
        $count = (int) $this->em->createQuery(
            'SELECT COUNT(m.id) FROM App\Entity\Message m JOIN m.recipients r WHERE r.id = :userId AND m.subject = :subject'
        )->setParameters(['userId' => $user->getId(), 'subject' => $subject])
         ->getSingleScalarResult();

        $this->assertSame(0, $count, "User {$user->getEmail()} should NOT have received the message '{$subject}'");
    }

    private function assertUserReceivedMessageExactlyOnce(User $user, string $subject): void
    {
        $count = (int) $this->em->createQuery(
            'SELECT COUNT(m.id) FROM App\Entity\Message m JOIN m.recipients r WHERE r.id = :userId AND m.subject = :subject'
        )->setParameters(['userId' => $user->getId(), 'subject' => $subject])
         ->getSingleScalarResult();

        $this->assertSame(1, $count, "User {$user->getEmail()} should have received the message '{$subject}' exactly once");
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
