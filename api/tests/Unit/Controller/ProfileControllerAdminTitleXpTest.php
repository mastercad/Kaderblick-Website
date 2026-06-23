<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\ProfileController;
use App\Entity\Cup;
use App\Entity\Player;
use App\Entity\PlayerTitle;
use App\Service\CoachTeamPlayerService;
use App\Service\EmailVerificationService;
use App\Service\SystemSettingService;
use App\Service\UserTitleService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Tests for ProfileController::adminTitleXpOverview() focusing on the cup grouping logic.
 *
 * Covers:
 *  - Players belonging to different cups are NOT merged into the same title group
 *  - Each cup entry in the response has the correct cupName and cupId
 *  - Cup player lists are assigned to the right title group via the cupId-inclusive key
 */
#[AllowMockObjectsWithoutExpectations]
class ProfileControllerAdminTitleXpTest extends TestCase
{
    private ProfileController $controller;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $passwordHasher = $this->createMock(UserPasswordHasherInterface::class);
        $validator = $this->createMock(ValidatorInterface::class);
        $emailSvc = $this->createMock(EmailVerificationService::class);
        $coachTeamSvc = $this->createMock(CoachTeamPlayerService::class);
        $systemSettingSvc = $this->createMock(SystemSettingService::class);
        $dispatcher = $this->createMock(EventDispatcherInterface::class);

        $this->controller = new ProfileController(
            $em,
            $passwordHasher,
            $validator,
            $emailSvc,
            $coachTeamSvc,
            $systemSettingSvc,
            $dispatcher,
        );

        // Minimal container so that AbstractController::json() falls back to new JsonResponse()
        $this->controller->setContainer(new ContainerBuilder());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function makeCupMock(int $id): Cup & MockObject
    {
        $cup = $this->getMockBuilder(Cup::class)
            ->onlyMethods(['getId'])
            ->getMock();
        $cup->method('getId')->willReturn($id);

        return $cup;
    }

    private function makePlayerMock(int $id, string $firstName, string $lastName, string $email): Player & MockObject
    {
        $player = $this->getMockBuilder(Player::class)
            ->onlyMethods(['getId', 'getFirstName', 'getLastName', 'getEmail'])
            ->getMock();
        $player->method('getId')->willReturn($id);
        $player->method('getFirstName')->willReturn($firstName);
        $player->method('getLastName')->willReturn($lastName);
        $player->method('getEmail')->willReturn($email);

        return $player;
    }

    private function makeCupPlayerTitle(string $cat, string $rank, Cup $cup, Player $player): PlayerTitle & MockObject
    {
        $pt = $this->getMockBuilder(PlayerTitle::class)
            ->onlyMethods(['getTitleCategory', 'getTitleScope', 'getTitleRank', 'getTeam', 'getLeague', 'getCup', 'getPlayer'])
            ->getMock();
        $pt->method('getTitleCategory')->willReturn($cat);
        $pt->method('getTitleScope')->willReturn('cup');
        $pt->method('getTitleRank')->willReturn($rank);
        $pt->method('getTeam')->willReturn(null);
        $pt->method('getLeague')->willReturn(null);
        $pt->method('getCup')->willReturn($cup);
        $pt->method('getPlayer')->willReturn($player);

        return $pt;
    }

