<?php

namespace App\Tests\Unit\Service;

use App\Entity\Player;
use App\Entity\Position;
use App\Entity\User;
use App\Service\CoachTeamPlayerService;
use App\Service\PlayerSerializerService;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;

#[AllowMockObjectsWithoutExpectations]
class PlayerSerializerServiceTest extends TestCase
{
    private Security&MockObject $security;
    private CoachTeamPlayerService&MockObject $coachTeamPlayerService;
    private EntityManagerInterface&MockObject $em;
    private PlayerSerializerService $service;

    protected function setUp(): void
    {
        $this->security = $this->createMock(Security::class);
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->em = $this->createMock(EntityManagerInterface::class);

        $this->service = new PlayerSerializerService(
            $this->security,
            $this->coachTeamPlayerService,
            $this->em,
        );

        // Default: not admin, no coach teams
        $this->security->method('isGranted')->willReturn(false);
        $this->security->method('getUser')->willReturn($this->createMock(User::class));
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);

        // Stub the two query builders used in buildStats()
        $this->stubQueryBuilder();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Stubs EntityManagerInterface::createQueryBuilder() for both buildStats queries. */
    private function stubQueryBuilder(): void
    {
        $emptyQuery = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->getMock();
        $emptyQuery->method('getArrayResult')->willReturn([]);
        $emptyQuery->method('getOneOrNullResult')->willReturn(null);

        $qb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->getMock();
        $qb->method('select')->willReturnSelf();
        $qb->method('from')->willReturnSelf();
        $qb->method('join')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();
        $qb->method('groupBy')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        $qb->method('addOrderBy')->willReturnSelf();
        $qb->method('getQuery')->willReturn($emptyQuery);

        $this->em->method('createQueryBuilder')->willReturn($qb);
    }

