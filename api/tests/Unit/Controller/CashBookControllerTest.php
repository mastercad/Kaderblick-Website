<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\Api\CashBookController;
use App\Entity\CashBook;
use App\Entity\CashBookEntry;
use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryClubAssignmentType;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\CashBookEntryRepository;
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
class CashBookControllerTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private AuthorizationCheckerInterface&MockObject $authChecker;
    private TokenStorageInterface&MockObject $tokenStorage;
    private CashBookController $controller;

    /** @var EntityRepository<CashBook>&MockObject */
    private EntityRepository&MockObject $cashBookRepo;

    /** @var EntityRepository<CashBookEntry>&MockObject */
    private EntityRepository&MockObject $cashBookEntryRepo;

    /** @var EntityRepository<FunctionaryTeamAssignment>&MockObject */
    private EntityRepository&MockObject $teamAssignmentRepo;

    /** @var EntityRepository<FunctionaryClubAssignment>&MockObject */
    private EntityRepository&MockObject $clubAssignmentRepo;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $this->tokenStorage = $this->createMock(TokenStorageInterface::class);

        $this->cashBookRepo = $this->createMock(EntityRepository::class);
        $this->cashBookEntryRepo = $this->createMock(EntityRepository::class);
        $this->teamAssignmentRepo = $this->createMock(EntityRepository::class);
        $this->clubAssignmentRepo = $this->createMock(EntityRepository::class);

        $this->em->method('getRepository')->willReturnCallback(
            fn (string $class) => match ($class) {
                CashBook::class => $this->cashBookRepo,
                CashBookEntry::class => $this->cashBookEntryRepo,
                FunctionaryTeamAssignment::class => $this->teamAssignmentRepo,
                FunctionaryClubAssignment::class => $this->clubAssignmentRepo,
                default => $this->createMock(EntityRepository::class),
            }
        );

        $this->controller = new CashBookController($this->em);

        $container = new ContainerBuilder();
        $container->set('security.authorization_checker', $this->authChecker);
        $container->set('security.token_storage', $this->tokenStorage);
        $this->controller->setContainer($container);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function loginAs(int $id = 1): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getFullName')->willReturn('Max Mustermann');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);
        $this->tokenStorage->method('getToken')->willReturn($token);

        return $user;
    }

    private function makeCashBook(int $id = 1, bool $hasTeam = true): CashBook&MockObject
    {
        $cashBook = $this->createMock(CashBook::class);
        $cashBook->method('getId')->willReturn($id);
        $cashBook->method('getName')->willReturn('Test Kassenbuch');
        $cashBook->method('getCreatedAt')->willReturn(new DateTimeImmutable('2026-01-01 00:00:00'));

        if ($hasTeam) {
            $team = $this->createMock(Team::class);
            $team->method('getId')->willReturn(10);
            $team->method('getName')->willReturn('Test Team');
            $cashBook->method('getTeam')->willReturn($team);
            $cashBook->method('getClub')->willReturn(null);
        } else {
            $cashBook->method('getTeam')->willReturn(null);
            $club = $this->createMock(Club::class);
            $club->method('getId')->willReturn(20);
            $club->method('getName')->willReturn('Test Club');
            $cashBook->method('getClub')->willReturn($club);
        }

        return $cashBook;
    }

    private function makeEntry(
        int $id,
        CashBook $cashBook,
        string $type = 'income',
        float $amount = 100.0,
    ): CashBookEntry&MockObject {
        $entry = $this->createMock(CashBookEntry::class);
        $entry->method('getId')->willReturn($id);
        $entry->method('getCashBook')->willReturn($cashBook);
        $entry->method('getType')->willReturn($type);
        $entry->method('getAmount')->willReturn($amount);
        $entry->method('getCategory')->willReturn(null);
        $entry->method('getDescription')->willReturn('Test Buchung');
        $entry->method('getEntryDate')->willReturn(new DateTimeImmutable('2026-01-15'));
        $entry->method('getCreatedByUser')->willReturn(null);

        return $entry;
    }

    private function grantAdminAccess(): void
    {
        $this->authChecker->method('isGranted')->willReturn(true);
    }

    private function grantTeamKassenwartAccess(): void
    {
        $type = $this->createMock(FunctionaryTeamAssignmentType::class);
        $type->method('getName')->willReturn('Kassenwart');

        $assignment = $this->createMock(FunctionaryTeamAssignment::class);
        $assignment->method('getFunctionaryTeamAssignmentType')->willReturn($type);

        $this->teamAssignmentRepo->method('findBy')->willReturn([$assignment]);
        $this->clubAssignmentRepo->method('findBy')->willReturn([]);
    }

    private function grantClubKassenwartAccess(): void
    {
        $type = $this->createMock(FunctionaryClubAssignmentType::class);
        $type->method('getName')->willReturn('Kassenwart');

        $assignment = $this->createMock(FunctionaryClubAssignment::class);
        $assignment->method('getFunctionaryClubAssignmentType')->willReturn($type);

        $this->clubAssignmentRepo->method('findBy')->willReturn([$assignment]);
        $this->teamAssignmentRepo->method('findBy')->willReturn([]);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function makeQueryBuilderMock(array $rows): QueryBuilder&MockObject
    {
        $query = $this->getMockBuilder(Query::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getArrayResult'])
            ->getMock();
        $query->method('getArrayResult')->willReturn($rows);

        $qb = $this->getMockBuilder(QueryBuilder::class)
            ->disableOriginalConstructor()
            ->getMock();

        foreach (['select', 'from', 'where', 'setParameter', 'groupBy'] as $method) {
            $qb->method($method)->willReturnSelf();
        }
        $qb->method('getQuery')->willReturn($query);

        return $qb;
    }

    private function emptyEntryRepository(): CashBookEntryRepository&MockObject
    {
        $repo = $this->createMock(CashBookEntryRepository::class);
        $repo->method('findByCashBookOrdered')->willReturn([]);

        return $repo;
    }

    // ─── index() ──────────────────────────────────────────────────────────────

    public function testIndexReturnsEmptyArrayWhenNoBooksAccessible(): void
    {
        $this->loginAs();

        $response = $this->controller->index($this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertSame([], $data);
    }

    public function testIndexAdminSeesAllBooksViaFindAll(): void
    {
        $this->loginAs();
        $this->grantAdminAccess();

        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('findAll')->willReturn([$cashBook]);
        $this->em->method('createQueryBuilder')->willReturn($this->makeQueryBuilderMock([]));

        $response = $this->controller->index($this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertCount(1, $data);
        $this->assertSame(1, $data[0]['id']);
        $this->assertSame('Test Kassenbuch', $data[0]['name']);
        $this->assertSame('team', $data[0]['type']);
    }

    public function testIndexComputesTotalsFromQueryBuilderResult(): void
    {
        $this->loginAs();
        $this->grantAdminAccess();

        $cashBook = $this->makeCashBook(1, true);
        $this->cashBookRepo->method('findAll')->willReturn([$cashBook]);

        $totalsRows = [
            ['bookId' => 1, 'type' => 'income', 'total' => '150.00'],
            ['bookId' => 1, 'type' => 'expense', 'total' => '50.00'],
        ];
        $this->em->method('createQueryBuilder')->willReturn($this->makeQueryBuilderMock($totalsRows));

        $response = $this->controller->index($this->emptyEntryRepository());
        $data = json_decode($response->getContent(), true);

        $this->assertEquals(100.0, $data[0]['balance']);
        $this->assertEquals(150.0, $data[0]['incomeTotal']);
        $this->assertEquals(50.0, $data[0]['expenseTotal']);
    }

    public function testIndexReturnsClubTypeForClubBasedBook(): void
    {
        $this->loginAs();
        $this->grantAdminAccess();

        $cashBook = $this->makeCashBook(1, false);
        $this->cashBookRepo->method('findAll')->willReturn([$cashBook]);
        $this->em->method('createQueryBuilder')->willReturn($this->makeQueryBuilderMock([]));

        $response = $this->controller->index($this->emptyEntryRepository());
        $data = json_decode($response->getContent(), true);

        $this->assertSame('club', $data[0]['type']);
        $this->assertSame(20, $data[0]['clubId']);
        $this->assertNull($data[0]['teamId']);
    }

    public function testIndexResultContainsExpectedFields(): void
    {
        $this->loginAs();
        $this->grantAdminAccess();

        $cashBook = $this->makeCashBook(1, true);
        $this->cashBookRepo->method('findAll')->willReturn([$cashBook]);
        $this->em->method('createQueryBuilder')->willReturn($this->makeQueryBuilderMock([]));

        $response = $this->controller->index($this->emptyEntryRepository());
        $data = json_decode($response->getContent(), true);

        $this->assertArrayHasKey('id', $data[0]);
        $this->assertArrayHasKey('name', $data[0]);
        $this->assertArrayHasKey('type', $data[0]);
        $this->assertArrayHasKey('entityName', $data[0]);
        $this->assertArrayHasKey('openingBalance', $data[0]);
        $this->assertArrayHasKey('balance', $data[0]);
        $this->assertArrayHasKey('incomeTotal', $data[0]);
        $this->assertArrayHasKey('expenseTotal', $data[0]);
    }

    // ─── entries() ────────────────────────────────────────────────────────────

    public function testEntriesReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $response = $this->controller->entries(999, $this->emptyEntryRepository());

        $this->assertSame(404, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testEntriesReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $response = $this->controller->entries(1, $this->emptyEntryRepository());

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testEntriesReturns200WithEmptyEntries(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->entries(1, $this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('cashBook', $data);
        $this->assertArrayHasKey('entries', $data);
        $this->assertSame([], $data['entries']);
        $this->assertEquals(0.0, $data['balance']);
        $this->assertEquals(0.0, $data['incomeTotal']);
        $this->assertEquals(0.0, $data['expenseTotal']);
    }

    public function testEntriesResponseContainsExpectedCashBookFields(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->entries(1, $this->emptyEntryRepository());
        $data = json_decode($response->getContent(), true);

        $this->assertSame(1, $data['cashBook']['id']);
        $this->assertSame('Test Kassenbuch', $data['cashBook']['name']);
        $this->assertSame('team', $data['cashBook']['type']);
        $this->assertEquals(0.0, $data['cashBook']['openingBalance']);
        $this->assertArrayHasKey('createdAt', $data['cashBook']);
    }

    public function testEntriesComputesCorrectRunningBalance(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $cashBook->method('getOpeningBalance')->willReturn(100.0);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry1 = $this->makeEntry(1, $cashBook, 'income', 200.0);
        $entry2 = $this->makeEntry(2, $cashBook, 'expense', 50.0);

        $entryRepo = $this->createMock(CashBookEntryRepository::class);
        $entryRepo->method('findByCashBookOrdered')->willReturn([$entry2, $entry1]);

        $response = $this->controller->entries(1, $entryRepo);
        $data = json_decode($response->getContent(), true);

        $this->assertEquals(250.0, $data['balance']);
        $this->assertEquals(200.0, $data['incomeTotal']);
        $this->assertEquals(50.0, $data['expenseTotal']);
    }

    public function testEntriesRunningBalancePerEntryIsCorrect(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $cashBook->method('getOpeningBalance')->willReturn(0.0);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry1 = $this->makeEntry(1, $cashBook, 'income', 100.0);
        $entry2 = $this->makeEntry(2, $cashBook, 'income', 50.0);

        $entryRepo = $this->createMock(CashBookEntryRepository::class);
        $entryRepo->method('findByCashBookOrdered')->willReturn([$entry2, $entry1]);

        $response = $this->controller->entries(1, $entryRepo);
        $data = json_decode($response->getContent(), true);

        $this->assertEquals(150.0, $data['entries'][0]['balance']);
        $this->assertEquals(100.0, $data['entries'][1]['balance']);
    }

    public function testEntriesAccessGrantedViaTeamKassenwart(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1, true);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantTeamKassenwartAccess();

        $response = $this->controller->entries(1, $this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testEntriesAccessGrantedViaClubKassenwart(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1, false);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantClubKassenwartAccess();

        $response = $this->controller->entries(1, $this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── createEntry() ────────────────────────────────────────────────────────

    public function testCreateEntryReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 100, 'type' => 'income', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(999, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testCreateEntryReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 100, 'type' => 'income', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenBodyIsInvalidJson(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], 'not-json');
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testCreateEntryReturns400WhenAmountIsMissing(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'type' => 'income', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenAmountIsZero(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 0, 'type' => 'income', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenAmountIsNegative(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => -10, 'type' => 'income', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenTypeIsInvalid(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 100, 'type' => 'invalid', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenDescriptionIsEmpty(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 100, 'type' => 'income', 'description' => '   ', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns400WhenEntryDateIsMissing(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 100, 'type' => 'income', 'description' => 'Test', 'entryDate' => '',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreateEntryReturns201OnSuccess(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 99.99,
            'type' => 'expense',
            'category' => 'Miete',
            'description' => 'Hallenmietung',
            'entryDate' => '2026-06-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(201, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('entry', $data);
        $this->assertSame(99.99, $data['entry']['amount']);
        $this->assertSame('expense', $data['entry']['type']);
        $this->assertSame('Hallenmietung', $data['entry']['description']);
        $this->assertSame('Miete', $data['entry']['category']);
    }

    public function testCreateEntryNullCategoryWhenBlank(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'POST', [], [], [], [], json_encode([
            'amount' => 50.0, 'type' => 'income', 'category' => '  ', 'description' => 'Test', 'entryDate' => '2026-01-01',
        ]));
        $response = $this->controller->createEntry(1, $request);

        $this->assertSame(201, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertNull($data['entry']['category']);
    }

    // ─── updateEntry() ────────────────────────────────────────────────────────

    public function testUpdateEntryReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 50]));
        $response = $this->controller->updateEntry(999, 1, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdateEntryReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 50]));
        $response = $this->controller->updateEntry(1, 1, $request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testUpdateEntryReturns404WhenEntryNotFound(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();
        $this->cashBookEntryRepo->method('find')->willReturn(null);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 50]));
        $response = $this->controller->updateEntry(1, 999, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdateEntryReturns404WhenEntryBelongsToDifferentBook(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $otherBook = $this->makeCashBook(2);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(5, $otherBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 50]));
        $response = $this->controller->updateEntry(1, 5, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdateEntryReturns400WhenBodyIsInvalidJson(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(1, $cashBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $request = Request::create('/', 'PUT', [], [], [], [], 'not-json');
        $response = $this->controller->updateEntry(1, 1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testUpdateEntryReturns400WhenAmountBecomesZero(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(1, $cashBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 0]));
        $response = $this->controller->updateEntry(1, 1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testUpdateEntryReturns200OnSuccess(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(1, $cashBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['amount' => 75.0]));
        $response = $this->controller->updateEntry(1, 1, $request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    // ─── deleteEntry() ────────────────────────────────────────────────────────

    public function testDeleteEntryReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $response = $this->controller->deleteEntry(999, 1);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testDeleteEntryReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $response = $this->controller->deleteEntry(1, 1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testDeleteEntryReturns404WhenEntryNotFound(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();
        $this->cashBookEntryRepo->method('find')->willReturn(null);

        $response = $this->controller->deleteEntry(1, 999);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testDeleteEntryReturns404WhenEntryBelongsToDifferentBook(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $otherBook = $this->makeCashBook(2);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(5, $otherBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $response = $this->controller->deleteEntry(1, 5);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testDeleteEntryReturns200OnSuccess(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook(1);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->makeEntry(1, $cashBook);
        $this->cashBookEntryRepo->method('find')->willReturn($entry);

        $response = $this->controller->deleteEntry(1, 1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    // ─── update() ─────────────────────────────────────────────────────────────

    public function testUpdateReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['name' => 'Neu']));
        $response = $this->controller->update(999, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdateReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['name' => 'Neu']));
        $response = $this->controller->update(1, $request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testUpdateReturns400WhenBodyIsInvalidJson(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'PUT', [], [], [], [], 'not-json');
        $response = $this->controller->update(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testUpdateReturns200OnSuccess(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode([
            'name' => 'Neuer Name',
            'openingBalance' => 500.0,
        ]));
        $response = $this->controller->update(1, $request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['success']);
    }

    public function testUpdateIgnoresEmptyName(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $cashBook->expects($this->never())->method('setName');

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['name' => '   ']));
        $response = $this->controller->update(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testUpdateIgnoresNonNumericOpeningBalance(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $cashBook->expects($this->never())->method('setOpeningBalance');

        $request = Request::create('/', 'PUT', [], [], [], [], json_encode(['openingBalance' => 'abc']));
        $response = $this->controller->update(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    // ─── export() ─────────────────────────────────────────────────────────────

    public function testExportReturns404WhenCashBookNotFound(): void
    {
        $this->loginAs();
        $this->cashBookRepo->method('find')->willReturn(null);

        $response = $this->controller->export(999, $this->emptyEntryRepository());

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testExportReturns403WhenAccessDenied(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);

        $response = $this->controller->export(1, $this->emptyEntryRepository());

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testExportReturnsCsvContentType(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->export(1, $this->emptyEntryRepository());

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
    }

    public function testExportCsvContainsHeaderRow(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->export(1, $this->emptyEntryRepository());
        $content = $response->getContent();

        $this->assertStringContainsString('Datum', $content);
        $this->assertStringContainsString('Beschreibung', $content);
        $this->assertStringContainsString('Kontostand', $content);
        $this->assertStringContainsString('Einnahme', $content);
        $this->assertStringContainsString('Ausgabe', $content);
    }

    public function testExportIncludesOpeningBalanceRowWhenNonZero(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $cashBook->method('getOpeningBalance')->willReturn(200.0);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->export(1, $this->emptyEntryRepository());
        $content = $response->getContent();

        $this->assertStringContainsString('Eröffnungssaldo', $content);
    }

    public function testExportOmitsOpeningBalanceRowWhenZero(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $cashBook->method('getOpeningBalance')->willReturn(0.0);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->export(1, $this->emptyEntryRepository());
        $content = $response->getContent();

        $this->assertStringNotContainsString('Eröffnungssaldo', $content);
    }

    public function testExportCsvContainsEntryData(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $cashBook->method('getOpeningBalance')->willReturn(0.0);
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $entry = $this->createMock(CashBookEntry::class);
        $entry->method('getId')->willReturn(1);
        $entry->method('getCashBook')->willReturn($cashBook);
        $entry->method('getType')->willReturn('income');
        $entry->method('getAmount')->willReturn(100.0);
        $entry->method('getDescription')->willReturn('Mitgliedsbeitrag');
        $entry->method('getCategory')->willReturn(null);
        $entry->method('getEntryDate')->willReturn(new DateTimeImmutable('2026-01-15'));
        $entry->method('getCreatedByUser')->willReturn(null);

        $entryRepo = $this->createMock(CashBookEntryRepository::class);
        $entryRepo->method('findByCashBookOrdered')->willReturn([$entry]);

        $response = $this->controller->export(1, $entryRepo);
        $content = $response->getContent();

        $this->assertStringContainsString('Mitgliedsbeitrag', $content);
        $this->assertStringContainsString('100,00', $content);
        $this->assertStringContainsString('15.01.2026', $content);
    }

    public function testExportFilenameContainsCashBookName(): void
    {
        $this->loginAs();
        $cashBook = $this->makeCashBook();
        $this->cashBookRepo->method('find')->willReturn($cashBook);
        $this->grantAdminAccess();

        $response = $this->controller->export(1, $this->emptyEntryRepository());
        $contentDisposition = $response->headers->get('Content-Disposition');

        $this->assertStringContainsString('Test_Kassenbuch', $contentDisposition);
    }
}
