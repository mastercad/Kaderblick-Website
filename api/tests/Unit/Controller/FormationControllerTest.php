<?php

namespace App\Tests\Unit\Controller;

use App\Controller\FormationController;
use App\Entity\Formation;
use App\Entity\FormationType;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\FormationRepository;
use App\Security\Voter\FormationVoter;
use App\Service\CoachTeamPlayerService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit-Tests für FormationController.
 *
 * Abgedeckt:
 *  - index(): kein User → leere Antwort
 *  - index(): normaler User → findVisibleFormationsForUser wird aufgerufen
 *  - index(): SUPERADMIN + teamId-Param → findByTeam wird aufgerufen
 *  - index(): Nicht-SUPERADMIN + teamId-Param → findVisibleFormationsForUser (KEIN findByTeam)
 *  - index(): JSON-Struktur der Antwort
 *  - allTeams(): Nicht-SUPERADMIN → 403
 *  - allTeams(): SUPERADMIN → Teams-Liste aus Repository
 */
#[AllowMockObjectsWithoutExpectations]
class FormationControllerTest extends TestCase
{
    private FormationController $controller;
    private CoachTeamPlayerService&MockObject $coachTeamPlayerService;
    private EntityManagerInterface&MockObject $em;
    private FormationRepository&MockObject $formationRepo;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->formationRepo = $this->createMock(FormationRepository::class);
        $logger = $this->createMock(LoggerInterface::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $this->controller = new FormationController(
            $this->coachTeamPlayerService,
            $this->formationRepo,
            $logger,
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function wireUser(?User $user, bool $isSuperAdmin = false, bool $canEdit = true): void
    {
        if (null === $user) {
            $token = null;
        } else {
            $token = $this->createMock(TokenInterface::class);
            $token->method('getUser')->willReturn($user);
        }

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $this->authChecker
            ->method('isGranted')
            ->willReturnCallback(function (string $attribute) use ($isSuperAdmin, $canEdit) {
                return match ($attribute) {
                    'ROLE_SUPERADMIN' => $isSuperAdmin,
                    FormationVoter::EDIT => $canEdit,
                    default => false,
                };
            });

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }

    private function makeUser(): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        return $user;
    }

    private function makeFormation(int $id = 1): Formation&MockObject
    {
        $formationType = $this->createMock(FormationType::class);
        $formationType->method('getId')->willReturn(1);
        $formationType->method('getName')->willReturn('Fußball');
        $formationType->method('getBackgroundPath')->willReturn('pitch.png');
        $formationType->method('getCssClass')->willReturn('football');

        $formation = $this->createMock(Formation::class);
        $formation->method('getId')->willReturn($id);
        $formation->method('getName')->willReturn("Formation {$id}");
        $formation->method('getFormationData')->willReturn(['code' => '4-3-3']);
        $formation->method('getFormationType')->willReturn($formationType);

        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(1);
        $team->method('getName')->willReturn('Test Team');
        $formation->method('getTeam')->willReturn($team);

        return $formation;
    }

    /** @param array<Team> $teams */
    private function mockCollectCoachTeams(User&MockObject $user, array $teams = []): void
    {
        $this->coachTeamPlayerService
            ->method('collectCoachTeams')
            ->with($user)
            ->willReturn($teams);
    }

    // ─── index() ──────────────────────────────────────────────────────────────

    public function testIndexReturnsEmptyFormationsWhenNotAuthenticated(): void
    {
        $this->wireUser(null);

        $response = $this->controller->index(new Request(), $this->em);
        $body = json_decode((string) $response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertArrayHasKey('formations', $body);
        $this->assertSame([], $body['formations']);
    }

    public function testIndexCallsFindVisibleFormationsForUserForNormalUser(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false);
        $this->mockCollectCoachTeams($user);

        $this->formationRepo->expects($this->once())
            ->method('findVisibleForUser')
            ->with([])
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findByTeam');

        $this->controller->index(new Request(), $this->em);
    }

    public function testIndexCallsFindByTeamForSuperAdminWithTeamIdParam(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, true);

        $this->formationRepo->expects($this->once())
            ->method('findByTeam')
            ->with(5)
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findVisibleForUser');

        $request = Request::create('/', 'GET', ['teamId' => '5']);
        $this->controller->index($request, $this->em);
    }

    public function testIndexIgnoresTeamIdParamForNonSuperAdmin(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false); // kein SUPERADMIN
        $this->mockCollectCoachTeams($user);

        $this->formationRepo->expects($this->once())
            ->method('findVisibleForUser')
            ->with([])
            ->willReturn([]);

