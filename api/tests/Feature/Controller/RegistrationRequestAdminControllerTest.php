<?php

namespace Tests\Feature\Controller;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\RegistrationRequest;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\ApiWebTestCase;

class RegistrationRequestAdminControllerTest extends ApiWebTestCase
{
    /**
     * Cleans up UserRelations and RegistrationRequests created for user6 during these tests.
     * This prevents test pollution: testApproveCoachRequest() creates a coach UserRelation
     * for user6 which makes later tests see user6 as a coach.
     */
    protected function tearDown(): void
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        if ($user) {
            // Remove test-created RegistrationRequests for user6
            foreach ($em->getRepository(RegistrationRequest::class)->findBy(['user' => $user]) as $req) {
                $em->remove($req);
            }
            $em->flush();

            // Reload to pick up fresh UserRelation collection after flush
            $em->clear();
            $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
            if ($user) {
                // Remove coach-category UserRelations: fixture data gives user6 none,
                // only approval tests create them.
                foreach ($user->getUserRelations() as $relation) {
                    if (null !== $relation->getCoach()) {
                        $em->remove($relation);
                    }
                }
                $em->flush();
            }
        }

        parent::tearDown();
    }

    // ─────────────────────── Helpers ───────────────────────

    /**
     * Creates a pending RegistrationRequest in the DB and returns it.
     */
    private function createPendingRequest(?string $entityType = 'player'): RegistrationRequest
    {
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($user);

        // Remove existing pending requests for this user
        $existing = $em->getRepository(RegistrationRequest::class)->findBy(['user' => $user, 'status' => 'pending']);
        foreach ($existing as $r) {
            $em->remove($r);
        }
        $em->flush();

        $rt = $em->getRepository(RelationType::class)->findOneBy(['category' => $entityType]);
        $this->assertNotNull($rt, "No RelationType for category '{$entityType}' found.");

        $req = new RegistrationRequest();
        $req->setUser($user)->setRelationType($rt);

        if ('player' === $entityType) {
            $player = $em->getRepository(Player::class)->findOneBy([]);
            $this->assertNotNull($player, 'No Player fixture found.');
            $req->setPlayer($player);
        } else {
            $coach = $em->getRepository(Coach::class)->findOneBy([]);
            $this->assertNotNull($coach, 'No Coach fixture found.');
            $req->setCoach($coach);
        }

        $em->persist($req);
        $em->flush();

        return $req;
    }

    // ─────────────────────── GET /admin/registration-requests ───────────────────────

    public function testIndexRequiresAdminRole(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com'); // ROLE_USER

        $client->request('GET', '/admin/registration-requests');

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testIndexIsUnaccessibleWithoutAuth(): void
    {
        $client = static::createClient();

        $client->request('GET', '/admin/registration-requests');

        $this->assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testIndexReturnsListStructure(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com'); // ROLE_SUPERADMIN

        $client->request('GET', '/admin/registration-requests');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('requests', $data);
        $this->assertArrayHasKey('counts', $data);
        $this->assertIsArray($data['requests']);
        $this->assertArrayHasKey('pending', $data['counts']);
        $this->assertArrayHasKey('approved', $data['counts']);
        $this->assertArrayHasKey('rejected', $data['counts']);
    }

    public function testIndexDefaultFilterIsPending(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        // Create a pending request
        $this->createPendingRequest();

        $client->request('GET', '/admin/registration-requests');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        foreach ($data['requests'] as $req) {
            $this->assertEquals('pending', $req['status']);
        }
    }

    public function testIndexWithAllFilterReturnsAllStatuses(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/admin/registration-requests?status=all');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('requests', $data);
        // Just verify the structure is correct (IDs, statuses etc. are in list)
        foreach ($data['requests'] as $req) {
            $this->assertArrayHasKey('id', $req);
            $this->assertArrayHasKey('status', $req);
            $this->assertContains($req['status'], ['pending', 'approved', 'rejected']);
        }
    }

    public function testIndexCountsAreIntegers(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/admin/registration-requests?status=all');

        $data = json_decode($client->getResponse()->getContent(), true);

        $this->assertIsInt($data['counts']['pending']);
        $this->assertIsInt($data['counts']['approved']);
        $this->assertIsInt($data['counts']['rejected']);
    }

    public function testIndexRequestItemHasExpectedFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $this->createPendingRequest();

        $client->request('GET', '/admin/registration-requests');

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($data['requests']);

        $req = $data['requests'][0];
        $this->assertArrayHasKey('id', $req);
        $this->assertArrayHasKey('status', $req);
        $this->assertArrayHasKey('createdAt', $req);
        $this->assertArrayHasKey('user', $req);
        $this->assertArrayHasKey('entityType', $req);
        $this->assertArrayHasKey('entityName', $req);
        $this->assertArrayHasKey('relationType', $req);
    }

    // ─────────────────────── POST /admin/registration-requests/{id}/approve ───────────────────────

    public function testApproveRequiresAdminRole(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $req = $this->createPendingRequest();

        $client->request('POST', "/admin/registration-requests/{$req->getId()}/approve");

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testApproveCreatesUserRelation(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest('player');
        $reqId = $req->getId();

        $em = static::getContainer()->get('doctrine')->getManager();
        $userId = $req->getUser()->getId();

        $client->request('POST', "/admin/registration-requests/{$reqId}/approve");

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('userRelationId', $data);

        // Verify UserRelation was created
        $em->clear();
        $userRelation = $em->getRepository(UserRelation::class)->find($data['userRelationId']);
        $this->assertNotNull($userRelation);
        $this->assertEquals($userId, $userRelation->getUser()->getId());

        // Verify request is now approved
        $updatedReq = $em->getRepository(RegistrationRequest::class)->find($reqId);
        $this->assertEquals('approved', $updatedReq->getStatus());
        $this->assertNotNull($updatedReq->getProcessedAt());
        $this->assertNotNull($updatedReq->getProcessedBy());
    }

    public function testApproveAlreadyProcessedReturns409(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest();

        // First approval
        $client->request('POST', "/admin/registration-requests/{$req->getId()}/approve");
        $this->assertResponseIsSuccessful();

        // Second approval (already processed)
        $client->request('POST', "/admin/registration-requests/{$req->getId()}/approve");
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testApproveCoachRequest(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest('coach');

        $client->request('POST', "/admin/registration-requests/{$req->getId()}/approve");

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        $em = static::getContainer()->get('doctrine')->getManager();
        $em->clear();
        $userRelation = $em->getRepository(UserRelation::class)->find($data['userRelationId']);
        $this->assertNotNull($userRelation);
        $this->assertNotNull($userRelation->getCoach());
    }

    // ─────────────────────── POST /admin/registration-requests/{id}/reject ───────────────────────

    public function testRejectRequiresAdminRole(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user6@example.com');

        $req = $this->createPendingRequest();

        $client->request('POST', "/admin/registration-requests/{$req->getId()}/reject");

        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testRejectMarksRequestAsRejected(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest();
        $reqId = $req->getId();

        $client->request('POST', "/admin/registration-requests/{$reqId}/reject", [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($data['success']);

        $em = static::getContainer()->get('doctrine')->getManager();
        $em->clear();
        $updatedReq = $em->getRepository(RegistrationRequest::class)->find($reqId);
        $this->assertEquals('rejected', $updatedReq->getStatus());
        $this->assertNotNull($updatedReq->getProcessedAt());
        $this->assertNotNull($updatedReq->getProcessedBy());
    }

    public function testRejectWithReasonAppendsToNote(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest();
        $reqId = $req->getId();

        $payload = json_encode(['reason' => 'Daten unvollständig']);

        $client->request('POST', "/admin/registration-requests/{$reqId}/reject", [], [], ['CONTENT_TYPE' => 'application/json'], $payload);

        $this->assertResponseIsSuccessful();

        $em = static::getContainer()->get('doctrine')->getManager();
        $em->clear();
        $updatedReq = $em->getRepository(RegistrationRequest::class)->find($reqId);
        $this->assertStringContainsString('Daten unvollständig', (string) $updatedReq->getNote());
    }

    public function testRejectAlreadyProcessedReturns409(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $req = $this->createPendingRequest();

        // First rejection
        $client->request('POST', "/admin/registration-requests/{$req->getId()}/reject", [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseIsSuccessful();

        // Second rejection
        $client->request('POST', "/admin/registration-requests/{$req->getId()}/reject", [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $this->assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
    }
}
