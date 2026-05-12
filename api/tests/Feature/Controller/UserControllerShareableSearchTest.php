<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\Coach;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für GET /api/users/shareable-search?q=...
 *
 * Prüft:
 *  - Endpoint erfordert Authentifizierung
 *  - Leere Liste bei query < 2 Zeichen
 *  - Coaches (RelationType category='coach') werden gefunden
 *  - ROLE_SUPPORTER-Nutzer werden gefunden
 *  - Reguläre ROLE_USER werden NICHT gefunden
 *  - Aktueller Nutzer wird aus Ergebnissen ausgeschlossen
 *  - Deaktivierte Nutzer werden ausgeschlossen
 *  - Nicht-verifizierte Nutzer werden ausgeschlossen
 *  - Antwort-Shape: {users: [{id: int, fullName: string}]}
 *
 * Alle Tests laufen in einer rollback-gesicherten DB-Transaktion.
 */
class UserControllerShareableSearchTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $adminUser;
    private string $suffix;
    private RelationType $selfCoachType;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->suffix = bin2hex(random_bytes(4));

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');

        $this->selfCoachType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_coach']);
        self::assertNotNull($this->selfCoachType, 'RelationType "self_coach" nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    /** @return array<string, mixed> */
    private function assertJsonResponse(int $expectedStatus): array
    {
        self::assertResponseStatusCodeSame($expectedStatus);
        $content = $this->client->getResponse()->getContent();
        self::assertJson($content);

        return (array) json_decode($content, true);
    }

    private function search(string $q): void
    {
        $url = '/api/users/shareable-search' . ('' !== $q ? '?q=' . rawurlencode($q) : '');
        $this->client->request('GET', $url);
    }

    /**
     * Creates a user with a self_coach UserRelation (making them discoverable as a coach).
     * firstName is made unique via $tag so tests can search for it specifically.
     */
    private function makeCoachUser(string $tag): User
    {
        $firstName = 'SrchCoach' . $tag;
        $lastName = 'Test';
        $email = 'coach-' . $tag . '@search.example.com';

        $coach = (new Coach())
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setEmail($email);
        $this->em->persist($coach);

        $user = (new User())
            ->setEmail($email)
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setPassword('test')
            ->setRoles(['ROLE_USER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        $relation = (new UserRelation())
            ->setUser($user)
            ->setCoach($coach)
            ->setRelationType($this->selfCoachType)
            ->setPermissions([]);
        $this->em->persist($relation);
        $user->addUserRelation($relation);
        $coach->addUserRelation($relation);

        $this->em->flush();

        return $user;
    }

    /**
     * Creates a plain ROLE_USER + ROLE_SUPPORTER user without coach relation.
     */
    private function makeSupporterUser(string $tag): User
    {
        $firstName = 'SrchSupp' . $tag;
        $email = 'supp-' . $tag . '@search.example.com';

        $user = (new User())
            ->setEmail($email)
            ->setFirstName($firstName)
            ->setLastName('Test')
            ->setPassword('test')
            ->setRoles(['ROLE_USER', 'ROLE_SUPPORTER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    /**
     * Creates a plain ROLE_USER without any coach relation or ROLE_SUPPORTER.
     */
    private function makeRegularUser(string $tag): User
    {
        $firstName = 'SrchReg' . $tag;
        $email = 'reg-' . $tag . '@search.example.com';

        $user = (new User())
            ->setEmail($email)
            ->setFirstName($firstName)
            ->setLastName('Test')
            ->setPassword('test')
            ->setRoles(['ROLE_USER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    // ── Authentication ────────────────────────────────────────────────────

    public function testRequiresAuthentication(): void
    {
        $this->search('test');
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    // ── Query-Length-Validierung ──────────────────────────────────────────

    public function testReturnsEmptyListWhenQueryMissing(): void
    {
        $this->authenticate($this->adminUser);
        $this->search('');
        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame([], $data['users']);
    }

    public function testReturnsEmptyListWhenQueryIsOneChar(): void
    {
        $this->authenticate($this->adminUser);
        $this->search('a');
        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertSame([], $data['users']);
    }

    public function testReturnsListForQueryOfTwoChars(): void
    {
        $this->authenticate($this->adminUser);
        // Two chars is the minimum; just verify we get a response (no 400)
        $this->search('ab');
        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('users', $data);
    }

    // ── Response-Shape ────────────────────────────────────────────────────

    public function testResponseHasUsersKey(): void
    {
        $this->authenticate($this->adminUser);
        $this->search('findme');
        $data = $this->assertJsonResponse(Response::HTTP_OK);
        self::assertArrayHasKey('users', $data);
        self::assertIsArray($data['users']);
    }

    public function testUserResultHasIdAndFullName(): void
    {
        $tag = $this->suffix . 'sh';
        $coach = $this->makeCoachUser($tag);

        $this->authenticate($this->adminUser);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        self::assertNotEmpty($data['users'], 'Coach sollte in Ergebnissen erscheinen');
        $result = $data['users'][0];
        self::assertArrayHasKey('id', $result);
        self::assertArrayHasKey('fullName', $result);
        self::assertIsInt($result['id']);
        self::assertIsString($result['fullName']);
    }

    // ── Coach-Erkennung ───────────────────────────────────────────────────

    public function testCoachUserIsReturned(): void
    {
        $tag = $this->suffix . 'c1';
        $coach = $this->makeCoachUser($tag);

        $this->authenticate($this->adminUser);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertContains($coach->getId(), $ids, 'Coach muss in Suchergebnissen enthalten sein');
    }

    public function testCoachFullNameIsCorrect(): void
    {
        $tag = $this->suffix . 'cfn';
        $coach = $this->makeCoachUser($tag);

        $this->authenticate($this->adminUser);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        $idx = array_search($coach->getId(), $ids);
        self::assertNotFalse($idx);
        self::assertStringContainsString($coach->getFirstName(), $data['users'][$idx]['fullName']);
    }

    // ── ROLE_SUPPORTER-Erkennung ──────────────────────────────────────────

    public function testSupporterUserIsReturned(): void
    {
        $tag = $this->suffix . 's1';
        $supporter = $this->makeSupporterUser($tag);

        $this->authenticate($this->adminUser);
        $this->search($supporter->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertContains($supporter->getId(), $ids, 'ROLE_SUPPORTER-Nutzer muss in Suchergebnissen enthalten sein');
    }

    // ── Ausschlüsse ───────────────────────────────────────────────────────

    public function testRegularUserWithoutCoachOrSupporterRoleIsNotReturned(): void
    {
        $tag = $this->suffix . 'r1';
        $regular = $this->makeRegularUser($tag);

        $this->authenticate($this->adminUser);
        $this->search($regular->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertNotContains($regular->getId(), $ids, 'Regulärer Nutzer darf nicht erscheinen');
    }

    public function testCurrentUserIsExcludedFromResults(): void
    {
        $tag = $this->suffix . 'me';
        $coach = $this->makeCoachUser($tag);

        // Authenticate AS the coach and search for themselves
        $this->authenticate($coach);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertNotContains($coach->getId(), $ids, 'Aktueller Nutzer darf nicht in eigenen Ergebnissen erscheinen');
    }

    public function testDisabledUserIsExcluded(): void
    {
        $tag = $this->suffix . 'd1';
        $coach = $this->makeCoachUser($tag);
        $coach->setIsEnabled(false);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertNotContains($coach->getId(), $ids, 'Deaktivierter Nutzer darf nicht erscheinen');
    }

    public function testUnverifiedUserIsExcluded(): void
    {
        $tag = $this->suffix . 'u1';
        $coach = $this->makeCoachUser($tag);
        $coach->setIsVerified(false);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->search($coach->getFirstName());
        $data = $this->assertJsonResponse(Response::HTTP_OK);

        $ids = array_column($data['users'], 'id');
        self::assertNotContains($coach->getId(), $ids, 'Nicht-verifizierter Nutzer darf nicht erscheinen');
    }
}
