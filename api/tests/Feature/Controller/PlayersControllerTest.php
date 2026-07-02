<?php

namespace Tests\Feature\Controller;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class PlayersControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── Pagination ──────────────────────────────

    public function testIndexReturnsPaginatedStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/api/players');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('players', $data);
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('limit', $data);
        $this->assertIsArray($data['players']);
        $this->assertIsInt($data['total']);
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
    }

    public function testIndexDefaultsToPage1Limit25(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
        $this->assertLessThanOrEqual(25, count($data['players']));
    }

    public function testIndexRespectsCustomPageAndLimit(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?page=1&limit=5');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(5, $data['limit']);
        $this->assertLessThanOrEqual(5, count($data['players']));
    }

    public function testIndexLimitIsCappedAt100(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?limit=500');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(100, $data['limit']);
        $this->assertLessThanOrEqual(100, count($data['players']));
    }

    public function testIndexPageMinimumIs1(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?page=0');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
    }

    public function testIndexPaginationReturnsCorrectTotalCount(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Fetch first page with small limit
        $client->request('GET', '/api/players?page=1&limit=5');
        $data1 = json_decode($client->getResponse()->getContent(), true);
        $total = $data1['total'];

        // Fetch second page
        $client->request('GET', '/api/players?page=2&limit=5');
        $data2 = json_decode($client->getResponse()->getContent(), true);

        // Total should be the same across pages
        $this->assertEquals($total, $data2['total']);

        // If total > 5, second page should have results
        if ($total > 5) {
            $this->assertNotEmpty($data2['players']);
        }
    }

    public function testIndexBeyondLastPageReturnsEmptyArray(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?page=99999&limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['players']);
        // Total should still be available
        $this->assertGreaterThanOrEqual(0, $data['total']);
    }

    // ────────────────────────────── Search ──────────────────────────────

    public function testIndexFiltersBySearchTerm(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // First get all players to find a name to search for
        $client->request('GET', '/api/players?limit=1');
        $allData = json_decode($client->getResponse()->getContent(), true);

        if (empty($allData['players'])) {
            $this->markTestSkipped('No players in fixture data');
        }

        $firstName = $allData['players'][0]['firstName'];

        // Now search for that name
        $client->request('GET', '/api/players?search=' . urlencode($firstName));
        $searchData = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertNotEmpty($searchData['players']);
        // All results should contain the search term
        foreach ($searchData['players'] as $player) {
            $fullName = strtolower($player['firstName'] . ' ' . $player['lastName']);
            $this->assertStringContainsString(strtolower($firstName), $fullName);
        }
    }

    public function testIndexSearchWithNoMatchReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?search=zzzzxxxxxnonexistent99999');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['players']);
        $this->assertEquals(0, $data['total']);
    }

    // ────────────────────────────── Team Filter ──────────────────────────────

    public function testIndexFiltersByTeamId(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Get a team ID from the teams list
        $client->request('GET', '/api/teams/list');
        $teamsData = json_decode($client->getResponse()->getContent(), true);

        if (empty($teamsData['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $teamId = $teamsData['teams'][0]['id'];

        $client->request('GET', '/api/players?teamId=' . $teamId);
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('players', $data);
        // Total with team filter should be <= total without filter
        $client->request('GET', '/api/players');
        $allData = json_decode($client->getResponse()->getContent(), true);
        $this->assertLessThanOrEqual($allData['total'], $data['total']);
    }

    // ────────────────────────────── Player Data Structure ──────────────────────────────

    public function testIndexPlayerHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['players'])) {
            $this->markTestSkipped('No players in fixture data');
        }

        $player = $data['players'][0];
        $this->assertArrayHasKey('id', $player);
        $this->assertArrayHasKey('firstName', $player);
        $this->assertArrayHasKey('lastName', $player);
        $this->assertArrayHasKey('fullName', $player);
        $this->assertArrayHasKey('mainPosition', $player);
        $this->assertArrayHasKey('permissions', $player);
        $this->assertArrayHasKey('clubAssignments', $player);
        $this->assertArrayHasKey('teamAssignments', $player);
        $this->assertArrayHasKey('nationalityAssignments', $player);
    }

    // ────────────────────────────── Permissions ──────────────────────────────

    public function testIndexAdminHasFullPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/api/players?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['players'])) {
            $this->markTestSkipped('No players in fixture data');
        }

        $permissions = $data['players'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertTrue($permissions['canEdit']);
        $this->assertTrue($permissions['canCreate']);
        $this->assertTrue($permissions['canDelete']);
    }

    public function testIndexRegularUserSeesNoPlayers(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/api/players?limit=1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame([], $data['players']);
        $this->assertSame(0, $data['total']);
    }

    public function testIndexRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/players');

        // Should return 401 Unauthorized without authentication
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ────────────────────────────── Combined Filters ──────────────────────────────

    public function testIndexCombinesSearchAndTeamFilter(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Get a team ID
        $client->request('GET', '/api/teams/list');
        $teamsData = json_decode($client->getResponse()->getContent(), true);

        if (empty($teamsData['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $teamId = $teamsData['teams'][0]['id'];

        $client->request('GET', '/api/players?teamId=' . $teamId . '&search=a');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('players', $data);
        $this->assertArrayHasKey('total', $data);
    }

    public function testIndexCombinesSearchAndPagination(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?search=a&page=1&limit=3');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertLessThanOrEqual(3, count($data['players']));
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(3, $data['limit']);
    }

    // ────────────────────────────── Date Format (Regression) ──────────────────────────────
    // Regression: PHP \DateTime-Objekte dürfen NICHT als serialisiertes Objekt
    // (mit timezone/offset/timestamp-Keys) gesendet werden, sondern immer als
    // "YYYY-MM-DD"-String oder null.

    private function assertDateFormat(mixed $value, string $context): void
    {
        if (null === $value) {
            return; // null ist erlaubt
        }
        $this->assertIsString($value, "$context muss ein String sein, kein serialisiertes DateTime-Objekt");
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}$/',
            $value,
            "$context muss das Format YYYY-MM-DD haben"
        );
    }

    public function testIndexPlayerDatesAreStringNotSerializedObject(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players?limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['players'])) {
            $this->markTestSkipped('Keine Spieler in den Fixture-Daten');
        }

        foreach ($data['players'] as $player) {
            $this->assertDateFormat($player['birthdate'] ?? null, 'players[].birthdate');

            foreach ($player['clubAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "clubAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "clubAssignments[$i].endDate");
            }
            foreach ($player['nationalityAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "nationalityAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "nationalityAssignments[$i].endDate");
            }
            foreach ($player['teamAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "teamAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "teamAssignments[$i].endDate");
            }
        }
    }

    public function testShowPlayerDatesAreStringNotSerializedObject(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Spieler-ID aus der Liste holen
        $client->request('GET', '/api/players?limit=1');
        $listData = json_decode($client->getResponse()->getContent(), true);

        if (empty($listData['players'])) {
            $this->markTestSkipped('Keine Spieler in den Fixture-Daten');
        }

        $playerId = $listData['players'][0]['id'];

        $client->request('GET', '/api/players/' . $playerId);
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $player = $data['player'];

        $this->assertDateFormat($player['birthdate'] ?? null, 'player.birthdate');

        foreach ($player['clubAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "clubAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "clubAssignments[$i].endDate");
        }
        foreach ($player['nationalityAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "nationalityAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "nationalityAssignments[$i].endDate");
        }
        foreach ($player['teamAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "teamAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "teamAssignments[$i].endDate");
        }
    }

    // ────────────────────────────── show() ──────────────────────────────

    public function testShowReturnsPlayerById(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('player', $data);
        $this->assertSame(1, $data['player']['id']);
        $this->assertArrayHasKey('firstName', $data['player']);
        $this->assertArrayHasKey('lastName', $data['player']);
        $this->assertArrayHasKey('fullName', $data['player']);
    }

    public function testShowReturnsPlayerPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('permissions', $data['player']);
        $this->assertArrayHasKey('canView', $data['player']['permissions']);
        $this->assertArrayHasKey('canEdit', $data['player']['permissions']);
        $this->assertArrayHasKey('canCreate', $data['player']['permissions']);
        $this->assertArrayHasKey('canDelete', $data['player']['permissions']);
    }

    public function testShowReturnsPlayerRelations(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('mainPosition', $data['player']);
        $this->assertArrayHasKey('teamAssignments', $data['player']);
        $this->assertArrayHasKey('clubAssignments', $data['player']);
        $this->assertArrayHasKey('nationalityAssignments', $data['player']);
        $this->assertArrayHasKey('alternativePositions', $data['player']);
    }

    public function testShowRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/players/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testShowReturns404ForUnknownPlayer(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players/99999999');
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testShowAsRegularUserSucceeds(): void
    {
        // PlayerVoter allows all authenticated users to view
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
    }

    public function testShowAdminHasFullPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertTrue($data['player']['permissions']['canView']);
        $this->assertTrue($data['player']['permissions']['canEdit']);
        $this->assertTrue($data['player']['permissions']['canCreate']);
        $this->assertTrue($data['player']['permissions']['canDelete']);
    }

    // ────────────────────────────── create() ──────────────────────────────

    public function testCreateRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['firstName' => 'New', 'lastName' => 'Player'])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testCreateAsAdminReturnsCreated(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));

        // Get a position ID from fixtures
        $client->request('GET', '/api/players/1');
        $playerData = json_decode($client->getResponse()->getContent(), true);
        $positionId = $playerData['player']['mainPosition']['id'];

        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'NewCreate',
                'lastName' => 'PCT-' . $suffix,
                'email' => 'pct-create-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        // Cleanup
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $em->getConnection()->executeStatement(
            "DELETE FROM players WHERE last_name = 'PCT-" . $suffix . "'"
        );
    }

    public function testCreateAsRegularUserForbidden(): void
    {
        // Regular user is not a coach/admin, so PlayerVoter denies CREATE
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Blocked',
                'lastName' => 'PCT-blocked',
                'email' => 'blocked-pct@test.example.com',
                'mainPosition' => ['id' => 1],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testCreateWithNationalityAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'NewNat',
                'lastName' => 'PCT-nat-' . $suffix,
                'email' => 'pct-nat-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [
                    [
                        'startDate' => '2020-01-01',
                        'endDate' => null,
                        'nationality' => ['id' => 1],
                    ]
                ],
                'teamAssignments' => [],
            ])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Cleanup
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement("DELETE pna FROM player_nationality_assignments pna INNER JOIN players p ON pna.player_id = p.id WHERE p.last_name = 'PCT-nat-" . $suffix . "'");
        $conn->executeStatement("DELETE FROM players WHERE last_name = 'PCT-nat-" . $suffix . "'");
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function testCreateWithClubAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'NewClub',
                'lastName' => 'PCT-club-' . $suffix,
                'email' => 'pct-club-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [
                    [
                        'startDate' => '2020-01-01',
                        'endDate' => null,
                        'club' => ['id' => 1],
                    ]
                ],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Cleanup
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement("DELETE pca FROM player_club_assignments pca INNER JOIN players p ON pca.player_id = p.id WHERE p.last_name = 'PCT-club-" . $suffix . "'");
        $conn->executeStatement("DELETE FROM players WHERE last_name = 'PCT-club-" . $suffix . "'");
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function testCreateWithTeamAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'NewTeam',
                'lastName' => 'PCT-team-' . $suffix,
                'email' => 'pct-team-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [
                    [
                        'startDate' => '2024-07-01',
                        'endDate' => null,
                        'shirtNumber' => 77,
                        'team' => ['id' => 1],
                        'type' => 1,
                    ]
                ],
            ])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Cleanup
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement("DELETE pta FROM player_team_assignments pta INNER JOIN players p ON pta.player_id = p.id WHERE p.last_name = 'PCT-team-" . $suffix . "'");
        $conn->executeStatement("DELETE FROM players WHERE last_name = 'PCT-team-" . $suffix . "'");
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    // ────────────────────────────── update() ──────────────────────────────

    public function testUpdateRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request(
            'PUT',
            '/api/players/1',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['firstName' => 'X', 'lastName' => 'Y'])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testUpdateReturns404ForUnknownPlayer(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request(
            'PUT',
            '/api/players/99999999',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['firstName' => 'X', 'lastName' => 'Y', 'mainPosition' => ['id' => 1]])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testUpdateAsRegularUserForbidden(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request(
            'PUT',
            '/api/players/1',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Hacked',
                'lastName' => 'Player',
                'email' => '',
                'mainPosition' => ['id' => 1],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateAsAdminSucceeds(): void
    {
        // Minimal: create a player, update it, verify, restore original data
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        // 1. Create a disposable player
        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Upd',
                'lastName' => 'PCT-upd-' . $suffix,
                'email' => 'pct-upd-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Get the new player's ID
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $player = $em->getRepository(\App\Entity\Player::class)->findOneBy(['lastName' => 'PCT-upd-' . $suffix]);
        $this->assertNotNull($player);
        $playerId = $player->getId();

        // 2. Update it
        $client->request(
            'PUT',
            '/api/players/' . $playerId,
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'UpdatedName',
                'lastName' => 'PCT-upd-' . $suffix,
                'email' => 'pct-upd-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        // Cleanup
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement('DELETE FROM players WHERE id = ' . $playerId);
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function testUpdateWithNationalityAndClubAndTeamAssignments(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        // Create player with assignments
        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'UAll',
                'lastName' => 'PCT-uall-' . $suffix,
                'email' => 'pct-uall-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [
                    ['startDate' => '2020-01-01', 'endDate' => null, 'club' => ['id' => 1]]
                ],
                'nationalityAssignments' => [
                    ['startDate' => '2020-01-01', 'endDate' => null, 'nationality' => ['id' => 1]]
                ],
                'teamAssignments' => [
                    ['startDate' => '2024-07-01', 'endDate' => null, 'shirtNumber' => 44, 'team' => ['id' => 1], 'type' => 1]
                ],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $player = $em->getRepository(\App\Entity\Player::class)->findOneBy(['lastName' => 'PCT-uall-' . $suffix]);
        $this->assertNotNull($player);
        $playerId = $player->getId();

        // Update - replace with different assignments
        $client->request(
            'PUT',
            '/api/players/' . $playerId,
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'UAllUpdated',
                'lastName' => 'PCT-uall-' . $suffix,
                'email' => 'pct-uall-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [
                    ['startDate' => '2021-01-01', 'endDate' => null, 'club' => ['id' => 2]]
                ],
                'nationalityAssignments' => [
                    ['startDate' => '2021-01-01', 'endDate' => null, 'nationality' => ['id' => 2]]
                ],
                'teamAssignments' => [
                    ['startDate' => '2024-07-01', 'endDate' => null, 'shirtNumber' => 55, 'team' => ['id' => 1], 'type' => 1]
                ],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Cleanup
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement('DELETE pna FROM player_nationality_assignments pna WHERE pna.player_id = ' . $playerId);
        $conn->executeStatement('DELETE pca FROM player_club_assignments pca WHERE pca.player_id = ' . $playerId);
        $conn->executeStatement('DELETE pta FROM player_team_assignments pta WHERE pta.player_id = ' . $playerId);
        $conn->executeStatement('DELETE FROM players WHERE id = ' . $playerId);
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    // ────────────────────────────── delete() ──────────────────────────────

    public function testDeleteRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('DELETE', '/api/players/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testDeleteReturns404ForUnknownPlayer(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('DELETE', '/api/players/99999999');
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testDeleteAsRegularUserForbidden(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('DELETE', '/api/players/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteAsAdminSucceeds(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $suffix = bin2hex(random_bytes(4));
        $positionId = $this->fetchFixturePositionId($client);

        // Create a disposable player to delete
        $client->request(
            'POST',
            '/api/players',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'DelMe',
                'lastName' => 'PCT-del-' . $suffix,
                'email' => 'pct-del-' . $suffix . '@test.example.com',
                'mainPosition' => ['id' => $positionId],
                'alternativePositions' => [],
                'clubAssignments' => [],
                'nationalityAssignments' => [],
                'teamAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $player = $em->getRepository(\App\Entity\Player::class)->findOneBy(['lastName' => 'PCT-del-' . $suffix]);
        $this->assertNotNull($player);
        $playerId = $player->getId();

        // Delete the player
        $client->request('DELETE', '/api/players/' . $playerId);
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        // Verify it's gone
        $em->clear();
        $this->assertNull($em->getRepository(\App\Entity\Player::class)->find($playerId));
    }

    private function fetchFixturePositionId(KernelBrowser $client): int
    {
        $client->request('GET', '/api/players/1');
        $this->assertResponseIsSuccessful();
        $playerData = json_decode($client->getResponse()->getContent(), true);

        return $playerData['player']['mainPosition']['id'];
    }
}