    /**
     * Wires the passed EntityManagerInterface mock so that:
     *  - getRepository(PlayerTitle::class) → repo whose createQueryBuilder()->…->getResult() returns $activeTitles
     *  - createQueryBuilder() (users query) → returns empty array from getArrayResult()
     */
    /** @param array<int, PlayerTitle> $activeTitles */
    private function wireEntityManager(EntityManagerInterface & MockObject $em, array $activeTitles): void
    {
        // Query mock for the activeTitles QB (->getQuery()->getResult())
        $ptQueryMock = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getResult'])
            ->getMock();
        $ptQueryMock->method('getResult')->willReturn($activeTitles);

        $ptQbMock = $this->createMock(QueryBuilder::class);
        $ptQbMock->method('leftJoin')->willReturnSelf();
        $ptQbMock->method('where')->willReturnSelf();
        $ptQbMock->method('getQuery')->willReturn($ptQueryMock);

        $ptRepoMock = $this->getMockBuilder(\Doctrine\ORM\EntityRepository::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['createQueryBuilder'])
            ->getMock();
        $ptRepoMock->method('createQueryBuilder')->willReturn($ptQbMock);

        // Query mock for the users QB (->getQuery()->getArrayResult())
        $userQueryMock = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getArrayResult'])
            ->getMock();
        $userQueryMock->method('getArrayResult')->willReturn([]);

        $userQbMock = $this->createMock(QueryBuilder::class);
        $userQbMock->method('select')->willReturnSelf();
        $userQbMock->method('from')->willReturnSelf();
        $userQbMock->method('leftJoin')->willReturnSelf();
        $userQbMock->method('orderBy')->willReturnSelf();
        $userQbMock->method('getQuery')->willReturn($userQueryMock);

        $em->method('getRepository')->willReturn($ptRepoMock);
        $em->method('createQueryBuilder')->willReturn($userQbMock);
    }

    // ─── Tests ───────────────────────────────────────────────────────────────

