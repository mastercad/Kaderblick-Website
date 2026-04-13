<?php

namespace App\Tests\Feature\Controller;

use App\Entity\Team;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Feature-Tests für ReportController: /api/report/presets und /api/report/context-data.
 *
 * Geprüft werden:
 *  – GET /api/report/presets        → gibt presets-Array zurück
 *  – GET /api/report/context-data   → 401 wenn nicht eingeloggt
 *  – GET /api/report/context-data   → Admin erhält alle Teams/Spieler (findAll)
 *  – GET /api/report/context-data   → Normaler Nutzer erhält nur seine Teams (via Service)
 *  – GET /api/report/context-data   → Normaler Nutzer ohne Zuordnungen → leere Arrays
 */
#[AllowMockObjectsWithoutExpectations]
class ReportContextDataTest extends WebTestCase
{
    private const PREFIX = 'ctx-data-test-';

    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    // =========================================================================
    //  GET /api/report/presets
    // =========================================================================

    public function testPresetsUnauthenticatedIsRejected(): void
    {
        $this->client->request('GET', '/api/report/presets');
        $this->assertResponseStatusCodeSame(401);
    }

    public function testPresetsReturnsPresetsArray(): void
    {
        $user = $this->createUser(self::PREFIX . 'presets-user@example.com');
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/presets');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('presets', $data);
        $this->assertIsArray($data['presets']);
    }

    public function testPresetsContainsKeyLabelAndConfig(): void
    {
        $user = $this->createUser(self::PREFIX . 'presets-shape@example.com');
        $this->client->loginUser($user);

        $this->client->request('GET', '/api/report/presets');

        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Presets should be non-empty and each entry must have key, label, config
        $this->assertNotEmpty($data['presets'], 'There should be at least one preset defined.');
        foreach ($data['presets'] as $preset) {
            $this->assertArrayHasKey('key', $preset, 'Each preset must have a key.');
            $this->assertArrayHasKey('label', $preset, 'Each preset must have a label.');
            $this->assertArrayHasKey('config', $preset, 'Each preset must have a config.');
        }
    }

    // =========================================================================
    //  GET /api/report/context-data – Authentifizierung
    // =========================================================================

    public function testContextDataUnauthenticatedIsRejected(): void
    {
        $this->client->request('GET', '/api/report/context-data');
        $this->assertResponseStatusCodeSame(401);
    }

    // =========================================================================
    //  GET /api/report/context-data – Admin-Nutzer
    // =========================================================================

