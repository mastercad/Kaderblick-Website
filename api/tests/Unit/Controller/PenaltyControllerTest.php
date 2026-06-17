<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\PenaltyController;
use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryClubAssignmentType;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\PenaltyType;
use App\Entity\TabEntry;
use App\Entity\Team;
use App\Entity\User;
use App\Service\TeamMembershipService;
use App\Service\UserTeamAccessService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

#[AllowMockObjectsWithoutExpectations]
class PenaltyControllerTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private UserTeamAccessService&MockObject $teamAccessService;
    private TeamMembershipService&MockObject $teamMembershipService;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private TokenStorageInterface&MockObject $tokenStorage;
    private PenaltyController $controller;

    /** @var EntityRepository<PenaltyType>&MockObject */
    private EntityRepository&MockObject $penaltyTypeRepo;

    /** @var EntityRepository<Team>&MockObject */
    private EntityRepository&MockObject $teamRepo;

    /** @var EntityRepository<Club>&MockObject */
    private EntityRepository&MockObject $clubRepo;

    /** @var EntityRepository<User>&MockObject */
    private EntityRepository&MockObject $userRepo;

    /** @var EntityRepository<TabEntry>&MockObject */
    private EntityRepository&MockObject $tabEntryRepo;

    /** @var EntityRepository<FunctionaryTeamAssignment>&MockObject */
    private EntityRepository&MockObject $funcTeamAssignRepo;

    /** @var EntityRepository<FunctionaryClubAssignment>&MockObject */
    private EntityRepository&MockObject $funcClubAssignRepo;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->teamAccessService = $this->createMock(UserTeamAccessService::class);
        $this->teamMembershipService = $this->createMock(TeamMembershipService::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $this->tokenStorage = $this->createMock(TokenStorageInterface::class);

        $this->penaltyTypeRepo = $this->createMock(EntityRepository::class);
        $this->teamRepo = $this->createMock(EntityRepository::class);
        $this->clubRepo = $this->createMock(EntityRepository::class);
        $this->userRepo = $this->createMock(EntityRepository::class);
        $this->tabEntryRepo = $this->createMock(EntityRepository::class);
        $this->funcTeamAssignRepo = $this->createMock(EntityRepository::class);
        $this->funcClubAssignRepo = $this->createMock(EntityRepository::class);

        $this->em->method('getRepository')->willReturnCallback(
            fn (string $class) => match ($class) {
                PenaltyType::class => $this->penaltyTypeRepo,
                Team::class => $this->teamRepo,
                Club::class => $this->clubRepo,
                User::class => $this->userRepo,
                TabEntry::class => $this->tabEntryRepo,
                FunctionaryTeamAssignment::class => $this->funcTeamAssignRepo,
                FunctionaryClubAssignment::class => $this->funcClubAssignRepo,
                default => $this->createMock(EntityRepository::class),
            }
        );

        $this->controller = new PenaltyController(
            $this->em,
            $this->teamAccessService,
            $this->teamMembershipService,
        );

        $container = new ContainerBuilder();
        $container->set('security.authorization_checker', $this->authChecker);
        $container->set('security.token_storage', $this->tokenStorage);
        $this->controller->setContainer($container);
    }

    private function loginAs(int $id = 1): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getFirstName')->willReturn('Max');
        $user->method('getLastName')->willReturn('Mustermann');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        return $user;
    }

    private function grantAdmin(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);
    }

    private function denyAll(): void
    {
        $this->authChecker->method('isGranted')->willReturn(false);
    }

    /** @param array<int, Team&MockObject> $teams */
    private function grantCoach(User $user, array $teams = []): void
    {
        $indexed = [];
        foreach ($teams as $t) {
            $indexed[$t->getId()] = $t;
        }
        $this->teamAccessService->method('getSelfCoachTeams')->with($user)->willReturn($indexed);
    }

    private function grantKassenwartViaTeam(User $user): void
    {
        $type = $this->createMock(FunctionaryTeamAssignmentType::class);
        $type->method('getName')->willReturn('Kassenwart');
        $assignment = $this->createMock(FunctionaryTeamAssignment::class);
        $assignment->method('getFunctionaryTeamAssignmentType')->willReturn($type);
        $this->funcTeamAssignRepo->method('findBy')->with(['user' => $user])->willReturn([$assignment]);
    }

    private function grantKassenwartViaClub(User $user): void
    {
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $type = $this->createMock(FunctionaryClubAssignmentType::class);
        $type->method('getName')->willReturn('Kassenwart');
        $assignment = $this->createMock(FunctionaryClubAssignment::class);
        $assignment->method('getFunctionaryClubAssignmentType')->willReturn($type);
        $this->funcClubAssignRepo->method('findBy')->with(['user' => $user])->willReturn([$assignment]);
    }

    private function makeTeam(int $id, string $name = 'Team A'): Team&MockObject
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getName')->willReturn($name);

        return $team;
    }

    private function makePenaltyType(
        int $id,
        string $name = 'Verspätung',
        float $amount = 5.0,
        bool $isPositive = false,
        bool $active = true,
        bool $currentlyValid = true,
        bool $global = true,
        ?Team $team = null,
        ?Club $club = null,
    ): PenaltyType&MockObject {
        $pt = $this->createMock(PenaltyType::class);
        $pt->method('getId')->willReturn($id);
        $pt->method('getName')->willReturn($name);
        $pt->method('getDescription')->willReturn(null);
        $pt->method('getAmount')->willReturn($amount);
        $pt->method('isPositive')->willReturn($isPositive);
        $pt->method('isActive')->willReturn($active);
        $pt->method('getValidFrom')->willReturn(null);
        $pt->method('getValidUntil')->willReturn(null);
        $pt->method('isGlobal')->willReturn($global);
        $pt->method('isCurrentlyValid')->willReturn($currentlyValid);
        $pt->method('getTeam')->willReturn($team);
        $pt->method('getClub')->willReturn($club);
        $pt->method('getCreatedAt')->willReturn(new DateTimeImmutable());

        return $pt;
    }

    // ─── catalogList ─────────────────────────────────────────────────────────

    public function testCatalogListForbiddenWhenNotCoachOrKassenwart(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $response = $this->controller->catalogList();
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogListAdminSeesAllTypes(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt1 = $this->makePenaltyType(1, 'Global');
        $pt2 = $this->makePenaltyType(2, 'Team-Spezifisch', global: false);
        $this->penaltyTypeRepo->method('findBy')->willReturn([$pt1, $pt2]);
        $this->teamRepo->method('findAll')->willReturn([]);
        $this->teamRepo->method('findBy')->willReturn([]);
        $this->clubRepo->method('findAll')->willReturn([]);

        $response = $this->controller->catalogList();
        $this->assertSame(200, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertCount(2, $data['catalog']);
    }

    public function testCatalogListCoachSeesGlobalAndOwnTeamTypes(): void
    {
        $user = $this->loginAs();
        $this->denyAll();

        $team = $this->makeTeam(10);
        $this->grantCoach($user, [$team]);

        $ptGlobal = $this->makePenaltyType(1, 'Global', global: true);
        $ptOwnTeam = $this->makePenaltyType(2, 'Team', global: false, team: $team);
        $otherTeam = $this->makeTeam(99, 'Other');
        $ptOtherTeam = $this->makePenaltyType(3, 'Other Team', global: false, team: $otherTeam);

        $this->penaltyTypeRepo->method('findBy')->willReturn([$ptGlobal, $ptOwnTeam, $ptOtherTeam]);
        $this->teamRepo->method('findBy')->willReturn([$team]);
        $this->clubRepo->method('findAll')->willReturn([]);

        $response = $this->controller->catalogList();
        $this->assertSame(200, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertCount(2, $data['catalog']);
        $names = array_column($data['catalog'], 'name');
        $this->assertContains('Global', $names);
        $this->assertContains('Team', $names);
        $this->assertNotContains('Other Team', $names);
    }

    public function testCatalogListClubTypesVisibleToCoach(): void
    {
        $user = $this->loginAs();
        $this->denyAll();

        $team = $this->makeTeam(10);
        $this->grantCoach($user, [$team]);

        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn(1);
        $club->method('getName')->willReturn('Test Club');

        $ptClub = $this->makePenaltyType(1, 'Club Type', global: false, club: $club);
        $this->penaltyTypeRepo->method('findBy')->willReturn([$ptClub]);
        $this->teamRepo->method('findBy')->willReturn([$team]);
        $this->clubRepo->method('findAll')->willReturn([$club]);

        $response = $this->controller->catalogList();
        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertCount(1, $data['catalog']);
    }

    public function testCatalogListKassenwartHasAccess(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->grantKassenwartViaTeam($user);
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);

        $this->penaltyTypeRepo->method('findBy')->willReturn([]);
        $this->teamRepo->method('findBy')->willReturn([]);
        $this->clubRepo->method('findAll')->willReturn([]);

        $response = $this->controller->catalogList();
        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── catalogCreate ───────────────────────────────────────────────────────

    public function testCatalogCreateForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $request = new Request(content: json_encode(['name' => 'Test', 'amount' => 5]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogCreateBadRequestEmptyName(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $request = new Request(content: json_encode(['name' => '', 'amount' => 5]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCatalogCreateBadRequestZeroAmount(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $request = new Request(content: json_encode(['name' => 'Test', 'amount' => 0]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCatalogCreateSuccess(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $this->em->expects($this->once())->method('persist')->with($this->isInstanceOf(PenaltyType::class));
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'name' => 'Neue Strafe',
            'amount' => 7.5,
            'isPositive' => false,
            'description' => 'Beschreibung',
            'active' => true,
        ]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(201, $response->getStatusCode());
    }

    public function testCatalogCreateWithTeamScope(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'name' => 'Team Strafe',
            'amount' => 3.0,
            'teamId' => 10,
        ]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(201, $response->getStatusCode());
    }

    public function testCatalogCreateWithClubScope(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $club = $this->createMock(Club::class);
        $club->method('getId')->willReturn(5);
        $club->method('getName')->willReturn('Club');
        $this->clubRepo->method('find')->with(5)->willReturn($club);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'name' => 'Club Strafe',
            'amount' => 2.0,
            'clubId' => 5,
        ]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(201, $response->getStatusCode());
    }

    public function testCatalogCreateWithValidityDates(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'name' => 'Saisonstrafe',
            'amount' => 5.0,
            'validFrom' => '2026-01-01',
            'validUntil' => '2026-12-31',
        ]));
        $response = $this->controller->catalogCreate($request);
        $this->assertSame(201, $response->getStatusCode());
    }

    // ─── catalogUpdate ───────────────────────────────────────────────────────

    public function testCatalogUpdateForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $request = new Request(content: json_encode(['name' => 'X']));
        $response = $this->controller->catalogUpdate(1, $request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogUpdateNotFound(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $this->penaltyTypeRepo->method('find')->with(999)->willReturn(null);

        $request = new Request(content: json_encode(['name' => 'X']));
        $response = $this->controller->catalogUpdate(999, $request);
        $this->assertSame(404, $response->getStatusCode());
    }

    public function testCatalogUpdateGlobalTypeNonAdminForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();

        $team = $this->makeTeam(10);
        $this->grantCoach($user, [$team]);

        $pt = $this->makePenaltyType(1, 'Global', global: true);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $request = new Request(content: json_encode(['name' => 'X']));
        $response = $this->controller->catalogUpdate(1, $request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogUpdateSuccess(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt = new PenaltyType();
        $pt->setName('Alt');
        $pt->setAmount(5.0);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'name' => 'Neu',
            'amount' => 10.0,
            'isPositive' => true,
            'description' => 'New desc',
            'active' => false,
            'validFrom' => '2026-01-01',
            'validUntil' => '2026-12-31',
        ]));
        $response = $this->controller->catalogUpdate(1, $request);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Neu', $pt->getName());
        $this->assertEquals(10.0, $pt->getAmount());
        $this->assertTrue($pt->isPositive());
        $this->assertSame('New desc', $pt->getDescription());
        $this->assertFalse($pt->isActive());
    }

    public function testCatalogUpdatePartialFields(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt = new PenaltyType();
        $pt->setName('Original');
        $pt->setAmount(5.0);
        $pt->setDescription('Orig desc');
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $request = new Request(content: json_encode(['name' => 'Updated']));
        $response = $this->controller->catalogUpdate(1, $request);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Updated', $pt->getName());
        $this->assertEquals(5.0, $pt->getAmount());
        $this->assertSame('Orig desc', $pt->getDescription());
    }

    public function testCatalogUpdateClearNullableFields(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt = new PenaltyType();
        $pt->setName('Test');
        $pt->setAmount(5.0);
        $pt->setDescription('Some desc');
        $pt->setValidFrom(new DateTimeImmutable('2026-01-01'));
        $pt->setValidUntil(new DateTimeImmutable('2026-12-31'));
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $request = new Request(content: json_encode([
            'description' => null,
            'validFrom' => null,
            'validUntil' => null,
        ]));
        $response = $this->controller->catalogUpdate(1, $request);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($pt->getDescription());
        $this->assertNull($pt->getValidFrom());
        $this->assertNull($pt->getValidUntil());
    }

    // ─── catalogDelete ───────────────────────────────────────────────────────

    public function testCatalogDeleteForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $response = $this->controller->catalogDelete(1);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogDeleteNotFound(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $this->penaltyTypeRepo->method('find')->with(999)->willReturn(null);

        $response = $this->controller->catalogDelete(999);
        $this->assertSame(404, $response->getStatusCode());
    }

    public function testCatalogDeleteGlobalNonAdminForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();

        $team = $this->makeTeam(10);
        $this->grantCoach($user, [$team]);

        $pt = $this->makePenaltyType(1, 'Global', global: true);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $response = $this->controller->catalogDelete(1);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCatalogDeleteInUseConflict(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt = $this->makePenaltyType(1, 'Used');
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->tabEntryRepo->method('count')->with(['penaltyType' => $pt])->willReturn(3);

        $response = $this->controller->catalogDelete(1);
        $this->assertSame(409, $response->getStatusCode());
    }

    public function testCatalogDeleteSuccess(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $pt = $this->makePenaltyType(1, 'Unused');
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->tabEntryRepo->method('count')->with(['penaltyType' => $pt])->willReturn(0);

        $this->em->expects($this->once())->method('remove')->with($pt);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->catalogDelete(1);
        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── assign ──────────────────────────────────────────────────────────────

    public function testAssignMissingParams(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $request = new Request(content: json_encode([]));
        $response = $this->controller->assign($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testAssignPenaltyTypeNotFound(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $this->penaltyTypeRepo->method('find')->with(99)->willReturn(null);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 99,
            'userId' => 1,
            'teamId' => 1,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testAssignPenaltyTypeInactive(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $pt = $this->makePenaltyType(1, active: false);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testAssignPenaltyTypeNotCurrentlyValid(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $pt = $this->makePenaltyType(1, currentlyValid: false);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testAssignTeamNotFound(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $pt = $this->makePenaltyType(1);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(999)->willReturn(null);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 999,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(404, $response->getStatusCode());
    }

    public function testAssignNotCoachOfTeam(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->grantCoach($user, []);

        $pt = $this->makePenaltyType(1);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);

        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testAssignTargetUserNotFound(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $pt = $this->makePenaltyType(1);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(10)->willReturn($team);
        $this->teamRepo->method('findAll')->willReturn([$team]);
        $this->userRepo->method('find')->with(99)->willReturn(null);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 99,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(404, $response->getStatusCode());
    }

    public function testAssignUserNotInTeam(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $pt = $this->makePenaltyType(1);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(10)->willReturn($team);
        $this->teamRepo->method('findAll')->willReturn([$team]);

        $targetUser = $this->createMock(User::class);
        $targetUser->method('getId')->willReturn(2);
        $this->userRepo->method('find')->with(2)->willReturn($targetUser);

        $this->teamMembershipService->method('resolveTeamMembers')->with($team)->willReturn([]);

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(400, $response->getStatusCode());
    }

    public function testAssignSuccessNegativePenalty(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $this->teamRepo->method('findAll')->willReturn([$team]);
        $pt = $this->makePenaltyType(1, 'Verspätung', 5.0, isPositive: false);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $targetUser = $this->createMock(User::class);
        $targetUser->method('getId')->willReturn(2);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $this->userRepo->method('find')->with(2)->willReturn($targetUser);
        $this->teamMembershipService->method('resolveTeamMembers')->willReturn([2 => $targetUser]);

        $this->em->expects($this->once())->method('persist')->with($this->isInstanceOf(TabEntry::class));
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
            'entryDate' => '2026-06-17',
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(201, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertEquals(5.0, $data['entry']['amount']);
        $this->assertFalse($data['entry']['isPositive']);
    }

    public function testAssignSuccessPositiveReward(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $this->teamRepo->method('findAll')->willReturn([$team]);
        $pt = $this->makePenaltyType(1, 'Trainingsteilnahme', 0.20, isPositive: true);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $targetUser = $this->createMock(User::class);
        $targetUser->method('getId')->willReturn(2);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $this->userRepo->method('find')->with(2)->willReturn($targetUser);
        $this->teamMembershipService->method('resolveTeamMembers')->willReturn([2 => $targetUser]);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(201, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertEquals(-0.20, $data['entry']['amount']);
        $this->assertTrue($data['entry']['isPositive']);
    }

    public function testAssignWithNote(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $this->teamRepo->method('findAll')->willReturn([$team]);
        $pt = $this->makePenaltyType(1);
        $this->penaltyTypeRepo->method('find')->with(1)->willReturn($pt);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $targetUser = $this->createMock(User::class);
        $targetUser->method('getId')->willReturn(2);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $this->userRepo->method('find')->with(2)->willReturn($targetUser);
        $this->teamMembershipService->method('resolveTeamMembers')->willReturn([2 => $targetUser]);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = new Request(content: json_encode([
            'penaltyTypeId' => 1,
            'userId' => 2,
            'teamId' => 10,
            'note' => 'Wieder zu spät!',
        ]));
        $response = $this->controller->assign($request);
        $this->assertSame(201, $response->getStatusCode());
    }

    // ─── teamPlayers ─────────────────────────────────────────────────────────

    public function testTeamPlayersTeamNotFound(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $this->teamRepo->method('find')->with(999)->willReturn(null);

        $response = $this->controller->teamPlayers(999);
        $this->assertSame(404, $response->getStatusCode());
    }

    public function testTeamPlayersForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->grantCoach($user, []);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $response = $this->controller->teamPlayers(10);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testTeamPlayersSuccess(): void
    {
        $user = $this->loginAs();
        $this->grantAdmin();

        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->with(10)->willReturn($team);

        $player1 = $this->createMock(User::class);
        $player1->method('getId')->willReturn(2);
        $player1->method('getFirstName')->willReturn('Zebra');
        $player1->method('getLastName')->willReturn('Müller');

        $player2 = $this->createMock(User::class);
        $player2->method('getId')->willReturn(3);
        $player2->method('getFirstName')->willReturn('Anton');
        $player2->method('getLastName')->willReturn('Becker');

        $this->teamMembershipService->method('resolveTeamMembers')
            ->willReturn([2 => $player1, 3 => $player2]);

        $response = $this->controller->teamPlayers(10);
        $this->assertSame(200, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertCount(2, $data['players']);
        $this->assertSame('Anton Becker', $data['players'][0]['name']);
        $this->assertSame('Zebra Müller', $data['players'][1]['name']);
    }

    public function testTeamPlayersKassenwartHasAccess(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->grantCoach($user, []);
        $this->grantKassenwartViaClub($user);

        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->with(10)->willReturn($team);
        $this->teamMembershipService->method('resolveTeamMembers')->willReturn([]);

        $response = $this->controller->teamPlayers(10);
        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── history ─────────────────────────────────────────────────────────────

    public function testHistoryForbidden(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->teamAccessService->method('getSelfCoachTeams')->willReturn([]);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $request = new Request();
        $response = $this->controller->history($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testHistoryEmptyTeamIdsReturnsEmpty(): void
    {
        $user = $this->loginAs();
        $this->denyAll();

        $team = $this->makeTeam(10);
        $this->grantCoach($user, [$team]);

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        $qb->method('addOrderBy')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([]);
        $qb->method('getQuery')->willReturn($query);

        $this->tabEntryRepo->method('createQueryBuilder')->willReturn($qb);

        $request = new Request();
        $response = $this->controller->history($request);
        $this->assertSame(200, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertEmpty($data['entries']);
    }

    public function testHistoryAdminSeesAll(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('where')->willReturnSelf();
        $qb->method('andWhere')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        $qb->method('addOrderBy')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();
        $qb->method('setParameter')->willReturnSelf();

        $pt = $this->makePenaltyType(1, 'Gelbe Karte');
        $targetUser = $this->createMock(User::class);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $targetUser->method('getId')->willReturn(2);

        $team = $this->makeTeam(10);

        $entry = $this->createMock(TabEntry::class);
        $entry->method('getId')->willReturn(1);
        $entry->method('getUser')->willReturn($targetUser);
        $entry->method('getPenaltyType')->willReturn($pt);
        $entry->method('getCustomName')->willReturn('Gelbe Karte');
        $entry->method('getPriceAtBooking')->willReturn(5.0);
        $entry->method('getEntryDate')->willReturn(new DateTimeImmutable('2026-06-17'));
        $entry->method('getNote')->willReturn(null);
        $entry->method('getTeam')->willReturn($team);
        $entry->method('getCreatedByUser')->willReturn(null);
        $entry->method('getCreatedAt')->willReturn(new DateTimeImmutable('2026-06-17 10:00'));

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$entry]);
        $qb->method('getQuery')->willReturn($query);

        $this->tabEntryRepo->method('createQueryBuilder')->willReturn($qb);

        $request = new Request();
        $response = $this->controller->history($request);
        $this->assertSame(200, $response->getStatusCode());

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertCount(1, $data['entries']);
        $this->assertSame('Hans Müller', $data['entries'][0]['userName']);
        $this->assertSame('Gelbe Karte', $data['entries'][0]['penaltyName']);
    }

    public function testHistoryCoachEmptyTeamsReturnsEmpty(): void
    {
        $user = $this->loginAs();
        $this->denyAll();
        $this->grantCoach($user, []);
        $this->funcTeamAssignRepo->method('findBy')->willReturn([]);
        $this->funcClubAssignRepo->method('findBy')->willReturn([]);

        $request = new Request();
        $response = $this->controller->history($request);
        $this->assertSame(403, $response->getStatusCode());
    }

    public function testHistoryEntryWithCreatedByUser(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('where')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        $qb->method('addOrderBy')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();

        $pt = $this->makePenaltyType(1);
        $targetUser = $this->createMock(User::class);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $targetUser->method('getId')->willReturn(2);

        $createdBy = $this->createMock(User::class);
        $createdBy->method('getFirstName')->willReturn('Trainer');
        $createdBy->method('getLastName')->willReturn('Schmidt');

        $entry = $this->createMock(TabEntry::class);
        $entry->method('getId')->willReturn(1);
        $entry->method('getUser')->willReturn($targetUser);
        $entry->method('getPenaltyType')->willReturn($pt);
        $entry->method('getCustomName')->willReturn('Verspätung');
        $entry->method('getPriceAtBooking')->willReturn(5.0);
        $entry->method('getEntryDate')->willReturn(new DateTimeImmutable('2026-06-17'));
        $entry->method('getNote')->willReturn('Notiz');
        $entry->method('getTeam')->willReturn(null);
        $entry->method('getCreatedByUser')->willReturn($createdBy);
        $entry->method('getCreatedAt')->willReturn(new DateTimeImmutable('2026-06-17 10:00'));

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$entry]);
        $qb->method('getQuery')->willReturn($query);

        $this->tabEntryRepo->method('createQueryBuilder')->willReturn($qb);

        $request = new Request();
        $response = $this->controller->history($request);

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertSame('Trainer Schmidt', $data['entries'][0]['createdBy']);
        $this->assertSame('Notiz', $data['entries'][0]['note']);
    }

    public function testHistoryEntryWithNullPenaltyType(): void
    {
        $this->loginAs();
        $this->grantAdmin();

        $qb = $this->createMock(QueryBuilder::class);
        $qb->method('where')->willReturnSelf();
        $qb->method('orderBy')->willReturnSelf();
        $qb->method('addOrderBy')->willReturnSelf();
        $qb->method('setMaxResults')->willReturnSelf();

        $targetUser = $this->createMock(User::class);
        $targetUser->method('getFirstName')->willReturn('Hans');
        $targetUser->method('getLastName')->willReturn('Müller');
        $targetUser->method('getId')->willReturn(2);

        $entry = $this->createMock(TabEntry::class);
        $entry->method('getId')->willReturn(1);
        $entry->method('getUser')->willReturn($targetUser);
        $entry->method('getPenaltyType')->willReturn(null);
        $entry->method('getCustomName')->willReturn('Custom Entry');
        $entry->method('getPriceAtBooking')->willReturn(3.0);
        $entry->method('getEntryDate')->willReturn(new DateTimeImmutable('2026-06-17'));
        $entry->method('getNote')->willReturn(null);
        $entry->method('getTeam')->willReturn(null);
        $entry->method('getCreatedByUser')->willReturn(null);
        $entry->method('getCreatedAt')->willReturn(new DateTimeImmutable('2026-06-17 10:00'));

        $query = $this->createMock(Query::class);
        $query->method('getResult')->willReturn([$entry]);
        $qb->method('getQuery')->willReturn($query);

        $this->tabEntryRepo->method('createQueryBuilder')->willReturn($qb);

        $request = new Request();
        $response = $this->controller->history($request);

        /** @var array<string, mixed> $data */
        $data = json_decode($response->getContent(), true);
        $this->assertSame('Custom Entry', $data['entries'][0]['penaltyName']);
        $this->assertFalse($data['entries'][0]['isPositive']);
    }
}