    /**
     * Two PlayerTitle objects with the same category/scope/rank but different cups
     * must end up in separate title groups, each with their own player list.
     */
    public function testPlayersFromDifferentCupsAreNotMerged(): void
    {
        $cup1 = $this->makeCupMock(1);
        $cup2 = $this->makeCupMock(2);
        $player1 = $this->makePlayerMock(101, 'Max', 'Müller', 'max@example.com');
        $player2 = $this->makePlayerMock(102, 'Anna', 'Schmidt', 'anna@example.com');

        $pt1 = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup1, $player1);
        $pt2 = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup2, $player2);

        $em = $this->createMock(EntityManagerInterface::class);
        $this->wireEntityManager($em, [$pt1, $pt2]);

        $userTitleService = $this->createMock(UserTitleService::class);
        $userTitleService->method('retrieveTitleStats')->willReturn([
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 1, 'cupName' => 'Kreispokal'],
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 2, 'cupName' => 'Bezirkspokal'],
        ]);

        $response = $this->controller->adminTitleXpOverview($em, $userTitleService);
        $data = json_decode((string) $response->getContent(), true);

        $titles = $data['titles'];
        $this->assertCount(2, $titles);

        $cup1Entry = array_values(array_filter($titles, fn ($t) => 1 === $t['cupId']))[0];
        $cup2Entry = array_values(array_filter($titles, fn ($t) => 2 === $t['cupId']))[0];

        // Each cup group must contain exactly one player – the correct one
        $this->assertCount(1, $cup1Entry['players']);
        $this->assertSame(101, $cup1Entry['players'][0]['id'], 'cup1 player should be Max Müller');

        $this->assertCount(1, $cup2Entry['players']);
        $this->assertSame(102, $cup2Entry['players'][0]['id'], 'cup2 player should be Anna Schmidt');
    }

    /**
     * The response for a cup title must include cupName and cupId from the service stats,
     * and the matching player must be listed.
     */
    public function testCupTitleResponseIncludesCupNameAndPlayer(): void
    {
        $cup = $this->makeCupMock(5);
        $player = $this->makePlayerMock(201, 'Test', 'Tester', 'test@example.com');
        $pt = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup, $player);

        $em = $this->createMock(EntityManagerInterface::class);
        $this->wireEntityManager($em, [$pt]);

        $userTitleService = $this->createMock(UserTitleService::class);
        $userTitleService->method('retrieveTitleStats')->willReturn([
            [
                'titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold',
                'teamId' => null, 'leagueId' => null, 'cupId' => 5, 'cupName' => 'Sparkassenkreispokal',
            ],
        ]);

        $response = $this->controller->adminTitleXpOverview($em, $userTitleService);
        $data = json_decode((string) $response->getContent(), true);

        $title = $data['titles'][0];
        $this->assertSame('Sparkassenkreispokal', $title['cupName']);
        $this->assertSame(5, $title['cupId']);
        $this->assertCount(1, $title['players']);
        $this->assertSame(201, $title['players'][0]['id']);
        $this->assertSame('Test', $title['players'][0]['firstName']);
    }

    /**
     * When two PlayerTitle entries share the same cup, the same player is deduplicated
     * (the controller uses player ID as the array key to avoid duplicates).
     */
    public function testDuplicatePlayerInSameCupGroupIsDeduped(): void
    {
        $cup = $this->makeCupMock(3);
        $player = $this->makePlayerMock(301, 'Dupe', 'Player', 'dupe@example.com');

        // Same player appears twice in the same cup group (e.g. two active titles for the same slot)
        $pt1 = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup, $player);
        $pt2 = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup, $player);

        $em = $this->createMock(EntityManagerInterface::class);
        $this->wireEntityManager($em, [$pt1, $pt2]);

        $userTitleService = $this->createMock(UserTitleService::class);
        $userTitleService->method('retrieveTitleStats')->willReturn([
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 3, 'cupName' => 'Stadtpokal'],
        ]);

        $response = $this->controller->adminTitleXpOverview($em, $userTitleService);
        $data = json_decode((string) $response->getContent(), true);

        $this->assertCount(1, $data['titles'][0]['players'], 'Duplicate player must be deduplicated within the same cup group');
    }

    /**
     * When a cup title PlayerTitle has no associated cup (getCup() returns null),
     * it must NOT be matched into the cup title group with a real cupId.
     * The group with cupId=5 receives only players with that cup, not orphaned ones.
     */
    public function testPlayerTitleWithoutCupDoesNotPolluteCupGroup(): void
    {
        $cup = $this->makeCupMock(5);
        $player1 = $this->makePlayerMock(401, 'With', 'Cup', 'with@example.com');
        $player2 = $this->makePlayerMock(402, 'Without', 'Cup', 'without@example.com');

        // pt1 has the correct cup; pt2 has no cup (getCup() → null)
        $pt1 = $this->makeCupPlayerTitle('top_scorer', 'gold', $cup, $player1);

        $pt2Orphan = $this->getMockBuilder(PlayerTitle::class)
            ->onlyMethods(['getTitleCategory', 'getTitleScope', 'getTitleRank', 'getTeam', 'getLeague', 'getCup', 'getPlayer'])
            ->getMock();
        $pt2Orphan->method('getTitleCategory')->willReturn('top_scorer');
        $pt2Orphan->method('getTitleScope')->willReturn('cup');
        $pt2Orphan->method('getTitleRank')->willReturn('gold');
        $pt2Orphan->method('getTeam')->willReturn(null);
        $pt2Orphan->method('getLeague')->willReturn(null);
        $pt2Orphan->method('getCup')->willReturn(null);  // ← no cup
        $pt2Orphan->method('getPlayer')->willReturn($player2);

        $em = $this->createMock(EntityManagerInterface::class);
        $this->wireEntityManager($em, [$pt1, $pt2Orphan]);

        $userTitleService = $this->createMock(UserTitleService::class);
        $userTitleService->method('retrieveTitleStats')->willReturn([
            ['titleCategory' => 'top_scorer', 'titleScope' => 'cup', 'titleRank' => 'gold', 'teamId' => null, 'leagueId' => null, 'cupId' => 5, 'cupName' => 'Kreispokal'],
        ]);

        $response = $this->controller->adminTitleXpOverview($em, $userTitleService);
        $data = json_decode((string) $response->getContent(), true);

        $title = $data['titles'][0];

        // Only player1 (the one with cup=5) must be in the group
        $this->assertCount(1, $title['players']);
        $this->assertSame(401, $title['players'][0]['id']);
    }
}
