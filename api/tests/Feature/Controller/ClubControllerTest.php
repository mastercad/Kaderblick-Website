<?php

namespace Tests\Feature\Controller;

use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class ClubControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── Pagination ──────────────────────────────

    public function testListReturnsPaginatedStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/clubs');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('clubs', $data);
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('limit', $data);
        $this->assertIsArray($data['clubs']);
        $this->assertIsInt($data['total']);
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
    }

    public function testListDefaultsToPage1Limit25(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
        $this->assertLessThanOrEqual(25, count($data['clubs']));
    }

    public function testListRespectsCustomPageAndLimit(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?page=1&limit=5');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(5, $data['limit']);
        $this->assertLessThanOrEqual(5, count($data['clubs']));
    }

    public function testListLimitIsCappedAt100(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?limit=500');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(100, $data['limit']);
    }

    public function testListPageMinimumIs1(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?page=0');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
    }

    public function testListPaginationReturnsConsistentTotal(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?page=1&limit=3');
        $data1 = json_decode($client->getResponse()->getContent(), true);
        $total = $data1['total'];

        $client->request('GET', '/clubs?page=2&limit=3');
        $data2 = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals($total, $data2['total']);

        if ($total > 3) {
            $this->assertNotEmpty($data2['clubs']);
        }
    }

    public function testListBeyondLastPageReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?page=99999&limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['clubs']);
    }

    // ────────────────────────────── Search ──────────────────────────────

    public function testListFiltersBySearchTerm(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Get a club name to search for
        $client->request('GET', '/clubs?limit=1');
        $allData = json_decode($client->getResponse()->getContent(), true);

        if (empty($allData['clubs'])) {
            $this->markTestSkipped('No clubs in fixture data');
        }

        $clubName = $allData['clubs'][0]['name'];
        $searchTerm = substr($clubName, 0, 3);

        $client->request('GET', '/clubs?search=' . urlencode($searchTerm));
        $searchData = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertNotEmpty($searchData['clubs']);
    }

    public function testListSearchAcrossMultipleFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Get a club with a stadium name
        $client->request('GET', '/clubs?limit=100');
        $allData = json_decode($client->getResponse()->getContent(), true);

        $clubWithStadium = null;
        foreach ($allData['clubs'] as $club) {
            if (!empty($club['stadiumName'])) {
                $clubWithStadium = $club;
                break;
            }
        }

        if (!$clubWithStadium) {
            $this->markTestSkipped('No club with stadium name in fixture data');
        }

        $searchTerm = substr($clubWithStadium['stadiumName'], 0, 4);

        $client->request('GET', '/clubs?search=' . urlencode($searchTerm));
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertNotEmpty($data['clubs']);
    }

    public function testListSearchWithNoMatchReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?search=zzzzxxxxxnonexistent99999');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['clubs']);
        $this->assertEquals(0, $data['total']);
    }

    // ────────────────────────────── Data Structure ──────────────────────────────

    public function testListClubHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['clubs'])) {
            $this->markTestSkipped('No clubs in fixture data');
        }

        $club = $data['clubs'][0];
        $this->assertArrayHasKey('id', $club);
        $this->assertArrayHasKey('name', $club);
        $this->assertArrayHasKey('shortName', $club);
        $this->assertArrayHasKey('abbreviation', $club);
        $this->assertArrayHasKey('stadiumName', $club);
        $this->assertArrayHasKey('website', $club);
        $this->assertArrayHasKey('logoUrl', $club);
        $this->assertArrayHasKey('email', $club);
        $this->assertArrayHasKey('phone', $club);
        $this->assertArrayHasKey('clubColors', $club);
        $this->assertArrayHasKey('contactPerson', $club);
        $this->assertArrayHasKey('foundingYear', $club);
        $this->assertArrayHasKey('active', $club);
        $this->assertArrayHasKey('location', $club);
        $this->assertArrayHasKey('permissions', $club);
    }

    // ────────────────────────────── Permissions ──────────────────────────────

    public function testListAdminHasFullPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/clubs?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['clubs'])) {
            $this->markTestSkipped('No clubs in fixture data');
        }

        $permissions = $data['clubs'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertTrue($permissions['canEdit']);
        $this->assertTrue($permissions['canCreate']);
        $this->assertTrue($permissions['canDelete']);
    }

    public function testListRegularUserHasViewOnlyPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/clubs?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['clubs'])) {
            $this->markTestSkipped('No clubs in fixture data');
        }

        $permissions = $data['clubs'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertFalse($permissions['canEdit']);
        $this->assertFalse($permissions['canCreate']);
        $this->assertFalse($permissions['canDelete']);
    }

    public function testListRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/clubs');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ────────────────────────────── Combined Filters ──────────────────────────────

    public function testListCombinesSearchAndPagination(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/clubs?search=a&page=1&limit=3');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertLessThanOrEqual(3, count($data['clubs']));
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(3, $data['limit']);
    }
}
