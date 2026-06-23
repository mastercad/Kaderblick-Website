<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\TeamSizeGuideController;
use App\Entity\CalendarEventType;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CalendarEventTypeRepository;
use App\Service\CoachTeamPlayerService;
use App\Service\PushNotificationService;
use App\Service\SizeGuidePdfService;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit-Tests für TeamSizeGuideController.
 *
 * Abgedeckte Methoden:
 *   - sizeGuideOverview  (Spieler, Trainer, Supporter, Dedup, Datumfilter)
 *   - sizeGuidePdf       (404, Player-Filter, PDF-Inhalt, Content-Disposition)
 *   - sizeGuideRemind    (404, 400 Validierung, Push, Exclude, Dedup, createTask)
 */
#[AllowMockObjectsWithoutExpectations]
class TeamSizeGuideControllerTest extends TestCase
{
    private CoachTeamPlayerService & MockObject $coachTeamPlayerService;
    private SizeGuidePdfService & MockObject $sizeGuidePdfService;
    private PushNotificationService & MockObject $pushNotificationService;
    private EntityManagerInterface & MockObject $em;
    private CalendarEventTypeRepository & MockObject $calendarEventTypeRepository;
    private User & MockObject $loggedInUser;
    private TeamSizeGuideController $controller;

    protected function setUp(): void
    {
        $this->coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $this->sizeGuidePdfService = $this->createMock(SizeGuidePdfService::class);
        $this->pushNotificationService = $this->createMock(PushNotificationService::class);
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventTypeRepository = $this->createMock(CalendarEventTypeRepository::class);

        $this->controller = new TeamSizeGuideController(
            $this->coachTeamPlayerService,
            $this->sizeGuidePdfService,
            $this->pushNotificationService,
            $this->em,
            $this->calendarEventTypeRepository,
        );

        $this->loggedInUser = $this->createMock(User::class);

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->loggedInUser);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $authChecker);
        $container->set('serializer', new class {
            /** @param array<string, mixed> $context */
            public function serialize(mixed $data, string $format, array $context = []): string
            {
                return json_encode($data, JSON_THROW_ON_ERROR);
            }
        });

        $this->controller->setContainer($container);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Erstellt einen User-Mock mit optionalen Größenangaben und Rollen.
     *
     * @param array<string> $roles
     */
    private function makeUser(
        int $id,
        string $fullName = 'Test User',
        ?string $pantsSize = 'M',
        ?string $shirtSize = 'L',
        ?float $shoeSize = 42.0,
        ?string $socksSize = 'M',
        ?string $jacketSize = 'L',
        array $roles = ['ROLE_USER'],
    ): User & MockObject {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getFullName')->willReturn($fullName);
        $user->method('getPantsSize')->willReturn($pantsSize);
        $user->method('getShirtSize')->willReturn($shirtSize);
        $user->method('getShoeSize')->willReturn($shoeSize);
        $user->method('getSocksSize')->willReturn($socksSize);
        $user->method('getJacketSize')->willReturn($jacketSize);
        $user->method('getRoles')->willReturn($roles);

        return $user;
    }

    /**
     * Erstellt einen UserRelation-Mock mit einem bestimmten Relationstyp-Identifier.
     */
    private function makeRelation(string $identifier, User $relUser): UserRelation & MockObject
    {
        $relType = $this->createMock(RelationType::class);
        $relType->method('getIdentifier')->willReturn($identifier);

        $rel = $this->createMock(UserRelation::class);
        $rel->method('getRelationType')->willReturn($relType);
        $rel->method('getUser')->willReturn($relUser);

        return $rel;
    }

    /**
     * Erstellt einen Player-Mock mit einer UserRelation-Collection.
     *
     * @param UserRelation[] $relations
     */
    private function makePlayer(string $fullname, array $relations = []): Player & MockObject
    {
        $player = $this->createMock(Player::class);
        $player->method('getFullname')->willReturn($fullname);
        $player->method('getUserRelations')->willReturn(new ArrayCollection($relations));

        return $player;
    }

    /**
     * Erstellt einen Coach-Mock mit einer UserRelation-Collection.
     *
     * @param UserRelation[] $relations
     */
    private function makeCoach(string $fullName, array $relations = []): Coach & MockObject
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getFullName')->willReturn($fullName);
        $coach->method('getUserRelations')->willReturn(new ArrayCollection($relations));

        return $coach;
    }

    /**
     * Erstellt einen PlayerTeamAssignment-Mock.
     */
    private function makePlayerAssignment(
        Player $player,
        ?DateTime $start = null,
        ?DateTime $end = null,
    ): PlayerTeamAssignment & MockObject {
        $assignment = $this->createMock(PlayerTeamAssignment::class);
        $assignment->method('getPlayer')->willReturn($player);
        $assignment->method('getStartDate')->willReturn($start);
        $assignment->method('getEndDate')->willReturn($end);

        return $assignment;
    }

    /**
     * Erstellt einen CoachTeamAssignment-Mock.
     */
    private function makeCoachAssignment(
        Coach $coach,
        ?DateTime $start = null,
        ?DateTime $end = null,
    ): CoachTeamAssignment & MockObject {
        $assignment = $this->createMock(CoachTeamAssignment::class);
        $assignment->method('getCoach')->willReturn($coach);
        $assignment->method('getStartDate')->willReturn($start);
        $assignment->method('getEndDate')->willReturn($end);

        return $assignment;
    }

    /**
     * Erstellt einen Team-Mock mit gegebenen Assignments.
     *
     * @param PlayerTeamAssignment[] $playerAssignments
     * @param CoachTeamAssignment[]  $coachAssignments
     */
    private function makeTeam(
        int $id,
        string $name,
        array $playerAssignments = [],
        array $coachAssignments = [],
    ): Team & MockObject {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getName')->willReturn($name);
        $team->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection($playerAssignments));
        $team->method('getCoachTeamAssignments')->willReturn(new ArrayCollection($coachAssignments));

        return $team;
    }

    /** @return array<mixed> */
    private function decodeJson(string $content): array
    {
        $data = json_decode($content, true);
        $this->assertIsArray($data);

        return $data;
    }

    private function jsonRequest(mixed $body = null): Request
    {
        return Request::create(
            '/',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            null !== $body ? json_encode($body, JSON_THROW_ON_ERROR) : '',
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // sizeGuideOverview
    // ═════════════════════════════════════════════════════════════════════════

    public function testOverviewNoTeamsReturnsEmptyArray(): void
    {
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);

        $response = $this->controller->sizeGuideOverview();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([], $this->decodeJson($response->getContent()));
    }

    public function testOverviewActivePlayerIsIncluded(): void
    {
        $user = $this->makeUser(1, 'Max Mustermann', 'M', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Max Mustermann', [$rel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(1, $data);
        $this->assertSame(10, $data[0]['team_id']);
        $this->assertSame('U17', $data[0]['team_name']);
        $this->assertCount(1, $data[0]['players']);
        $this->assertSame(1, $data[0]['players'][0]['id']);
        $this->assertSame('Max Mustermann', $data[0]['players'][0]['name']);
        $this->assertSame('M', $data[0]['players'][0]['shorts_size']);
        $this->assertSame('42', $data[0]['players'][0]['shoe_size']); // float → string
        $this->assertCount(0, $data[0]['coaches']);
        $this->assertCount(0, $data[0]['supporters']);
    }

    public function testOverviewNullShoeSizeIsNull(): void
    {
        $user = $this->makeUser(1, 'Anna', 'M', 'L', null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Anna', [$rel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertNull($data[0]['players'][0]['shoe_size']);
    }

    public function testOverviewFutureStartDateExcludesPlayer(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Future Player', [$rel]);
        $future = new DateTime('+1 year');
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player, $future)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['players']);
    }

    public function testOverviewPastEndDateExcludesPlayer(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Past Player', [$rel]);
        $past = new DateTime('-1 year');
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player, null, $past)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['players']);
    }

    public function testOverviewPlayerWithNoSelfPlayerRelationIsExcluded(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('parent', $user); // nicht 'self_player'
        $player = $this->makePlayer('Orphan', [$rel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['players']);
    }

    public function testOverviewActiveCoachIsIncluded(): void
    {
        $user = $this->makeUser(2, 'Coach Huber', 'XL', 'XL', 44.0, 'L', 'XL');
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Coach Huber', [$rel]);
        $team = $this->makeTeam(10, 'U17', [], [$this->makeCoachAssignment($coach)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(1, $data[0]['coaches']);
        $this->assertSame(2, $data[0]['coaches'][0]['id']);
        $this->assertSame('44', $data[0]['coaches'][0]['shoe_size']);
    }

    public function testOverviewFutureStartDateExcludesCoach(): void
    {
        $user = $this->makeUser(2);
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Coach', [$rel]);
        $team = $this->makeTeam(10, 'U17', [], [$this->makeCoachAssignment($coach, new DateTime('+1 year'))]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['coaches']);
    }

    public function testOverviewPastEndDateExcludesCoach(): void
    {
        $user = $this->makeUser(2);
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Coach', [$rel]);
        $team = $this->makeTeam(10, 'U17', [], [$this->makeCoachAssignment($coach, null, new DateTime('-1 year'))]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['coaches']);
    }

    public function testOverviewCoachWithNoSelfCoachRelationIsExcluded(): void
    {
        $user = $this->makeUser(2);
        $rel = $this->makeRelation('self_player', $user); // kein self_coach
        $coach = $this->makeCoach('NoCoachRel', [$rel]);
        $team = $this->makeTeam(10, 'U17', [], [$this->makeCoachAssignment($coach)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['coaches']);
    }

    public function testOverviewSupporterViaPlayerRelationIsIncluded(): void
    {
        // Player hat eine UserRelation zu einem Supporter-User
        $supporterUser = $this->makeUser(99, 'Mama Müller', 'S', 'S', 38.0, 'S', 'S', ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('parent', $supporterUser);

        // Selbst-Relation für den Spieler (damit der Player nicht ignoriert wird)
        $playerUser = $this->makeUser(1, 'Kind Müller');
        $selfRel = $this->makeRelation('self_player', $playerUser);

        $player = $this->makePlayer('Kind Müller', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(1, $data[0]['players']);
        $this->assertCount(1, $data[0]['supporters']);
        $this->assertSame(99, $data[0]['supporters'][0]['id']);
        $this->assertSame('Mama Müller', $data[0]['supporters'][0]['name']);
        $this->assertSame('38', $data[0]['supporters'][0]['shoe_size']);
    }

    public function testOverviewSupporterViaCoachRelationIsIncluded(): void
    {
        $supporterUser = $this->makeUser(88, 'Onkel Sport', null, null, null, null, null, ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('sibling', $supporterUser);
        $coachUser = $this->makeUser(2, 'Trainer');
        $selfRel = $this->makeRelation('self_coach', $coachUser);

        $coach = $this->makeCoach('Trainer', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(10, 'U17', [], [$this->makeCoachAssignment($coach)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(1, $data[0]['supporters']);
        $this->assertSame(88, $data[0]['supporters'][0]['id']);
        $this->assertNull($data[0]['supporters'][0]['shoe_size']);
    }

    public function testOverviewSupporterAlreadyInPlayersIsDeduped(): void
    {
        // Gleicher User ist Spieler (self_player) UND Supporter-Relation eines anderen
        $sharedUser = $this->makeUser(5, 'Doppelt', 'M', 'M', 40.0, 'M', 'M', ['ROLE_USER', 'ROLE_SUPPORTER']);
        $selfRel = $this->makeRelation('self_player', $sharedUser);
        $supporterRel = $this->makeRelation('parent', $sharedUser);

        $player = $this->makePlayer('Doppelt', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        // Muss als Spieler auftauchen, NICHT doppelt als Supporter
        $this->assertCount(1, $data[0]['players']);
        $this->assertCount(0, $data[0]['supporters']);
    }

    public function testOverviewNonSupporterRelationUserIsNotInSupporters(): void
    {
        $normalUser = $this->makeUser(7, 'Normalo', null, null, null, null, null, ['ROLE_USER']);
        $normalRel = $this->makeRelation('sibling', $normalUser);
        $playerUser = $this->makeUser(1, 'Spieler');
        $selfRel = $this->makeRelation('self_player', $playerUser);

        $player = $this->makePlayer('Spieler', [$selfRel, $normalRel]);
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['supporters']);
    }

    public function testOverviewSupporterWithInactivePlayerAssignmentIsExcluded(): void
    {
        $supporterUser = $this->makeUser(99, 'Ausgeschieden', 'S', 'S', 38.0, 'S', 'S', ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('parent', $supporterUser);
        $playerUser = $this->makeUser(1, 'Kind');
        $selfRel = $this->makeRelation('self_player', $playerUser);
        $player = $this->makePlayer('Kind', [$selfRel, $supporterRel]);

        // Zuweisung liegt in der Vergangenheit
        $past = new DateTime('-1 year');
        $team = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($player, null, $past)]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(0, $data[0]['supporters']);
    }

    public function testOverviewMultipleTeamsAllReturned(): void
    {
        $user1 = $this->makeUser(1, 'A');
        $user2 = $this->makeUser(2, 'B');

        $team1 = $this->makeTeam(10, 'U17', [$this->makePlayerAssignment($this->makePlayer('A', [$this->makeRelation('self_player', $user1)]))]);
        $team2 = $this->makeTeam(20, 'U19', [$this->makePlayerAssignment($this->makePlayer('B', [$this->makeRelation('self_player', $user2)]))]);

        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team1, $team2]);

        $response = $this->controller->sizeGuideOverview();
        $data = $this->decodeJson($response->getContent());

        $this->assertCount(2, $data);
        $this->assertSame('U17', $data[0]['team_name']);
        $this->assertSame('U19', $data[1]['team_name']);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // sizeGuidePdf
    // ═════════════════════════════════════════════════════════════════════════

    public function testPdfTeamNotFoundReturns404(): void
    {
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class);
        $this->controller->sizeGuidePdf(999);
    }

    public function testPdfTeamAccessDeniedForWrongTeamReturns404(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class);
        $this->controller->sizeGuidePdf(999);
    }

    public function testPdfReturnsResponseWithPdfContentType(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);
        $this->sizeGuidePdfService->method('generatePdf')->willReturn('%PDF-binary-content');

        $response = $this->controller->sizeGuidePdf(1);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
    }

    public function testPdfCallsGeneratePdfWithTeamNameAndPlayers(): void
    {
        $user = $this->makeUser(1, 'Spieler', 'M', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Spieler', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', $this->callback(fn ($players) => 1 === count($players) && '42' === $players[0]['shoe_size']))
            ->willReturn('%PDF');

        $this->controller->sizeGuidePdf(1);
    }

    public function testPdfPostExportsOnlyExplicitlySelectedItems(): void
    {
        $user = $this->makeUser(7, 'Spieler', 'M', 'L', 42.0, 'S', 'XL');
        $player = $this->makePlayer('Spieler', [$this->makeRelation('self_player', $user)]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', $this->callback(static fn (array $members): bool => 1 === count($members)
                && ['shirt_size'] === $members[0]['ordered_items']
                && 'L' === $members[0]['shirt_size']
                && null === $members[0]['shorts_size']
                && null === $members[0]['shoe_size']))
            ->willReturn('%PDF');

        $request = Request::create(
            '/api/teams/1/size-guide-pdf',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['orders' => [['role' => 'player', 'memberId' => 7, 'items' => ['shirt_size']]]], JSON_THROW_ON_ERROR),
        );

        $response = $this->controller->sizeGuidePdf(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testPdfPostRejectsAnEmptyOrder(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);
        $request = Request::create('/api/teams/1/size-guide-pdf', 'POST', [], [], [], [], '{"orders":[]}');

        $response = $this->controller->sizeGuidePdf(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testPdfActivePlayerWithNullShoeSizeIsIncluded(): void
    {
        $user = $this->makeUser(1, 'Anna', 'S', 'S', null, 'S', 'S');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Anna', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', $this->callback(fn ($players) => 1 === count($players) && null === $players[0]['shoe_size']))
            ->willReturn('%PDF');

        $this->controller->sizeGuidePdf(1);
    }

    public function testPdfFutureStartDateExcludesPlayer(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Zukunft', [$rel]);
        $future = new DateTime('+1 year');
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player, $future)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', [])
            ->willReturn('%PDF');

        $this->controller->sizeGuidePdf(1);
    }

    public function testPdfPastEndDateExcludesPlayer(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Abgelaufen', [$rel]);
        $past = new DateTime('-1 year');
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player, null, $past)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', [])
            ->willReturn('%PDF');

        $this->controller->sizeGuidePdf(1);
    }

    public function testPdfPlayerWithNoSelfPlayerRelationIsExcluded(): void
    {
        $user = $this->makeUser(1);
        $rel = $this->makeRelation('parent', $user); // not self_player
        $player = $this->makePlayer('Kein Self', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);

        $this->sizeGuidePdfService
            ->expects($this->once())
            ->method('generatePdf')
            ->with('U17', [])
            ->willReturn('%PDF');

        $this->controller->sizeGuidePdf(1);
    }

    public function testPdfContentDispositionContainsTeamName(): void
    {
        $team = $this->makeTeam(1, 'U17 Junioren');
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);
        $this->sizeGuidePdfService->method('generatePdf')->willReturn('%PDF');

        $response = $this->controller->sizeGuidePdf(1);

        $this->assertStringContainsString('U17_Junioren', $response->headers->get('Content-Disposition') ?? '');
    }

    public function testPdfResponseBodyMatchesPdfContent(): void
    {
        $pdfContent = '%PDF-fake-content';
        $team = $this->makeTeam(1, 'Team');
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);
        $this->sizeGuidePdfService->method('generatePdf')->willReturn($pdfContent);

        $response = $this->controller->sizeGuidePdf(1);

        $this->assertSame($pdfContent, $response->getContent());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // sizeGuideRemind
    // ═════════════════════════════════════════════════════════════════════════

    private function remindRequest(mixed $body): Request
    {
        return $this->jsonRequest($body);
    }

    private function setupSingleTeam(int $teamId, Team $team): void
    {
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([$team]);
    }

    public function testRemindTeamNotFoundReturns404(): void
    {
        $this->coachTeamPlayerService->method('collectCoachTeams')->willReturn([]);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class);

        $this->controller->sizeGuideRemind(999, $this->remindRequest([]));
    }

    public function testRemindCreateTaskWithoutDueDateReturns400(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $this->setupSingleTeam(1, $team);

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest(['createTask' => true]));

        $this->assertSame(400, $response->getStatusCode());
        $data = $this->decodeJson($response->getContent());
        $this->assertArrayHasKey('error', $data);
    }

    public function testRemindCreateTaskWithInvalidDateReturns400(): void
    {
        $team = $this->makeTeam(1, 'U17');
        $this->setupSingleTeam(1, $team);

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([
            'createTask' => true,
            'taskDueDate' => 'kein-datum',
        ]));

        $this->assertSame(400, $response->getStatusCode());
        $data = $this->decodeJson($response->getContent());
        $this->assertArrayHasKey('error', $data);
    }

    public function testRemindPlayerWithMissingFieldsIsNotified(): void
    {
        $user = $this->makeUser(1, 'Leer', null, null, null, null, null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Leer', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService
            ->expects($this->once())
            ->method('sendNotification')
            ->with($user, 'Ausrüstungsdaten unvollständig', $this->stringContains('Noch fehlend'), '/');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
        $this->assertSame(0, $data['skipped']);
    }

    public function testRemindPlayerWithAllSizesIsSkipped(): void
    {
        $user = $this->makeUser(1, 'Komplett', 'M', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Komplett', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
        $this->assertSame(1, $data['skipped']);
    }

    public function testRemindPlayerInExcludeIdsIsSkipped(): void
    {
        $user = $this->makeUser(1, 'Ausgeschlossen', null, null, null, null, null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Ausgeschlossen', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest(['exclude' => [1]]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
        $this->assertSame(1, $data['skipped']);
    }

    public function testRemindInactivePlayerAssignmentIsIgnored(): void
    {
        $user = $this->makeUser(1, 'Inaktiv', null, null, null, null, null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Inaktiv', [$rel]);
        $past = new DateTime('-1 year');
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player, null, $past)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
        $this->assertSame(0, $data['skipped']);
    }

    public function testRemindCoachWithMissingFieldsIsNotified(): void
    {
        $user = $this->makeUser(2, 'Trainer Leer', null, null, null, null, null);
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Trainer Leer', [$rel]);
        $team = $this->makeTeam(1, 'U17', [], [$this->makeCoachAssignment($coach)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService
            ->expects($this->once())
            ->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
    }

    public function testRemindCoachWithAllSizesIsSkipped(): void
    {
        $user = $this->makeUser(2, 'Trainer Komplett', 'M', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Trainer Komplett', [$rel]);
        $team = $this->makeTeam(1, 'U17', [], [$this->makeCoachAssignment($coach)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
        $this->assertSame(1, $data['skipped']);
    }

    public function testRemindCoachInExcludeIdsIsSkipped(): void
    {
        $user = $this->makeUser(2, 'Trainer', null, null, null, null, null);
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Trainer', [$rel]);
        $team = $this->makeTeam(1, 'U17', [], [$this->makeCoachAssignment($coach)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest(['exclude' => [2]]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
        $this->assertSame(1, $data['skipped']);
    }

    public function testRemindInactiveCoachAssignmentIsIgnored(): void
    {
        $user = $this->makeUser(2, 'Trainer Alt', null, null, null, null, null);
        $rel = $this->makeRelation('self_coach', $user);
        $coach = $this->makeCoach('Trainer Alt', [$rel]);
        $team = $this->makeTeam(1, 'U17', [], [$this->makeCoachAssignment($coach, null, new DateTime('-1 year'))]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->never())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(0, $data['notified']);
    }

    public function testRemindSupporterViaPlayerRelationWithMissingFieldsIsNotified(): void
    {
        $supporterUser = $this->makeUser(99, 'Supporter', null, null, null, null, null, ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('parent', $supporterUser);

        $playerUser = $this->makeUser(1, 'Spieler', 'M', 'L', 42.0, 'M', 'L');
        $selfRel = $this->makeRelation('self_player', $playerUser);

        $player = $this->makePlayer('Spieler', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService
            ->expects($this->once())
            ->method('sendNotification')
            ->with($supporterUser, $this->anything(), $this->anything(), $this->anything());

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']); // Spieler komplett → übersprungen, Supporter fehlt → 1
    }

    public function testRemindSupporterViaCoachRelationWithMissingFieldsIsNotified(): void
    {
        $supporterUser = $this->makeUser(88, 'CoachSupporter', null, null, null, null, null, ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('sibling', $supporterUser);

        $coachUser = $this->makeUser(2, 'Trainer', 'M', 'L', 42.0, 'M', 'L');
        $selfRel = $this->makeRelation('self_coach', $coachUser);

        $coach = $this->makeCoach('Trainer', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(1, 'U17', [], [$this->makeCoachAssignment($coach)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService
            ->expects($this->once())
            ->method('sendNotification')
            ->with($supporterUser, $this->anything(), $this->anything(), $this->anything());

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
    }

    public function testRemindSupporterInExcludeIdsIsSkipped(): void
    {
        $supporterUser = $this->makeUser(99, 'Supporter', null, null, null, null, null, ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('parent', $supporterUser);
        // Player is incomplete so it gets notified; only the excluded supporter is skipped
        $playerUser = $this->makeUser(1, 'Spieler', null, null, null, null, null);
        $selfRel = $this->makeRelation('self_player', $playerUser);
        $player = $this->makePlayer('Spieler', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification'); // player notified

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest(['exclude' => [99]]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
        $this->assertSame(1, $data['skipped']); // 1 Supporter excluded
    }

    public function testRemindSupporterAlreadyInProcessedIdsIsDeduped(): void
    {
        // Gleicher User ist Spieler (processedUserIds) UND Supporter-Relation desselben Spielers
        $sharedUser = $this->makeUser(5, 'Doppelt', null, null, null, null, null, ['ROLE_USER', 'ROLE_SUPPORTER']);
        $selfRel = $this->makeRelation('self_player', $sharedUser);
        $supporterRel = $this->makeRelation('parent', $sharedUser);

        $player = $this->makePlayer('Doppelt', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        // Nur einmal benachrichtigt (als Spieler), nicht doppelt als Supporter
        $this->pushNotificationService
            ->expects($this->once())
            ->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
    }

    public function testRemindSupporterWithCompleteDataIsSkipped(): void
    {
        $supporterUser = $this->makeUser(99, 'SupKomplett', 'S', 'S', 38.0, 'S', 'S', ['ROLE_USER', 'ROLE_SUPPORTER']);
        $supporterRel = $this->makeRelation('parent', $supporterUser);
        // Player is incomplete so it gets notified; only the complete supporter is skipped
        $playerUser = $this->makeUser(1, 'Spieler', null, null, null, null, null);
        $selfRel = $this->makeRelation('self_player', $playerUser);
        $player = $this->makePlayer('Spieler', [$selfRel, $supporterRel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification'); // player notified

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
        $this->assertSame(1, $data['skipped']); // supporter with complete data skipped
    }

    public function testRemindWithCreateTaskCallsFlushWhenNotified(): void
    {
        $user = $this->makeUser(1, 'Leer', null, null, null, null, null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Leer', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->loggedInUser->method('getFullName')->willReturn('Coach');
        $this->calendarEventTypeRepository->method('findOneBy')->willReturn(null);

        $this->em->expects($this->atLeastOnce())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([
            'createTask' => true,
            'taskDueDate' => '2026-12-31',
        ]));

        $data = $this->decodeJson($response->getContent());
        $this->assertSame(1, $data['notified']);
    }

    public function testRemindWithCreateTaskAndCalendarEventTypeCreatesCalendarEvent(): void
    {
        $user = $this->makeUser(1, 'Leer', null, null, null, null, null);
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Leer', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->loggedInUser->method('getFullName')->willReturn('Coach');
        $aufgabeType = $this->createMock(CalendarEventType::class);
        $this->calendarEventTypeRepository->method('findOneBy')->willReturn($aufgabeType);

        // persist wird für Task + CalendarEvent + TaskAssignment = 3× aufgerufen
        $this->em->expects($this->exactly(3))->method('persist');
        $this->em->expects($this->once())->method('flush');

        $this->controller->sizeGuideRemind(1, $this->remindRequest([
            'createTask' => true,
            'taskDueDate' => '2026-12-31',
        ]));
    }

    public function testRemindWithCreateTaskNoNotificationsDoesNotFlush(): void
    {
        $user = $this->makeUser(1, 'Komplett', 'M', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Komplett', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->em->expects($this->never())->method('flush');

        $this->controller->sizeGuideRemind(1, $this->remindRequest([
            'createTask' => true,
            'taskDueDate' => '2026-12-31',
        ]));
    }

    public function testRemindShoeSize0IsConsideredMissing(): void
    {
        // shoeSize = 0.0 → gilt als fehlend
        $user = $this->makeUser(1, 'Schuh0', 'M', 'L', 0.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Schuh0', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
    }

    public function testRemindPantsSize0IsConsideredMissing(): void
    {
        $user = $this->makeUser(1, 'Hose0', '0', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('Hose0', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $this->assertSame(1, $this->decodeJson($response->getContent())['notified']);
    }

    public function testRemindEmptyStringPantsIsConsideredMissing(): void
    {
        $user = $this->makeUser(1, 'LeerStr', '', 'L', 42.0, 'M', 'L');
        $rel = $this->makeRelation('self_player', $user);
        $player = $this->makePlayer('LeerStr', [$rel]);
        $team = $this->makeTeam(1, 'U17', [$this->makePlayerAssignment($player)]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification');

        $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
    }

    public function testRemindReturnsNotifiedAndSkippedCounts(): void
    {
        // 2 Spieler: einer vollständig, einer unvollständig
        $user1 = $this->makeUser(1, 'Komplett', 'M', 'L', 42.0, 'M', 'L');
        $rel1 = $this->makeRelation('self_player', $user1);
        $player1 = $this->makePlayer('Komplett', [$rel1]);

        $user2 = $this->makeUser(2, 'Leer', null, null, null, null, null);
        $rel2 = $this->makeRelation('self_player', $user2);
        $player2 = $this->makePlayer('Leer', [$rel2]);

        $team = $this->makeTeam(1, 'U17', [
            $this->makePlayerAssignment($player1),
            $this->makePlayerAssignment($player2),
        ]);
        $this->setupSingleTeam(1, $team);

        $this->pushNotificationService->expects($this->once())->method('sendNotification');

        $response = $this->controller->sizeGuideRemind(1, $this->remindRequest([]));
        $data = $this->decodeJson($response->getContent());

        $this->assertSame(1, $data['notified']);
        $this->assertSame(1, $data['skipped']);
    }
}
