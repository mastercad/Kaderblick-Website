<?php

namespace App\Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\Position;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Feature-Tests für die optimierten Report-Builder-Endpunkte.
 *
 * Geprüft werden:
 *  – GET /api/report/builder-data
 *      · 401 ohne Login
 *      · Antwortstruktur enthält fields, teams, eventTypes, availableDates
 *      · Antwort enthält KEIN „players"-Schlüssel mehr
 *      · availableDates enthält nur eindeutige Datumsstrings (Format Y-m-d)
 *      · Cache-Control-Header ist gesetzt
 *      · Nur Teams mit echten Game-Events erscheinen
 *
 *  – GET /api/report/player-search
 *      · 401 ohne Login
 *      · Suchanfrage < 2 Zeichen → leeres Array
 *      · Treffer bei passendem Nachnamen
 *      · Keine Treffer bei falschem Namen
 *      · Antwortfelder: id, fullName, firstName, lastName
 *      · Ergebnis ist auf 20 Einträge begrenzt
 */
class ReportBuilderDataTest extends WebTestCase
{
    private const PREFIX = 'builder-data-test-';

    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $fixtureUser;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->fixtureUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->fixtureUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    // =========================================================================
    //  GET /api/report/builder-data – Authentifizierung
    // =========================================================================

    public function testBuilderDataRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/report/builder-data');
        $this->assertResponseStatusCodeSame(401);
    }

    // =========================================================================
    //  GET /api/report/builder-data – Antwortstruktur
    // =========================================================================

    public function testBuilderDataReturnsExpectedKeys(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        foreach (['fields', 'presets', 'teams', 'eventTypes', 'surfaceTypes', 'gameTypes', 'availableDates', 'minDate', 'maxDate'] as $key) {
            $this->assertArrayHasKey($key, $data, "Response must contain key '$key'.");
        }
    }

    public function testBuilderDataDoesNotContainPlayersKey(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayNotHasKey(
            'players',
            $data,
            'The players list must no longer be included in /api/report/builder-data (too large).'
        );
    }

    public function testBuilderDataFieldsHaveKeyLabelAndSource(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data['fields'], 'fields must be non-empty.');
        foreach ($data['fields'] as $field) {
            $this->assertArrayHasKey('key', $field, 'Each field must have a key.');
            $this->assertArrayHasKey('label', $field, 'Each field must have a label.');
        }
    }

    // =========================================================================
    //  GET /api/report/builder-data – availableDates
    // =========================================================================

    public function testAvailableDatesContainsOnlyUniqueDateStrings(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $dates = $data['availableDates'];
        $this->assertIsArray($dates);

        // All entries must match Y-m-d
        foreach ($dates as $d) {
            $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $d, 'Date must be in Y-m-d format.');
        }

        // Must be unique
        $this->assertSame(array_values(array_unique($dates)), $dates, 'Dates must be unique and without gaps.');
    }

    public function testAvailableDatesAreSortedAscending(): void
    {
        // Create 2 game events on different dates to guarantee at least 2 availableDates entries
        $eventType = $this->getOrCreateGameEventType();
        $ageGroup = $this->getOrCreateAgeGroup();

        $team1 = new Team();
        $team1->setName(self::PREFIX . 'sort-team-a');
        $team1->setAgeGroup($ageGroup);
        $this->em->persist($team1);

        $team2 = new Team();
        $team2->setName(self::PREFIX . 'sort-team-b');
        $team2->setAgeGroup($ageGroup);
        $this->em->persist($team2);
        $this->em->flush();

        $game1 = $this->createGame($team1);
        $event1 = new GameEvent();
        $event1->setTeam($team1)->setGame($game1)->setGameEventType($eventType)->setTimestamp(new DateTimeImmutable('2023-03-10'));
        $this->em->persist($event1);

        $game2 = $this->createGame($team2);
        $event2 = new GameEvent();
        $event2->setTeam($team2)->setGame($game2)->setGameEventType($eventType)->setTimestamp(new DateTimeImmutable('2024-07-20'));
        $this->em->persist($event2);
        $this->em->flush();

        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $dates = $data['availableDates'];
        $this->assertGreaterThanOrEqual(2, count($dates), 'Es müssen mind. 2 Datumseinträge vorhanden sein.');

        $sorted = $dates;
        sort($sorted);
        $this->assertSame($sorted, $dates, 'availableDates must be sorted ascending.');
    }

    // =========================================================================
    //  GET /api/report/builder-data – Teams-Filter
    // =========================================================================

    public function testBuilderDataTeamsOnlyContainsTeamsWithEvents(): void
    {
        $user = $this->fixtureUser;

        // Team with events
        [$teamWithEvents, $teamId] = $this->createTeamWithEvent('Team mit Events');

        // Team without events — should NOT appear in builder-data
        $emptyTeam = $this->createTeamWithoutEvent('Team ohne Events');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/builder-data');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $teamIds = array_column($data['teams'], 'id');

        $this->assertContains($teamId, $teamIds, 'Team mit Events muss in der Liste sein.');
        $this->assertNotContains($emptyTeam->getId(), $teamIds, 'Team ohne Events darf nicht in der Liste sein.');
    }

    // =========================================================================
    //  GET /api/report/builder-data – HTTP-Cache-Header
    // =========================================================================

    public function testBuilderDataHasCacheControlHeader(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/builder-data');

        $cacheControl = $this->client->getResponse()->headers->get('Cache-Control');
        $this->assertNotNull($cacheControl, 'Cache-Control header must be present.');
        $this->assertStringContainsString('max-age=300', $cacheControl);
    }

    // =========================================================================
    //  GET /api/report/player-search – Authentifizierung
    // =========================================================================

    public function testPlayerSearchRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/report/player-search?q=Müller');
        $this->assertResponseStatusCodeSame(401);
    }

    // =========================================================================
    //  GET /api/report/player-search – Kurzanfragen abweisen
    // =========================================================================

    public function testPlayerSearchReturnsEmptyArrayForEmptyQuery(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/player-search?q=');
        $this->assertResponseIsSuccessful();
        $this->assertSame([], json_decode($this->client->getResponse()->getContent(), true), 'Empty query must return [].');
    }

    public function testPlayerSearchReturnsEmptyArrayForSingleCharQuery(): void
    {
        $user = $this->fixtureUser;
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/player-search?q=M');
        $this->assertResponseIsSuccessful();
        $this->assertSame([], json_decode($this->client->getResponse()->getContent(), true), 'Single-char query must return [].');
    }

    // =========================================================================
    //  GET /api/report/player-search – Treffer
    // =========================================================================

    public function testPlayerSearchReturnMatchingPlayersByLastName(): void
    {
        $user = $this->fixtureUser;
        $player = $this->createPlayer('FindMe', 'Suchname');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('Suchname'));

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertIsArray($data);
        $ids = array_column($data, 'id');
        $this->assertContains($player->getId(), $ids, 'Player with matching last name must be in results.');
    }

    public function testPlayerSearchReturnMatchingPlayersByFirstName(): void
    {
        $user = $this->fixtureUser;
        $player = $this->createPlayer('VornameXY', 'Beliebig');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('VornameXY'));

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $ids = array_column($data, 'id');
        $this->assertContains($player->getId(), $ids, 'Player with matching first name must be in results.');
    }

    public function testPlayerSearchIsCaseInsensitive(): void
    {
        $user = $this->fixtureUser;
        $player = $this->createPlayer('Maxi', 'Mustermann');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('mustermann'));

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $ids = array_column($data, 'id');
        $this->assertContains($player->getId(), $ids, 'Search must be case-insensitive.');
    }

    public function testPlayerSearchDoesNotReturnNonMatchingPlayer(): void
    {
        $user = $this->fixtureUser;
        $this->createPlayer('Nobody', 'XzqNotMatch99');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('NotMatchXzq99'));

        $data = json_decode($this->client->getResponse()->getContent(), true);
        // If there are results, they must not contain our non-matching player
        $names = array_column($data, 'lastName');
        $this->assertNotContains('XzqNotMatch99', $names, 'Non-matching player must not appear in results.');
    }

    // =========================================================================
    //  GET /api/report/player-search – Antwortstruktur
    // =========================================================================

    public function testPlayerSearchResultHasExpectedFields(): void
    {
        $user = $this->fixtureUser;
        $this->createPlayer('Beispiel', 'Spieler');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('Spieler'));

        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);
        $first = $data[0];
        foreach (['id', 'fullName', 'firstName', 'lastName'] as $field) {
            $this->assertArrayHasKey($field, $first, "Result item must have field '$field'.");
        }
    }

    public function testPlayerSearchIsLimitedToTwentyResults(): void
    {
        $user = $this->fixtureUser;

        // Create 25 players with the same distinctive last name prefix
        for ($i = 0; $i < 25; ++$i) {
            $this->createPlayer('Vorname' . $i, 'LimitTestXYZ' . $i);
        }

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=' . urlencode('LimitTestXYZ'));

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertLessThanOrEqual(20, count($data), 'Player search must return at most 20 results.');
    }

    // =========================================================================
    //  GET /api/report/player-search?teams=… – Team-Filter
    // =========================================================================

    public function testPlayerSearchWithTeamsFilterReturnsOnlyPlayersFromThoseTeams(): void
    {
        $user = $this->fixtureUser;

        [$teamA, $playerInA] = $this->createTeamWithPlayer('TeamA-TS', 'InTeamA', 'SearchTeam');
        [$teamB, $playerNotInA] = $this->createTeamWithPlayer('TeamB-TS', 'NotInTeamA', 'SearchTeam');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=SearchTeam&teams=' . $teamA->getId());

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $ids = array_column($data, 'id');

        $this->assertContains($playerInA->getId(), $ids, 'Spieler aus gefiltertem Team muss erscheinen.');
        $this->assertNotContains($playerNotInA->getId(), $ids, 'Spieler aus anderem Team darf nicht erscheinen.');
    }

    public function testPlayerSearchWithMultipleTeamIdsReturnsPlayersFromAllSpecifiedTeams(): void
    {
        $user = $this->fixtureUser;

        [$teamA, $playerA] = $this->createTeamWithPlayer('TeamMultiA-TS', 'MultiA', 'SearchMulti');
        [$teamB, $playerB] = $this->createTeamWithPlayer('TeamMultiB-TS', 'MultiB', 'SearchMulti');
        [$teamC, $playerC] = $this->createTeamWithPlayer('TeamMultiC-TS', 'MultiC', 'SearchMulti');

        $this->client->loginUser($user);
        $this->client->request('GET', sprintf(
            '/api/report/player-search?q=SearchMulti&teams=%d,%d',
            $teamA->getId(),
            $teamB->getId(),
        ));

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $ids = array_column($data, 'id');

        $this->assertContains($playerA->getId(), $ids, 'Spieler aus Team A muss erscheinen.');
        $this->assertContains($playerB->getId(), $ids, 'Spieler aus Team B muss erscheinen.');
        $this->assertNotContains($playerC->getId(), $ids, 'Spieler aus Team C (nicht gefiltert) darf nicht erscheinen.');
    }

    public function testPlayerSearchWithEmptyTeamsParamReturnsAllMatchingPlayers(): void
    {
        $user = $this->fixtureUser;

        [$teamA, $playerA] = $this->createTeamWithPlayer('TeamEmpty-A-TS', 'EmptyA', 'SearchNoFilter');
        [$teamB, $playerB] = $this->createTeamWithPlayer('TeamEmpty-B-TS', 'EmptyB', 'SearchNoFilter');

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/player-search?q=SearchNoFilter&teams=');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $ids = array_column($data, 'id');

        $this->assertContains($playerA->getId(), $ids, 'Ohne Team-Filter: Spieler A muss erscheinen.');
        $this->assertContains($playerB->getId(), $ids, 'Ohne Team-Filter: Spieler B muss erscheinen.');
    }

    public function testPlayerSearchWithInvalidTeamIdIgnoresIt(): void
    {
        $user = $this->fixtureUser;
        $player = $this->createPlayer('Valid', 'SearchInvalid');

        $this->client->loginUser($user);
        // teams=0 is invalid (≤ 0) → filter is ignored → behaves like no teams filter
        $this->client->request('GET', '/api/report/player-search?q=SearchInvalid&teams=0');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $ids = array_column($data, 'id');

        $this->assertContains($player->getId(), $ids, 'Ungültige Team-ID 0 wird ignoriert; Spieler muss trotzdem erscheinen.');
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    /**
     * Creates a team and a player assigned to it.
     *
     * @return array{0: Team, 1: Player}
     */
    private function createTeamWithPlayer(string $teamName, string $firstName, string $lastName): array
    {
        $ageGroup = $this->getOrCreateAgeGroup();
        $team = new Team();
        $team->setName(self::PREFIX . $teamName);
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $player = new Player();
        $player->setFirstName($firstName);
        $player->setLastName($lastName);
        $player->setBirthdate(new DateTime('1990-01-01'));
        $player->setMainPosition($this->getOrCreatePosition());
        $this->em->persist($player);
        $this->em->flush();

        $assignment = new \App\Entity\PlayerTeamAssignment();
        $assignment->setPlayer($player);
        $assignment->setTeam($team);
        $this->em->persist($assignment);
        $this->em->flush();

        return [$team, $player];
    }

    private function createPlayer(string $firstName, string $lastName): Player
    {
        $player = new Player();
        $player->setFirstName($firstName);
        $player->setLastName($lastName);
        $player->setBirthdate(new DateTime('1990-01-01'));
        $player->setMainPosition($this->getOrCreatePosition());
        $this->em->persist($player);
        $this->em->flush();

        return $player;
    }

    /**
     * Returns [Team, teamId]. Creates an AgeGroup, Team, GameEventType, Game and GameEvent
     * so the team appears in the builder-data teams list.
     *
     * @return array{0: Team, 1: int}
     */
    private function createTeamWithEvent(string $teamName): array
    {
        $ageGroup = $this->getOrCreateAgeGroup();
        $team = new Team();
        $team->setName(self::PREFIX . $teamName);
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);
        $this->em->flush();

        $eventType = $this->getOrCreateGameEventType();
        $game = $this->createGame($team);

        $event = new GameEvent();
        $event->setTeam($team);
        $event->setGame($game);
        $event->setGameEventType($eventType);
        $event->setTimestamp(new DateTimeImmutable('2024-06-15'));
        $this->em->persist($event);
        $this->em->flush();

        return [$team, $team->getId()];
    }

    private function createTeamWithoutEvent(string $teamName): Team
    {
        $ageGroup = $this->getOrCreateAgeGroup();
        $team = new Team();
        $team->setName(self::PREFIX . $teamName);
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);
        $this->em->flush();

        return $team;
    }

    private function createGame(Team $team): Game
    {
        $gameType = $this->getOrCreateGameType();
        $game = new Game();
        $game->setHomeTeam($team);
        $game->setGameType($gameType);
        $this->em->persist($game);
        $this->em->flush();

        return $game;
    }

    private function getOrCreateAgeGroup(): AgeGroup
    {
        $existing = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        if ($existing) {
            return $existing;
        }
        $ag = new AgeGroup();
        $ag->setName('Senioren');
        $this->em->persist($ag);
        $this->em->flush();

        return $ag;
    }

    private function getOrCreateGameEventType(): GameEventType
    {
        $existing = $this->em->getRepository(GameEventType::class)->findOneBy([]);
        if ($existing) {
            return $existing;
        }
        $t = new GameEventType();
        $t->setName('Tor');
        $t->setCode('GOAL');
        $this->em->persist($t);
        $this->em->flush();

        return $t;
    }

    private function getOrCreateGameType(): GameType
    {
        $existing = $this->em->getRepository(GameType::class)->findOneBy([]);
        if ($existing) {
            return $existing;
        }
        $gt = new GameType();
        $gt->setName('Liga');
        $this->em->persist($gt);
        $this->em->flush();

        return $gt;
    }

    private function getOrCreatePosition(): Position
    {
        $existing = $this->em->getRepository(Position::class)->findOneBy([]);
        if ($existing) {
            return $existing;
        }
        $pos = new Position();
        $pos->setName('Stürmer');
        $this->em->persist($pos);
        $this->em->flush();

        return $pos;
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
