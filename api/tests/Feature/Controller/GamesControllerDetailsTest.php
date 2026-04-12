<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für GamesController::details().
 */
class GamesControllerDetailsTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Team $homeTeam;
    private Team $awayTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private User $adminUser;
    private User $regularUser;

    private string $suffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->suffix = bin2hex(random_bytes(6));

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $spielType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        self::assertNotNull($spielType, 'CalendarEventType "Spiel" nicht gefunden. Bitte Fixtures laden.');

        $this->homeTeam = (new Team())
            ->setName('test-gdet-home-' . $this->suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-gdet-away-' . $this->suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $this->calendarEvent = (new CalendarEvent())
            ->setTitle('test-gdet-event-' . $this->suffix)
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

    // ── details() ─────────────────────────────────────────────────────────────

    public function testDetailsReturns403WhenNotAuthenticated(): void
    {
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');
        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDetailsReturns404ForUnknownGame(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/99999999/details');
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testDetailsAsAdminReturnsSuccessful(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('game', $data);
        self::assertArrayHasKey('gameEvents', $data);
        self::assertArrayHasKey('homeScore', $data);
        self::assertArrayHasKey('awayScore', $data);
    }

    public function testDetailsAsRegularUserSucceeds(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        self::assertArrayHasKey('game', $data);
    }

    public function testDetailsGameHasExpectedFields(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $game = $data['game'];

        self::assertSame($this->game->getId(), $game['id']);
        self::assertArrayHasKey('homeTeam', $game);
        self::assertArrayHasKey('awayTeam', $game);
        self::assertArrayHasKey('isFinished', $game);
        self::assertArrayHasKey('permissions', $game);
        self::assertFalse($game['isFinished']);
    }

    public function testDetailsPermissionsForAdmin(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $permissions = $data['game']['permissions'];

        self::assertArrayHasKey('can_finish_game', $permissions);
        self::assertArrayHasKey('can_edit_timing', $permissions);
        self::assertArrayHasKey('can_create_game_events', $permissions);
        self::assertTrue($permissions['can_finish_game']);
        self::assertTrue($permissions['can_edit_timing']);
    }

    public function testDetailsPermissionsForRegularUser(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $permissions = $data['game']['permissions'];

        self::assertFalse($permissions['can_finish_game']);
        self::assertFalse($permissions['can_edit_timing']);
    }

    public function testDetailsTeamFields(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame($this->homeTeam->getId(), $data['game']['homeTeam']['id']);
        self::assertSame($this->awayTeam->getId(), $data['game']['awayTeam']['id']);
    }

    public function testDetailsCalendarEventFields(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('calendarEvent', $data['game']);
        self::assertSame($this->calendarEvent->getId(), $data['game']['calendarEvent']['id']);
    }

    public function testDetailsInitialScoreIsZero(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(0, $data['homeScore']);
        self::assertSame(0, $data['awayScore']);
    }

    public function testDetailsGameEventsIsEmptyInitially(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertIsArray($data['gameEvents']);
        self::assertCount(0, $data['gameEvents']);
    }

    public function testDetailsWithGameEvent(): void
    {
        $gameEventType = $this->em->getRepository(GameEventType::class)->findOneBy([]);
        if (null === $gameEventType) {
            $this->markTestSkipped('No GameEventType fixture found.');
        }

        $gameEvent = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($gameEventType)
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($gameEvent);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertCount(1, $data['gameEvents']);
        $event = $data['gameEvents'][0];
        self::assertArrayHasKey('id', $event);
        self::assertArrayHasKey('gameEventType', $event);
        self::assertArrayHasKey('player', $event);
    }

    // ── collectScores() – goal-variant coverage ───────────────────────────────

    /**
     * All goal variant codes that represent a valid, counted goal for the
     * scoring team (everything but own_goal, offside_goal, var_goal_denied).
     *
     * @return array<string, array{string}>
     */
    public static function goalVariantCodesProvider(): array
    {
        return [
            'goal' => ['goal'],
            'penalty_goal' => ['penalty_goal'],
            'freekick_goal' => ['freekick_goal'],
            'header_goal' => ['header_goal'],
            'corner_goal' => ['corner_goal'],
            'cross_goal' => ['cross_goal'],
            'counter_goal' => ['counter_goal'],
            'pressing_goal' => ['pressing_goal'],
            'sub_goal' => ['sub_goal'],
            'var_goal_confirmed' => ['var_goal_confirmed'],
        ];
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testDetailsScoreCountsGoalVariantForHomeTeam(string $code): void
    {
        $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => $code]);
        if (null === $type) {
            $this->markTestSkipped("GameEventType '$code' not found in fixtures.");
        }

        $event = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($type)
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(1, $data['homeScore'], "Code '$code' should count as 1 home goal.");
        self::assertSame(0, $data['awayScore']);
    }

    #[DataProvider('goalVariantCodesProvider')]
    public function testDetailsScoreCountsGoalVariantForAwayTeam(string $code): void
    {
        $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => $code]);
        if (null === $type) {
            $this->markTestSkipped("GameEventType '$code' not found in fixtures.");
        }

        $event = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($type)
            ->setTeam($this->awayTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(0, $data['homeScore']);
        self::assertSame(1, $data['awayScore'], "Code '$code' should count as 1 away goal.");
    }

    public function testDetailsScoreOwnGoalByHomeTeamCountsForAway(): void
    {
        $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'own_goal']);
        if (null === $type) {
            $this->markTestSkipped('GameEventType own_goal not found in fixtures.');
        }

        $event = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($type)
            ->setTeam($this->homeTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(0, $data['homeScore'], 'Own goal by home team must not increase home score.');
        self::assertSame(1, $data['awayScore'], 'Own goal by home team must increase away score.');
    }

    public function testDetailsScoreOwnGoalByAwayTeamCountsForHome(): void
    {
        $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'own_goal']);
        if (null === $type) {
            $this->markTestSkipped('GameEventType own_goal not found in fixtures.');
        }

        $event = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($type)
            ->setTeam($this->awayTeam)
            ->setTimestamp(new DateTime());
        $this->em->persist($event);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(1, $data['homeScore'], 'Own goal by away team must increase home score.');
        self::assertSame(0, $data['awayScore'], 'Own goal by away team must not increase away score.');
    }

    /**
     * @return array<string, array{string}>
     */
    public static function nonCountingEventCodesProvider(): array
    {
        return [
            'offside_goal' => ['offside_goal'],
            'var_goal_denied' => ['var_goal_denied'],
        ];
    }

    #[DataProvider('nonCountingEventCodesProvider')]
    public function testDetailsScoreDoesNotCountNonGoalEventCode(string $code): void
    {
        $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => $code]);
        if (null === $type) {
            $this->markTestSkipped("GameEventType '$code' not found in fixtures.");
        }

        // Add one for each team to ensure neither direction counts
        foreach ([$this->homeTeam, $this->awayTeam] as $team) {
            $event = (new GameEvent())
                ->setGame($this->game)
                ->setGameEventType($type)
                ->setTeam($team)
                ->setTimestamp(new DateTime());
            $this->em->persist($event);
        }
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(0, $data['homeScore'], "Code '$code' must not be counted as a goal.");
        self::assertSame(0, $data['awayScore'], "Code '$code' must not be counted as a goal.");
    }

    public function testDetailsScoreMixedGoalTypesCombination(): void
    {
        // home scores 3: penalty_goal, header_goal, counter_goal
        // away scores 2: freekick_goal, corner_goal
        // not counted: offside_goal (home), var_goal_denied (away)
        // own_goal by away team -> +1 for home  => home=4, away=2
        $scenarios = [
            ['code' => 'penalty_goal',   'team' => $this->homeTeam],
            ['code' => 'header_goal',    'team' => $this->homeTeam],
            ['code' => 'counter_goal',   'team' => $this->homeTeam],
            ['code' => 'freekick_goal',  'team' => $this->awayTeam],
            ['code' => 'corner_goal',    'team' => $this->awayTeam],
            ['code' => 'offside_goal',   'team' => $this->homeTeam],  // not counted
            ['code' => 'var_goal_denied', 'team' => $this->awayTeam], // not counted
            ['code' => 'own_goal',       'team' => $this->awayTeam],  // +1 for home
        ];

        foreach ($scenarios as $s) {
            $type = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => $s['code']]);
            if (null === $type) {
                $this->markTestSkipped("GameEventType '{$s['code']}' not found.");
            }
            $event = (new GameEvent())
                ->setGame($this->game)
                ->setGameEventType($type)
                ->setTeam($s['team'])
                ->setTimestamp(new DateTime());
            $this->em->persist($event);
        }
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertSame(4, $data['homeScore'], 'Home: 3 goal variants + 1 away own_goal.');
        self::assertSame(2, $data['awayScore'], 'Away: 2 goal variants, offside/denied not counted.');
    }

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
