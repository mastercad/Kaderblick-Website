<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\CupRound;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for CupRoundsController.
 *
 * GET    /api/cup-rounds          - public list
 * POST   /api/cup-rounds          - admin: create
 * PUT    /api/cup-rounds/{id}     - admin: rename
 * DELETE /api/cup-rounds/{id}     - admin: delete (409 when in use)
 *
 * All data created inside a test is cleaned up via rollback / explicit delete.
 */
class CupRoundsControllerTest extends WebTestCase
{
    private const PREFIX = 'cup-round-test-';

    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @param string[] $roles */
    private function createUser(string $suffix, array $roles = ['ROLE_USER']): User
    {
        $user = new User();
        $user->setEmail(self::PREFIX . $suffix . '@example.com');
        $user->setFirstName('Cup');
        $user->setLastName('Tester');
        $user->setPassword('x');
        $user->setRoles($roles);
        $user->setIsEnabled(true);
        $user->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    private function createRound(string $name): CupRound
    {
        $round = new CupRound();
        $round->setName($name);
        $this->em->persist($round);
        $this->em->flush();

        return $round;
    }

    private function deleteRound(CupRound $round): void
    {
        $fresh = $this->em->find(CupRound::class, $round->getId());
        if ($fresh) {
            $this->em->remove($fresh);
            $this->em->flush();
        }
    }

    /** @param array<string, mixed> $data */
    private function jsonRequest(string $method, string $url, array $data = []): void
    {
        $this->client->request(
            $method,
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($data, JSON_THROW_ON_ERROR),
        );
    }

    /** @return array<string, mixed> */
    private function responseData(): array
    {
        $content = (string) $this->client->getResponse()->getContent();

        return (array) json_decode($content, true);
    }

    // ── GET /api/cup-rounds ───────────────────────────────────────────────────

    public function testIndexIsPubliclyAccessible(): void
    {
        $this->client->request('GET', '/api/cup-rounds');

        self::assertResponseIsSuccessful();
    }

    public function testIndexReturnsRoundsArray(): void
    {
        $round = $this->createRound(self::PREFIX . 'Viertelfinale');

        $this->client->request('GET', '/api/cup-rounds');

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertArrayHasKey('rounds', $data);
        $names = array_column($data['rounds'], 'name');
        self::assertContains(self::PREFIX . 'Viertelfinale', $names);

        $this->deleteRound($round);
    }

    public function testIndexRoundHasIdAndName(): void
    {
        $round = $this->createRound(self::PREFIX . 'Halbfinale-fields');

        $this->client->request('GET', '/api/cup-rounds');

        $data = $this->responseData();
        $rounds = array_values(array_filter(
            $data['rounds'],
            fn ($r) => $r['name'] === self::PREFIX . 'Halbfinale-fields',
        ));
        self::assertNotEmpty($rounds);
        self::assertArrayHasKey('id', $rounds[0]);
        self::assertArrayHasKey('name', $rounds[0]);

        $this->deleteRound($round);
    }

    // ── POST /api/cup-rounds ──────────────────────────────────────────────────

    public function testCreateRequiresAdminRole(): void
    {
        $user = $this->createUser('post-nonadmin');
        $this->client->loginUser($user);

        $this->jsonRequest('POST', '/api/cup-rounds', ['name' => 'ShouldFail']);

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testCreateSucceedsForAdmin(): void
    {
        $admin = $this->createUser('post-admin', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $name = self::PREFIX . 'Gruppenphase-' . bin2hex(random_bytes(3));
        $this->jsonRequest('POST', '/api/cup-rounds', ['name' => $name]);

        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = $this->responseData();
        self::assertArrayHasKey('round', $data);
        self::assertSame($name, $data['round']['name']);

        // cleanup
        $round = $this->em->getRepository(CupRound::class)->find($data['round']['id']);
        if ($round) {
            $this->em->remove($round);
            $this->em->flush();
        }
    }

    public function testCreateReturns422ForEmptyName(): void
    {
        $admin = $this->createUser('post-empty', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $this->jsonRequest('POST', '/api/cup-rounds', ['name' => '   ']);

        self::assertResponseStatusCodeSame(Response::HTTP_UNPROCESSABLE_ENTITY);
        self::assertArrayHasKey('error', $this->responseData());
    }

    // ── PUT /api/cup-rounds/{id} ──────────────────────────────────────────────

    public function testUpdateRequiresAdminRole(): void
    {
        $round = $this->createRound(self::PREFIX . 'Put-nonadmin');
        $user = $this->createUser('put-nonadmin');
        $this->client->loginUser($user);

        $this->jsonRequest('PUT', '/api/cup-rounds/' . $round->getId(), ['name' => 'Renamed']);

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
        $this->deleteRound($round);
    }

    public function testUpdateRenamesRound(): void
    {
        $round = $this->createRound(self::PREFIX . 'Put-old');
        $admin = $this->createUser('put-admin', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $newName = self::PREFIX . 'Put-new-' . bin2hex(random_bytes(3));
        $this->jsonRequest('PUT', '/api/cup-rounds/' . $round->getId(), ['name' => $newName]);

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertSame($newName, $data['round']['name']);
        self::assertArrayHasKey('gamesUpdated', $data);

        $this->deleteRound($round);
    }

    public function testUpdateWithSameNameReturnsWithoutUpdating(): void
    {
        $name = self::PREFIX . 'Put-same-' . bin2hex(random_bytes(3));
        $round = $this->createRound($name);
        $admin = $this->createUser('put-same-admin', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $this->jsonRequest('PUT', '/api/cup-rounds/' . $round->getId(), ['name' => $name]);

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertSame($name, $data['round']['name']);

        $this->deleteRound($round);
    }

    public function testUpdateReturns422ForEmptyName(): void
    {
        $round = $this->createRound(self::PREFIX . 'Put-empty');
        $admin = $this->createUser('put-empty-admin', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $this->jsonRequest('PUT', '/api/cup-rounds/' . $round->getId(), ['name' => '']);

        self::assertResponseStatusCodeSame(Response::HTTP_UNPROCESSABLE_ENTITY);
        $this->deleteRound($round);
    }

    // ── DELETE /api/cup-rounds/{id} ───────────────────────────────────────────

    public function testDeleteRequiresAdminRole(): void
    {
        $round = $this->createRound(self::PREFIX . 'Del-nonadmin');
        $user = $this->createUser('del-nonadmin');
        $this->client->loginUser($user);

        $this->client->request('DELETE', '/api/cup-rounds/' . $round->getId());

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
        $this->deleteRound($round);
    }

    public function testDeleteSucceedsWhenRoundIsNotInUse(): void
    {
        $round = $this->createRound(self::PREFIX . 'Del-unused-' . bin2hex(random_bytes(3)));
        $roundId = $round->getId();
        $admin = $this->createUser('del-admin', ['ROLE_ADMIN']);
        $this->client->loginUser($admin);

        $this->client->request('DELETE', '/api/cup-rounds/' . $roundId);

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertArrayHasKey('message', $data);
        $this->em->clear();
        self::assertNull($this->em->find(CupRound::class, $roundId));
    }

    public function testDeleteReturns409WhenRoundIsInUse(): void
    {
        $roundName = self::PREFIX . 'Del-inuse-' . bin2hex(random_bytes(3));
        $round = $this->createRound($roundName);
        $admin = $this->createUser('del-inuse-admin-' . bin2hex(random_bytes(3)), ['ROLE_ADMIN']);

        // create a game that references this round name
        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Fixture GameType needed.');

        $game = new Game();
        $game->setRound($roundName);
        $game->setGameType($gameType);
        $this->em->persist($game);
        $this->em->flush();

        $this->client->loginUser($admin);
        $this->client->request('DELETE', '/api/cup-rounds/' . $round->getId());

        self::assertResponseStatusCodeSame(Response::HTTP_CONFLICT);
        $data = $this->responseData();
        self::assertArrayHasKey('error', $data);
        self::assertArrayHasKey('usageCount', $data);

        // cleanup
        $this->em->remove($game);
        $this->deleteRound($round);
    }
}
