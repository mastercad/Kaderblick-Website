<?php

namespace Tests\Feature\Controller;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\RegistrationRequest;
use App\Entity\RelationType;
use App\Entity\User;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class RegistrationRequestControllerTest extends ApiWebTestCase
{
    // ────────────────────────────── GET /api/registration-request/context ──────────────────────────────
    // Regression: context darf NIE WIEDER alle Spieler/Trainer auf einmal laden.
    // Nur noch relationTypes – Spieler/Trainer werden über /context/search gesucht.

    public function testContextIsPubliclyAccessible(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context');

        $this->assertResponseIsSuccessful();
    }

    public function testContextReturnsOnlyRelationTypesNotPlayersOrCoaches(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        // Must have relationTypes
        $this->assertArrayHasKey('relationTypes', $data);
        $this->assertIsArray($data['relationTypes']);

        // Must NOT contain players or coaches – those would cause a 15k-row payload
        $this->assertArrayNotHasKey('players', $data, '/context darf keine Spielerliste enthalten – nutze /context/search stattdessen!');
        $this->assertArrayNotHasKey('coaches', $data, '/context darf keine Trainerliste enthalten – nutze /context/search stattdessen!');
    }

    public function testContextRelationTypeItemHasExpectedFields(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context');

        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertNotEmpty($data['relationTypes'], 'Relation types should not be empty.');
        $rt = $data['relationTypes'][0];
        $this->assertArrayHasKey('id', $rt);
        $this->assertArrayHasKey('identifier', $rt);
        $this->assertArrayHasKey('name', $rt);
        $this->assertArrayHasKey('category', $rt);
    }

    // ────────────────────────────── GET /api/registration-request/context/search ──────────────────────────────
    // Regression: Suche muss min. 2 Zeichen erfordern und nie alle Datensätze auf einmal liefern.

    public function testContextSearchRequiresTypeParameter(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context/search?q=Max');

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testContextSearchRejectsInvalidType(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context/search?type=team&q=Max');

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testContextSearchRequiresAtLeastTwoChars(): void
    {
        $client = static::createClient();

        // 0 chars
        $client->request('GET', '/api/registration-request/context/search?type=player&q=');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertResponseIsSuccessful();
        $this->assertSame([], $data['results'], 'Leere Suche darf keine Ergebnisse liefern');

        // 1 char
        $client->request('GET', '/api/registration-request/context/search?type=player&q=A');
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertResponseIsSuccessful();
        $this->assertSame([], $data['results'], 'Ein-Zeichen-Suche darf keine Ergebnisse liefern');
    }

    public function testContextSearchPlayerReturnsResults(): void
    {
        $client = static::createClient();

        // Fetch a real player name from the DB
        $em = static::getContainer()->get('doctrine')->getManager();
        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player, 'Keine Spieler in den Testdaten');

        $prefix = mb_substr($player->getLastName(), 0, 2);
        $client->request('GET', '/api/registration-request/context/search?type=player&q=' . urlencode($prefix));

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('results', $data);
        $this->assertIsArray($data['results']);
        $this->assertNotEmpty($data['results']);

        $item = $data['results'][0];
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('fullName', $item);
        $this->assertArrayHasKey('teams', $item);
    }

    public function testContextSearchCoachReturnsResults(): void
    {
        $client = static::createClient();

        $em = static::getContainer()->get('doctrine')->getManager();
        $coach = $em->getRepository(Coach::class)->findOneBy([]);
        $this->assertNotNull($coach, 'Keine Coaches in den Testdaten');

        // Use firstName prefix — lastName is a numeric string (e.g. "1") which is only
        // 1 character and would be below the 2-char minimum required by the search endpoint.
        $prefix = mb_substr($coach->getFirstName(), 0, 2);
        $client->request('GET', '/api/registration-request/context/search?type=coach&q=' . urlencode($prefix));

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('results', $data);
        $this->assertIsArray($data['results']);
        $this->assertNotEmpty($data['results']);
    }

    public function testContextSearchResultsCappedAt30(): void
    {
        $client = static::createClient();

        // Search for a single letter – likely matches many players
        $client->request('GET', '/api/registration-request/context/search?type=player&q=er');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertLessThanOrEqual(30, count($data['results']), 'Suchergebnis darf maximal 30 Einträge enthalten');
    }

    public function testContextSearchNonMatchingQueryReturnsEmptyResults(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/context/search?type=player&q=zzz_nonexistent_xyz');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame([], $data['results']);
    }

    // ────────────────────────────── POST /api/registration-request ──────────────────────────────

    public function testSubmitRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testSubmitRejectsMissingFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([]));

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testSubmitRejectsInvalidEntityType(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $relationType = $em->getRepository(RelationType::class)->findOneBy([]);
        $this->assertNotNull($relationType, 'No RelationType found in test fixtures.');

        $payload = json_encode([
            'entityType' => 'invalid_type',
            'entityId' => 1,
            'relationTypeId' => $relationType->getId(),
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testSubmitWithPlayerCreatesRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();

        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player, 'No Player found in test fixtures.');

        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'player']);
        $this->assertNotNull($relationType, 'No player RelationType found in test fixtures.');

        // Remove any existing pending requests for this user first
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => $player->getId(),
            'relationTypeId' => $relationType->getId(),
            'note' => 'Test note',
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('message', $data);
    }

    public function testSubmitWithCoachCreatesRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();

        $coach = $em->getRepository(Coach::class)->findOneBy([]);
        $this->assertNotNull($coach, 'No Coach found in test fixtures.');

        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'coach']);
        $this->assertNotNull($relationType, 'No coach RelationType found in test fixtures.');

        // Remove any existing pending requests for this user first
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'coach',
            'entityId' => $coach->getId(),
            'relationTypeId' => $relationType->getId(),
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);
    }

    public function testSubmitReturnsBadRequestForUnknownRelationType(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => $player->getId(),
            'relationTypeId' => 99999,
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testSubmitReturnsBadRequestForUnknownPlayer(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'player']);
        $this->assertNotNull($relationType);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => 99999,
            'relationTypeId' => $relationType->getId(),
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testSubmitReturnsBadRequestForUnknownCoach(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();
        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'coach']);
        $this->assertNotNull($relationType);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'coach',
            'entityId' => 99999,
            'relationTypeId' => $relationType->getId(),
        ]);

        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testSubmitRejectsDuplicatePendingRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();

        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player);

        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'player']);
        $this->assertNotNull($relationType);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => $player->getId(),
            'relationTypeId' => $relationType->getId(),
        ]);

        // First request
        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Second request — should return 409 Conflict
        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    // ────────────────────────────── GET /api/registration-request/mine ──────────────────────────────

    public function testMineRequiresAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/registration-request/mine');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testMineReturnsNullWhenNoPendingRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        // Ensure no pending requests exist
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $pending = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($pending as $r) {
            $em->remove($r);
        }
        $em->flush();

        $client->request('GET', '/api/registration-request/mine');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('request', $data);
        $this->assertNull($data['request']);
    }

    public function testMineReturnsPendingRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();

        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player);

        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'player']);
        $this->assertNotNull($relationType);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        // Create a pending request
        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => $player->getId(),
            'relationTypeId' => $relationType->getId(),
        ]);
        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);
        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        // Fetch own pending request
        $client->request('GET', '/api/registration-request/mine');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('request', $data);
        $this->assertNotNull($data['request']);
        $this->assertEquals('pending', $data['request']['status']);
        // API returns separate player/coach fields, not a unified entityType
        $this->assertNotNull($data['request']['player']);
        $this->assertNull($data['request']['coach']);
    }

    public function testMineReturnsExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $em = static::getContainer()->get('doctrine')->getManager();

        $player = $em->getRepository(Player::class)->findOneBy([]);
        $this->assertNotNull($player);

        $relationType = $em->getRepository(RelationType::class)->findOneBy(['category' => 'player']);
        $this->assertNotNull($relationType);

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $payload = json_encode([
            'entityType' => 'player',
            'entityId' => $player->getId(),
            'relationTypeId' => $relationType->getId(),
            'note' => 'Test Anmerkung',
        ]);
        $client->request('POST', '/api/registration-request', [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $client->request('GET', '/api/registration-request/mine');

        $data = json_decode($client->getResponse()->getContent(), true);
        $req = $data['request'];

        $this->assertArrayHasKey('id', $req);
        $this->assertArrayHasKey('status', $req);
        $this->assertArrayHasKey('player', $req);
        $this->assertArrayHasKey('coach', $req);
        $this->assertArrayHasKey('relationType', $req);
        $this->assertArrayHasKey('createdAt', $req);
        $this->assertNotNull($req['player']);
        $this->assertNull($req['coach']);
        $this->assertEquals('Test Anmerkung', $req['note']);
    }
}
