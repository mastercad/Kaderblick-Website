<?php

namespace Tests\Feature\Controller;

use App\Entity\Coach;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature-Tests für GET /api/profile/relations.
 *
 * Der Endpoint gibt die UserRelations des eingeloggten Users zurück,
 * inklusive der verschachtelten PlayerClubAssignments bzw.
 * CoachClubAssignments mit Vereinsname, Logo und Farben.
 *
 * Wird von usePosterClub.ts genutzt, um den aktuellen Verein des Users
 * automatisch für die Poster-Vorschau zu ermitteln.
 *
 * Fixture-Voraussetzungen (--group=master --group=test):
 *   - user5@example.com  : hat UserRelation mit coach_7 (der eine CoachClubAssignment hat)
 *   - user6@example.com  : Elternteil von player_1_1 (der eine PlayerClubAssignment hat)
 *   - user9@example.com  : ROLE_USER, keine UserRelations
 *   - user10@example.com : ROLE_USER, keine UserRelations (für minimale Neu-Anlage)
 *   - Coach 8 (firstName='Coach', lastName='8'):
 *       hat 2 CoachClubAssignments, davon eines mit endDate='2020-12-31'
 */
class ProfileRelationsControllerTest extends ApiWebTestCase
{
    private const ENDPOINT = '/api/profile/relations';

    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        $this->em->getConnection()->rollBack();
        parent::tearDown();
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public function testRequiresAuthentication(): void
    {
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ── Leere Liste ──────────────────────────────────────────────────────────

    public function testReturnsEmptyArrayWhenUserHasNoRelations(): void
    {
        // user9 (ROLE_USER) hat laut UserRelationFixtures keine UserRelations.
        $this->authenticateUser($this->client, 'user9@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
        $this->assertEmpty($data);
    }

    // ── Spieler-Relation ─────────────────────────────────────────────────────

    public function testReturnsPlayerRelationWithClubAssignment(): void
    {
        // user6 ist laut UserRelationFixtures Elternteil von player_1_1 (Team 1).
        // player_1_1 hat laut PlayerFixtures eine PlayerClubAssignment zu einem Fixture-Club.
        $this->authenticateUser($this->client, 'user6@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);
        $rel = $data[0];

        $this->assertArrayHasKey('relationType', $rel);
        $this->assertArrayHasKey('identifier', $rel['relationType']);
        $this->assertArrayHasKey('player', $rel);
        $this->assertArrayHasKey('coach', $rel);
        $this->assertNotNull($rel['player']);

        $playerData = $rel['player'];
        $this->assertArrayHasKey('clubAssignments', $playerData);
        $this->assertNotEmpty($playerData['clubAssignments']);

        $ca = $playerData['clubAssignments'][0];
        $this->assertArrayHasKey('startDate', $ca);
        $this->assertArrayHasKey('endDate', $ca);
        $this->assertArrayHasKey('club', $ca);
        $this->assertArrayHasKey('name', $ca['club']);
        $this->assertArrayHasKey('logoUrl', $ca['club']);
        $this->assertArrayHasKey('clubColors', $ca['club']);
    }

    // ── Trainer-Relation ──────────────────────────────────────────────────────

    public function testReturnsCoachRelationWithClubAssignment(): void
    {
        // user5 hat laut UserRelationFixtures eine Relation die coach_7 enthält.
        // coach_7 hat laut CoachClubAssignmentFixtures eine CoachClubAssignment zu club2.
        $this->authenticateUser($this->client, 'user5@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);

        $coachRelation = null;
        foreach ($data as $rel) {
            if (!empty($rel['coach'])) {
                $coachRelation = $rel;
                break;
            }
        }
        $this->assertNotNull($coachRelation, 'Keine Relation mit coach-Daten in der Response gefunden.');

        $coachData = $coachRelation['coach'];
        $this->assertArrayHasKey('clubAssignments', $coachData);
        $this->assertNotEmpty($coachData['clubAssignments']);

        $ca = $coachData['clubAssignments'][0];
        $this->assertArrayHasKey('startDate', $ca);
        $this->assertArrayHasKey('endDate', $ca);
        $this->assertArrayHasKey('club', $ca);
        $this->assertArrayHasKey('name', $ca['club']);
        $this->assertArrayHasKey('logoUrl', $ca['club']);
        $this->assertArrayHasKey('clubColors', $ca['club']);
    }

    // ── End-Datum ─────────────────────────────────────────────────────────────

    public function testCoachAssignmentWithEndDateIsReturned(): void
    {
        // coach_8 hat laut CoachClubAssignmentFixtures ein beendetes Assignment
        // (club1, 2015-01-01 – 2020-12-31). Kein Fixture-User hat eine Relation zu
        // coach_8 → minimale Neuanlage einer UserRelation (absoluter Notfall).
        $coach = $this->em->getRepository(Coach::class)
            ->findOneBy(['firstName' => 'Coach', 'lastName' => '8']);
        self::assertNotNull($coach, 'Fixture-Coach "Coach 8" nicht gefunden.');

        $user = $this->em->getRepository(User::class)
            ->findOneBy(['email' => 'user10@example.com']);
        self::assertNotNull($user, 'Fixture-User "user10@example.com" nicht gefunden.');

        $rt = $this->em->getRepository(RelationType::class)
            ->findOneBy(['identifier' => 'parent']);
        self::assertNotNull($rt, 'RelationType "parent" nicht gefunden.');

        $relation = new UserRelation();
        $relation->setUser($user);
        $relation->setCoach($coach);
        $relation->setRelationType($rt);
        $this->em->persist($relation);
        $this->em->flush();

        $this->authenticateUser($this->client, 'user10@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);
        $coachData = $data[0]['coach'];
        $this->assertNotEmpty($coachData['clubAssignments']);

        $endedAssignment = null;
        foreach ($coachData['clubAssignments'] as $ca) {
            if ($ca['endDate'] !== null) {
                $endedAssignment = $ca;
                break;
            }
        }
        $this->assertNotNull($endedAssignment, 'Kein abgelaufenes ClubAssignment in der Response gefunden.');
        $this->assertSame('2020-12-31', $endedAssignment['endDate']);
    }

    // ── Mehrere Assignments ───────────────────────────────────────────────────

    public function testMultipleCoachAssignmentsAreAllReturned(): void
    {
        // coach_8 hat laut CoachClubAssignmentFixtures genau 2 CoachClubAssignments
        // (club1 beendet + club2 aktuell). Kein Fixture-User hat eine Relation zu
        // coach_8 → minimale Neuanlage einer UserRelation (absoluter Notfall).
        $coach = $this->em->getRepository(Coach::class)
            ->findOneBy(['firstName' => 'Coach', 'lastName' => '8']);
        self::assertNotNull($coach, 'Fixture-Coach "Coach 8" nicht gefunden.');

        $user = $this->em->getRepository(User::class)
            ->findOneBy(['email' => 'user10@example.com']);
        self::assertNotNull($user, 'Fixture-User "user10@example.com" nicht gefunden.');

        $rt = $this->em->getRepository(RelationType::class)
            ->findOneBy(['identifier' => 'parent']);
        self::assertNotNull($rt, 'RelationType "parent" nicht gefunden.');

        $relation = new UserRelation();
        $relation->setUser($user);
        $relation->setCoach($coach);
        $relation->setRelationType($rt);
        $this->em->persist($relation);
        $this->em->flush();

        $this->authenticateUser($this->client, 'user10@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);
        $this->assertCount(2, $data[0]['coach']['clubAssignments']);
    }

    // ── Response-Struktur ─────────────────────────────────────────────────────

    public function testResponseHasExpectedShape(): void
    {
        // user6 ist Elternteil von player_1_1 – vollständig strukturierter Datensatz.
        $this->authenticateUser($this->client, 'user6@example.com');
        $this->client->request('GET', self::ENDPOINT);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data);
        $rel = $data[0];

        foreach (['relationType', 'player', 'coach'] as $key) {
            $this->assertArrayHasKey($key, $rel, "Key \"$key\" fehlt in der Response.");
        }
        $this->assertArrayHasKey('identifier', $rel['relationType']);
        $this->assertNotNull($rel['player']);
        $this->assertArrayHasKey('clubAssignments', $rel['player']);

        $ca = $rel['player']['clubAssignments'][0];
        foreach (['startDate', 'endDate', 'club'] as $key) {
            $this->assertArrayHasKey($key, $ca, "Key \"$key\" fehlt in clubAssignment.");
        }
        foreach (['id', 'name', 'logoUrl', 'clubColors'] as $key) {
            $this->assertArrayHasKey($key, $ca['club'], "Key \"$key\" fehlt in club.");
        }
    }
}
