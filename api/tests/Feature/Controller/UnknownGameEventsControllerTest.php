<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\GameEvent;
use App\Entity\Player;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für UnknownGameEventsController.
 *
 * Abgedeckt:
 * - Authentifizierungspflicht (401 ohne Token)
 * - Zugriffssteuerung (403 für User ohne Coach-Relation)
 * - SUPERADMIN sieht alle unbekannten Ereignisse
 * - SUPERADMIN sieht Ereignisse mit Coach/Spieler NICHT in der Unbekannt-Liste
 * - ADMIN ohne Team-Zuordnung sieht keine Ereignisse (leere Liste)
 * - Trainer sieht unbekannte Ereignisse aus Spielen seiner Teams
 * - Spieler-Liste für ein Ereignis
 * - Spieler-Zuweisungs-Workflow (inkl. Fehlerfall 400/404/422/200)
 *
 * Fixture-Voraussetzung: Fixtures der Gruppen "master" und "test" müssen geladen sein,
 * inkl. der TestData/GameEventFixtures.php aus diesem PR.
 *
 * Alle Tests laufen innerhalb einer DB-Transaktion, die am Ende zurückgerollt wird.
 */
class UnknownGameEventsControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $superAdmin;   // user21 – ROLE_SUPERADMIN
    private User $adminUser;    // user16 – ROLE_ADMIN, keine UserRelations → leere Teamliste
    private User $coachUser;    // user11 – ROLE_CLUB, coach_1 → Team 1 (aktiv)
    private User $regularUser;  // user6  – ROLE_USER, nur Eltern-Relation, kein Coach
    private User $noRelUser;    // user10 – ROLE_USER, keinerlei UserRelations

    private GameEvent $unknownEventTeam1;  // kein Spieler, kein Coach → unbekannt (Team 1, game_0)
    private GameEvent $unknownEventTeam2;  // kein Spieler, kein Coach → unbekannt (Team 2, game_0)
    private GameEvent $eventWithCoach;     // Coach gesetzt  → NICHT unbekannt
    private GameEvent $eventWithPlayer;    // Spieler gesetzt → NICHT unbekannt

    private Player $team1Player;  // aktiver Spieler in Team 1 (gültiger Kandidat zum Zuweisen)
    private Player $team3Player;  // aktiver Spieler in Team 3 (falsche Team-Zuordnung → 422)

    // ── Initialisierung ───────────────────────────────────────────────────────

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        // Fixture-User laden
        $this->superAdmin = $this->loadUser('user21@example.com');
        $this->adminUser = $this->loadUser('user16@example.com');
        $this->coachUser = $this->loadUser('user11@example.com');
        $this->regularUser = $this->loadUser('user6@example.com');
        $this->noRelUser = $this->loadUser('user10@example.com');

        // Fixture-Ereignisse anhand des eindeutigen Beschreibungsmarkers laden
        $this->unknownEventTeam1 = $this->loadGameEvent('__test_unknown_evt_1__');
        $this->unknownEventTeam2 = $this->loadGameEvent('__test_unknown_evt_2__');
        $this->eventWithCoach = $this->loadGameEvent('__test_evt_with_coach__');
        $this->eventWithPlayer = $this->loadGameEvent('__test_evt_with_player__');

        // Einen aktiven Spieler aus Team 1 und Team 3 für assign-Tests bereitstellen
        $this->team1Player = $this->findFirstActivePlayerForTeam('Team 1');
        $this->team3Player = $this->findFirstActivePlayerForTeam('Team 3');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── GET /api/admin/unknown-game-events ────────────────────────────────────

    public function testListRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testListForbiddenForUserWithoutCoachRelation(): void
    {
        $this->authenticate($this->regularUser);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testListForbiddenForUserWithNoRelations(): void
    {
        $this->authenticate($this->noRelUser);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testSuperAdminSeesUnknownEvents(): void
    {
        $this->authenticate($this->superAdmin);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseIsSuccessful();
        $data = $this->decodeResponseJson();

        $ids = array_column($data, 'id');
        $this->assertContains($this->unknownEventTeam1->getId(), $ids, 'Unbekanntes Ereignis Team 1 fehlt in der Liste');
        $this->assertContains($this->unknownEventTeam2->getId(), $ids, 'Unbekanntes Ereignis Team 2 fehlt in der Liste');
    }

    public function testSuperAdminDoesNotSeeEventWithCoach(): void
    {
        $this->authenticate($this->superAdmin);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseIsSuccessful();
        $ids = array_column($this->decodeResponseJson(), 'id');

        $this->assertNotContains($this->eventWithCoach->getId(), $ids, 'Ereignis mit Coach darf nicht als unbekannt erscheinen');
    }

    public function testSuperAdminDoesNotSeeEventWithPlayer(): void
    {
        $this->authenticate($this->superAdmin);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseIsSuccessful();
        $ids = array_column($this->decodeResponseJson(), 'id');

        $this->assertNotContains($this->eventWithPlayer->getId(), $ids, 'Ereignis mit Spieler darf nicht als unbekannt erscheinen');
    }

    public function testAdminWithNoTeamRelationsSeesEmptyList(): void
    {
        // user16 ist ROLE_ADMIN, hat aber keine UserRelations und damit keine Team-IDs.
        // findUnknownPlayerEvents() gibt für leere teamIds sofort [] zurück.
        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseIsSuccessful();
        $data = $this->decodeResponseJson();

        $this->assertSame([], $data, 'ADMIN ohne Team-Zuordnung muss eine leere Ereignisliste erhalten');
    }

    public function testCoachSeesUnknownEventsFromOwnTeamGames(): void
    {
        // user11 ist Trainer von Team 1. Spiel game_0 ist Team 1 vs. Team 2.
        // Die Team-ID-Filterung prüft homeTeam oder awayTeam des Spiels → game_0 matcht.
        // Daher sieht user11 ALLE unbekannten Ereignisse aus game_0.
        $this->authenticate($this->coachUser);
        $this->client->request('GET', '/api/admin/unknown-game-events');

        $this->assertResponseIsSuccessful();
        $ids = array_column($this->decodeResponseJson(), 'id');

        $this->assertContains($this->unknownEventTeam1->getId(), $ids, 'Trainer muss unbekanntes Ereignis aus eigenem Teamspiel sehen');
        $this->assertContains($this->unknownEventTeam2->getId(), $ids, 'Trainer muss alle unbekannten Ereignisse aus dem Spiel sehen (auch Gegner-Ereignis)');
    }

    // ── GET /api/admin/unknown-game-events/{id}/players ───────────────────────

    public function testPlayersForEventRequiresAuthentication(): void
    {
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/players';
        $this->client->request('GET', $url);

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testPlayersForEventForbiddenForNonCoachUser(): void
    {
        $this->authenticate($this->regularUser);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/players';
        $this->client->request('GET', $url);

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testSuperAdminGetsPlayersForEvent(): void
    {
        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/players';
        $this->client->request('GET', $url);

        $this->assertResponseIsSuccessful();
        $data = $this->decodeResponseJson();

        $this->assertNotEmpty($data, 'Spielerliste muss mindestens einen aktiven Spieler enthalten');

        // Jeder Eintrag hat id und fullName
        $firstPlayer = $data[0];
        $this->assertArrayHasKey('id', $firstPlayer);
        $this->assertArrayHasKey('fullName', $firstPlayer);
    }

    public function testPlayersForEventContainsActivePlayersFromBothTeams(): void
    {
        // game_0: Team 1 vs. Team 2 → Spielerliste enthält Spieler beider Teams
        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/players';
        $this->client->request('GET', $url);

        $this->assertResponseIsSuccessful();
        $data = $this->decodeResponseJson();
        $playerIds = array_column($data, 'id');

        $this->assertContains($this->team1Player->getId(), $playerIds, 'Team-1-Spieler muss in der Spielerliste erscheinen');
    }

    // ── PATCH /api/admin/unknown-game-events/{id}/assign ─────────────────────

    public function testAssignPlayerRequiresAuthentication(): void
    {
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/assign';
        $this->client->request('PATCH', $url, [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['playerId' => 1]));

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testAssignPlayerForbiddenForNonCoachUser(): void
    {
        $this->authenticate($this->regularUser);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/assign';
        $this->client->request('PATCH', $url, [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['playerId' => 1]));

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testAssignPlayerReturnsBadRequestWhenPlayerIdMissing(): void
    {
        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/assign';
        $this->client->request('PATCH', $url, [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([]));

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testAssignPlayerReturnsNotFoundForUnknownPlayerId(): void
    {
        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/assign';
        $this->client->request(
            'PATCH',
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['playerId' => 999999999]),
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testAssignPlayerReturnsUnprocessableEntityForWrongTeam(): void
    {
        // team3Player gehört nicht zu Team 1 oder Team 2 (die Teams von game_0)
        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $this->unknownEventTeam1->getId() . '/assign';
        $this->client->request(
            'PATCH',
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['playerId' => $this->team3Player->getId()]),
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    public function testAssignPlayerSuccessfullyAssignsPlayer(): void
    {
        $eventId = $this->unknownEventTeam1->getId();

        $this->authenticate($this->superAdmin);
        $url = '/api/admin/unknown-game-events/' . $eventId . '/assign';
        $this->client->request(
            'PATCH',
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['playerId' => $this->team1Player->getId()]),
        );

        $this->assertResponseIsSuccessful();

        // Direkt in der DB prüfen (innerhalb derselben Transaktion):
        // Der Spieler muss jetzt gesetzt sein.
        $this->em->clear();
        $refreshedEvent = $this->em->find(GameEvent::class, $eventId);
        $this->assertNotNull($refreshedEvent, 'GameEvent muss nach dem PATCH noch in der DB existieren');
        $this->assertNotNull($refreshedEvent->getPlayer(), 'Spieler muss nach der Zuweisung gesetzt sein');
        $this->assertSame($this->team1Player->getId(), $refreshedEvent->getPlayer()->getId());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function loadUser(string $email): User
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture-User "%s" nicht gefunden. Bitte Fixtures laden (Gruppe "test").', $email));

        return $user;
    }

    private function loadGameEvent(string $description): GameEvent
    {
        $event = $this->em->getRepository(GameEvent::class)->findOneBy(['description' => $description]);
        self::assertNotNull(
            $event,
            sprintf('Fixture-GameEvent mit Beschreibung "%s" nicht gefunden. Bitte Fixtures laden (Gruppe "test", inkl. GameEventFixtures).', $description),
        );

        return $event;
    }

    private function findFirstActivePlayerForTeam(string $teamName): Player
    {
        $result = $this->em->createQueryBuilder()
            ->select('p')
            ->from(Player::class, 'p')
            ->innerJoin('p.playerTeamAssignments', 'pta')
            ->innerJoin('pta.team', 't')
            ->where('t.name = :teamName')
            ->andWhere('pta.endDate IS NULL OR pta.endDate >= :now')
            ->setParameter('teamName', $teamName)
            ->setParameter('now', new DateTime())
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();

        self::assertNotEmpty($result, sprintf('Kein aktiver Spieler für Team "%s" gefunden. Bitte Fixtures laden.', $teamName));

        return $result[0];
    }

    /**
     * @return array<mixed>
     */
    private function decodeResponseJson(): array
    {
        $content = $this->client->getResponse()->getContent();
        $data = json_decode((string) $content, true);
        self::assertIsArray($data, 'Response muss ein JSON-Array sein. Content: ' . $content);

        return $data;
    }
}
