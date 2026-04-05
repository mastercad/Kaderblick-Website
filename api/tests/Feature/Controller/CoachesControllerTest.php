<?php

namespace Tests\Feature\Controller;

use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class CoachesControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── Pagination ──────────────────────────────

    public function testListReturnsPaginatedStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/coaches');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('coaches', $data);
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('limit', $data);
        $this->assertIsArray($data['coaches']);
        $this->assertIsInt($data['total']);
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
    }

    public function testListDefaultsToPage1Limit25(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
        $this->assertLessThanOrEqual(25, count($data['coaches']));
    }

    public function testListRespectsCustomPageAndLimit(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?page=1&limit=5');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(5, $data['limit']);
        $this->assertLessThanOrEqual(5, count($data['coaches']));
    }

    public function testListLimitIsCappedAt100(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?limit=500');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(100, $data['limit']);
        $this->assertLessThanOrEqual(100, count($data['coaches']));
    }

    public function testListPageMinimumIs1(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?page=-1');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
    }

    public function testListPaginationReturnsConsistentTotal(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        // Fetch first page with small limit
        $client->request('GET', '/api/coaches?page=1&limit=3');
        $data1 = json_decode($client->getResponse()->getContent(), true);
        $total = $data1['total'];

        // Fetch second page
        $client->request('GET', '/api/coaches?page=2&limit=3');
        $data2 = json_decode($client->getResponse()->getContent(), true);

        // Total should be the same across pages
        $this->assertEquals($total, $data2['total']);

        // If total > 3, second page should have results
        if ($total > 3) {
            $this->assertNotEmpty($data2['coaches']);
        }
    }

    public function testListBeyondLastPageReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?page=99999&limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['coaches']);
        $this->assertGreaterThanOrEqual(0, $data['total']);
    }

    // ────────────────────────────── Search ──────────────────────────────

    public function testListFiltersBySearchTerm(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        // Get a coach name to search for
        $client->request('GET', '/api/coaches?limit=1');
        $allData = json_decode($client->getResponse()->getContent(), true);

        if (empty($allData['coaches'])) {
            $this->markTestSkipped('No coaches in fixture data');
        }

        $firstName = $allData['coaches'][0]['firstName'];

        $client->request('GET', '/api/coaches?search=' . urlencode($firstName));
        $searchData = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertNotEmpty($searchData['coaches']);
        foreach ($searchData['coaches'] as $coach) {
            $fullName = strtolower($coach['firstName'] . ' ' . $coach['lastName']);
            $this->assertStringContainsString(strtolower($firstName), $fullName);
        }
    }

    public function testListSearchWithNoMatchReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?search=zzzzxxxxxnonexistent99999');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['coaches']);
        $this->assertEquals(0, $data['total']);
    }

    // ────────────────────────────── Team Filter ──────────────────────────────

    public function testListFiltersByTeamId(): void
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

        $client->request('GET', '/api/coaches?teamId=' . $teamId);
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('coaches', $data);

        // Total with team filter should be <= total without filter
        $client->request('GET', '/api/coaches');
        $allData = json_decode($client->getResponse()->getContent(), true);
        $this->assertLessThanOrEqual($allData['total'], $data['total']);
    }

    // ────────────────────────────── Data Structure ──────────────────────────────

    public function testListCoachHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['coaches'])) {
            $this->markTestSkipped('No coaches in fixture data');
        }

        $coach = $data['coaches'][0];
        $this->assertArrayHasKey('id', $coach);
        $this->assertArrayHasKey('firstName', $coach);
        $this->assertArrayHasKey('lastName', $coach);
        $this->assertArrayHasKey('email', $coach);
        $this->assertArrayHasKey('permissions', $coach);
        $this->assertArrayHasKey('clubAssignments', $coach);
        $this->assertArrayHasKey('teamAssignments', $coach);
        $this->assertArrayHasKey('licenseAssignments', $coach);
        $this->assertArrayHasKey('nationalityAssignments', $coach);
    }

    // ────────────────────────────── Permissions ──────────────────────────────

    public function testListAdminHasFullPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/coaches?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['coaches'])) {
            $this->markTestSkipped('No coaches in fixture data');
        }

        $permissions = $data['coaches'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertTrue($permissions['canEdit']);
        $this->assertTrue($permissions['canCreate']);
        $this->assertTrue($permissions['canDelete']);
    }

    public function testListRegularUserHasViewOnlyPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/api/coaches?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['coaches'])) {
            $this->markTestSkipped('No coaches in fixture data');
        }

        $permissions = $data['coaches'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertFalse($permissions['canEdit']);
        $this->assertFalse($permissions['canCreate']);
        $this->assertFalse($permissions['canDelete']);
    }

    public function testListRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/coaches');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ────────────────────────────── Combined Filters ──────────────────────────────

    public function testListCombinesSearchAndTeamFilter(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams/list');
        $teamsData = json_decode($client->getResponse()->getContent(), true);

        if (empty($teamsData['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $teamId = $teamsData['teams'][0]['id'];

        $client->request('GET', '/api/coaches?teamId=' . $teamId . '&search=a');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertArrayHasKey('coaches', $data);
        $this->assertArrayHasKey('total', $data);
    }

    public function testListCombinesSearchAndPagination(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?search=a&page=1&limit=3');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertLessThanOrEqual(3, count($data['coaches']));
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

    public function testListCoachDatesAreStringNotSerializedObject(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches?limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['coaches'])) {
            $this->markTestSkipped('Keine Coaches in den Fixture-Daten');
        }

        foreach ($data['coaches'] as $coach) {
            $this->assertDateFormat($coach['birthdate'] ?? null, 'coaches[].birthdate');

            foreach ($coach['clubAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "clubAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "clubAssignments[$i].endDate");
            }
            foreach ($coach['teamAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "teamAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "teamAssignments[$i].endDate");
            }
            foreach ($coach['licenseAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "licenseAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "licenseAssignments[$i].endDate");
            }
            foreach ($coach['nationalityAssignments'] ?? [] as $i => $a) {
                $this->assertDateFormat($a['startDate'] ?? null, "nationalityAssignments[$i].startDate");
                $this->assertDateFormat($a['endDate'] ?? null, "nationalityAssignments[$i].endDate");
            }
        }
    }

    public function testShowCoachDatesAreStringNotSerializedObject(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        // Coach-ID aus der Liste holen
        $client->request('GET', '/api/coaches?limit=1');
        $listData = json_decode($client->getResponse()->getContent(), true);

        if (empty($listData['coaches'])) {
            $this->markTestSkipped('Keine Coaches in den Fixture-Daten');
        }

        $coachId = $listData['coaches'][0]['id'];

        $client->request('GET', '/api/coaches/' . $coachId);
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $coach = $data['coach'];

        $this->assertDateFormat($coach['birthdate'] ?? null, 'coach.birthdate');

        foreach ($coach['clubAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "clubAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "clubAssignments[$i].endDate");
        }
        foreach ($coach['teamAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "teamAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "teamAssignments[$i].endDate");
        }
        foreach ($coach['licenseAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "licenseAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "licenseAssignments[$i].endDate");
        }
        foreach ($coach['nationalityAssignments'] ?? [] as $i => $a) {
            $this->assertDateFormat($a['startDate'] ?? null, "nationalityAssignments[$i].startDate");
            $this->assertDateFormat($a['endDate'] ?? null, "nationalityAssignments[$i].endDate");
        }
    }

    // ─────────────────────────── show() ───────────────────────────

    public function testShowReturnsCoachById(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('coach', $data);
        $this->assertSame(1, $data['coach']['id']);
        $this->assertArrayHasKey('firstName', $data['coach']);
        $this->assertArrayHasKey('lastName', $data['coach']);
    }

    public function testShowReturnsCoachRelations(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('clubAssignments', $data['coach']);
        $this->assertArrayHasKey('teamAssignments', $data['coach']);
        $this->assertArrayHasKey('licenseAssignments', $data['coach']);
        $this->assertArrayHasKey('nationalityAssignments', $data['coach']);
    }

    public function testShowRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/coaches/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testShowReturns404ForUnknownCoach(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $client->request('GET', '/api/coaches/99999999');
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testShowAsRegularUserSucceeds(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('GET', '/api/coaches/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('coach', $data);
    }

    public function testShowReturnsPermissionsKey(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/coaches/1');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('permissions', $data['coach']);
        $this->assertArrayHasKey('canEdit', $data['coach']['permissions']);
        $this->assertArrayHasKey('canDelete', $data['coach']['permissions']);
    }

    // ─────────────────────────── create() ───────────────────────────

    public function testCreateRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['firstName' => 'New', 'lastName' => 'Coach'])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testCreateAsRegularUserForbidden(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');
        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'New',
                'lastName' => 'Coach',
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testCreateAsAdminReturnsCreated(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'New',
                'lastName' => 'CCT-' . $suffix,
                'email' => 'cct-' . $suffix . '@test.example.com',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $em->getConnection()->executeStatement(
            'DELETE FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-' . $suffix]
        );
    }

    public function testCreateWithNationalityAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Nat',
                'lastName' => 'CCT-NAT-' . $suffix,
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [
                    ['nationality' => ['id' => 1], 'startDate' => '2024-01-01', 'endDate' => null],
                ],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement(
            'DELETE cna FROM coach_nationality_assignments cna
              JOIN coaches c ON cna.coach_id = c.id WHERE c.last_name = :ln',
            ['ln' => 'CCT-NAT-' . $suffix]
        );
        $conn->executeStatement(
            'DELETE FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-NAT-' . $suffix]
        );
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function testCreateWithClubAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Club',
                'lastName' => 'CCT-CLUB-' . $suffix,
                'email' => '',
                'clubAssignments' => [
                    ['club' => ['id' => 1], 'startDate' => '2024-01-01', 'endDate' => null],
                ],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $conn = $em->getConnection();
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $conn->executeStatement(
            'DELETE cca FROM coach_club_assignments cca
              JOIN coaches c ON cca.coach_id = c.id WHERE c.last_name = :ln',
            ['ln' => 'CCT-CLUB-' . $suffix]
        );
        $conn->executeStatement(
            'DELETE FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-CLUB-' . $suffix]
        );
        $conn->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    // ─────────────────────────── update() ───────────────────────────

    public function testUpdateRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request(
            'PUT',
            '/api/coaches/1',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['firstName' => 'X', 'lastName' => 'Y', 'email' => ''])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testUpdateReturns404ForUnknownCoach(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $client->request(
            'PUT',
            '/api/coaches/99999999',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'X',
                'lastName' => 'Y',
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testUpdateAsRegularUserForbidden(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');
        $client->request(
            'PUT',
            '/api/coaches/1',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'X',
                'lastName' => 'Y',
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateAsAdminSucceeds(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        // Create a temporary coach so fixture data is not modified
        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Upd',
                'lastName' => 'CCT-UPD-' . $suffix,
                'email' => 'cct-upd-' . $suffix . '@test.example.com',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $newId = $em->getConnection()->fetchOne(
            'SELECT id FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-UPD-' . $suffix]
        );
        $this->assertNotFalse($newId);

        $client->request(
            'PUT',
            '/api/coaches/' . $newId,
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Updated',
                'lastName' => 'CCT-UPD-' . $suffix,
                'email' => 'cct-upd-' . $suffix . '@test.example.com',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        $em->getConnection()->executeStatement(
            'DELETE FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-UPD-' . $suffix]
        );
    }

    public function testUpdateWithNationalityAssignment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        // Create a temporary coach so fixture data is not modified
        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Nat',
                'lastName' => 'CCT-NAUPD-' . $suffix,
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $newId = $em->getConnection()->fetchOne(
            'SELECT id FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-NAUPD-' . $suffix]
        );
        $this->assertNotFalse($newId);

        $client->request(
            'PUT',
            '/api/coaches/' . $newId,
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Nat',
                'lastName' => 'CCT-NAUPD-' . $suffix,
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [
                    ['nationality' => ['id' => 1], 'startDate' => '2024-01-01', 'endDate' => null],
                ],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Cleanup temporary coach and its assignments
        $em->getConnection()->executeStatement('SET FOREIGN_KEY_CHECKS=0');
        $em->getConnection()->executeStatement(
            'DELETE cna FROM coach_nationality_assignments cna
              JOIN coaches c ON cna.coach_id = c.id WHERE c.last_name = :ln',
            ['ln' => 'CCT-NAUPD-' . $suffix]
        );
        $em->getConnection()->executeStatement(
            'DELETE FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-NAUPD-' . $suffix]
        );
        $em->getConnection()->executeStatement('SET FOREIGN_KEY_CHECKS=1');
    }

    // ─────────────────────────── delete() ───────────────────────────

    public function testDeleteRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('DELETE', '/api/coaches/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testDeleteReturns404ForUnknownCoach(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $client->request('DELETE', '/api/coaches/99999999');
        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testDeleteAsRegularUserForbidden(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('DELETE', '/api/coaches/1');
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteAsAdminSucceeds(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');
        $suffix = bin2hex(random_bytes(4));

        // Create a coach to delete
        $client->request(
            'POST',
            '/api/coaches',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'firstName' => 'Del',
                'lastName' => 'CCT-DEL-' . $suffix,
                'email' => '',
                'clubAssignments' => [],
                'teamAssignments' => [],
                'licenseAssignments' => [],
                'nationalityAssignments' => [],
            ])
        );
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Find the new coach's ID via the list
        $em = static::getContainer()->get('doctrine.orm.entity_manager');
        $newId = $em->getConnection()->fetchOne(
            'SELECT id FROM coaches WHERE last_name = :ln',
            ['ln' => 'CCT-DEL-' . $suffix]
        );
        $this->assertNotFalse($newId);

        $client->request('DELETE', '/api/coaches/' . $newId);
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
    }
}
