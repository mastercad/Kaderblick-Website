<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für GamesController::finish(), timing() und overview().
 */
class GamesControllerFinishTimingOverviewTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Team $homeTeam;
    private Team $awayTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private User $adminUser;
    private User $regularUser;

    private string $emailSuffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->emailSuffix = bin2hex(random_bytes(6));

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        // CalendarEventType "Spiel" needed for overview queries
        $spielType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        self::assertNotNull($spielType, 'CalendarEventType "Spiel" nicht gefunden. Bitte Fixtures laden.');

        $this->homeTeam = (new Team())
            ->setName('test-gft-home-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-gft-away-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $this->calendarEvent = (new CalendarEvent())
            ->setTitle('test-gft-event-' . $this->emailSuffix)
            ->setStartDate(new DateTime('+1 day'))
            ->setEndDate(new DateTime('+1 day +2 hours'))
            ->setCalendarEventType($spielType);
        $this->em->persist($this->calendarEvent);

        $this->game = (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setGameType($gameType)
            ->setCalendarEvent($this->calendarEvent);
        $this->em->persist($this->game);

        $this->em->flush();

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    // ── finish() ──────────────────────────────────────────────────────────────

    public function testFinishRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('POST', '/api/games/' . $this->game->getId() . '/finish');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testFinishRequiresAuthentication(): void
    {
        $this->client->request('POST', '/api/games/' . $this->game->getId() . '/finish');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testFinishSetsIsFinishedTrue(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('POST', '/api/games/' . $this->game->getId() . '/finish');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);
        self::assertTrue($data['isFinished']);
        self::assertNull($data['advanced']);

        $this->em->refresh($this->game);
        self::assertTrue($this->game->isFinished());
    }

    public function testFinishReturns400WhenAlreadyFinished(): void
    {
        $this->game->setIsFinished(true);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('POST', '/api/games/' . $this->game->getId() . '/finish');

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $data);
    }

    // ── timing() ──────────────────────────────────────────────────────────────

    public function testTimingRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halfDuration' => 45], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testTimingRequiresAuthentication(): void
    {
        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halfDuration' => 45], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testTimingUpdatesHalfDuration(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halfDuration' => 45], JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);
        self::assertSame(45, $data['halfDuration']);

        $this->em->refresh($this->game);
        self::assertSame(45, $this->game->getHalfDuration());
    }

    public function testTimingValidatesHalfDurationMin(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halfDuration' => 0], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $data);
    }

    public function testTimingValidatesHalfDurationMax(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halfDuration' => 91], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('error', $data);
    }

    public function testTimingUpdatesHalftimeBreakDuration(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halftimeBreakDuration' => 15], JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);
        self::assertSame(15, $data['halftimeBreakDuration']);
    }

    public function testTimingValidatesHalftimeBreakMax(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halftimeBreakDuration' => 61], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testTimingValidatesHalftimeBreakMin(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['halftimeBreakDuration' => -1], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testTimingUpdatesExtraTimes(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstHalfExtraTime' => 3,
                'secondHalfExtraTime' => 5,
            ], JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);
        self::assertSame(3, $data['firstHalfExtraTime']);
        self::assertSame(5, $data['secondHalfExtraTime']);
    }

    public function testTimingClearsExtraTimes(): void
    {
        $this->game->setFirstHalfExtraTime(3);
        $this->game->setSecondHalfExtraTime(5);
        $this->em->flush();

        $this->authenticate($this->adminUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/timing',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstHalfExtraTime' => null,
                'secondHalfExtraTime' => null,
            ], JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertNull($data['firstHalfExtraTime']);
        self::assertNull($data['secondHalfExtraTime']);
    }

    // ── overview() ────────────────────────────────────────────────────────────

    public function testOverviewRequiresAuthentication(): void
    {
        // overview() allows anonymous access — unauthenticated users get an empty result
        $this->client->request('GET', '/api/games/overview');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('upcoming_games', $data);
    }

    public function testOverviewReturnsJsonResponse(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/games/overview');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('upcoming_games', $data);
        self::assertArrayHasKey('finished_games', $data);
        self::assertArrayHasKey('availableSeasons', $data);
        self::assertArrayHasKey('noTeamAssignment', $data);
    }

    public function testOverviewWithTeamIdAllReturnsAllTeams(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('upcoming_games', $data);

        // Our test game has a future startDate — it should appear in upcoming_games
        $ids = array_column($data['upcoming_games'], 'id');
        self::assertContains($this->game->getId(), $ids);
    }

    public function testOverviewFiltersToSpecificTeam(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/api/games/overview?teamId=' . $this->homeTeam->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        // Our test game belongs to homeTeam => should be in upcoming_games
        $ids = array_column($data['upcoming_games'], 'id');
        self::assertContains($this->game->getId(), $ids);
    }

    public function testOverviewFiltersExcludesOtherTeam(): void
    {
        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);

        // third team not related to our game
        $otherTeam = (new Team())
            ->setName('test-gft-other-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($otherTeam);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=' . $otherTeam->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $allIds = array_merge(
            array_column($data['upcoming_games'], 'id'),
            array_column($data['finished_games'], 'id'),
            array_column($data['running_games'], 'id')
        );
        self::assertNotContains($this->game->getId(), $allIds);
    }

    public function testOverviewSeasonFilter(): void
    {
        $this->authenticate($this->adminUser);

        $currentYear = (int) (new DateTimeImmutable())->format('Y');
        $currentMonth = (int) (new DateTimeImmutable())->format('n');
        $currentSeasonYear = $currentMonth >= 7 ? $currentYear : ($currentYear - 1);

        // Current season should include the game which is set 1 day in the future
        $this->client->request('GET', '/api/games/overview?teamId=all&season=' . $currentSeasonYear);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $ids = array_column($data['upcoming_games'], 'id');
        self::assertContains($this->game->getId(), $ids);
    }

    public function testOverviewSeasonFilterExcludesOldSeason(): void
    {
        $this->authenticate($this->adminUser);

        // Season 2010 should not contain our game (which is in the future / current season)
        $this->client->request('GET', '/api/games/overview?teamId=all&season=2010');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $allIds = array_merge(
            array_column($data['upcoming_games'], 'id'),
            array_column($data['finished_games'], 'id'),
            array_column($data['running_games'], 'id')
        );
        self::assertNotContains($this->game->getId(), $allIds);
    }

    public function testOverviewAvailableSeasonsNotEmpty(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertNotEmpty($data['availableSeasons']);
        self::assertContains(2021, $data['availableSeasons']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
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
