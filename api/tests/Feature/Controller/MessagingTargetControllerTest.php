<?php

namespace Tests\Feature\Controller;

use Tests\Feature\ApiWebTestCase;

/**
 * Tests for MessagingTargetController:
 *   GET /api/messaging/teams
 *   GET /api/messaging/clubs
 *
 * Uses fixture data exclusively (--group=master --group=test).
 * No dynamic entities are created; tearDown is therefore not required.
 *
 * Relevant fixture users:
 *   user4@example.com  – linked to player_4_1 (Team 1) and player_5_2 (Team 2)
 *   user6@example.com  – ROLE_USER, linked to player_1_1 (Team 1 / Club 1)
 *   user9@example.com  – ROLE_USER, linked to player_5_1 (Team 1)
 *   user10@example.com – ROLE_USER, no UserRelations → resolves to empty teams/clubs
 *   user21@example.com – ROLE_SUPERADMIN, sees all teams and active clubs
 */
class MessagingTargetControllerTest extends ApiWebTestCase
{
    // =========================================================================
    // GET /api/messaging/teams
    // =========================================================================

    public function testTeamsEndpointRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseStatusCodeSame(401);
    }

    public function testTeamsEndpointReturnsEmptyForUnlinkedUser(): void
    {
        $client = static::createClient();
        // user10 = ROLE_USER with no UserRelations in fixtures
        $this->authenticateUser($client, 'user10@example.com');
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);
        $this->assertSame([], $data['teams']);
    }

    public function testTeamsEndpointReturnsTeamForPlayerLinkedUser(): void
    {
        $client = static::createClient();
        // user6 → UserRelation (parent) → player_1_1 → PlayerTeamAssignment → Team 1
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $names = array_column($data['teams'], 'name');
        $this->assertContains('Team 1', $names);
    }

    public function testTeamsEndpointReturnsBothTeamsForMultipleAssignments(): void
    {
        $client = static::createClient();
        // user4 → player_4_1 (Team 1) AND player_5_2 (Team 2) via friend relations
        $this->authenticateUser($client, 'user4@example.com');
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $names = array_column($data['teams'], 'name');
        $this->assertContains('Team 1', $names);
        $this->assertContains('Team 2', $names);
    }

    public function testTeamsEndpointReturnsAllTeamsForSuperAdmin(): void
    {
        $client = static::createClient();
        // user21 = ROLE_SUPERADMIN → controller returns all teams via findBy()
        $this->authenticateUser($client, 'user21@example.com');
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('teams', $data);
        $this->assertNotEmpty($data['teams']);
        $names = array_column($data['teams'], 'name');
        $this->assertContains('Team 1', $names);
    }

    // =========================================================================
    // GET /api/messaging/clubs
    // =========================================================================

    public function testClubsEndpointRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/messaging/clubs');

        $this->assertResponseStatusCodeSame(401);
    }

    public function testClubsEndpointReturnsEmptyForUnlinkedUser(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user10@example.com');
        $client->request('GET', '/api/messaging/clubs');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('clubs', $data);
        $this->assertSame([], $data['clubs']);
    }

    public function testClubsEndpointReturnsClubForPlayerLinkedUser(): void
    {
        $client = static::createClient();
        // user6 → player_1_1 → PlayerClubAssignment → Club 1 (Team 1 belongs to Club 1)
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('GET', '/api/messaging/clubs');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $names = array_column($data['clubs'], 'name');
        $this->assertContains('Club 1', $names);
    }

    public function testClubsEndpointReturnsAllClubsForSuperAdmin(): void
    {
        $client = static::createClient();
        // user21 = ROLE_SUPERADMIN → controller returns all active clubs
        // Fixture clubs (Club 1–4) default to active = true
        $this->authenticateUser($client, 'user21@example.com');
        $client->request('GET', '/api/messaging/clubs');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('clubs', $data);
        $this->assertNotEmpty($data['clubs']);
        $names = array_column($data['clubs'], 'name');
        $this->assertContains('Club 1', $names);
    }

    // =========================================================================
    // Response shape
    // =========================================================================

    public function testTeamsEndpointResponseHasIdAndName(): void
    {
        $client = static::createClient();
        // user6 has at least Team 1 via fixture → verifies response structure
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('GET', '/api/messaging/teams');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($data['teams']);
        $this->assertArrayHasKey('id', $data['teams'][0]);
        $this->assertArrayHasKey('name', $data['teams'][0]);
    }
}
