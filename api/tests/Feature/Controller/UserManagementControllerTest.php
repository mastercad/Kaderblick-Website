<?php

namespace Tests\Feature\Controller;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\Position;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserTeamAdminAssignment;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für UserManagementController (GET/POST /admin/users/*).
 *
 * Der Controller ist mit #[IsGranted('ROLE_ADMIN')] gesichert.
 * Tests prüfen Auth, Autorisierung und die wichtigsten Endpunkte.
 */
class UserManagementControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $adminUser;
    private User $regularUser;
    private User $targetUser;

    private string $emailSuffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);

        $this->emailSuffix = bin2hex(random_bytes(6));

        /** @var User $adminUser */
        $adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($adminUser, 'Fixture user user16@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->adminUser = $adminUser;

        /** @var User $regularUser */
        $regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($regularUser, 'Fixture user user6@example.com not found. Ensure fixtures (group=test) are loaded.');
        $this->regularUser = $regularUser;

        // The target is deliberately owned by this test. Fixture users may be used
        // for authentication, but their persisted state must never be modified.
        $this->targetUser = $this->makeUser('test-um-target', ['ROLE_USER']);
        $this->em->flush();
    }

    // ── index() GET /admin/users ───────────────────────────────────────────────

    public function testIndexRequiresAuthentication(): void
    {
        $this->client->request('GET', '/admin/users');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testIndexRequiresAdminRole(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/admin/users');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testIndexReturnsUserList(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('users', $data);
        self::assertIsArray($data['users']);

        // At least our target user should be in the list
        $emails = array_column($data['users'], 'email');
        self::assertContains($this->targetUser->getEmail(), $emails);
    }

    public function testIndexSearchFiltersByEmail(): void
    {
        $this->authenticate($this->adminUser);

        $uniqueTerm = $this->targetUser->getEmail();
        $this->client->request('GET', '/admin/users?search=' . urlencode($uniqueTerm));

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('users', $data);
        // The target user email contains our suffix
        $emails = array_column($data['users'], 'email');
        self::assertContains($this->targetUser->getEmail(), $emails);
    }

    public function testIndexSearchReturnsEmptyForUnknownTerm(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users?search=XXXXXXXXNOTEXISTXXXX');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data['users']);
    }

    // ── editRoles() GET /admin/users/{id}/roles ────────────────────────────────

    public function testEditRolesRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/roles');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testEditRolesReturnsUserAndAvailableRoles(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/roles');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('user', $data);
        self::assertArrayHasKey('available_roles', $data);
        self::assertArrayHasKey('current_role', $data);
        self::assertArrayHasKey('ROLE_USER', $data['available_roles']);
        self::assertArrayHasKey('ROLE_ADMIN', $data['available_roles']);
    }

    // ── updateRoles() POST /admin/users/{id}/roles ─────────────────────────────

    public function testUpdateRolesRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/roles',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['role' => 'ROLE_USER'], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUpdateRolesSucceedsForAdmin(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/roles',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['role' => 'ROLE_SUPPORTER'], JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);

        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_SUPPORTER'], $this->targetUser->getRoles());
    }

    public function testUpdateRolesRejectsMissingRole(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/roles',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_USER'], $this->targetUser->getRoles());
    }

    // ── toggleStatus() GET /admin/users/{id}/toggle-status ────────────────────

    public function testToggleStatusRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/toggle-status');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testToggleStatusDisablesUser(): void
    {
        self::assertTrue($this->targetUser->isEnabled());

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/toggle-status');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);

        $this->em->refresh($this->targetUser);
        self::assertFalse($this->targetUser->isEnabled());
    }

    public function testToggleStatusEnablesDisabledUser(): void
    {
        $this->targetUser->setIsEnabled(false);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/toggle-status');

        self::assertResponseIsSuccessful();
        $this->em->refresh($this->targetUser);
        self::assertTrue($this->targetUser->isEnabled());
    }

    // ── unlock() POST /admin/users/{id}/unlock ────────────────────────────────

    public function testUnlockRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('POST', '/admin/users/' . $this->targetUser->getId() . '/unlock');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUnlockReturns400WhenNotLocked(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('POST', '/admin/users/' . $this->targetUser->getId() . '/unlock');

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($data['success']);
    }

    public function testUnlockClearsLockedAt(): void
    {
        $this->targetUser->setLockedAt(new DateTimeImmutable());
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('POST', '/admin/users/' . $this->targetUser->getId() . '/unlock');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);

        $this->em->refresh($this->targetUser);
        self::assertNull($this->targetUser->getLockedAt());
    }

    // ── search() GET /admin/users/search/{type} ───────────────────────────────

    public function testSearchRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/admin/users/search/player?term=Test');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testSearchReturnsEmptyWithoutTerm(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users/search/player');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data);
    }

    public function testSearchPlayerReturnsResults(): void
    {
        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        self::assertNotNull($position);

        $player = (new Player())
            ->setFirstName('SearchableFirst')
            ->setLastName('SearchableLast')
            ->setMainPosition($position);
        $this->em->persist($player);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/admin/users/search/player?term=Searchable');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('results', $data);

        $names = array_column($data['results'], 'text');
        $found = array_filter($names, fn (string $t) => str_contains($t, 'Searchable'));
        self::assertNotEmpty($found, 'Searchable player should appear in results.');

        $this->em->remove($player);
        $this->em->flush();
    }

    public function testSearchCoachReturnsResults(): void
    {
        $coach = (new Coach())
            ->setFirstName('SearchCoachFirst')
            ->setLastName('SearchCoachLast')
            ->setEmail('test-um-coach-src-' . $this->emailSuffix . '@test.example.com');
        $this->em->persist($coach);
        $this->em->flush();

        $this->authenticate($this->adminUser);
        $this->client->request('GET', '/admin/users/search/coach?term=SearchCoach');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('results', $data);

        $names = array_column($data['results'], 'text');
        $found = array_filter($names, fn (string $t) => str_contains($t, 'SearchCoach'));
        self::assertNotEmpty($found, 'Searchable coach should appear in results.');

        $this->em->remove($coach);
        $this->em->flush();
    }

    public function testSearchInvalidTypeThrows404(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users/search/unknowntype?term=Test');

        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    // ── assignForm() GET /admin/users/{id}/assign ─────────────────────────────

    public function testAssignFormRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/assign');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testAssignFormReturnsUserAndLists(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request('GET', '/admin/users/' . $this->targetUser->getId() . '/assign');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('user', $data);
        self::assertArrayHasKey('players', $data);
        self::assertArrayHasKey('coaches', $data);
        self::assertArrayHasKey('currentAssignments', $data);
        self::assertArrayHasKey('relationTypes', $data);
        self::assertArrayHasKey('permissions', $data);
        self::assertArrayHasKey('currentAdminTeamAssignments', $data);
        self::assertArrayHasKey('currentAdminClubAssignments', $data);
        self::assertSame($this->targetUser->getId(), $data['user']['id']);
    }

    public function testAssigningTeamAdminScopeCreatesDirectAssignmentAndRole(): void
    {
        $team = $this->em->getRepository(Team::class)->findOneBy([]);
        self::assertNotNull($team);
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['adminTeamAssignments' => [['teamId' => $team->getId()]]], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_TEAM_ADMIN'], $this->targetUser->getRoles());
        self::assertSame('ROLE_USER', $this->targetUser->getRoleBeforeScopedAdmin());
        self::assertNotNull($this->em->getRepository(UserTeamAdminAssignment::class)->findOneBy([
            'user' => $this->targetUser,
            'team' => $team,
        ]));
    }

    public function testFutureAdminScopeIsStoredButDoesNotPromoteUserYet(): void
    {
        $team = $this->em->getRepository(Team::class)->findOneBy([]);
        self::assertNotNull($team);
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['adminTeamAssignments' => [[
                'teamId' => $team->getId(),
                'startDate' => '2099-07-01',
                'endDate' => '2099-12-31',
            ]]], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_USER'], $this->targetUser->getRoles());
        $assignment = $this->em->getRepository(UserTeamAdminAssignment::class)->findOneBy(['user' => $this->targetUser]);
        self::assertSame('2099-07-01', $assignment?->getStartDate()?->format('Y-m-d'));
        self::assertSame('2099-12-31', $assignment->getEndDate()?->format('Y-m-d'));
    }

    public function testMultiplePeriodsForSameTeamAreAllowed(): void
    {
        $team = $this->em->getRepository(Team::class)->findOneBy([]);
        self::assertNotNull($team);
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['adminTeamAssignments' => [
                ['teamId' => $team->getId(), 'startDate' => '2025-01-01', 'endDate' => '2025-06-30'],
                ['teamId' => $team->getId(), 'startDate' => '2099-01-01', 'endDate' => '2099-06-30'],
            ]], JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        self::assertCount(2, $this->em->getRepository(UserTeamAdminAssignment::class)->findBy([
            'user' => $this->targetUser,
            'team' => $team,
        ]));
    }

    public function testAdminScopeRejectsEndDateBeforeStartDate(): void
    {
        $team = $this->em->getRepository(Team::class)->findOneBy([]);
        self::assertNotNull($team);
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['adminTeamAssignments' => [[
                'teamId' => $team->getId(),
                'startDate' => '2027-01-01',
                'endDate' => '2026-12-31',
            ]]], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        self::assertNull($this->em->getRepository(UserTeamAdminAssignment::class)->findOneBy(['user' => $this->targetUser]));
    }

    public function testClubScopeTakesPrecedenceAndRemovingAllScopesRestoresBaseRole(): void
    {
        $targetUserId = $this->targetUser->getId();
        self::assertNotNull($targetUserId);
        $team = $this->em->getRepository(Team::class)->findOneBy([]);
        $club = $this->em->getRepository(Club::class)->findOneBy([]);
        self::assertNotNull($team);
        self::assertNotNull($club);
        $this->targetUser->setRoles(['ROLE_SUPPORTER']);
        $this->em->flush();
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $targetUserId . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'adminTeamAssignments' => [['teamId' => $team->getId()]],
                'adminClubAssignments' => [['clubId' => $club->getId()]],
            ], JSON_THROW_ON_ERROR),
        );
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_CLUB_ADMIN'], $this->targetUser->getRoles());
        self::assertSame('ROLE_SUPPORTER', $this->targetUser->getRoleBeforeScopedAdmin());

        $this->client->request(
            'POST',
            '/admin/users/' . $targetUserId . '/assign',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['adminTeamAssignments' => [], 'adminClubAssignments' => []], JSON_THROW_ON_ERROR),
        );
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $targetUser = $this->em->find(User::class, $targetUserId);
        self::assertInstanceOf(User::class, $targetUser);
        $this->targetUser = $targetUser;
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_SUPPORTER'], $this->targetUser->getRoles());
        self::assertNull($this->targetUser->getRoleBeforeScopedAdmin());
    }

    public function testScopedAdminRolesCannotBeAssignedThroughRoleEndpoint(): void
    {
        $this->authenticate($this->adminUser);

        $this->client->request(
            'POST',
            '/admin/users/' . $this->targetUser->getId() . '/roles',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['role' => 'ROLE_TEAM_ADMIN'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $this->em->refresh($this->targetUser);
        self::assertSame(['ROLE_USER'], $this->targetUser->getRoles());
    }

    // ── deleteUser() DELETE /admin/users/{id} ─────────────────────────────────

    public function testDeleteUserRequiresAdmin(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('DELETE', '/admin/users/' . $this->targetUser->getId());

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDeleteUserRemovesUser(): void
    {
        // Create a separate user to delete (so we don't delete targetUser before other tests)
        $toDelete = $this->makeUser('test-um-todelete', ['ROLE_USER']);
        $this->em->flush();

        $deleteId = $toDelete->getId();

        $this->authenticate($this->adminUser);
        $this->client->request('DELETE', '/admin/users/' . $deleteId);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);

        // User should no longer exist in DB
        $deleted = $this->em->find(User::class, $deleteId);
        self::assertNull($deleted);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    /**
     * @param array<string> $roles
     */
    private function makeUser(string $prefix, array $roles): User
    {
        $user = (new User())
            ->setEmail("{$prefix}-{$this->emailSuffix}@test.example.com")
            ->setFirstName(ucfirst(str_replace('-', '', $prefix)))
            ->setLastName('UM')
            ->setPassword('test')
            ->setRoles($roles)
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        return $user;
    }

    protected function tearDown(): void
    {
        if (isset($this->em, $this->emailSuffix, $this->targetUser)) {
            // Scoped assignments use ON DELETE CASCADE. The wildcard also catches
            // the disposable user from testDeleteUserRemovesUser after a failure.
            $this->em->getConnection()->executeStatement(
                'DELETE dashboard_widgets FROM dashboard_widgets INNER JOIN users ON users.id = dashboard_widgets.user_id WHERE users.email LIKE ?',
                ['test-um-%-' . $this->emailSuffix . '@test.example.com'],
            );
            $this->em->getConnection()->executeStatement(
                'DELETE FROM users WHERE email LIKE ?',
                ['test-um-%-' . $this->emailSuffix . '@test.example.com'],
            );
            $this->em->close();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
