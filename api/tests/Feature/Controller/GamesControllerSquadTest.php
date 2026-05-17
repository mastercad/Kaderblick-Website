<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Participation;
use App\Entity\ParticipationStatus;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
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
 * Tests für GET /api/games/{id}/squad.
 *
 * Prüft, dass nur Spieler mit confirmed Participation (attending/late) erscheinen
 * und Eltern/Geschwister (anderer RelationType) korrekt herausgefiltert werden.
 */
class GamesControllerSquadTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    // ── Test-Objekte (werden in setUp() erstellt) ─────────────────────────────

    private Team $homeTeam;
    private Team $awayTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private Player $playerA;
    private Player $playerC;       // wird im „not_attending"-Test gebraucht
    private User $userPlayerA;
    private User $userParent;
    private User $userPlayerC;

    private ParticipationStatus $statusAttending;
    private ParticipationStatus $statusNotAttending;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);

        // ── Fixture-Entitäten holen ───────────────────────────────────────────
        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        self::assertNotNull($position, 'Keine Fixture-Position. Bitte Fixtures laden.');

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $this->statusAttending = $this->em->getRepository(ParticipationStatus::class)
            ->findOneBy(['code' => 'attending']);
        self::assertNotNull($this->statusAttending, 'ParticipationStatus "attending" nicht gefunden. Bitte Fixtures laden.');

        $this->statusNotAttending = $this->em->getRepository(ParticipationStatus::class)
            ->findOneBy(['code' => 'not_attending']);
        self::assertNotNull($this->statusNotAttending, 'ParticipationStatus "not_attending" nicht gefunden. Bitte Fixtures laden.');

        $selfPlayerType = $this->em->getRepository(RelationType::class)
            ->findOneBy(['identifier' => 'self_player']);
        self::assertNotNull($selfPlayerType, 'RelationType "self_player" nicht gefunden. Bitte Fixtures laden.');

        $parentType = $this->em->getRepository(RelationType::class)
            ->findOneBy(['identifier' => 'parent']);
        self::assertNotNull($parentType, 'RelationType "parent" nicht gefunden. Bitte Fixtures laden.');

        // ── Test-Teams ────────────────────────────────────────────────────────
        $this->homeTeam = new Team();
        $this->homeTeam->setName('test-squad-home');
        $this->homeTeam->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = new Team();
        $this->awayTeam->setName('test-squad-away');
        $this->awayTeam->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        // ── CalendarEvent + Game ──────────────────────────────────────────────
        $this->calendarEvent = new CalendarEvent();
        $this->calendarEvent->setTitle('test-squad-event');
        $this->calendarEvent->setStartDate(new DateTime());
        $this->calendarEvent->setEndDate(new DateTime('+2 hours'));
        $this->em->persist($this->calendarEvent);

        $this->game = new Game();
        $this->game->setHomeTeam($this->homeTeam);
        $this->game->setAwayTeam($this->awayTeam);
        $this->game->setGameType($gameType);
        $this->game->setCalendarEvent($this->calendarEvent);
        $this->em->persist($this->game);

        // ── Spieler A (attending) ─────────────────────────────────────────────
        $this->playerA = new Player();
        $this->playerA->setFirstName('test-squad-PlayerA');
        $this->playerA->setLastName('Testname');
        $this->playerA->setMainPosition($position);
        $this->em->persist($this->playerA);

        $ptaA = new PlayerTeamAssignment();
        $ptaA->setPlayer($this->playerA);
        $ptaA->setTeam($this->homeTeam);
        $ptaA->setShirtNumber(7);
        $ptaA->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($ptaA);

        // User for playerA (self_player relation) - use fixture user
        /** @var User $userPlayerA */
        $userPlayerA = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($userPlayerA, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->userPlayerA = $userPlayerA;

        $urA = new UserRelation();
        $urA->setUser($this->userPlayerA);
        $urA->setPlayer($this->playerA);
        $urA->setRelationType($selfPlayerType);
        $urA->setPermissions([]);
        $this->em->persist($urA);

        // ── User Parent (should NOT appear in squad) - use fixture user ──────
        /** @var User $userParent */
        $userParent = $this->em->getRepository(User::class)->findOneBy(['email' => 'user7@example.com']);
        self::assertNotNull($userParent, 'Fixture user user7@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->userParent = $userParent;

        $urParent = new UserRelation();
        $urParent->setUser($this->userParent);
        $urParent->setPlayer($this->playerA);
        $urParent->setRelationType($parentType);
        $urParent->setPermissions([]);
        $this->em->persist($urParent);

        // ── Spieler C (not_attending) ─────────────────────────────────────────
        $this->playerC = new Player();
        $this->playerC->setFirstName('test-squad-PlayerC');
        $this->playerC->setLastName('Testname');
        $this->playerC->setMainPosition($position);
        $this->em->persist($this->playerC);

        $ptaC = new PlayerTeamAssignment();
        $ptaC->setPlayer($this->playerC);
        $ptaC->setTeam($this->homeTeam);
        $ptaC->setShirtNumber(10);
        $ptaC->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($ptaC);

        /** @var User $userPlayerC */
        $userPlayerC = $this->em->getRepository(User::class)->findOneBy(['email' => 'user8@example.com']);
        self::assertNotNull($userPlayerC, 'Fixture user user8@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->userPlayerC = $userPlayerC;

        $urC = new UserRelation();
        $urC->setUser($this->userPlayerC);
        $urC->setPlayer($this->playerC);
        $urC->setRelationType($selfPlayerType);
        $urC->setPermissions([]);
        $this->em->persist($urC);

        $this->em->flush();
    }

    // ── Hilfsmethoden ──────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function authenticateAsPlayerA(): void
    {
        $this->authenticate($this->userPlayerA);
    }

    private function createParticipation(User $user, ParticipationStatus $status): Participation
    {
        $p = new Participation();
        $p->setEvent($this->calendarEvent);
        $p->setUser($user);
        $p->setStatus($status);
        $this->em->persist($p);
        $this->em->flush();

        return $p;
    }

    /** @return array<string, mixed> */
    private function requestSquad(): array
    {
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/squad');
        $this->assertResponseIsSuccessful();

        return json_decode($this->client->getResponse()->getContent(), true);
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    public function testSquadRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/squad');
        // GameVoter::VIEW returns false for anonymous users → 403 (kein ROLE_USER
        // access_control rule für /api/games, daher kein 401 vom JWT-Firewall)
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testSquadReturnsEmptyWhenNoParticipationsExist(): void
    {
        $this->authenticateAsPlayerA();

        $data = $this->requestSquad();

        $this->assertArrayHasKey('squad', $data);
        $this->assertArrayHasKey('hasParticipationData', $data);
        $this->assertEmpty($data['squad']);
        $this->assertFalse($data['hasParticipationData'], 'hasParticipationData muss false sein wenn keine Teilnahmen vorhanden.');
    }

    public function testSquadReturnsEmptyWithParticipationDataWhenNobodyAttending(): void
    {
        $this->authenticateAsPlayerA();

        // Niemand zugesagt
        $this->createParticipation($this->userPlayerA, $this->statusNotAttending);
        $this->createParticipation($this->userPlayerC, $this->statusNotAttending);

        $data = $this->requestSquad();

        $this->assertEmpty($data['squad'], 'Squad muss leer sein wenn niemand zugesagt hat.');
        $this->assertTrue($data['hasParticipationData'], 'hasParticipationData muss true sein da Teilnahme-Einträge existieren.');
    }

    public function testSquadContainsAttendingPlayer(): void
    {
        $this->authenticateAsPlayerA();

        $this->createParticipation($this->userPlayerA, $this->statusAttending);

        $data = $this->requestSquad();

        $this->assertTrue($data['hasParticipationData']);
        $this->assertCount(1, $data['squad'], 'Genau ein zugesagter Spieler muss im Squad erscheinen.');

        $squadPlayer = $data['squad'][0];
        $this->assertEquals($this->playerA->getId(), $squadPlayer['id']);
        $this->assertEquals('test-squad-PlayerA Testname', $squadPlayer['fullName']);
        $this->assertEquals(7, $squadPlayer['shirtNumber']);
        $this->assertEquals($this->homeTeam->getId(), $squadPlayer['teamId']);
    }

    public function testSquadExcludesParentUser(): void
    {
        $this->authenticateAsPlayerA();

        // Spieler A zugesagt + Elternteil zugesagt → Elternteil darf nicht im Squad erscheinen
        $this->createParticipation($this->userPlayerA, $this->statusAttending);
        $this->createParticipation($this->userParent, $this->statusAttending);

        $data = $this->requestSquad();

        $this->assertCount(1, $data['squad'], 'Nur der Spieler (self_player), nicht der Elternteil darf im Squad sein.');
        $this->assertEquals($this->playerA->getId(), $data['squad'][0]['id']);
    }

    public function testSquadExcludesNotAttendingPlayer(): void
    {
        $this->authenticateAsPlayerA();

        // PlayerA zugesagt, PlayerC abgesagt
        $this->createParticipation($this->userPlayerA, $this->statusAttending);
        $this->createParticipation($this->userPlayerC, $this->statusNotAttending);

        $data = $this->requestSquad();

        $this->assertCount(1, $data['squad'], 'Abgesagter Spieler darf nicht im Squad erscheinen.');
        $this->assertEquals($this->playerA->getId(), $data['squad'][0]['id']);
    }

    public function testSquadResponseHasExpectedShape(): void
    {
        $this->authenticateAsPlayerA();

        $this->createParticipation($this->userPlayerA, $this->statusAttending);

        $data = $this->requestSquad();

        $this->assertArrayHasKey('squad', $data);
        $this->assertArrayHasKey('allPlayers', $data);
        $this->assertArrayHasKey('hasParticipationData', $data);
        $this->assertIsArray($data['squad']);
        $this->assertIsArray($data['allPlayers']);
        $this->assertIsBool($data['hasParticipationData']);

        $player = $data['squad'][0];
        $this->assertArrayHasKey('id', $player);
        $this->assertArrayHasKey('fullName', $player);
        $this->assertArrayHasKey('shirtNumber', $player);
        $this->assertArrayHasKey('teamId', $player);
    }

    // ── allPlayers-Tests ───────────────────────────────────────────────────────

    public function testAllPlayersContainsAllActiveTeamPlayersRegardlessOfParticipation(): void
    {
        $this->authenticateAsPlayerA();

        // Nur playerA zugesagt – playerC hat keine Participation
        $this->createParticipation($this->userPlayerA, $this->statusAttending);

        $data = $this->requestSquad();

        $this->assertArrayHasKey('allPlayers', $data);

        $allPlayerIds = array_column($data['allPlayers'], 'id');

        // Beide Spieler haben aktive Teamzuordnungen → beide in allPlayers
        $this->assertContains(
            $this->playerA->getId(),
            $allPlayerIds,
            'PlayerA (attending) muss in allPlayers erscheinen.'
        );
        $this->assertContains(
            $this->playerC->getId(),
            $allPlayerIds,
            'PlayerC (nicht zugesagt) muss trotzdem in allPlayers erscheinen.'
        );
    }

    public function testAllPlayersIsReturnedEvenWhenNobodyConfirmed(): void
    {
        $this->authenticateAsPlayerA();

        // Niemand hat Participation angelegt
        $data = $this->requestSquad();

        $this->assertArrayHasKey('allPlayers', $data);
        $this->assertNotEmpty(
            $data['allPlayers'],
            'allPlayers muss aktive Teamspieler enthalten, auch wenn niemand zugesagt hat.'
        );

        $allPlayerIds = array_column($data['allPlayers'], 'id');
        $this->assertContains($this->playerA->getId(), $allPlayerIds);
        $this->assertContains($this->playerC->getId(), $allPlayerIds);
    }

    public function testAllPlayersReturnedWhenAllDeclined(): void
    {
        $this->authenticateAsPlayerA();

        // Alle haben abgesagt
        $this->createParticipation($this->userPlayerA, $this->statusNotAttending);
        $this->createParticipation($this->userPlayerC, $this->statusNotAttending);

        $data = $this->requestSquad();

        $this->assertEmpty($data['squad'], 'Squad muss leer sein.');
        $this->assertNotEmpty(
            $data['allPlayers'],
            'allPlayers muss trotz Absagen aktive Teamspieler enthalten.'
        );
    }

    public function testAllPlayersHasExpectedShape(): void
    {
        $this->authenticateAsPlayerA();

        $data = $this->requestSquad();

        $this->assertNotEmpty($data['allPlayers']);
        $player = $data['allPlayers'][0];

        $this->assertArrayHasKey('id', $player);
        $this->assertArrayHasKey('fullName', $player);
        $this->assertArrayHasKey('shirtNumber', $player);
        $this->assertArrayHasKey('teamId', $player);
    }

    public function testAllPlayersExcludesInactivePlayers(): void
    {
        $this->authenticateAsPlayerA();

        // Spieler D mit abgelaufener Teamzuordnung anlegen
        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        $playerD = new Player();
        $playerD->setFirstName('test-squad-PlayerD');
        $playerD->setLastName('Inactive');
        $playerD->setMainPosition($position);
        $this->em->persist($playerD);

        $ptaInactive = new PlayerTeamAssignment();
        $ptaInactive->setPlayer($playerD);
        $ptaInactive->setTeam($this->homeTeam);
        $ptaInactive->setShirtNumber(99);
        $ptaInactive->setStartDate(new DateTime('2020-01-01'));
        $ptaInactive->setEndDate(new DateTime('2021-12-31')); // abgelaufen
        $this->em->persist($ptaInactive);
        $this->em->flush();

        $data = $this->requestSquad();

        $allPlayerIds = array_column($data['allPlayers'], 'id');
        $this->assertNotContains(
            $playerD->getId(),
            $allPlayerIds,
            'Inaktiver Spieler (endDate in der Vergangenheit) darf nicht in allPlayers erscheinen.'
        );
    }

    public function testSquadPlayersAreSubsetOfAllPlayers(): void
    {
        $this->authenticateAsPlayerA();

        $this->createParticipation($this->userPlayerA, $this->statusAttending);

        $data = $this->requestSquad();

        $squadIds = array_column($data['squad'], 'id');
        $allPlayerIds = array_column($data['allPlayers'], 'id');

        foreach ($squadIds as $id) {
            $this->assertContains(
                $id,
                $allPlayerIds,
                'Jeder Spieler aus squad muss auch in allPlayers enthalten sein.'
            );
        }
    }

    // ── Teardown ───────────────────────────────────────────────────────────────

    protected function tearDown(): void
    {
        $conn = $this->em->getConnection();

        // Teilnahmen via CalendarEvent bereinigen
        $conn->executeStatement(
            <<<SQL
                DELETE FROM participations
                WHERE event_id IN (
                    SELECT id FROM (
                        SELECT id FROM calendar_events WHERE title LIKE 'test-squad-%'
                    ) AS tmp
                )
            SQL
        );

        // UserRelations via Player bereinigen
        $conn->executeStatement(
            <<<SQL
                DELETE FROM user_relations
                WHERE player_id IN (
                    SELECT id FROM (
                        SELECT id FROM players WHERE first_name LIKE 'test-squad-%'
                    ) AS tmp
                )
            SQL
        );

        // Games via CalendarEvent bereinigen
        $conn->executeStatement(
            <<<SQL
                DELETE FROM games
                WHERE calendar_event_id IN (
                    SELECT id FROM (
                        SELECT id FROM calendar_events WHERE title LIKE 'test-squad-%'
                    ) AS tmp
                )
            SQL
        );

        $conn->executeStatement("DELETE FROM calendar_events WHERE title LIKE 'test-squad-%'");

        // PlayerTeamAssignments via Team bereinigen
        $conn->executeStatement(
            <<<SQL
                DELETE FROM player_team_assignments
                WHERE team_id IN (
                    SELECT id FROM (
                        SELECT id FROM teams WHERE name LIKE 'test-squad-%'
                    ) AS tmp
                )
            SQL
        );

        // PlayerTeamAssignments via Player bereinigen
        $conn->executeStatement(
            <<<SQL
                DELETE FROM player_team_assignments
                WHERE player_id IN (
                    SELECT id FROM (
                        SELECT id FROM players WHERE first_name LIKE 'test-squad-%'
                    ) AS tmp
                )
            SQL
        );

        $conn->executeStatement("DELETE FROM players WHERE first_name LIKE 'test-squad-%'");
        $conn->executeStatement("DELETE FROM teams WHERE name LIKE 'test-squad-%'");

        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