        // findByTeam darf NICHT aufgerufen werden, auch wenn teamId übergeben wurde
        $this->formationRepo->expects($this->never())
            ->method('findByTeam');

        $request = Request::create('/', 'GET', ['teamId' => '5']);
        $this->controller->index($request, $this->em);
    }

    public function testIndexReturnsCorrectJsonStructureForFormations(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false);
        $this->mockCollectCoachTeams($user);

        $formation = $this->makeFormation(42);
        $this->formationRepo->method('findVisibleForUser')->willReturn([$formation]);

        $response = $this->controller->index(new Request(), $this->em);
        $body = json_decode((string) $response->getContent(), true);

        $this->assertArrayHasKey('formations', $body);
        $this->assertCount(1, $body['formations']);

        $f = $body['formations'][0];
        $this->assertSame(42, $f['id']);
        $this->assertSame('Formation 42', $f['name']);
        $this->assertArrayHasKey('teamId', $f);
        $this->assertArrayHasKey('teamName', $f);
        $this->assertArrayHasKey('formationData', $f);
        $this->assertArrayHasKey('formationType', $f);
        $this->assertArrayHasKey('id', $f['formationType']);
        $this->assertArrayHasKey('name', $f['formationType']);
        $this->assertArrayHasKey('backgroundPath', $f['formationType']);
        $this->assertArrayHasKey('cssClass', $f['formationType']);
    }

    public function testIndexCastsTeamIdToInt(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, true);

        // teamId kommt als String via Query-String
        $this->formationRepo->expects($this->once())
            ->method('findByTeam')
            ->with($this->identicalTo(12)) // muss int sein
            ->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => '12']);
        $this->controller->index($request, $this->em);
    }

    public function testIndexSuperAdminWithoutTeamIdParamUsesVisibleFormations(): void
    {
        // SUPERADMIN ohne teamId-Param soll weiterhin findVisibleForUser nutzen
        $user = $this->makeUser();
        $this->wireUser($user, true);
        $this->mockCollectCoachTeams($user);

        $this->formationRepo->expects($this->once())
            ->method('findVisibleForUser')
            ->with([])
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findByTeam');

        $this->controller->index(new Request(), $this->em);
    }

    // ─── allTeams() ───────────────────────────────────────────────────────────

    public function testAllTeamsReturns403ForNonSuperAdmin(): void
    {
        $this->wireUser($this->makeUser(), false);

        $response = $this->controller->allTeams($this->em);

        $this->assertSame(403, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testAllTeamsReturnsTeamsForSuperAdmin(): void
    {
        $this->wireUser($this->makeUser(), true);

        $teamA = $this->createMock(Team::class);
        $teamA->method('getId')->willReturn(1);
        $teamA->method('getName')->willReturn('A-Jugend');

        $teamB = $this->createMock(Team::class);
        $teamB->method('getId')->willReturn(2);
        $teamB->method('getName')->willReturn('B-Jugend');

        $this->em->method('getRepository')
            ->with(Team::class)
            ->willReturn($this->createConfiguredMock(
                \Doctrine\ORM\EntityRepository::class,
                ['findBy' => [$teamA, $teamB]]
            ));

        $response = $this->controller->allTeams($this->em);
        $body = json_decode((string) $response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertArrayHasKey('teams', $body);
        $this->assertCount(2, $body['teams']);

        $this->assertSame(1, $body['teams'][0]['id']);
        $this->assertSame('A-Jugend', $body['teams'][0]['name']);
        $this->assertSame(2, $body['teams'][1]['id']);
        $this->assertSame('B-Jugend', $body['teams'][1]['name']);
    }

    public function testAllTeamsReturnsEmptyTeamsArrayWhenNoTeamsExist(): void
    {
        $this->wireUser($this->makeUser(), true);

        $this->em->method('getRepository')
            ->with(Team::class)
            ->willReturn($this->createConfiguredMock(
                \Doctrine\ORM\EntityRepository::class,
                ['findBy' => []]
            ));

        $response = $this->controller->allTeams($this->em);
        $body = json_decode((string) $response->getContent(), true);

        $this->assertSame([], $body['teams']);
    }

    public function testAllTeamsQueriesByNameAsc(): void
    {
        $this->wireUser($this->makeUser(), true);

        $teamRepo = $this->createMock(\Doctrine\ORM\EntityRepository::class);
        $teamRepo->expects($this->once())
            ->method('findBy')
            ->with([], ['name' => 'ASC'])
            ->willReturn([]);

        $this->em->method('getRepository')
            ->with(Team::class)
            ->willReturn($teamRepo);

        $this->controller->allTeams($this->em);
    }

    // ─── archived() ───────────────────────────────────────────────────────────

    public function testArchivedReturnsEmptyFormationsWhenNotAuthenticated(): void
    {
        $this->wireUser(null);

        $response = $this->controller->archived(new Request());
        $body = json_decode((string) $response->getContent(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertArrayHasKey('formations', $body);
        $this->assertSame([], $body['formations']);
    }

    public function testArchivedCallsFindArchivedForUserForNormalUser(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false);
        $this->mockCollectCoachTeams($user);

        $this->formationRepo->expects($this->once())
            ->method('findArchivedForUser')
            ->with([])
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findArchivedByTeam');

        $this->controller->archived(new Request());
    }

    public function testArchivedCallsFindArchivedByTeamForSuperAdminWithTeamIdParam(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, true);

        $this->formationRepo->expects($this->once())
            ->method('findArchivedByTeam')
            ->with(3)
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findArchivedForUser');

        $request = Request::create('/', 'GET', ['teamId' => '3']);
        $this->controller->archived($request);
    }

    public function testArchivedIgnoresTeamIdParamForNonSuperAdmin(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false);
        $this->mockCollectCoachTeams($user);

        $this->formationRepo->expects($this->once())
            ->method('findArchivedForUser')
            ->willReturn([]);

        $this->formationRepo->expects($this->never())
            ->method('findArchivedByTeam');

        $request = Request::create('/', 'GET', ['teamId' => '3']);
        $this->controller->archived($request);
    }

    public function testArchivedResponseIncludesArchivedAtField(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false);
        $this->mockCollectCoachTeams($user);

        $archivedAt = new DateTimeImmutable('2026-04-30T10:00:00+00:00');
        $formation = $this->makeFormation(7);
        $formation->method('getArchivedAt')->willReturn($archivedAt);

        $this->formationRepo->method('findArchivedForUser')->willReturn([$formation]);

        $response = $this->controller->archived(new Request());
        $body = json_decode((string) $response->getContent(), true);

        $this->assertCount(1, $body['formations']);
        $this->assertArrayHasKey('archivedAt', $body['formations'][0]);
        $this->assertNotNull($body['formations'][0]['archivedAt']);
    }

    // ─── archive() ────────────────────────────────────────────────────────────

    public function testArchiveReturns403WhenAccessDenied(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: false);

        $formation = $this->makeFormation();
        $response = $this->controller->archive($formation, $this->em);

        $this->assertSame(403, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testArchiveReturnsSuccessWhenAccessGranted(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: true);

        $formation = $this->makeFormation();
        $formation->expects($this->once())->method('archive')->willReturnSelf();

        $response = $this->controller->archive($formation, $this->em);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertTrue($body['success']);
    }

    public function testArchiveCallsFlushOnEntityManager(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: true);

        $formation = $this->makeFormation();
        $formation->method('archive')->willReturnSelf();

        $this->em->expects($this->once())->method('flush');

        $this->controller->archive($formation, $this->em);
    }

    // ─── unarchive() ──────────────────────────────────────────────────────────

    public function testUnarchiveReturns403WhenAccessDenied(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: false);

        $formation = $this->makeFormation();
        $response = $this->controller->unarchive($formation, $this->em);

        $this->assertSame(403, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testUnarchiveReturnsSuccessWithFormationInResponse(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: true);

        $formation = $this->makeFormation(5);
        $formation->expects($this->once())->method('unarchive')->willReturnSelf();

        $response = $this->controller->unarchive($formation, $this->em);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertTrue($body['success']);
        $this->assertArrayHasKey('formation', $body);
        $this->assertSame(5, $body['formation']['id']);
    }

    public function testUnarchiveResponseIncludesExpectedFields(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: true);

        $formation = $this->makeFormation(5);
        $formation->method('unarchive')->willReturnSelf();

        $response = $this->controller->unarchive($formation, $this->em);
        $body = json_decode((string) $response->getContent(), true);
        $f = $body['formation'];

        $this->assertArrayHasKey('id', $f);
        $this->assertArrayHasKey('name', $f);
        $this->assertArrayHasKey('teamId', $f);
        $this->assertArrayHasKey('teamName', $f);
        $this->assertArrayHasKey('formationData', $f);
        $this->assertArrayHasKey('formationType', $f);
    }

    public function testUnarchiveCallsFlushOnEntityManager(): void
    {
        $user = $this->makeUser();
        $this->wireUser($user, false, canEdit: true);

        $formation = $this->makeFormation();
        $formation->method('unarchive')->willReturnSelf();

        $this->em->expects($this->once())->method('flush');

        $this->controller->unarchive($formation, $this->em);
    }
}
