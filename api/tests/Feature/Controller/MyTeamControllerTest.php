<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

/**
 * Feature-Tests für den MyTeamController (/api/my-team).
 *
 * Fixtures: user6 = ROLE_USER mit Spieler-Verknüpfung (Team 1)
 *           user21 = ROLE_SUPERADMIN
 */
final class MyTeamControllerTest extends ApiWebTestCase
{
    // ========== AUTHENTICATION ==========

    public function testOverviewRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/my-team');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ========== RESPONSE STRUCTURE ==========

    public function testOverviewReturnsExpectedTopLevelKeys(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/my-team');

        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertIsArray($data);
        self::assertArrayHasKey('teams', $data);
        self::assertArrayHasKey('upcomingEvents', $data);
        self::assertArrayHasKey('openTasks', $data);
        self::assertArrayHasKey('isCoach', $data);
        self::assertArrayHasKey('isPlayer', $data);
    }

    public function testOverviewTeamsHaveExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/my-team');
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);

        // user6 ist mit einem Spieler in Team 1 verknüpft – es muss mind. ein Team zurückkommen
        self::assertNotEmpty($data['teams'], 'Ein Benutzer mit Spieler-Verknüpfung muss mindestens ein Team haben.');

        $team = $data['teams'][0];
        self::assertArrayHasKey('id', $team);
        self::assertArrayHasKey('name', $team);
        self::assertArrayHasKey('players', $team);
        self::assertArrayHasKey('coaches', $team);
        self::assertArrayHasKey('playerCount', $team);
        self::assertArrayHasKey('coachCount', $team);
    }

    public function testOverviewPlayerEntriesHaveExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/my-team');
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);

        self::assertNotEmpty($data['teams']);
        $players = $data['teams'][0]['players'];
        self::assertIsArray($players);

        if (count($players) > 0) {
            $player = $players[0];
            self::assertArrayHasKey('id', $player);
            self::assertArrayHasKey('firstName', $player);
            self::assertArrayHasKey('lastName', $player);
            self::assertArrayHasKey('fullName', $player);
            self::assertArrayHasKey('isMe', $player);
        }
    }

    public function testOverviewIsPlayerTrueForUserWithPlayerRelation(): void
    {
        $client = static::createClient();
        // user6 hat eine self_player-Verknüpfung
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('GET', '/api/my-team');
        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertTrue($data['isPlayer'], 'isPlayer muss true sein für Benutzer mit Spieler-Verknüpfung.');
    }

    public function testOverviewAdminReturnsValidResponse(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/api/my-team');

        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayHasKey('teams', $data);
        self::assertArrayHasKey('isCoach', $data);
        self::assertIsBool($data['isCoach']);
        self::assertIsBool($data['isPlayer']);
    }
}
