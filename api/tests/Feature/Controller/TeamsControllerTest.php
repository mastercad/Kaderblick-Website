<?php

namespace Tests\Feature\Controller;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class TeamsControllerTest extends ApiWebTestCase
{
    private function fetchAllTeamCountForAdmin(KernelBrowser $client): int
    {
        $this->authenticateUser($client, 'user16@example.com');
        $client->request('GET', '/api/teams/list');
        $data = json_decode($client->getResponse()->getContent(), true);

        return count($data['teams'] ?? []);
    }

    // ────────────────────────────── Paginated Index ──────────────────────────────

    public function testIndexReturnsPaginatedStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('teams', $data);
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('limit', $data);
        $this->assertIsArray($data['teams']);
        $this->assertIsInt($data['total']);
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(25, $data['limit']);
    }

    public function testIndexRespectsCustomPageAndLimit(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?page=1&limit=5');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
        $this->assertEquals(5, $data['limit']);
        $this->assertLessThanOrEqual(5, count($data['teams']));
    }

    public function testIndexLimitIsCappedAt100(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=500');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(100, $data['limit']);
    }

    public function testIndexPageMinimumIs1(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?page=0');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(1, $data['page']);
    }

    public function testIndexPaginationReturnsConsistentTotal(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?page=1&limit=3');
        $data1 = json_decode($client->getResponse()->getContent(), true);
        $total = $data1['total'];

        $client->request('GET', '/api/teams?page=2&limit=3');
        $data2 = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals($total, $data2['total']);

        if ($total > 3) {
            $this->assertNotEmpty($data2['teams']);
        }
    }

    public function testIndexBeyondLastPageReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?page=99999&limit=25');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['teams']);
    }

    // ────────────────────────────── Search ──────────────────────────────

    public function testIndexFiltersBySearchTerm(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        // Get a team name to search for
        $client->request('GET', '/api/teams?limit=1');
        $allData = json_decode($client->getResponse()->getContent(), true);

        if (empty($allData['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $teamName = $allData['teams'][0]['name'];
        // Use first few characters
        $searchTerm = substr($teamName, 0, 3);

        $client->request('GET', '/api/teams?search=' . urlencode($searchTerm));
        $searchData = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertNotEmpty($searchData['teams']);
    }

    public function testIndexSearchWithNoMatchReturnsEmpty(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?search=zzzzxxxxxnonexistent99999');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertEmpty($data['teams']);
        $this->assertEquals(0, $data['total']);
    }

    // ────────────────────────────── Non-Paginated List ──────────────────────────────

    public function testListReturnsAllTeamsForDropdown(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams/list');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('teams', $data);
        $this->assertIsArray($data['teams']);
        // List endpoint should NOT have pagination metadata
        $this->assertArrayNotHasKey('total', $data);
        $this->assertArrayNotHasKey('page', $data);
        $this->assertArrayNotHasKey('limit', $data);
    }

    public function testListTeamHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams/list');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $team = $data['teams'][0];
        $this->assertArrayHasKey('id', $team);
        $this->assertArrayHasKey('name', $team);
        $this->assertArrayHasKey('ageGroup', $team);
        $this->assertArrayHasKey('league', $team);
        $this->assertArrayHasKey('permissions', $team);
    }

    // ────────────────────────────── Data Structure ──────────────────────────────

    public function testIndexTeamHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $team = $data['teams'][0];
        $this->assertArrayHasKey('id', $team);
        $this->assertArrayHasKey('name', $team);
        $this->assertArrayHasKey('ageGroup', $team);
        $this->assertArrayHasKey('league', $team);
        $this->assertArrayHasKey('permissions', $team);

        // Check nested structure
        $this->assertArrayHasKey('id', $team['ageGroup']);
        $this->assertArrayHasKey('name', $team['ageGroup']);
        $this->assertArrayHasKey('id', $team['league']);
        $this->assertArrayHasKey('name', $team['league']);
    }

    // ────────────────────────────── Permissions ──────────────────────────────

    public function testIndexAdminHasFullPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }

        $permissions = $data['teams'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertTrue($permissions['canEdit']);
        $this->assertTrue($permissions['canCreate']);
        $this->assertTrue($permissions['canDelete']);
    }

    public function testIndexRegularUserHasViewOnlyPermissions(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);

        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data — user may not have team relations');
        }

        $permissions = $data['teams'][0]['permissions'];
        $this->assertTrue($permissions['canView']);
        $this->assertFalse($permissions['canEdit']);
        $this->assertFalse($permissions['canCreate']);
        $this->assertFalse($permissions['canDelete']);
    }

    public function testIndexRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/teams');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testListRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/teams/list');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ────────────────────────────── Context-aware team list ──────────────────────────────

    /**
     * A non-admin / non-coach user (user6, parent of a player in Team 1) must only
     * see their own teams without a context parameter.
     */
    public function testListWithoutContextReturnsOnlyOwnTeamsForParentUser(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER, linked to Team 1 only

        $client->request('GET', '/api/teams/list');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        // user6 is only related to Team 1 — must not see more
        $this->assertCount(1, $data['teams']);
        $this->assertEquals('Team 1', $data['teams'][0]['name']);
    }

    /**
     * A parent user (not a coach) must NOT get all teams with context=match.
     * Only coaches / admins / superadmins may bypass the assignment filter.
     */
    public function testListWithContextMatchDoesNotBypassFilterForParentUser(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER, parent only — NOT a coach

        $client->request('GET', '/api/teams/list?context=match');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        // Filter must still be applied → only Team 1
        $this->assertCount(1, $data['teams']);
    }

    /**
     * A coach user (user3, Mentor of coach assigned to Team 2) must see all teams with context=match
     * so they can select opponent teams when creating a game.
     */
    public function testListWithContextMatchReturnsAllTeamsForCoach(): void
    {
        $client = static::createClient();
        $allTeamCount = $this->fetchAllTeamCountForAdmin($client);
        $this->authenticateUser($client, 'user3@example.com'); // ROLE_GUEST but has a Mentor (coach-category) relation

        $client->request('GET', '/api/teams/list?context=match');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        $this->assertCount($allTeamCount, $data['teams']);
    }

    /**
     * context=tournament must behave identically to context=match for a coach.
     */
    public function testListWithContextTournamentReturnsAllTeamsForCoach(): void
    {
        $client = static::createClient();
        $allTeamCount = $this->fetchAllTeamCountForAdmin($client);
        $this->authenticateUser($client, 'user3@example.com'); // coach-category relation (Mentor)

        $client->request('GET', '/api/teams/list?context=tournament');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        $this->assertCount($allTeamCount, $data['teams']);
    }

    /**
     * A coach without a context parameter still only sees their own assigned teams.
     */
    public function testListWithoutContextReturnsOnlyOwnTeamsForCoach(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user3@example.com'); // coach-category relation, parent of player in Team 2, friend of player in Team 1

        $client->request('GET', '/api/teams/list');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        // user3 is related to Team 1 (friend/player) and Team 2 (parent/player + Mentor/coach) — 2 unique teams
        $this->assertCount(2, $data['teams']);
    }

    /**
     * An admin user must always see all teams, regardless of the context parameter.
     */
    public function testListAdminAlwaysSeesAllTeamsRegardlessOfContext(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        // Without context
        $client->request('GET', '/api/teams/list');
        $dataWithout = json_decode($client->getResponse()->getContent(), true);

        // With context=match
        $client->request('GET', '/api/teams/list?context=match');
        $dataWithMatch = json_decode($client->getResponse()->getContent(), true);

        $this->assertCount(count($dataWithout['teams']), $dataWithMatch['teams']);
        $this->assertGreaterThan(0, count($dataWithout['teams']));
    }

    /**
     * An unknown context value must fall back to the default user-assignment filter,
     * even for a coach.
     */
    public function testListWithUnknownContextUsesDefaultFilter(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user3@example.com'); // coach-category relation, normally 2 teams

        $client->request('GET', '/api/teams/list?context=unknown_context');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);

        // Unknown context → same as no context → only own teams (Team 1 + Team 2)
        $this->assertCount(2, $data['teams']);
    }

    // ────────────────────────────── Combined Filters ──────────────────────────────

    public function testIndexCombinesSearchAndPagination(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?search=a&page=1&limit=3');
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertResponseIsSuccessful();
        $this->assertLessThanOrEqual(3, count($data['teams']));
        $this->assertEquals(1, $data['page']);
        $this->assertEquals(3, $data['limit']);
    }

    // ────────────────────────────── Timing Defaults ──────────────────────────────

    public function testShowIncludesTimingDefaultsFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        // Get a valid team id from the list
        $client->request('GET', '/api/teams?page=1&limit=1');
        $listData = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($listData['teams'], 'Need at least one team fixture');
        $teamId = $listData['teams'][0]['id'];

        $client->request('GET', "/api/teams/{$teamId}/details");
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('team', $data);
        $this->assertArrayHasKey('defaultHalfDuration', $data['team']);
        $this->assertArrayHasKey('defaultHalftimeBreakDuration', $data['team']);
    }

    public function testListIncludesTimingDefaultsFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        $client->request('GET', '/api/teams/list?context=match');
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($data['teams'], 'Need at least one team fixture');

        $firstTeam = $data['teams'][0];
        $this->assertArrayHasKey('defaultHalfDuration', $firstTeam);
        $this->assertArrayHasKey('defaultHalftimeBreakDuration', $firstTeam);
    }

    public function testPatchTimingDefaultsSucceedsForAdmin(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com'); // ROLE_ADMIN

        // Get a team id
        $client->request('GET', '/api/teams?page=1&limit=1');
        $listData = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($listData['teams'], 'Need at least one team fixture');
        $teamId = $listData['teams'][0]['id'];

        $client->request(
            'PATCH',
            "/api/teams/{$teamId}/timing-defaults",
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['defaultHalfDuration' => 40, 'defaultHalftimeBreakDuration' => 10])
        );

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertSame(40, $data['defaultHalfDuration']);
        $this->assertSame(10, $data['defaultHalftimeBreakDuration']);

        // Verify persisted: re-fetch details
        $client->request('GET', "/api/teams/{$teamId}/details");
        $detailsData = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(40, $detailsData['team']['defaultHalfDuration']);
        $this->assertSame(10, $detailsData['team']['defaultHalftimeBreakDuration']);
    }

    public function testPatchTimingDefaultsForbiddenForRegularUser(): void
    {
        $client = static::createClient();
        // user16 is admin, get team first with admin
        $this->authenticateUser($client, 'user16@example.com');
        $client->request('GET', '/api/teams?page=1&limit=1');
        $listData = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($listData['teams'], 'Need at least one team fixture');
        $teamId = $listData['teams'][0]['id'];

        // Now switch to a regular user who is not a coach of this team
        // user1@example.com is a player (no coach role)
        $this->authenticateUser($client, 'user1@example.com');
        $client->request(
            'PATCH',
            "/api/teams/{$teamId}/timing-defaults",
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['defaultHalfDuration' => 99])
        );

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    // ───────────────────────────── Banner Upload ────────────────────────────────

    public function testUploadBannerRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        $client->request('POST', "/api/teams/{$teamId}/banner");

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testUploadBannerForbiddenForRegularUser(): void
    {
        $client = static::createClient();

        // Fetch a team id using an admin token
        $this->authenticateUser($client, 'user16@example.com');
        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        // Switch to a user without banner-edit rights
        $this->authenticateUser($client, 'user1@example.com');
        $client->request('POST', "/api/teams/{$teamId}/banner");

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUploadBannerWithNoFileReturnsBadRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        $client->request('POST', "/api/teams/{$teamId}/banner");

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $body = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testUploadBannerWithInvalidMimeTypeReturnsUnprocessableEntity(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        // A plain text file will be detected as text/plain by finfo
        $tmpFile = tempnam(sys_get_temp_dir(), 'test_banner_invalid_') . '.txt';
        file_put_contents($tmpFile, 'this is not an image');

        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $tmpFile,
            'not_an_image.txt',
            'text/plain',
            null,
            true
        );

        $client->request('POST', "/api/teams/{$teamId}/banner", [], ['banner' => $uploadedFile]);

        @unlink($tmpFile);

        $this->assertResponseStatusCodeSame(Response::HTTP_UNPROCESSABLE_ENTITY);
        $body = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testUploadBannerWithValidPngAsAdminReturns200(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        // Minimal 1×1 PNG (8-bit RGB)
        $tmpFile = tempnam(sys_get_temp_dir(), 'test_banner_') . '.png';
        file_put_contents($tmpFile, $this->minimalPng());

        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $tmpFile,
            'banner.png',
            'image/png',
            null,
            true
        );

        $client->request('POST', "/api/teams/{$teamId}/banner", [], ['banner' => $uploadedFile]);

        @unlink($tmpFile);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $body = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($body['success']);
        $this->assertArrayHasKey('bannerImage', $body);
        $this->assertNotEmpty($body['bannerImage']);

        // Clean up: remove the uploaded banner via the API
        $client->request('DELETE', "/api/teams/{$teamId}/banner");
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
    }

    public function testUploadBannerResponseContainsExpectedShape(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        $tmpFile = tempnam(sys_get_temp_dir(), 'test_banner_') . '.png';
        file_put_contents($tmpFile, $this->minimalPng());

        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $tmpFile,
            'banner.png',
            'image/png',
            null,
            true
        );

        $client->request('POST', "/api/teams/{$teamId}/banner", [], ['banner' => $uploadedFile]);

        @unlink($tmpFile);

        $body = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($body);
        $this->assertArrayHasKey('success', $body);
        $this->assertArrayHasKey('bannerImage', $body);
        $this->assertIsString($body['bannerImage']);
        // The returned filename must end in .jpg (server always re-encodes as JPEG) or
        // match the original extension if GD is unavailable.
        $extension = strtolower(pathinfo($body['bannerImage'], PATHINFO_EXTENSION));
        $this->assertContains($extension, ['jpg', 'jpeg', 'png', 'webp']);

        // Cleanup
        $client->request('DELETE', "/api/teams/{$teamId}/banner");
    }

    // ───────────────────────────── Banner Delete ────────────────────────────────

    public function testDeleteBannerRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/teams?limit=1');

        $client->request('DELETE', '/api/teams/1/banner');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testDeleteBannerForbiddenForRegularUser(): void
    {
        $client = static::createClient();

        $this->authenticateUser($client, 'user16@example.com');
        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        $this->authenticateUser($client, 'user1@example.com');
        $client->request('DELETE', "/api/teams/{$teamId}/banner");

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteBannerWithNoBannerReturnsSuccess(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        // Use a team that has no banner (we cannot guarantee this without clearing state,
        // so we just assert the endpoint always succeeds for an admin)
        $teamId = $data['teams'][0]['id'];

        $client->request('DELETE', "/api/teams/{$teamId}/banner");

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $body = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($body['success']);
    }

    public function testDeleteBannerClearsBannerImageOnTeam(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user16@example.com');

        $client->request('GET', '/api/teams?limit=1');
        $data = json_decode($client->getResponse()->getContent(), true);
        if (empty($data['teams'])) {
            $this->markTestSkipped('No teams in fixture data');
        }
        $teamId = $data['teams'][0]['id'];

        // Upload a banner first
        $tmpFile = tempnam(sys_get_temp_dir(), 'test_banner_') . '.png';
        file_put_contents($tmpFile, $this->minimalPng());
        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $tmpFile,
            'banner.png',
            'image/png',
            null,
            true
        );
        $client->request('POST', "/api/teams/{$teamId}/banner", [], ['banner' => $uploadedFile]);
        @unlink($tmpFile);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Now delete it
        $client->request('DELETE', "/api/teams/{$teamId}/banner");
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Verify the team detail no longer has a bannerImage
        $client->request('GET', "/api/teams/{$teamId}/details");
        $this->assertResponseIsSuccessful();
        $teamData = json_decode($client->getResponse()->getContent(), true);
        $this->assertNull($teamData['team']['bannerImage']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Returns the binary content of a minimal valid 1×1 pixel PNG image.
     * finfo will correctly detect this as image/png.
     */
    private function minimalPng(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC' .
            'AAAAC0lEQVR42mP8/x8AAwMCAO+a8DcAAAAASUVORK5CYII='
        );
    }
}