    public function testContextDataAdminReceivesResponseWithoutCallingService(): void
    {
        $admin = $this->createUser(self::PREFIX . 'admin@example.com', ['ROLE_ADMIN']);

        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        // Admin path muss den Service NICHT benutzen
        $serviceMock->expects($this->never())->method('collectCoachTeams');
        $serviceMock->expects($this->never())->method('collectPlayerTeams');
        $serviceMock->expects($this->never())->method('collectTeamPlayers');

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($admin);
        $this->client->request('GET', '/api/report/context-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('teams', $data, 'Antwort muss teams enthalten.');
        $this->assertArrayHasKey('players', $data, 'Antwort muss players enthalten.');
        $this->assertIsArray($data['teams']);
        $this->assertIsArray($data['players']);
    }

    public function testContextDataSuperAdminReceivesResponseWithoutCallingService(): void
    {
        $superAdmin = $this->createUser(self::PREFIX . 'superadmin@example.com', ['ROLE_SUPERADMIN']);

        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->expects($this->never())->method('collectCoachTeams');
        $serviceMock->expects($this->never())->method('collectPlayerTeams');

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($superAdmin);
        $this->client->request('GET', '/api/report/context-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('teams', $data);
        $this->assertArrayHasKey('players', $data);
    }

    // =========================================================================
    //  GET /api/report/context-data – Normaler Nutzer
    // =========================================================================

    public function testContextDataRegularUserCallsServiceAndReturnsFilteredTeams(): void
    {
        $user = $this->createUser(self::PREFIX . 'coach@example.com');

        // Mock-Team vorbereiten
        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getId')->willReturn(99);
        $teamMock->method('getName')->willReturn('U17 Testteam');

        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->expects($this->once())
            ->method('collectCoachTeams')
            ->with($this->isInstanceOf(User::class))
            ->willReturn([99 => $teamMock]);

        $serviceMock->expects($this->once())
            ->method('collectPlayerTeams')
            ->with($this->isInstanceOf(User::class))
            ->willReturn([]);

        $serviceMock->expects($this->once())
            ->method('collectTeamPlayers')
            ->with($teamMock)
            ->willReturn([
                ['player' => ['id' => 42, 'name' => 'Max Mustermann']],
            ]);

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/context-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Teams prüfen
        $this->assertCount(1, $data['teams']);
        $this->assertSame(99, $data['teams'][0]['id']);
        $this->assertSame('U17 Testteam', $data['teams'][0]['name']);

        // Spieler prüfen
        $this->assertCount(1, $data['players']);
        $this->assertSame(42, $data['players'][0]['id']);
        $this->assertSame('Max Mustermann', $data['players'][0]['fullName']);
    }

    public function testContextDataRegularUserWithNoAssignmentsReturnsEmptyArrays(): void
    {
        $user = $this->createUser(self::PREFIX . 'noassign@example.com');

        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->method('collectCoachTeams')->willReturn([]);
        $serviceMock->method('collectPlayerTeams')->willReturn([]);
        $serviceMock->expects($this->never())->method('collectTeamPlayers');

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/context-data');

        $this->assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertSame([], $data['teams']);
        $this->assertSame([], $data['players']);
    }

    public function testContextDataDeduplicatesTeamsFromCoachAndPlayerRoles(): void
    {
        $user = $this->createUser(self::PREFIX . 'dual-role@example.com');

        $teamMock = $this->createMock(Team::class);
        $teamMock->method('getId')->willReturn(7);
        $teamMock->method('getName')->willReturn('Shared Team');

        // Dasselbe Team taucht in coachTeams UND in playerTeams auf
        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->method('collectCoachTeams')->willReturn([7 => $teamMock]);
        $serviceMock->method('collectPlayerTeams')->willReturn([7 => $teamMock]);
        // collectTeamPlayers darf nur EINMAL aufgerufen werden (nach Deduplication)
        $serviceMock->expects($this->once())->method('collectTeamPlayers')->willReturn([]);

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/context-data');

        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Nach Deduplication nur ein Team
        $this->assertCount(1, $data['teams']);
        $this->assertSame(7, $data['teams'][0]['id']);
    }

    public function testContextDataDeduplicatesPlayersAcrossTeams(): void
    {
        $user = $this->createUser(self::PREFIX . 'multi-team@example.com');

        $team1Mock = $this->createMock(Team::class);
        $team1Mock->method('getId')->willReturn(1);
        $team1Mock->method('getName')->willReturn('Team A');

        $team2Mock = $this->createMock(Team::class);
        $team2Mock->method('getId')->willReturn(2);
        $team2Mock->method('getName')->willReturn('Team B');

        $sharedPlayerEntry = ['player' => ['id' => 55, 'name' => 'Doppelt Erika']];

        $serviceMock = $this->createMock(CoachTeamPlayerService::class);
        $serviceMock->method('collectCoachTeams')->willReturn([1 => $team1Mock, 2 => $team2Mock]);
        $serviceMock->method('collectPlayerTeams')->willReturn([]);
        // Spieler 55 kommt in beiden Teams vor
        $serviceMock->method('collectTeamPlayers')->willReturn([$sharedPlayerEntry]);

        static::getContainer()->set(CoachTeamPlayerService::class, $serviceMock);

        $this->client->loginUser($user);
        $this->client->request('GET', '/api/report/context-data');

        $data = json_decode($this->client->getResponse()->getContent(), true);

        // Spieler soll nur einmal erscheinen (Deduplication über playerMap)
        $playerIds = array_column($data['players'], 'id');
        $this->assertCount(1, array_unique($playerIds), 'Spieler 55 darf nur einmal erscheinen.');
        $this->assertSame(55, $data['players'][0]['id']);
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    /** @param string[] $roles */
    private function createUser(string $email, array $roles = ['ROLE_USER']): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Test');
        $user->setLastName('User');
        $user->setPassword('password');
        $user->setRoles($roles);
        $user->setIsEnabled(true);
        $user->setIsVerified(true);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    protected function tearDown(): void
    {
        $conn = $this->em->getConnection();
        $conn->executeStatement('DELETE FROM users WHERE email LIKE :prefix', ['prefix' => self::PREFIX . '%']);

        $this->em->close();
        parent::tearDown();
        restore_exception_handler();
    }
}
