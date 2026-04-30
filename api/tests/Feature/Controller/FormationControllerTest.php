<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Formation;
use App\Entity\FormationType;
use App\Entity\Team;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class FormationControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $this->entityManager->getConnection()->beginTransaction();
    }

    public function testIndexOnlyReturnsOwnFormations(): void
    {
        // user11 ist aktiver Trainer von Team 1
        $user = $this->loadUser('user11@example.com');
        $type = $this->getFormationType();
        $team = $this->loadFirstTeamForUser($user);

        if (null === $team) {
            $this->markTestSkipped('user11 hat kein aktives Trainer-Team in den Fixtures.');
        }

        // Formation MIT team_id erscheint im Index
        $this->createFormation($user, $type, 'voter-test-Team Formation', $team);
        // Formation OHNE team_id: nach Backfill-Migration wird team_id befüllt, aber
        // eine im Test neu angelegte Formation mit team=null und formationData=[] hat
        // keine Spieler → kein Backfill möglich → bleibt unsichtbar.
        $this->createFormation($user, $type, 'voter-test-No-Team Formation', null);

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $formationNames = array_column($data['formations'], 'name');
        $this->assertContains('voter-test-Team Formation', $formationNames);
        $this->assertNotContains('voter-test-No-Team Formation', $formationNames);
    }

    public function testIndexIncludesTeamIdAndTeamNameInResponse(): void
    {
        // user11 ist aktiver Trainer von Team 1
        $user = $this->loadUser('user11@example.com');
        $type = $this->getFormationType();
        $team = $this->loadFirstTeamForUser($user);

        if (null === $team) {
            $this->markTestSkipped('user11 hat kein aktives Trainer-Team in den Fixtures.');
        }

        $this->createFormation($user, $type, 'voter-test-Team Formation', $team);

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $found = null;
        foreach ($data['formations'] as $f) {
            if ('voter-test-Team Formation' === $f['name']) {
                $found = $f;
                break;
            }
        }

        $this->assertNotNull($found, 'Formation not found in response');
        $this->assertArrayHasKey('teamId', $found);
        $this->assertArrayHasKey('teamName', $found);
        $this->assertSame($team->getId(), $found['teamId']);
        $this->assertSame($team->getName(), $found['teamName']);
    }

    public function testIndexReturnsEmptyListForNonCoachUser(): void
    {
        // user6 ist kein Trainer (ROLE_USER, nur Elternteil eines Spielers).
        // collectCoachTeams() liefert [] → findVisibleForUser([]) liefert [] → leere Liste.
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $this->createFormation($user, $type, 'voter-test-No-Team Formation', null);

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertEmpty($data['formations']);
    }

    public function testEditDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Formation');

        $this->client->loginUser($user1);
        $this->client->request(
            'POST',
            '/formation/' . $otherFormation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Hacked', 'formationData' => []])
        );

        $this->assertResponseStatusCodeSame(403);
    }

    public function testEditAllowsAccessToOwnFormation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-My Formation');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/' . $formation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Updated', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
    }

    public function testEditResponseIncludesTeamId(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-My Formation');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/' . $formation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Updated', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teamId', $data['formation']);
    }

    public function testDeleteDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Formation');

        $this->client->loginUser($user1);
        $this->client->request('DELETE', '/formation/' . $otherFormation->getId() . '/delete');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testDeleteAllowsAccessToOwnFormation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-My Formation');

        $this->client->loginUser($user);
        $this->client->request('DELETE', '/formation/' . $formation->getId() . '/delete');

        $this->assertResponseIsSuccessful();
    }

    public function testAdminCanAccessOtherUsersFormation(): void
    {
        $regularUser = $this->loadUser('user6@example.com');
        $admin = $this->loadUser('user16@example.com');
        $type = $this->getFormationType();
        $userFormation = $this->createFormation($regularUser, $type, 'voter-test-User Formation');

        $this->client->loginUser($admin);
        $this->client->request(
            'POST',
            '/formation/' . $userFormation->getId() . '/edit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-Admin Modified', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
    }

    // ─── new() – Eingabevalidierung ───────────────────────────────────────────

    public function testNewReturnsWith422WhenNameIsEmpty(): void
    {
        $user = $this->loadUser('user6@example.com');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/new',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => '', 'formationData' => []])
        );

        $this->assertResponseStatusCodeSame(422);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
        $this->assertNotEmpty($data['error']);
    }

    public function testNewReturnsWith422WhenNameIsAbsent(): void
    {
        $user = $this->loadUser('user6@example.com');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/new',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['formationData' => []])
        );

        $this->assertResponseStatusCodeSame(422);
    }

    public function testNewCreatesFormationAndReturnsTeamId(): void
    {
        $user = $this->loadUser('user6@example.com');

        $this->client->loginUser($user);
        $this->client->request(
            'POST',
            '/formation/new',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'voter-test-New Formation', 'formationData' => []])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('teamId', $data['formation']);
        $this->assertArrayHasKey('id', $data['formation']);
    }

    // ─── duplicate() – Team wird mitkopiert ──────────────────────────────────

    public function testDuplicateResponseIncludesTeamId(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-Original');

        $this->client->loginUser($user);
        $this->client->request('POST', '/formation/' . $formation->getId() . '/duplicate');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teamId', $data['formation']);
        $this->assertSame($formation->getTeam()?->getId(), $data['formation']['teamId']);
    }

    // ─── archive() / unarchive() / archived() ────────────────────────────────

    public function testArchivedEndpointReturnsEmptyListWhenNoneArchived(): void
    {
        $user = $this->loadUser('user6@example.com');
        $this->client->loginUser($user);
        $this->client->request('GET', '/formations/archived');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('formations', $data);
        $this->assertSame([], $data['formations']);
    }

    public function testArchivedEndpointReturnsArchivedFormation(): void
    {
        $user = $this->loadUser('user11@example.com');
        $type = $this->getFormationType();
        $team = $this->loadFirstTeamForUser($user);

        if (null === $team) {
            $this->markTestSkipped('user11 hat kein aktives Trainer-Team in den Fixtures.');
        }

        $formation = $this->createFormation($user, $type, 'voter-test-Archived Formation', $team);
        $formation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations/archived');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $formationNames = array_column($data['formations'], 'name');
        $this->assertContains('voter-test-Archived Formation', $formationNames);
    }

    public function testArchivedFormationDoesNotAppearInActiveIndex(): void
    {
        $user = $this->loadUser('user11@example.com');
        $type = $this->getFormationType();
        $team = $this->loadFirstTeamForUser($user);

        if (null === $team) {
            $this->markTestSkipped('user11 hat kein aktives Trainer-Team in den Fixtures.');
        }

        $formation = $this->createFormation($user, $type, 'voter-test-Archived From Index', $team);
        $formation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $formationNames = array_column($data['formations'], 'name');
        $this->assertNotContains('voter-test-Archived From Index', $formationNames);
    }

    public function testArchiveMovesFormationToArchived(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-To Archive');

        $this->client->loginUser($user);
        $this->client->request('POST', '/formation/' . $formation->getId() . '/archive');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
    }

    public function testArchiveDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Archive');

        $this->client->loginUser($user1);
        $this->client->request('POST', '/formation/' . $otherFormation->getId() . '/archive');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testUnarchiveRestoresFormation(): void
    {
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();
        $formation = $this->createFormation($user, $type, 'voter-test-To Unarchive');
        $formation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($user);
        $this->client->request('POST', '/formation/' . $formation->getId() . '/unarchive');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('formation', $data);
        $this->assertSame($formation->getId(), $data['formation']['id']);
    }

    public function testUnarchiveDeniesAccessToOtherUsersFormation(): void
    {
        $user1 = $this->loadUser('user6@example.com');
        $user2 = $this->loadUser('user7@example.com');
        $type = $this->getFormationType();
        $otherFormation = $this->createFormation($user2, $type, 'voter-test-Other Unarchive');
        $otherFormation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($user1);
        $this->client->request('POST', '/formation/' . $otherFormation->getId() . '/unarchive');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testArchivedResponseIncludesArchivedAtField(): void
    {
        $user = $this->loadUser('user11@example.com');
        $type = $this->getFormationType();
        $team = $this->loadFirstTeamForUser($user);

        if (null === $team) {
            $this->markTestSkipped('user11 hat kein aktives Trainer-Team in den Fixtures.');
        }

        $formation = $this->createFormation($user, $type, 'voter-test-ArchivedAt Check', $team);
        $formation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($user);
        $this->client->request('GET', '/formations/archived');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $found = null;
        foreach ($data['formations'] as $f) {
            if ('voter-test-ArchivedAt Check' === $f['name']) {
                $found = $f;
                break;
            }
        }

        $this->assertNotNull($found, 'Archived formation not found in response');
        $this->assertArrayHasKey('archivedAt', $found);
        $this->assertNotNull($found['archivedAt']);
    }

    public function testArchivedEndpointFiltersByTeamForSuperAdmin(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $user = $this->loadUser('user6@example.com');
        $type = $this->getFormationType();

        $team = $this->loadFirstTeamForUser($admin);
        if (null === $team) {
            $this->markTestSkipped('user21 hat kein aktives Trainer-Team in den Fixtures.');
        }

        // Archivierte Formation ohne Team – sollte bei teamId-Filter nicht erscheinen
        $noTeamFormation = $this->createFormation($user, $type, 'voter-test-No-Team Archived', null);
        $noTeamFormation->archive();

        // Archivierte Formation mit Team
        $teamFormation = $this->createFormation($user, $type, 'voter-test-Team Archived', $team);
        $teamFormation->archive();
        $this->entityManager->flush();

        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/archived', ['teamId' => $team->getId()]);

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $formationNames = array_column($data['formations'], 'name');
        $this->assertContains('voter-test-Team Archived', $formationNames);
        $this->assertNotContains('voter-test-No-Team Archived', $formationNames);
    }

    // ─── allTeams() – /formations/teams ──────────────────────────────────────

    public function testAllTeamsDeniesAccessForNonSuperAdmin(): void
    {
        $user = $this->loadUser('user11@example.com'); // ROLE_CLUB, kein SUPERADMIN
        $this->client->loginUser($user);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseStatusCodeSame(403);
    }

    public function testAllTeamsRequiresAuthentication(): void
    {
        $this->client->request('GET', '/formations/teams');

        // Unauthentifizierte Anfrage → 401, 302 oder 403 (je nach Firewall-Konfiguration)
        $this->assertThat(
            $this->client->getResponse()->getStatusCode(),
            $this->logicalOr(
                $this->equalTo(401),
                $this->equalTo(302),
                $this->equalTo(403)
            )
        );
    }

    public function testAllTeamsReturnsList(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);
        $this->assertIsArray($data['teams']);
        $this->assertNotEmpty($data['teams']);
    }

    public function testAllTeamsResponseIncludesAssignedField(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        foreach ($data['teams'] as $team) {
            $this->assertArrayHasKey('assigned', $team, 'Jedes Team muss ein "assigned"-Feld haben.');
            $this->assertIsBool($team['assigned']);
        }
    }

    public function testAllTeamsResponseIncludesIdAndNameFields(): void
    {
        $admin = $this->loadUser('user21@example.com');
        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $team = $data['teams'][0];
        $this->assertArrayHasKey('id', $team);
        $this->assertArrayHasKey('name', $team);
    }

    public function testAllTeamsMarksAssignedTeamsCorrectly(): void
    {
        // user21 ist via Fixtures coach_9 zugeordnet → hat mind. ein Team mit assigned=true
        $admin = $this->loadUser('user21@example.com');
        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $assignedTeams = array_filter($data['teams'], fn ($t) => true === $t['assigned']);
        $this->assertNotEmpty($assignedTeams, 'user21 muss mind. ein zugeordnetes Team haben (Fixtures).');
    }

    public function testAllTeamsMarksUnassignedTeamsCorrectly(): void
    {
        // Alle Teams aus der DB; mindestens eines davon ist user21 NICHT zugeordnet
        $admin = $this->loadUser('user21@example.com');
        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $unassignedTeams = array_filter($data['teams'], fn ($t) => false === $t['assigned']);
        $this->assertNotEmpty($unassignedTeams, 'Es muss mind. ein nicht-zugeordnetes Team geben.');
    }

    public function testAllTeamsAssignedTeamIdsMatchCoachTeams(): void
    {
        $admin = $this->loadUser('user21@example.com');

        // Erwartete IDs aus dem Service holen
        $accessService = static::getContainer()->get(\App\Service\UserTeamAccessService::class);
        $coachTeams = $accessService->getSelfCoachTeams($admin);
        $expectedIds = array_keys($coachTeams);

        $this->client->loginUser($admin);
        $this->client->request('GET', '/formations/teams');

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $assignedIds = array_column(
            array_filter($data['teams'], fn ($t) => true === $t['assigned']),
            'id'
        );

        sort($expectedIds);
        sort($assignedIds);
        $this->assertSame($expectedIds, $assignedIds, 'assigned-IDs müssen den Coach-Teams entsprechen.');
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function loadUser(string $email): User
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user, sprintf('Fixture user "%s" not found. Please load fixtures.', $email));

        return $user;
    }

    private function loadFirstTeamForUser(User $user): ?Team
    {
        // Gibt das erste aktive Trainer-Team des Users zurück
        $accessService = static::getContainer()->get(\App\Service\UserTeamAccessService::class);
        $coachTeams = $accessService->getSelfCoachTeams($user);

        return !empty($coachTeams) ? array_values($coachTeams)[0] : null;
    }

    private function getFormationType(): FormationType
    {
        $type = $this->entityManager->getRepository(FormationType::class)->findOneBy(['name' => 'fußball']);
        self::assertNotNull($type, 'FormationType "fußball" not found. Please load master fixtures.');

        return $type;
    }

    private function createFormation(User $user, FormationType $type, string $name, ?Team $team = null): Formation
    {
        $formation = new Formation();
        $formation->setUser($user);
        $formation->setFormationType($type);
        $formation->setName($name);
        $formation->setFormationData([]);
        $formation->setTeam($team);

        $this->entityManager->persist($formation);
        $this->entityManager->flush();

        return $formation;
    }

    protected function tearDown(): void
    {
        $this->entityManager->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }
}
