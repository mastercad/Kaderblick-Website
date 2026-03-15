<?php

namespace Tests\Feature\Controller;

use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class PlayersControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── Pagination ──────────────────────────────

    public function testIndexReturnsPaginatedStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

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
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/players');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
        $this->assertLessThanOrEqual(25, count($data['players']));
    }

    public function testIndexRespectsCustomPageAndLimit(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/players?page=1&limit=5');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(5, $data['limit']);
        $this->assertLessThanOrEqual(5, count($data['players']));
    }

    public function testIndexLimitIsCappedAt100(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/players?limit=500');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(100, $data['limit']);
        $this->assertLessThanOrEqual(100, count($data['players']));
    }

    public function testIndexPageMinimumIs1(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/players?page=0');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
    }

    public function testIndexPaginationReturnsCorrectTotalCount(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

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

    public function testIndexRegularUserHasViewOnlyPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/api/players?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['players'])) {
            $this->markTestSkipped('No players in fixture data');
        }

        $permissions = $data['players'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertFalse($permissions['canEdit']);
        $this->assertFalse($permissions['canCreate']);
        $this->assertFalse($permissions['canDelete']);
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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
        $this->authenticateUser($client, 'user16@example.com');

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
}
