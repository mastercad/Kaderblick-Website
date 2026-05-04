<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests that league and cup are serialized by GamesController::details()
 * and GamesController::overview().
 */
class GamesControllerCompetitionTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Team $homeTeam;
    private Team $awayTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private League $league;
    private Cup $cup;

    private User $adminUser;

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
            ->setName('test-comp-home-' . $this->suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-comp-away-' . $this->suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $this->calendarEvent = (new CalendarEvent())
            ->setTitle('test-comp-event-' . $this->suffix)
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

        $this->league = (new League())
            ->setName('Testliga ' . $this->suffix);
        $this->em->persist($this->league);

        $this->cup = (new Cup())
            ->setName('Testpokal ' . $this->suffix);
        $this->em->persist($this->cup);

        $this->em->flush();

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    // ── details(): league ────────────────────────────────────────────────────

    public function testDetailsIncludesLeagueWhenSet(): void
    {
        $this->game->setLeague($this->league);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('league', $data['game']);
        self::assertSame($this->league->getId(), $data['game']['league']['id']);
        self::assertSame('Testliga ' . $this->suffix, $data['game']['league']['name']);
    }

    public function testDetailsLeagueIsNullWhenNotSet(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('league', $data['game']);
        self::assertNull($data['game']['league']);
    }

    // ── details(): cup ───────────────────────────────────────────────────────

    public function testDetailsIncludesCupWhenSet(): void
    {
        $this->game->setCup($this->cup);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('cup', $data['game']);
        self::assertSame($this->cup->getId(), $data['game']['cup']['id']);
        self::assertSame('Testpokal ' . $this->suffix, $data['game']['cup']['name']);
    }

    public function testDetailsCupIsNullWhenNotSet(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('cup', $data['game']);
        self::assertNull($data['game']['cup']);
    }

    // ── details(): league + cup gleichzeitig ─────────────────────────────────

    public function testDetailsIncludesBothLeagueAndCupWhenBothSet(): void
    {
        $this->game->setLeague($this->league);
        $this->game->setCup($this->cup);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame($this->league->getId(), $data['game']['league']['id']);
        self::assertSame($this->cup->getId(), $data['game']['cup']['id']);
    }

    // ── overview(): league ───────────────────────────────────────────────────

    public function testOverviewUpcomingGameIncludesLeagueWhenSet(): void
    {
        $this->game->setLeague($this->league);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameData = $this->findGameById($data['upcoming_games'], $this->game->getId());
        self::assertNotNull($gameData, 'Spiel nicht in upcoming_games gefunden.');
        self::assertArrayHasKey('league', $gameData);
        self::assertSame($this->league->getId(), $gameData['league']['id']);
        self::assertSame('Testliga ' . $this->suffix, $gameData['league']['name']);
    }

    public function testOverviewUpcomingGameLeagueIsNullWhenNotSet(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameData = $this->findGameById($data['upcoming_games'], $this->game->getId());
        self::assertNotNull($gameData, 'Spiel nicht in upcoming_games gefunden.');
        self::assertArrayHasKey('league', $gameData);
        self::assertNull($gameData['league']);
    }

    // ── overview(): cup ──────────────────────────────────────────────────────

    public function testOverviewUpcomingGameIncludesCupWhenSet(): void
    {
        $this->game->setCup($this->cup);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameData = $this->findGameById($data['upcoming_games'], $this->game->getId());
        self::assertNotNull($gameData, 'Spiel nicht in upcoming_games gefunden.');
        self::assertArrayHasKey('cup', $gameData);
        self::assertSame($this->cup->getId(), $gameData['cup']['id']);
        self::assertSame('Testpokal ' . $this->suffix, $gameData['cup']['name']);
    }

    public function testOverviewUpcomingGameCupIsNullWhenNotSet(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameData = $this->findGameById($data['upcoming_games'], $this->game->getId());
        self::assertNotNull($gameData, 'Spiel nicht in upcoming_games gefunden.');
        self::assertArrayHasKey('cup', $gameData);
        self::assertNull($gameData['cup']);
    }

    // ── overview(): finished game (otherGames path) ──────────────────────────

    public function testOverviewFinishedGameIncludesLeagueWhenSet(): void
    {
        // Move game to the past so it appears in finished_games
        $this->calendarEvent
            ->setStartDate(new DateTime('-2 days'))
            ->setEndDate(new DateTime('-2 days +2 hours'));
        $this->game->setLeague($this->league);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $finishedGame = $this->findGameByIdInFinished($data['finished_games'], $this->game->getId());
        self::assertNotNull($finishedGame, 'Spiel nicht in finished_games gefunden.');
        self::assertArrayHasKey('league', $finishedGame['game']);
        self::assertSame($this->league->getId(), $finishedGame['game']['league']['id']);
    }

    public function testOverviewFinishedGameIncludesCupWhenSet(): void
    {
        $this->calendarEvent
            ->setStartDate(new DateTime('-2 days'))
            ->setEndDate(new DateTime('-2 days +2 hours'));
        $this->game->setCup($this->cup);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $finishedGame = $this->findGameByIdInFinished($data['finished_games'], $this->game->getId());
        self::assertNotNull($finishedGame, 'Spiel nicht in finished_games gefunden.');
        self::assertArrayHasKey('cup', $finishedGame['game']);
        self::assertSame($this->cup->getId(), $finishedGame['game']['cup']['id']);
    }

    // ── details(): gameType ──────────────────────────────────────────────────

    public function testDetailsIncludesGameType(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('gameType', $data['game']);
        self::assertIsArray($data['game']['gameType']);
        self::assertArrayHasKey('id', $data['game']['gameType']);
        self::assertArrayHasKey('name', $data['game']['gameType']);
        self::assertNotEmpty($data['game']['gameType']['name']);
    }

    public function testDetailsGameTypeMatchesEntity(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameType = $this->em->getRepository(GameType::class)->find($data['game']['gameType']['id']);
        self::assertNotNull($gameType);
        self::assertSame($data['game']['gameType']['name'], $gameType->getName());
    }

    // ── overview(): gameType ─────────────────────────────────────────────────

    public function testOverviewUpcomingGameIncludesGameType(): void
    {
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $gameData = $this->findGameById($data['upcoming_games'], $this->game->getId());
        self::assertNotNull($gameData, 'Spiel nicht in upcoming_games gefunden.');
        self::assertArrayHasKey('gameType', $gameData);
        self::assertIsArray($gameData['gameType']);
        self::assertArrayHasKey('id', $gameData['gameType']);
        self::assertArrayHasKey('name', $gameData['gameType']);
        self::assertNotEmpty($gameData['gameType']['name']);
    }

    public function testOverviewFinishedGameIncludesGameType(): void
    {
        $this->calendarEvent
            ->setStartDate(new DateTime('-2 days'))
            ->setEndDate(new DateTime('-2 days +2 hours'));
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/games/overview?teamId=all');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $finishedGame = $this->findGameByIdInFinished($data['finished_games'], $this->game->getId());
        self::assertNotNull($finishedGame, 'Spiel nicht in finished_games gefunden.');
        self::assertArrayHasKey('gameType', $finishedGame['game']);
        self::assertNotEmpty($finishedGame['game']['gameType']['name']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * @param array<int, array<string, mixed>> $games
     *
     * @return array<string, mixed>|null
     */
    private function findGameById(array $games, int $id): ?array
    {
        foreach ($games as $g) {
            if (isset($g['id']) && $g['id'] === $id) {
                return $g;
            }
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $finishedGames
     *
     * @return array<string, mixed>|null
     */
    private function findGameByIdInFinished(array $finishedGames, int $id): ?array
    {
        foreach ($finishedGames as $entry) {
            if (isset($entry['game']['id']) && $entry['game']['id'] === $id) {
                return $entry;
            }
        }

        return null;
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
