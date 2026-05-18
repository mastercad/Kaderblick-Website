<?php

namespace App\Tests\Feature\Controller;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for GET /api/cups and GET /api/cups/{id}/games.
 *
 * These endpoints were added/stabilised as part of the competition-games feature
 * and the onGamesChanged game-count synchronisation.
 */
class CupsControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $user;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        /** @var User $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($user, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->user = $user;
    }

    // ── GET /api/cups ────────────────────────────────────────────────────────

    public function testListIsPubliclyAccessible(): void
    {
        $this->client->request('GET', '/api/cups');

        $this->assertResponseIsSuccessful();
    }

    public function testListReturnsCupsArray(): void
    {
        $this->createCup('cptest-Kreispokal');

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('cups', $data);
        $this->assertIsArray($data['cups']);
    }

    public function testListIncludesRequiredFields(): void
    {
        $this->createCup('cptest-Stadtpokal');

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $cups = array_values(array_filter(
            $data['cups'],
            fn ($c) => 'cptest-Stadtpokal' === $c['name'],
        ));

        $this->assertNotEmpty($cups, 'Created cup must appear in the list.');
        $cup = $cups[0];

        $this->assertArrayHasKey('id', $cup);
        $this->assertArrayHasKey('name', $cup);
        $this->assertArrayHasKey('gameCount', $cup);
        $this->assertArrayHasKey('permissions', $cup);
        $this->assertArrayHasKey('canView', $cup['permissions']);
        $this->assertArrayHasKey('canEdit', $cup['permissions']);
        $this->assertArrayHasKey('canDelete', $cup['permissions']);
    }

    public function testGameCountIsZeroForCupWithNoGames(): void
    {
        $this->createCup('cptest-EmptyCup');

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $cups = array_values(array_filter(
            $data['cups'],
            fn ($c) => 'cptest-EmptyCup' === $c['name'],
        ));

        $this->assertNotEmpty($cups);
        $this->assertSame(0, $cups[0]['gameCount']);
    }

    public function testGameCountReflectsActualGamesLinkedToCup(): void
    {
        $cup = $this->createCup('cptest-CountCup');
        $evType = $this->getOrCreateCalendarEventType('Spiel');

        $this->createCalendarEventWithGame($cup, $evType);
        $this->createCalendarEventWithGame($cup, $evType);

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $cups = array_values(array_filter(
            $data['cups'],
            fn ($c) => 'cptest-CountCup' === $c['name'],
        ));

        $this->assertNotEmpty($cups);
        $this->assertGreaterThanOrEqual(2, $cups[0]['gameCount']);
    }

    // ── GET /api/cups/{id}/games ─────────────────────────────────────────────

    public function testGamesAccessDeniedWhenUnauthenticated(): void
    {
        $cup = $this->createCup('cptest-GamesAuth');

        $this->client->request('GET', '/api/cups/' . $cup->getId() . '/games');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testGamesReturnsGamesArray(): void
    {
        $cup = $this->createCup('cptest-GamesCup');
        $evType = $this->getOrCreateCalendarEventType('Spiel');
        $this->createCalendarEventWithGame($cup, $evType);

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups/' . $cup->getId() . '/games');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('games', $data);
        $this->assertIsArray($data['games']);
        $this->assertGreaterThanOrEqual(1, count($data['games']));
    }

    public function testGamesIncludesRequiredFields(): void
    {
        $cup = $this->createCup('cptest-FieldsCup');
        $evType = $this->getOrCreateCalendarEventType('Spiel');
        $this->createCalendarEventWithGame($cup, $evType);

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups/' . $cup->getId() . '/games');

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

    public function testGamesReturnsEmptyArrayForCupWithNoGames(): void
    {
        $cup = $this->createCup('cptest-EmptyGamesCup');

        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups/' . $cup->getId() . '/games');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertSame([], $data['games']);
    }

    public function testGamesReturns404ForNonExistentCup(): void
    {
        $this->client->loginUser($this->user);
        $this->client->request('GET', '/api/cups/999999/games');

        $this->assertResponseStatusCodeSame(404);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function createCup(string $name): Cup
    {
        $cup = new Cup();
        $cup->setName($name);
        $this->em->persist($cup);
        $this->em->flush();

        return $cup;
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

    private function createCalendarEventWithGame(Cup $cup, CalendarEventType $evType): CalendarEvent
    {
        $gameType = $this->getOrCreateGameType('cptest-Pokalspiel');

        $event = new CalendarEvent();
        $event->setTitle('cptest-Game');
        $event->setStartDate(new DateTime('2026-05-01 15:00:00'));
        $event->setCalendarEventType($evType);

        $game = new Game();
        $game->setCalendarEvent($event);
        $game->setCup($cup);
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
            . "WHERE ce.title = 'cptest-Game') g)",
        );
        $conn->executeStatement("DELETE FROM calendar_events WHERE title = 'cptest-Game'");
        $conn->executeStatement("DELETE FROM cups WHERE name LIKE 'cptest-%'");
        $conn->executeStatement("DELETE FROM game_types WHERE name LIKE 'cptest-%'");
        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
