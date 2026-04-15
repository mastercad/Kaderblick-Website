<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Club;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\Position;
use App\Entity\Team;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for ClubSeasonController GET /api/club/season-overview.
 */
class ClubSeasonControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $adminUser;
    private User $regularUser;

    private AgeGroup $ageGroup;
    private GameType $gameType;
    private CalendarEventType $spielType;
    private ?Position $playerPosition = null;

    private string $suffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->suffix = bin2hex(random_bytes(6));

        $this->ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($this->ageGroup, 'Keine Fixture-AgeGroup gefunden. Bitte Fixtures laden.');

        $this->gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($this->gameType, 'Kein Fixture-GameType gefunden. Bitte Fixtures laden.');

        $this->spielType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        self::assertNotNull($this->spielType, 'CalendarEventType "Spiel" nicht gefunden. Bitte Fixtures laden.');

        $this->playerPosition = $this->em->getRepository(Position::class)->findOneBy([]);

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── Authentication ─────────────────────────────────────────────────────────

    public function testSeasonOverviewReturns403WhenNotAuthenticated(): void
    {
        $this->client->request('GET', '/api/club/season-overview');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ── No-club response ───────────────────────────────────────────────────────

    public function testSeasonOverviewReturnsNullClubWhenNoClubLinked(): void
    {
        // adminUser has no explicit club set up in this test scope, and no clubId param given
        // The response must still be 200 with club: null
        $this->authenticate($this->adminUser);

        // Pass an unknown clubId to guarantee no club is resolved
        $this->client->request('GET', '/api/club/season-overview?clubId=99999999');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNull($data['club']);
        self::assertIsArray($data['teams']);
        self::assertEmpty($data['teams']);
        self::assertIsArray($data['topScorers']);
        self::assertEmpty($data['topScorers']);
    }

    // ── Top-level structure ────────────────────────────────────────────────────

    public function testSeasonOverviewResponseHasExpectedTopLevelKeys(): void
    {
        $club = $this->createClubWithTeam('test-season-keys');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('club', $data);
        self::assertArrayHasKey('season', $data);
        self::assertArrayHasKey('seasonYear', $data);
        self::assertArrayHasKey('availableSeasons', $data);
        self::assertArrayHasKey('teams', $data);
        self::assertArrayHasKey('topScorers', $data);
    }

    public function testSeasonOverviewClubDataContainsExpectedFields(): void
    {
        $club = $this->createClubWithTeam('test-season-club-fields');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotNull($data['club']);
        self::assertArrayHasKey('id', $data['club']);
        self::assertArrayHasKey('name', $data['club']);
        self::assertArrayHasKey('shortName', $data['club']);
        self::assertArrayHasKey('logoUrl', $data['club']);
        self::assertSame($club->getId(), $data['club']['id']);
        self::assertSame('TestClub-' . $this->suffix, $data['club']['name']);
    }

    // ── Season year resolution ─────────────────────────────────────────────────

    public function testSeasonOverviewUsesRequestedSeasonYear(): void
    {
        $club = $this->createClubWithTeam('test-season-year');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId() . '&season=2022');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(2022, $data['seasonYear']);
        self::assertSame('2022/2023', $data['season']);
    }

    public function testSeasonOverviewAvailableSeasonsIsNonEmptyArray(): void
    {
        $club = $this->createClubWithTeam('test-avail-seasons');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertIsArray($data['availableSeasons']);
        self::assertNotEmpty($data['availableSeasons']);
        foreach ($data['availableSeasons'] as $year) {
            self::assertIsInt($year);
        }
    }

    // ── Team stats and form ────────────────────────────────────────────────────

    public function testSeasonOverviewTeamHasExpectedStatsFields(): void
    {
        $club = $this->createClubWithTeam('test-team-stats');
        $team = $club->getTeams()->first();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['teams']);
        $teamData = $data['teams'][0];

        self::assertSame($team->getId(), $teamData['id']);
        self::assertArrayHasKey('stats', $teamData);
        self::assertArrayHasKey('form', $teamData);

        $stats = $teamData['stats'];
        self::assertArrayHasKey('played', $stats);
        self::assertArrayHasKey('won', $stats);
        self::assertArrayHasKey('drawn', $stats);
        self::assertArrayHasKey('lost', $stats);
        self::assertArrayHasKey('goalsFor', $stats);
        self::assertArrayHasKey('goalsAgainst', $stats);
        self::assertArrayHasKey('goalDifference', $stats);
        self::assertArrayHasKey('points', $stats);
    }

    public function testSeasonOverviewFormStreakIsCalculatedCorrectly(): void
    {
        $club = $this->createClubWithTeam('test-form-streak');
        /** @var Team $homeTeam */
        $homeTeam = $club->getTeams()->first();
        $opponentTeam = $this->createTeam('test-form-opponent');

        $season = (int) (new DateTime())->format('m') >= 7
            ? (int) (new DateTime())->format('Y')
            : (int) (new DateTime())->format('Y') - 1;

        // Create 3 finished games: W, D, L
        $this->createFinishedGame($homeTeam, $opponentTeam, $homeTeam, 2, 0, $season); // W
        $this->createFinishedGame($homeTeam, $opponentTeam, $homeTeam, 1, 1, $season); // D
        $this->createFinishedGame($opponentTeam, $homeTeam, $opponentTeam, 3, 0, $season); // L

        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['teams']);
        $teamData = null;
        foreach ($data['teams'] as $t) {
            if ($t['id'] === $homeTeam->getId()) {
                $teamData = $t;
                break;
            }
        }
        self::assertNotNull($teamData, 'Test team not found in response.');

        $stats = $teamData['stats'];
        self::assertSame(3, $stats['played']);
        self::assertSame(1, $stats['won']);
        self::assertSame(1, $stats['drawn']);
        self::assertSame(1, $stats['lost']);
        self::assertSame(3, $stats['goalsFor']);
        self::assertSame(4, $stats['goalsAgainst']); // 2+1+0 + 0+0+1 wait: homeTeam conceded 0+1+3=4
        self::assertSame(4, $stats['points']); // 3+1+0

        // Form is last 5, reversed (most recent first): [L, D, W]
        self::assertCount(3, $teamData['form']);
        self::assertSame('L', $teamData['form'][0]);
        self::assertSame('D', $teamData['form'][1]);
        self::assertSame('W', $teamData['form'][2]);
    }

    // ── Top scorers ────────────────────────────────────────────────────────────

    public function testSeasonOverviewTopScorersContainsScorerAfterGoal(): void
    {
        $club = $this->createClubWithTeam('test-top-scorer');
        /** @var Team $homeTeam */
        $homeTeam = $club->getTeams()->first();
        $opponentTeam = $this->createTeam('test-scorer-opponent');

        $season = (int) (new DateTime())->format('m') >= 7
            ? (int) (new DateTime())->format('Y')
            : (int) (new DateTime())->format('Y') - 1;

        $goalType = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'goal']);
        if (null === $goalType) {
            $this->markTestSkipped('GameEventType "goal" not found in fixtures.');
        }

        $game = $this->createFinishedGame($homeTeam, $opponentTeam, $homeTeam, 1, 0, $season);

        // Use an existing player from fixtures (we do not need to create one from scratch)
        $player = null;
        foreach ($homeTeam->getPlayerTeamAssignments() as $pta) {
            $player = $pta->getPlayer();
            break;
        }
        if (null === $player) {
            // Create a minimal player for the test
            if (null === $this->playerPosition) {
                $this->markTestSkipped('Keine Fixture-Position gefunden. Bitte Fixtures laden.');
            }
            $player = new \App\Entity\Player();
            $player->setFirstName('Goal');
            $player->setLastName('Scorer-' . $this->suffix);
            $player->setMainPosition($this->playerPosition);
            $this->em->persist($player);
        }

        $event = (new GameEvent())
            ->setGame($game)
            ->setGameEventType($goalType)
            ->setPlayer($player)
            ->setTeam($homeTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['topScorers'], 'At least one top scorer should appear.');
        $topScorer = $data['topScorers'][0];
        self::assertArrayHasKey('playerId', $topScorer);
        self::assertArrayHasKey('goals', $topScorer);
        self::assertArrayHasKey('teamId', $topScorer);
        self::assertArrayHasKey('teamName', $topScorer);
        self::assertSame($homeTeam->getId(), $topScorer['teamId']);
        self::assertGreaterThanOrEqual(1, $topScorer['goals']);
    }

    public function testSeasonOverviewOffsideGoalNotCountedInTopScorers(): void
    {
        $club = $this->createClubWithTeam('test-scorer-offside');
        /** @var Team $homeTeam */
        $homeTeam = $club->getTeams()->first();
        $opponentTeam = $this->createTeam('test-scorer-offside-opp');

        $season = (int) (new DateTime())->format('m') >= 7
            ? (int) (new DateTime())->format('Y')
            : (int) (new DateTime())->format('Y') - 1;

        $offsideType = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'offside_goal']);
        if (null === $offsideType) {
            $this->markTestSkipped('GameEventType "offside_goal" not found in fixtures.');
        }

        $game = $this->createFinishedGame($homeTeam, $opponentTeam, $homeTeam, 0, 0, $season);

        if (null === $this->playerPosition) {
            $this->markTestSkipped('Keine Fixture-Position gefunden. Bitte Fixtures laden.');
        }
        $player = new \App\Entity\Player();
        $player->setFirstName('Offside');
        $player->setLastName('Player-' . $this->suffix);
        $player->setMainPosition($this->playerPosition);
        $this->em->persist($player);

        // Add only an offside goal — must NOT appear in top scorers
        $event = (new GameEvent())
            ->setGame($game)
            ->setGameEventType($offsideType)
            ->setPlayer($player)
            ->setTeam($homeTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        foreach ($data['topScorers'] as $scorer) {
            self::assertNotSame($player->getId(), $scorer['playerId'], 'Offside goal must not count for top scorer.');
        }
    }

    // ── resolveSeasonYear – invalid param ──────────────────────────────────────

    public function testSeasonOverviewFallsBackToCurrentSeasonForInvalidSeasonParam(): void
    {
        $club = $this->createClubWithTeam('test-season-invalid');

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId() . '&season=invalid');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $now = new DateTime();
        $expectedYear = (int) $now->format('m') >= 7
            ? (int) $now->format('Y')
            : (int) $now->format('Y') - 1;

        self::assertSame($expectedYear, $data['seasonYear']);
        self::assertSame(sprintf('%d/%d', $expectedYear, $expectedYear + 1), $data['season']);
    }

    // ── resolveClub via User-Team-Inference ────────────────────────────────────

    #[AllowMockObjectsWithoutExpectations]
    public function testSeasonOverviewResolvesClubFromUserTeamInference(): void
    {
        $club = $this->createClubWithTeam('test-inference');
        /** @var Team $team */
        $team = $club->getTeams()->first();

        // Mock CoachTeamPlayerService so the team is returned for the authenticated user
        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->method('collectPlayerTeams')->willReturn([$team->getId() => $team]);
        $serviceMock->method('collectCoachTeams')->willReturn([]);
        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->authenticate($this->adminUser);
        // No clubId param: club must be inferred from the user's teams
        $this->client->request('GET', '/api/club/season-overview');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotNull($data['club'], 'Club must be resolved via team inference.');
        self::assertSame($club->getId(), $data['club']['id']);
    }

    // ── buildTeamData – league !== null ────────────────────────────────────────

    public function testSeasonOverviewIncludesLeagueDataWhenTeamHasLeague(): void
    {
        $league = (new League())->setName('Testliga-' . $this->suffix);
        $this->em->persist($league);

        $club = $this->createClubWithTeam('test-league');
        /** @var Team $team */
        $team = $club->getTeams()->first();
        $team->setLeague($league);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['teams']);
        $teamData = $data['teams'][0];

        self::assertNotNull($teamData['league'], 'League must be present when team has a league.');
        self::assertArrayHasKey('id', $teamData['league']);
        self::assertArrayHasKey('name', $teamData['league']);
        self::assertSame('Testliga-' . $this->suffix, $teamData['league']['name']);
    }

    // ── findNextGame – future game exists ──────────────────────────────────────

    public function testSeasonOverviewIncludesNextGameWhenFutureGameExists(): void
    {
        $club = $this->createClubWithTeam('test-nextgame');
        /** @var Team $homeTeam */
        $homeTeam = $club->getTeams()->first();
        $awayTeam = $this->createTeam('test-next-opponent');

        // Create an unfinished future game
        $ce = (new CalendarEvent())
            ->setTitle('future-test-' . $this->suffix)
            ->setStartDate(new DateTime('+30 days'))
            ->setEndDate(new DateTime('+30 days +2 hours'))
            ->setCalendarEventType($this->spielType);
        $this->em->persist($ce);

        $game = (new Game())
            ->setHomeTeam($homeTeam)
            ->setAwayTeam($awayTeam)
            ->setGameType($this->gameType)
            ->setCalendarEvent($ce)
            ->setIsFinished(false);
        $this->em->persist($game);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['teams']);
        $teamData = null;
        foreach ($data['teams'] as $t) {
            if ($t['id'] === $homeTeam->getId()) {
                $teamData = $t;
                break;
            }
        }
        self::assertNotNull($teamData, 'Test team not found in response.');
        self::assertNotNull($teamData['nextGame'], 'nextGame must be populated when a future game exists.');
        self::assertArrayHasKey('id', $teamData['nextGame']);
        self::assertArrayHasKey('date', $teamData['nextGame']);
        self::assertArrayHasKey('homeTeam', $teamData['nextGame']);
        self::assertArrayHasKey('awayTeam', $teamData['nextGame']);
        self::assertSame($game->getId(), $teamData['nextGame']['id']);
        self::assertSame($homeTeam->getId(), $teamData['nextGame']['homeTeam']['id']);
        self::assertSame($awayTeam->getId(), $teamData['nextGame']['awayTeam']['id']);
    }

    // ── Regular user access ────────────────────────────────────────────────────

    public function testSeasonOverviewIsAccessibleForRegularUser(): void
    {
        $club = $this->createClubWithTeam('test-regular-user');

        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/club/season-overview?clubId=' . $club->getId());

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertNotNull($data['club']);
        self::assertSame($club->getId(), $data['club']['id']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function createClubWithTeam(string $namePart): Club
    {
        $team = $this->createTeam($namePart);

        $club = new Club();
        $club->setName('TestClub-' . $this->suffix);
        $club->setShortName('TC-' . $this->suffix);
        $this->em->persist($club);

        $club->getTeams()->add($team);
        $team->getClubs()->add($club);

        $this->em->flush();

        return $club;
    }

    private function createTeam(string $namePart): Team
    {
        $team = (new Team())
            ->setName('test-' . $namePart . '-' . $this->suffix)
            ->setAgeGroup($this->ageGroup);
        $this->em->persist($team);
        $this->em->flush();

        return $team;
    }

    /**
     * Creates a finished game with a given number of goals (through real GameEvent entities).
     *
     * @param Team $scoreWinner the team that scores the winning goals (or draws)
     * @param int  $homeGoals   goals by homeTeam
     * @param int  $awayGoals   goals by awayTeam
     */
    private function createFinishedGame(
        Team $homeTeam,
        Team $awayTeam,
        Team $scoreWinner,
        int $homeGoals,
        int $awayGoals,
        int $seasonYear,
    ): Game {
        $ce = (new CalendarEvent())
            ->setTitle('test-game-' . $this->suffix . '-' . uniqid())
            ->setStartDate(new DateTime(sprintf('%d-10-15 15:00:00', $seasonYear)))
            ->setEndDate(new DateTime(sprintf('%d-10-15 17:00:00', $seasonYear)))
            ->setCalendarEventType($this->spielType);
        $this->em->persist($ce);

        $game = (new Game())
            ->setHomeTeam($homeTeam)
            ->setAwayTeam($awayTeam)
            ->setGameType($this->gameType)
            ->setCalendarEvent($ce)
            ->setIsFinished(true);
        $this->em->persist($game);
        $this->em->flush();

        $goalType = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'goal']);
        if (null === $goalType) {
            return $game;
        }

        for ($i = 0; $i < $homeGoals; ++$i) {
            $event = (new GameEvent())
                ->setGame($game)
                ->setGameEventType($goalType)
                ->setTeam($homeTeam)
                ->setTimestamp(new DateTime());
            $this->em->persist($event);
        }

        for ($i = 0; $i < $awayGoals; ++$i) {
            $event = (new GameEvent())
                ->setGame($game)
                ->setGameEventType($goalType)
                ->setTeam($awayTeam)
                ->setTimestamp(new DateTime());
            $this->em->persist($event);
        }

        $this->em->flush();

        return $game;
    }
}
