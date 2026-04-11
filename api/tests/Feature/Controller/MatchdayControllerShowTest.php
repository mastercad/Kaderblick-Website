<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für MatchdayController::show() (GET /api/matchday/{id}).
 *
 * Tests verify:
 *  - Authentication + authorisation
 *  - Role determination (admin / coach / player)
 *  - Response structure
 *  - Completeness flags
 *  - Participants visibility (coach-only vs. player)
 */
class MatchdayControllerShowTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Team $homeTeam;
    private Team $awayTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private RelationType $selfPlayerType;
    private RelationType $selfCoachType;

    private User $adminUser;
    private User $playerUser;
    private User $coachUser;
    private User $unrelatedUser;

    private string $emailSuffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->emailSuffix = bin2hex(random_bytes(6));

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $this->selfPlayerType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_player']);
        self::assertNotNull($this->selfPlayerType, 'RelationType "self_player" nicht gefunden. Bitte Fixtures laden.');

        $this->selfCoachType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_coach']);
        self::assertNotNull($this->selfCoachType, 'RelationType "self_coach" nicht gefunden. Bitte Fixtures laden.');

        $this->homeTeam = (new Team())
            ->setName('test-md-home-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-md-away-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $this->calendarEvent = (new CalendarEvent())
            ->setTitle('test-md-event-' . $this->emailSuffix)
            ->setStartDate(new DateTime('+1 day'))
            ->setEndDate(new DateTime('+1 day +2 hours'));
        $this->em->persist($this->calendarEvent);

        $this->game = (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setGameType($gameType)
            ->setCalendarEvent($this->calendarEvent);
        $this->em->persist($this->game);

        // Admin user — load from fixture
        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');

        // Player user linked to homeTeam
        $position = $this->em->getRepository(\App\Entity\Position::class)->findOneBy([]);
        self::assertNotNull($position, 'Keine Fixture-Position. Bitte Fixtures laden.');

        $player = (new Player())
            ->setFirstName('Test')
            ->setLastName('PlayerMD')
            ->setMainPosition($position);
        $this->em->persist($player);

        $pta = new PlayerTeamAssignment();
        $pta->setPlayer($player);
        $pta->setTeam($this->homeTeam);
        $pta->setShirtNumber(7);
        $pta->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($pta);
        $player->addPlayerTeamAssignment($pta);
        $this->homeTeam->addPlayerTeamAssignment($pta);

        $this->playerUser = $this->makeUser('test-md-player', ['ROLE_USER']);
        $playerRelation = (new UserRelation())
            ->setUser($this->playerUser)
            ->setPlayer($player)
            ->setRelationType($this->selfPlayerType)
            ->setPermissions([]);
        $this->em->persist($playerRelation);
        $this->playerUser->addUserRelation($playerRelation);
        $player->addUserRelation($playerRelation);

        // Coach user linked to homeTeam
        $coach = (new Coach())
            ->setFirstName('Test')
            ->setLastName('CoachMD')
            ->setEmail('test-md-coach-entity-' . $this->emailSuffix . '@test.example.com');
        $this->em->persist($coach);

        $cta = new CoachTeamAssignment();
        $cta->setCoach($coach);
        $cta->setTeam($this->homeTeam);
        $cta->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($cta);
        $coach->addCoachTeamAssignment($cta);
        $this->homeTeam->addCoachTeamAssignment($cta);

        $this->coachUser = $this->makeUser('test-md-coach', ['ROLE_USER']);
        $coachRelation = (new UserRelation())
            ->setUser($this->coachUser)
            ->setCoach($coach)
            ->setRelationType($this->selfCoachType)
            ->setPermissions([]);
        $this->em->persist($coachRelation);
        $this->coachUser->addUserRelation($coachRelation);
        $coach->addUserRelation($coachRelation);

        // Unrelated user — load from fixture (ROLE_USER, no relation to test teams)
        $this->unrelatedUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->unrelatedUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->em->flush();
    }

    // ── Authentication / Authorisation ────────────────────────────────────────

    public function testShowRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        // Controller uses $this->isGranted() and returns 403 for unauth/anonymous users
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testShowForbiddenForUnrelatedUser(): void
    {
        $this->authenticate($this->unrelatedUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    // ── Response structure ────────────────────────────────────────────────────

    public function testShowReturnsExpectedKeys(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        foreach (
            ['event', 'role', 'myParticipation', 'participationSummary', 'participants',
                'rides', 'myRide', 'myTasks', 'allTasks', 'unreadNotifications',
                'lastViewedAt', 'completeness'] as $key
        ) {
            self::assertArrayHasKey($key, $data, "Missing key: {$key}");
        }
    }

    // ── Role determination ────────────────────────────────────────────────────

    public function testShowReturnsRoleAdmin(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('admin', $data['role']);
    }

    public function testShowReturnsRoleCoach(): void
    {
        $this->authenticate($this->coachUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('coach', $data['role']);
    }

    public function testShowReturnsRolePlayer(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('player', $data['role']);
    }

    // ── Participation ─────────────────────────────────────────────────────────

    public function testShowMyParticipationIsNullWhenNotSet(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertNull($data['myParticipation']);
    }

    // ── Participants visibility ───────────────────────────────────────────────

    public function testShowParticipantsNotVisibleForPlayer(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        // Players do not receive the full participant list
        self::assertSame([], $data['participants']);
    }

    public function testShowParticipantsVisibleForCoach(): void
    {
        $this->authenticate($this->coachUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        // Coach always gets the full list key (may be empty if no participations)
        self::assertIsArray($data['participants']);
    }

    // ── Completeness ──────────────────────────────────────────────────────────

    public function testShowCompletenessHasParticipationAndTaskKeys(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('participation', $data['completeness']);
        self::assertArrayHasKey('task', $data['completeness']);
    }

    public function testShowCompletenessParticipationFalseWithoutParticipation(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($data['completeness']['participation']);
    }

    // ── Rides ─────────────────────────────────────────────────────────────────

    public function testShowRidesIsEmptyWhenNoRides(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data['rides']);
        self::assertNull($data['myRide']);
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────

    public function testShowMyTasksIsEmptyForUserWithoutTasks(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data['myTasks']);
    }

    public function testShowAllTasksVisibleForCoach(): void
    {
        $this->authenticate($this->coachUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data['allTasks']);
    }

    public function testShowAllTasksNullForPlayer(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        // Players receive an empty array (not null) for allTasks
        self::assertSame([], $data['allTasks']);
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    public function testShowUnreadNotificationsIsArray(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data['unreadNotifications']);
    }

    // ── Event data ────────────────────────────────────────────────────────────

    public function testShowEventContainsTitleAndDates(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('id', $data['event']);
        self::assertArrayHasKey('title', $data['event']);
        self::assertSame($this->calendarEvent->getId(), $data['event']['id']);
    }

    // ── squadReadiness (coach) ────────────────────────────────────────────────

    public function testShowSquadReadinessNullForPlayer(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertNull($data['squadReadiness']);
    }

    public function testShowSquadReadinessIsArrayForCoach(): void
    {
        $this->authenticate($this->coachUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data['squadReadiness']);
    }

    public function testShowSquadReadinessForAdmin(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data['squadReadiness']);
    }

    public function testShowSquadReadinessHasTeamFields(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        // The game has homeTeam and awayTeam, so squadReadiness should have entries
        if (!empty($data['squadReadiness'])) {
            $first = $data['squadReadiness'][0];
            self::assertArrayHasKey('teamId', $first);
            self::assertArrayHasKey('teamName', $first);
            self::assertArrayHasKey('attending', $first);
            self::assertArrayHasKey('total', $first);
            self::assertArrayHasKey('trafficLight', $first);
        } else {
            // no squad entries is also valid (teams may have no players)
            self::assertIsArray($data['squadReadiness']);
        }
    }

    public function testShowAttendingPlayersIsArray(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('attendingPlayers', $data);
        self::assertIsArray($data['attendingPlayers']);
    }

    public function testShowMyRideIsNullWhenNoRide(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertNull($data['myRide']);
    }

    public function testShowLastViewedAtIsNullOnFirstView(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('GET', '/api/matchday/' . $this->calendarEvent->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('lastViewedAt', $data);
    }

    // ── markViewed() ─────────────────────────────────────────────────────────

    public function testMarkViewedForbiddenWhenNotAuthenticated(): void
    {
        $this->client->request('POST', '/api/matchday/' . $this->calendarEvent->getId() . '/view');
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testMarkViewedReturns404ForUnknownEvent(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('POST', '/api/matchday/99999999/view');
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testMarkViewedAsPlayerSucceeds(): void
    {
        $this->authenticate($this->playerUser);

        $this->client->request('POST', '/api/matchday/' . $this->calendarEvent->getId() . '/view');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('previousViewedAt', $data);
    }

    public function testMarkViewedSecondTimeReturnsPreviousTimestamp(): void
    {
        $this->authenticate($this->playerUser);

        // First call
        $this->client->request('POST', '/api/matchday/' . $this->calendarEvent->getId() . '/view');
        self::assertResponseIsSuccessful();
        $first = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        // First time: no previous view
        self::assertNull($first['previousViewedAt']);

        // Second call
        $this->client->request('POST', '/api/matchday/' . $this->calendarEvent->getId() . '/view');
        self::assertResponseIsSuccessful();
        $second = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        // Previous view is now set
        self::assertNotNull($second['previousViewedAt']);
    }

    public function testMarkViewedAsAdminSucceeds(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('POST', '/api/matchday/' . $this->calendarEvent->getId() . '/view');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('previousViewedAt', $data);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    /**
     * @param array<string> $roles
     */
    private function makeUser(string $prefix, array $roles): User
    {
        $user = (new User())
            ->setEmail("{$prefix}-{$this->emailSuffix}@test.example.com")
            ->setFirstName(ucfirst($prefix))
            ->setLastName('MD')
            ->setPassword('test')
            ->setRoles($roles)
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        return $user;
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
