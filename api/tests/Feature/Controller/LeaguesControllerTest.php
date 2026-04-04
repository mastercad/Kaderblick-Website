<?php

namespace App\Tests\Feature\Controller;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for GET /api/leagues and GET /api/leagues/{id}/games.
 *
 * These endpoints were added/stabilised as part of the competition-games feature
 * and the onGamesChanged game-count synchronisation.
 */
class LeaguesControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    // ── GET /api/leagues ─────────────────────────────────────────────────────

    public function testListIsPubliclyAccessible(): void
    {
        $this->client->request('GET', '/api/leagues');

        $this->assertResponseIsSuccessful();
    }

    public function testListReturnsLeaguesArray(): void
    {
        $user = $this->createUser('lgtest-list@example.com');
        $this->createLeague('lgtest-Kreisliga');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('leagues', $data);
        $this->assertIsArray($data['leagues']);
    }

    public function testListIncludesRequiredFields(): void
    {
        $user = $this->createUser('lgtest-fields@example.com');
        $this->createLeague('lgtest-Bezirksliga');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $leagues = array_values(array_filter(
            $data['leagues'],
            fn ($l) => 'lgtest-Bezirksliga' === $l['name'],
        ));

        $this->assertNotEmpty($leagues, 'Created league must appear in the list.');
        $league = $leagues[0];

        $this->assertArrayHasKey('id', $league);
        $this->assertArrayHasKey('name', $league);
        $this->assertArrayHasKey('gameCount', $league);
        $this->assertArrayHasKey('permissions', $league);
        $this->assertArrayHasKey('canView', $league['permissions']);
        $this->assertArrayHasKey('canEdit', $league['permissions']);
        $this->assertArrayHasKey('canDelete', $league['permissions']);
    }

    public function testGameCountIsZeroForLeagueWithNoGames(): void
    {
        $user = $this->createUser('lgtest-nocount@example.com');
        $this->createLeague('lgtest-EmptyLeague');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $leagues = array_values(array_filter(
            $data['leagues'],
            fn ($l) => 'lgtest-EmptyLeague' === $l['name'],
        ));

        $this->assertNotEmpty($leagues);
        $this->assertSame(0, $leagues[0]['gameCount']);
    }

    public function testGameCountReflectsActualGamesLinkedToLeague(): void
    {
        $user = $this->createUser('lgtest-count@example.com');
        $league = $this->createLeague('lgtest-CountLeague');
        $evType = $this->getOrCreateCalendarEventType('Spiel');

        $this->createCalendarEventWithGame($league, $evType);
        $this->createCalendarEventWithGame($league, $evType);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $leagues = array_values(array_filter(
            $data['leagues'],
            fn ($l) => 'lgtest-CountLeague' === $l['name'],
        ));

        $this->assertNotEmpty($leagues);
        $this->assertGreaterThanOrEqual(2, $leagues[0]['gameCount']);
    }

    // ── GET /api/leagues/{id}/games ──────────────────────────────────────────

    public function testGamesAccessDeniedWhenUnauthenticated(): void
    {
        $league = $this->createLeague('lgtest-GamesAuth');

        $this->client->request('GET', '/api/leagues/' . $league->getId() . '/games');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testGamesReturnsGamesArray(): void
    {
        $user = $this->createUser('lgtest-games@example.com');
        $league = $this->createLeague('lgtest-GamesLeague');
        $evType = $this->getOrCreateCalendarEventType('Spiel');
        $this->createCalendarEventWithGame($league, $evType);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues/' . $league->getId() . '/games');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('games', $data);
        $this->assertIsArray($data['games']);
        $this->assertGreaterThanOrEqual(1, count($data['games']));
    }

    public function testGamesIncludesRequiredFields(): void
    {
        $user = $this->createUser('lgtest-gamefields@example.com');
        $league = $this->createLeague('lgtest-FieldsLeague');
        $evType = $this->getOrCreateCalendarEventType('Spiel');
        $this->createCalendarEventWithGame($league, $evType);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues/' . $league->getId() . '/games');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $game = $data['games'][0];

        $this->assertArrayHasKey('id', $game);
        $this->assertArrayHasKey('homeTeamName', $game);
        $this->assertArrayHasKey('awayTeamName', $game);
        $this->assertArrayHasKey('homeScore', $game);
        $this->assertArrayHasKey('awayScore', $game);
        $this->assertArrayHasKey('isFinished', $game);
        $this->assertArrayHasKey('calendarEventId', $game);
        $this->assertArrayHasKey('date', $game);
    }

    public function testGamesReturnsEmptyArrayForLeagueWithNoGames(): void
    {
        $user = $this->createUser('lgtest-empty@example.com');
        $league = $this->createLeague('lgtest-EmptyGamesLeague');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues/' . $league->getId() . '/games');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertSame([], $data['games']);
    }

    public function testGamesReturns404ForNonExistentLeague(): void
    {
        $user = $this->createUser('lgtest-404@example.com');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/leagues/999999/games');

        $this->assertResponseStatusCodeSame(404);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function createUser(string $email): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('password');
        $user->setRoles(['ROLE_USER']);
        $user->setIsEnabled(true);
        $user->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    private function createLeague(string $name): League
    {
        $league = new League();
        $league->setName($name);
        $this->em->persist($league);
        $this->em->flush();

        return $league;
    }

    private function getOrCreateCalendarEventType(string $name): CalendarEventType
    {
        $existing = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => $name]);
        if ($existing) {
            return $existing;
        }

        $type = new CalendarEventType();
        $type->setName($name);
        $type->setColor('#000000');
        $this->em->persist($type);
        $this->em->flush();

        return $type;
    }

    private function getOrCreateGameType(string $name): GameType
    {
        $existing = $this->em->getRepository(GameType::class)->findOneBy(['name' => $name]);
        if ($existing) {
            return $existing;
        }

        $gameType = new GameType();
        $gameType->setName($name);
        $this->em->persist($gameType);
        $this->em->flush();

        return $gameType;
    }

    private function createCalendarEventWithGame(League $league, CalendarEventType $evType): CalendarEvent
    {
        $gameType = $this->getOrCreateGameType('lgtest-Ligaspiel');

        $event = new CalendarEvent();
        $event->setTitle('lgtest-Game');
        $event->setStartDate(new DateTime('2026-05-01 15:00:00'));
        $event->setCalendarEventType($evType);

        $game = new Game();
        $game->setCalendarEvent($event);
        $game->setLeague($league);
        $game->setGameType($gameType);
        $event->setGame($game);

        $this->em->persist($event);
        $this->em->persist($game);
        $this->em->flush();

        return $event;
    }

    protected function tearDown(): void
    {
        $conn = $this->em->getConnection();
        $conn->executeStatement(
            'DELETE FROM games WHERE id IN ('
            . 'SELECT g.id FROM ('
            . 'SELECT g2.id FROM games g2 '
            . 'JOIN calendar_events ce ON g2.calendar_event_id = ce.id '
            . "WHERE ce.title = 'lgtest-Game') g)",
        );
        $conn->executeStatement("DELETE FROM calendar_events WHERE title = 'lgtest-Game'");
        $conn->executeStatement("DELETE FROM leagues WHERE name LIKE 'lgtest-%'");
        $conn->executeStatement("DELETE FROM game_types WHERE name LIKE 'lgtest-%'");
        $conn->executeStatement("DELETE FROM users WHERE email LIKE 'lgtest-%'");
        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
