<?php

namespace Tests\Feature;

use Symfony\Component\HttpFoundation\Response;

class NewsEndToEndTest extends ApiWebTestCase
{
    public function testAdminCanCreatePlatformNews(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Plattform-News',
            'content' => 'Dies ist eine Plattform-News',
            'visibility' => 'platform',
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Allow for success or redirect to success page
        if ($client->getResponse()->isRedirection()) {
            $client->followRedirect();
        }

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testAdminCanCreateClubNews(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $club = $em->getRepository(\App\Entity\Club::class)->findOneBy([]);
        if (!$club) {
            $this->fail('No club found in fixtures');
        }

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Vereins-News',
            'content' => 'Dies ist eine Vereins-News',
            'visibility' => 'club',
            'club_id' => $club->getId(),
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        if ($client->getResponse()->isRedirection()) {
            $client->followRedirect();
        }

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testAdminCanCreateTeamNews(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $team = $em->getRepository(\App\Entity\Team::class)->findOneBy(['name' => 'Team 1']);
        if (!$team) {
            $this->fail('Team 1 not found in fixtures');
        }

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Team-News',
            'content' => 'Dies ist eine Team-News',
            'visibility' => 'team',
            'team_id' => $team->getId(),
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        if ($client->getResponse()->isRedirection()) {
            $client->followRedirect();
        }

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testNonAdminCannotCreateNews(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Test News',
            'content' => 'Test Content',
            'visibility' => 'platform',
        ]));

        // Add an assertion to prevent "no assertions" warning
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUserSeesOnlyRelevantNews(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get('doctrine')->getManager();
        $playerRepo = $em->getRepository(\App\Entity\Player::class);
        $ptaRepo = $em->getRepository(\App\Entity\PlayerTeamAssignment::class);

        // Prepare test data: fetch relations and teams from fixtures
        $userRepo = $em->getRepository(\App\Entity\User::class);
        $relationRepo = $em->getRepository(\App\Entity\UserRelation::class);
        $teamRepo = $em->getRepository(\App\Entity\Team::class);

        $user6 = $userRepo->findOneBy(['email' => 'user6@example.com']);
        $user7 = $userRepo->findOneBy(['email' => 'user7@example.com']);
        $user8 = $userRepo->findOneBy(['email' => 'user8@example.com']);

        self::assertNotNull($user6, 'Fixture-User "user6@example.com" nicht gefunden. Bitte Fixtures laden.');
        self::assertNotNull($user7, 'Fixture-User "user7@example.com" nicht gefunden. Bitte Fixtures laden.');
        self::assertNotNull($user8, 'Fixture-User "user8@example.com" nicht gefunden. Bitte Fixtures laden.');

        $rel1 = $relationRepo->findBy(['user' => $user6]);
        $rel2 = $relationRepo->findBy(['user' => $user7]);
        $rel3 = $relationRepo->findBy(['user' => $user8]);

        self::assertNotEmpty($rel1, 'Keine UserRelation für user6 gefunden. Bitte Fixtures laden.');
        self::assertNotEmpty($rel2, 'Keine UserRelation für user7 gefunden. Bitte Fixtures laden.');
        self::assertNotEmpty($rel3, 'Keine UserRelation für user8 gefunden. Bitte Fixtures laden.');

        $player1 = $playerRepo->findOneBy(['id' => $rel1[0]->getPlayer()?->getId()]);
        $player2 = $playerRepo->findOneBy(['id' => $rel2[0]->getPlayer()?->getId()]);
        $player3 = $playerRepo->findOneBy(['id' => $rel3[0]->getPlayer()?->getId()]);

        $team1 = $teamRepo->findOneBy(['name' => 'Team 1']);
        $team2 = $teamRepo->findOneBy(['name' => 'Team 2']);

        self::assertNotNull($team1, 'Fixture-Team "Team 1" nicht gefunden.');
        self::assertNotNull($team2, 'Fixture-Team "Team 2" nicht gefunden.');

        // Admin legt eine Team-News für Team 1 an
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Team 1 News',
            'content' => 'Nur für Team 1',
            'visibility' => 'team',
            'team_id' => $team1->getId(),
        ]));

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Team 2 News',
            'content' => 'Nur für Team 2',
            'visibility' => 'team',
            'team_id' => $team2->getId(),
        ]));

        if ($client->getResponse()->isRedirection()) {
            $client->followRedirect();
        }
        $this->assertTrue($client->getResponse()->isSuccessful());

        // EntityManager clear, damit Relationen und User korrekt neu geladen werden
        $em->clear();

        // User 6 ist Elternteil von Spieler 1 in Team 1
        $this->authenticateUser($client, 'user6@example.com');
        $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 1 News', $titles);
        $this->assertNotContains('Team 2 News', $titles);

        // User 7 ist Elternteil von Spieler 2 in Team 1
        $this->authenticateUser($client, 'user7@example.com');
        $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 1 News', $titles);
        $this->assertNotContains('Team 2 News', $titles);

        // User 8 ist Elternteil von Spieler 3 in Team 2
        $this->authenticateUser($client, 'user8@example.com');
        $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 2 News', $titles);

        if ($client->getResponse()->isRedirection()) {
            $client->followRedirect();
        }

        $this->assertTrue($client->getResponse()->isSuccessful());

        // EntityManager clear, damit Relationen und User korrekt neu geladen werden
        $em->clear();

        // User 6 ist Elternteil von Spieler 1 in Team 1 (laut RelationFixtures)
        $this->authenticateUser($client, 'user6@example.com');
        $crawler = $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 1 News', $titles);
        $this->assertNotContains('Team 2 News', $titles);

        // User 7 ist Elternteil von Spieler 2 in Team 1 (laut RelationFixtures)
        $this->authenticateUser($client, 'user7@example.com');
        $crawler = $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 1 News', $titles);
        $this->assertNotContains('Team 2 News', $titles);

        // User 8 ist Elternteil von Spieler 3 in Team 2 (laut RelationFixtures)
        $this->authenticateUser($client, 'user8@example.com');
        $crawler = $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertContains('Team 2 News', $titles);
        $this->assertNotContains('Team 1 News', $titles);

        // User ohne Relation (user10, ROLE_USER, keine Relation) sieht keine Team-News
        $this->authenticateUser($client, 'user10@example.com');
        $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);
        $titles = array_column($data['news'], 'title');
        $this->assertNotContains('Team 1 News', $titles);
        $this->assertNotContains('Team 2 News', $titles);

        // Gäste (user1–user5, ROLE_GUEST, keine Relation) sehen keine Team-News
        foreach (range(1, 5) as $guestId) {
            $this->authenticateUser($client, "user{$guestId}@example.com");
            $client->request('GET', '/news', [], [], ['HTTP_ACCEPT' => 'application/json']);
            $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
        }
    }

    public function testUserWithoutRelationsCannotCreateNews(): void
    {
        $client = static::createClient();

        $this->authenticateUser($client, 'user10@example.com');

        $client->request('POST', '/news/create', [], [], [], json_encode([
            'title' => 'Team 1 News',
            'content' => 'Nur für Team 1',
            'visibility' => 'team',
            'team_id' => 1,
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }
}