    private function makePlayer(int $id = 1): Player&MockObject
    {
        $pos = $this->createMock(Position::class);
        $pos->method('getId')->willReturn(1);
        $pos->method('getName')->willReturn('Stürmer');

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn($id);
        $player->method('getFirstName')->willReturn('Max');
        $player->method('getLastName')->willReturn('Mustermann');
        $player->method('getFullName')->willReturn('Max Mustermann');
        $player->method('getBirthdate')->willReturn(null);
        $player->method('getHeight')->willReturn(180);
        $player->method('getWeight')->willReturn(75);
        $player->method('getStrongFoot')->willReturn(null);
        $player->method('getMainPosition')->willReturn($pos);
        $player->method('getAlternativePositions')->willReturn(new ArrayCollection());
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection());
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());
        $player->method('getPlayerNationalityAssignments')->willReturn(new ArrayCollection());
        $player->method('getFussballDeUrl')->willReturn(null);
        $player->method('getFussballDeId')->willReturn(null);

        return $player;
    }

    // ─── Structure ────────────────────────────────────────────────────────────

    public function testSerializeReturnsRequiredTopLevelKeys(): void
    {
        $player = $this->makePlayer();

        $result = $this->service->serializeForCurrentUser($player);

        foreach (
            ['id', 'firstName', 'lastName', 'fullName', 'birthdate',
                'height', 'weight', 'strongFeet', 'mainPosition',
                'alternativePositions', 'clubAssignments', 'nationalityAssignments',
                'teamAssignments', 'fussballDeUrl', 'fussballDeId',
                'stats', 'permissions'] as $key
        ) {
            $this->assertArrayHasKey($key, $result, "Missing key: $key");
        }
    }

    public function testSerializeScalarFields(): void
    {
        $player = $this->makePlayer(99);

        $result = $this->service->serializeForCurrentUser($player);

        $this->assertSame(99, $result['id']);
        $this->assertSame('Max', $result['firstName']);
        $this->assertSame('Mustermann', $result['lastName']);
        $this->assertSame('Max Mustermann', $result['fullName']);
        $this->assertNull($result['birthdate']);
        $this->assertSame(180, $result['height']);
        $this->assertSame(75, $result['weight']);
    }

    public function testSerializeEmptyCollectionsReturnArrays(): void
    {
        $player = $this->makePlayer();

        $result = $this->service->serializeForCurrentUser($player);

        $this->assertIsArray($result['teamAssignments']);
        $this->assertIsArray($result['clubAssignments']);
        $this->assertIsArray($result['nationalityAssignments']);
        $this->assertIsArray($result['alternativePositions']);
        $this->assertEmpty($result['teamAssignments']);
    }

    public function testSerializeMainPosition(): void
    {
        $player = $this->makePlayer();

        $result = $this->service->serializeForCurrentUser($player);

        $this->assertSame(1, $result['mainPosition']['id']);
        $this->assertSame('Stürmer', $result['mainPosition']['name']);
    }

    // ─── isFullScope ──────────────────────────────────────────────────────────

    public function testAdminHasFullScope(): void
    {
        $player = $this->makePlayer();

        // Rebuild service with admin security mock
        $adminSecurity = $this->createMock(Security::class);
        $adminSecurity->method('isGranted')
            ->willReturnCallback(fn (string $a) => in_array($a, ['ROLE_ADMIN']));
        $adminSecurity->method('getUser')->willReturn($this->createMock(User::class));
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);

        $service = new PlayerSerializerService(
            $adminSecurity,
            $this->coachTeamPlayerService,
            $this->em,
        );

        $result = $service->serializeForCurrentUser($player);

        $this->assertTrue($result['permissions']['canEditStammdaten']);
    }

    public function testNonAdminWithNoActiveAssignmentsHasFullScope(): void
    {
        // Player has no team assignments → diff is empty → isFullScope = true for any coach
        $player = $this->makePlayer();

        $result = $this->service->serializeForCurrentUser($player);

        // Coach teams = [], playerTeamIds = [] → array_diff([], []) = [] → count=0 → isFullScope
        $this->assertTrue($result['permissions']['canEditStammdaten']);
    }

    // ─── Permissions ──────────────────────────────────────────────────────────

    public function testPermissionsStructureHasAllKeys(): void
    {
        $player = $this->makePlayer();

        $perms = $this->service->serializeForCurrentUser($player)['permissions'];

        $this->assertArrayHasKey('canView', $perms);
        $this->assertArrayHasKey('canEdit', $perms);
        $this->assertArrayHasKey('canCreate', $perms);
        $this->assertArrayHasKey('canDelete', $perms);
        $this->assertArrayHasKey('canEditStammdaten', $perms);
        $this->assertArrayHasKey('coachTeamIds', $perms);
    }

    public function testCoachTeamIdsAreIncludedInPermissions(): void
    {
        $player = $this->makePlayer();

        $coachSvc = $this->createMock(CoachTeamPlayerService::class);
        $coachSvc->method('collectCoachTeams')->willReturn([7 => 'team']);

        $service = new PlayerSerializerService(
            $this->security,
            $coachSvc,
            $this->em,
        );

        $result = $service->serializeForCurrentUser($player);

        $this->assertSame([7], $result['permissions']['coachTeamIds']);
    }

    // ─── Stats ────────────────────────────────────────────────────────────────

    public function testStatsKeyExistsAndIsArray(): void
    {
        $player = $this->makePlayer();

        $result = $this->service->serializeForCurrentUser($player);

        $this->assertArrayHasKey('stats', $result);
        $this->assertIsArray($result['stats']);
    }

    public function testStatsContainsExpectedKeys(): void
    {
        $player = $this->makePlayer();

        $stats = $this->service->serializeForCurrentUser($player)['stats'];

        $this->assertArrayHasKey('eventCounts', $stats);
        $this->assertArrayHasKey('totalMinutesPlayed', $stats);
        $this->assertArrayHasKey('totalGames', $stats);
    }

    public function testStatsAreZeroWhenNoData(): void
    {
        $player = $this->makePlayer();

        $stats = $this->service->serializeForCurrentUser($player)['stats'];

        $this->assertEmpty($stats['eventCounts']);
        $this->assertSame(0, $stats['totalMinutesPlayed']);
        $this->assertSame(0, $stats['totalGames']);
    }
}
