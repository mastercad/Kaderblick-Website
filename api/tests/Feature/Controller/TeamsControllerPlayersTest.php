<?php

namespace Tests\Feature\Controller;

use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\Team;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tests für den GET /api/teams/{id}/players Endpoint.
 *
 * Testet insbesondere den Bug-Fix: Spieler mit doppelter Trikotnummer dürfen
 * sich nicht gegenseitig überschreiben (vormals: $result[$shirtNumber] = ...).
 */
class TeamsControllerPlayersTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private Team $fixtureTeam;
    private Position $fixturePosition;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);

        // Erste Fixture-Team und Position aus der DB verwenden (müssen nach
        // `php bin/console doctrine:fixtures:load` vorhanden sein).
        $this->fixtureTeam = $this->em->getRepository(Team::class)->findOneBy([]);
        self::assertNotNull($this->fixtureTeam, 'Kein Fixture-Team gefunden. Bitte Fixtures laden.');

        $this->fixturePosition = $this->em->getRepository(Position::class)->findOneBy([]);
        self::assertNotNull($this->fixturePosition, 'Keine Fixture-Position gefunden. Bitte Fixtures laden.');
        $this->em->getConnection()->beginTransaction();
    }

    // ── Hilfsmethoden ──────────────────────────────────────────────────────────

    private function authenticateAdmin(): void
    {
        $user = $this->em->getRepository(\App\Entity\User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($user, 'Admin-Fixture-User user16@example.com nicht gefunden.');

        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function createTestPlayer(string $firstName, ?int $shirtNumber = null): Player
    {
        $player = new Player();
        $player->setFirstName($firstName);
        $player->setLastName('TestPlayer');
        $player->setMainPosition($this->fixturePosition);
        $this->em->persist($player);
        $this->em->flush();

        $pta = new PlayerTeamAssignment();
        $pta->setPlayer($player);
        $pta->setTeam($this->fixtureTeam);
        $pta->setShirtNumber($shirtNumber);
        $pta->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($pta);
        $this->em->flush();

        return $player;
    }

    /**
     * Leert den Doctrine-Identity-Map damit nachfolgende HTTP-Requests alle
     * Entitäten frisch aus der DB laden (statt veraltete Objekte aus dem Cache).
     */
    private function clearEntityManager(): void
    {
        $teamId = $this->fixtureTeam->getId();
        $positionId = $this->fixturePosition->getId();
        $this->em->clear();
        // Nach clear() werden die Fixture-Referenzen neu geladen
        $this->fixtureTeam = $this->em->find(Team::class, $teamId);
        $this->fixturePosition = $this->em->find(Position::class, $positionId);
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    public function testPlayersRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/teams/' . $this->fixtureTeam->getId() . '/players');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testPlayersReturnsJsonArray(): void
    {
        $this->authenticateAdmin();

        $this->client->request('GET', '/api/teams/' . $this->fixtureTeam->getId() . '/players');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Muss ein numerisch indexiertes Array sein, kein assoziativer Hash
        $this->assertIsArray($data);
        $this->assertEquals(array_values($data), $data, 'Antwort ist kein numerisch indexiertes Array.');
    }

    public function testPlayersHaveExpectedFields(): void
    {
        $this->authenticateAdmin();
        $this->createTestPlayer('test-squad-fields', 99);
        $this->clearEntityManager();

        $this->client->request('GET', '/api/teams/' . $this->fixtureTeam->getId() . '/players');
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertNotEmpty($data);

        // Eigenen Test-Spieler finden
        $testPlayer = null;
        foreach ($data as $p) {
            if ('test-squad-fields TestPlayer' === $p['fullName']) {
                $testPlayer = $p;
                break;
            }
        }
        $this->assertNotNull($testPlayer, 'Test-Spieler nicht in Antwort gefunden.');
        $this->assertArrayHasKey('id', $testPlayer);
        $this->assertArrayHasKey('fullName', $testPlayer);
        $this->assertArrayHasKey('shirtNumber', $testPlayer);
        $this->assertEquals(99, $testPlayer['shirtNumber']);
    }

    /**
     * Kerntest für den Bug-Fix: Zwei Spieler mit gleicher Trikotnummer dürfen
     * nicht die selbe Array-Position belegen.
     *
     * Vor dem Fix: $result[$shirtNumber] = [...] → zweiter Spieler überschreibt ersten.
     * Nach dem Fix: $result[] = [...] → beide Spieler erscheinen.
     */
    public function testDuplicateShirtNumberPlayersAllAppear(): void
    {
        $this->authenticateAdmin();

        $this->createTestPlayer('test-squad-dup-A', 7);
        $this->createTestPlayer('test-squad-dup-B', 7);
        $this->clearEntityManager();

        $this->client->request('GET', '/api/teams/' . $this->fixtureTeam->getId() . '/players');
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);

        $squad7 = array_filter($data, fn ($p) => 7 === $p['shirtNumber']
            && str_starts_with($p['fullName'], 'test-squad-dup-'));

        $this->assertCount(
            2,
            $squad7,
            'Beide Spieler mit Trikotnummer 7 müssen in der Antwort erscheinen.'
        );
    }

    /**
     * Spieler ohne Trikotnummer (null) werden ans Ende sortiert.
     */
    public function testPlayersSortedShirtNumberNullsLastThenAlphabetical(): void
    {
        $this->authenticateAdmin();

        // Prefix für eindeutige Identifikation
        $this->createTestPlayer('test-squad-sort-Z', null);   // soll letzte sein
        $this->createTestPlayer('test-squad-sort-B', 5);
        $this->createTestPlayer('test-squad-sort-A', 1);
        $this->clearEntityManager();

        $this->client->request('GET', '/api/teams/' . $this->fixtureTeam->getId() . '/players');
        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Nur die drei Test-Spieler isolieren
        $testPlayers = array_values(array_filter(
            $data,
            fn ($p) => str_starts_with($p['fullName'], 'test-squad-sort-')
        ));

        $this->assertCount(3, $testPlayers);

        // Reihenfolge: shirtNumber 1, 5, null
        $this->assertEquals(1, $testPlayers[0]['shirtNumber'], '1. Spieler muss Trikotnummer 1 haben.');
        $this->assertEquals(5, $testPlayers[1]['shirtNumber'], '2. Spieler muss Trikotnummer 5 haben.');
        $this->assertNull($testPlayers[2]['shirtNumber'], '3. Spieler ohne Trikotnummer muss letzte sein.');
    }

    // ── Teardown ───────────────────────────────────────────────────────────────

    protected function tearDown(): void
    {
        $this->em->getConnection()->rollBack();
        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
