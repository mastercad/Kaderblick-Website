<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\WatchlistController;
use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\User;
use App\Entity\Watchlist;
use App\Repository\CoachRepository;
use App\Repository\PlayerRepository;
use App\Repository\WatchlistRepository;
use App\Service\CoachSerializerService;
use App\Service\PlayerSerializerService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

#[AllowMockObjectsWithoutExpectations]
class WatchlistControllerTest extends TestCase
{
    private EntityManagerInterface & MockObject $em;
    private WatchlistRepository & MockObject $watchlistRepository;
    private PlayerRepository & MockObject $playerRepository;
    private CoachRepository & MockObject $coachRepository;
    private PlayerSerializerService & MockObject $playerSerializer;
    private CoachSerializerService & MockObject $coachSerializer;
    private WatchlistController $controller;
    private User & MockObject $currentUser;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->watchlistRepository = $this->createMock(WatchlistRepository::class);
        $this->playerRepository = $this->createMock(PlayerRepository::class);
        $this->coachRepository = $this->createMock(CoachRepository::class);
        $this->playerSerializer = $this->createMock(PlayerSerializerService::class);
        $this->coachSerializer = $this->createMock(CoachSerializerService::class);

        $this->controller = new WatchlistController(
            $this->em,
            $this->watchlistRepository,
            $this->playerRepository,
            $this->coachRepository,
            $this->playerSerializer,
            $this->coachSerializer,
        );

        $this->currentUser = $this->createMock(User::class);
        $this->currentUser->method('getId')->willReturn(1);

        $container = new ContainerBuilder();

        // Minimal serializer so json() works
        $container->set(
            'serializer',
            new class {
                /** @param array<string, mixed> $context */
                public function serialize(mixed $data, string $format, array $context = []): string
                {
                    return json_encode($data, JSON_THROW_ON_ERROR);
                }
            }
        );

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->currentUser);
        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);
        $container->set('security.token_storage', $tokenStorage);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function decodeResponse(\Symfony\Component\HttpFoundation\JsonResponse $response): mixed
    {
        return json_decode((string) $response->getContent(), true);
    }

    private function makeWatchlistEntry(
        int $id,
        ?Player $player = null,
        ?Coach $coach = null,
        bool $isAnonymous = true
    ): Watchlist & MockObject {
        $entry = $this->createMock(Watchlist::class);
        $entry->method('getId')->willReturn($id);
        $entry->method('getWatcher')->willReturn($this->currentUser);
        $entry->method('getWatchedPlayer')->willReturn($player);
        $entry->method('getWatchedCoach')->willReturn($coach);
        $entry->method('isAnonymous')->willReturn($isAnonymous);
        $entry->method('getCreatedAt')->willReturn(new DateTimeImmutable('2025-01-01 12:00:00'));

        return $entry;
    }

    // ─── index() ──────────────────────────────────────────────────────────────

    public function testIndexReturnsEmptyWatchlistWhenNoEntries(): void
    {
        $this->watchlistRepository->method('findForUser')->willReturn([]);

        $response = $this->controller->index();
        $data = $this->decodeResponse($response);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertArrayHasKey('watchlist', $data);
        $this->assertEmpty($data['watchlist']);
    }

    public function testIndexIncludesPlayerEntry(): void
    {
        $player = $this->createMock(Player::class);
        $entry = $this->makeWatchlistEntry(1, $player, null);

        $this->watchlistRepository->method('findForUser')->willReturn([$entry]);
        $this->playerSerializer->method('serializeForCurrentUser')
            ->willReturn(['id' => 7, 'firstName' => 'Max']);

        $response = $this->controller->index();
        $data = $this->decodeResponse($response);

        $this->assertCount(1, $data['watchlist']);
        $this->assertSame('player', $data['watchlist'][0]['type']);
        $this->assertSame(['id' => 7, 'firstName' => 'Max'], $data['watchlist'][0]['player']);
    }

    public function testIndexIncludesCoachEntry(): void
    {
        $coach = $this->createMock(Coach::class);
        $entry = $this->makeWatchlistEntry(2, null, $coach);

        $this->watchlistRepository->method('findForUser')->willReturn([$entry]);
        $this->coachSerializer->method('serializeForCurrentUser')
            ->willReturn(['id' => 99, 'firstName' => 'Thomas']);

        $response = $this->controller->index();
        $data = $this->decodeResponse($response);

        $this->assertSame('coach', $data['watchlist'][0]['type']);
        $this->assertSame(['id' => 99, 'firstName' => 'Thomas'], $data['watchlist'][0]['coach']);
    }

    public function testIndexIncludesMetaFields(): void
    {
        $player = $this->createMock(Player::class);
        $entry = $this->makeWatchlistEntry(5, $player, null, false);
        $this->watchlistRepository->method('findForUser')->willReturn([$entry]);
        $this->playerSerializer->method('serializeForCurrentUser')->willReturn([]);

        $data = $this->decodeResponse($this->controller->index());

        $this->assertSame(5, $data['watchlist'][0]['id']);
        $this->assertFalse($data['watchlist'][0]['isAnonymous']);
        $this->assertArrayHasKey('createdAt', $data['watchlist'][0]);
    }

    // ─── search() ─────────────────────────────────────────────────────────────

    public function testSearchReturnsEmptyForQueryShorterThan2Chars(): void
    {
        $request = Request::create('/api/watchlist/search', 'GET', ['q' => 'a', 'type' => 'player']);
        $response = $this->controller->search($request);
        $data = $this->decodeResponse($response);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertEmpty($data['results']);
    }

    public function testSearchReturnsEmptyForEmptyQuery(): void
    {
        $request = Request::create('/api/watchlist/search', 'GET', ['q' => '']);
        $response = $this->controller->search($request);
        $data = $this->decodeResponse($response);

        $this->assertEmpty($data['results']);
    }

    public function testSearchPlayersCallsPlayerRepository(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(10);
        $player->method('getFirstName')->willReturn('Max');
        $player->method('getLastName')->willReturn('Mustermann');
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $this->playerRepository->method('searchGlobal')->willReturn([$player]);
        $this->watchlistRepository->method('findForUser')->willReturn([]);

        $request = Request::create('/api/watchlist/search', 'GET', ['q' => 'Ma', 'type' => 'player']);
        $response = $this->controller->search($request);
        $data = $this->decodeResponse($response);

        $this->assertCount(1, $data['results']);
        $this->assertSame(10, $data['results'][0]['id']);
        $this->assertSame('Max Mustermann', $data['results'][0]['name']);
        $this->assertFalse($data['results'][0]['isWatched']);
    }

    public function testSearchCoachesCallsCoachRepository(): void
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getId')->willReturn(20);
        $coach->method('getFirstName')->willReturn('Thomas');
        $coach->method('getLastName')->willReturn('Müller');
        $coach->method('getCoachClubAssignments')->willReturn(new ArrayCollection());

        $this->coachRepository->method('searchGlobal')->willReturn([$coach]);
        $this->watchlistRepository->method('findForUser')->willReturn([]);

        $request = Request::create('/api/watchlist/search', 'GET', ['q' => 'Th', 'type' => 'coach']);
        $response = $this->controller->search($request);
        $data = $this->decodeResponse($response);

        $this->assertCount(1, $data['results']);
        $this->assertSame(20, $data['results'][0]['id']);
        $this->assertSame('Thomas Müller', $data['results'][0]['name']);
        $this->assertFalse($data['results'][0]['isWatched']);
    }

    public function testSearchMarksAlreadyWatchedPlayer(): void
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(10);
        $player->method('getFirstName')->willReturn('Max');
        $player->method('getLastName')->willReturn('Mustermann');
        $player->method('getPlayerClubAssignments')->willReturn(new ArrayCollection());

        $this->playerRepository->method('searchGlobal')->willReturn([$player]);

        $playerEntry = $this->createMock(Watchlist::class);
        $playerEntry->method('getWatchedPlayer')->willReturn($player);
        $playerEntry->method('getWatchedCoach')->willReturn(null);
        $this->watchlistRepository->method('findForUser')->willReturn([$playerEntry]);

        $request = Request::create('/api/watchlist/search', 'GET', ['q' => 'Ma', 'type' => 'player']);
        $data = $this->decodeResponse($this->controller->search($request));

        $this->assertTrue($data['results'][0]['isWatched']);
    }

    // ─── create() ─────────────────────────────────────────────────────────────

    public function testCreateReturnsBadRequestWhenTypeIsMissing(): void
    {
        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['targetId' => 1])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturnsBadRequestWhenTargetIdIsMissing(): void
    {
        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'player'])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturnsBadRequestForInvalidType(): void
    {
        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'invalid', 'targetId' => 1])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturnsNotFoundWhenPlayerDoesNotExist(): void
    {
        $this->playerRepository->method('find')->willReturn(null);

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'player', 'targetId' => 999])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testCreateReturnsNotFoundWhenCoachDoesNotExist(): void
    {
        $this->coachRepository->method('find')->willReturn(null);

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'coach', 'targetId' => 999])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testCreateReturnsConflictWhenPlayerAlreadyWatched(): void
    {
        $player = $this->createMock(Player::class);
        $this->playerRepository->method('find')->willReturn($player);
        $this->watchlistRepository->method('findByWatcherAndPlayer')
            ->willReturn($this->createMock(Watchlist::class));

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'player', 'targetId' => 1])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_CONFLICT, $response->getStatusCode());
    }

    public function testCreateReturnsConflictWhenCoachAlreadyWatched(): void
    {
        $coach = $this->createMock(Coach::class);
        $this->coachRepository->method('find')->willReturn($coach);
        $this->watchlistRepository->method('findByWatcherAndCoach')
            ->willReturn($this->createMock(Watchlist::class));

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'coach', 'targetId' => 1])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_CONFLICT, $response->getStatusCode());
    }

    public function testCreatePlayerPersistsAndReturns201(): void
    {
        $player = $this->createMock(Player::class);
        $this->playerRepository->method('find')->willReturn($player);
        $this->watchlistRepository->method('findByWatcherAndPlayer')->willReturn(null);
        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'player', 'targetId' => 5])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
    }

    public function testCreateCoachPersistsAndReturns201(): void
    {
        $coach = $this->createMock(Coach::class);
        $this->coachRepository->method('find')->willReturn($coach);
        $this->watchlistRepository->method('findByWatcherAndCoach')->willReturn(null);
        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $request = Request::create(
            '/api/watchlist',
            'POST',
            [],
            [],
            [],
            [],
            json_encode(['type' => 'coach', 'targetId' => 7])
        );
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
    }

    // ─── update() ─────────────────────────────────────────────────────────────

    public function testUpdateReturns404WhenEntryNotFound(): void
    {
        $this->watchlistRepository->method('find')->willReturn(null);

        $request = Request::create(
            '/api/watchlist/1',
            'PATCH',
            [],
            [],
            [],
            [],
            json_encode(['isAnonymous' => false])
        );
        $response = $this->controller->update(1, $request);

        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testUpdateReturns403WhenEntryBelongsToDifferentUser(): void
    {
        $otherUser = $this->createMock(User::class);
        $otherUser->method('getId')->willReturn(99);

        $entry = $this->createMock(Watchlist::class);
        $entry->method('getWatcher')->willReturn($otherUser);
        $this->watchlistRepository->method('find')->willReturn($entry);

        $request = Request::create(
            '/api/watchlist/1',
            'PATCH',
            [],
            [],
            [],
            [],
            json_encode(['isAnonymous' => false])
        );
        $response = $this->controller->update(1, $request);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testUpdateSetsIsAnonymousAndFlushes(): void
    {
        $entry = $this->makeWatchlistEntry(1, null, null);
        $this->watchlistRepository->method('find')->willReturn($entry);
        $entry->expects($this->once())->method('setIsAnonymous')->with(false);
        $this->em->expects($this->once())->method('flush');

        $request = Request::create(
            '/api/watchlist/1',
            'PATCH',
            [],
            [],
            [],
            [],
            json_encode(['isAnonymous' => false])
        );
        $response = $this->controller->update(1, $request);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    // ─── delete() ─────────────────────────────────────────────────────────────

    public function testDeleteReturns404WhenEntryNotFound(): void
    {
        $this->watchlistRepository->method('find')->willReturn(null);

        $response = $this->controller->delete(1);

        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testDeleteReturns403WhenEntryBelongsToDifferentUser(): void
    {
        $otherUser = $this->createMock(User::class);
        $otherUser->method('getId')->willReturn(99);

        $entry = $this->createMock(Watchlist::class);
        $entry->method('getWatcher')->willReturn($otherUser);
        $this->watchlistRepository->method('find')->willReturn($entry);

        $response = $this->controller->delete(1);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeleteRemovesEntryAndReturns204(): void
    {
        $entry = $this->makeWatchlistEntry(1, null, null);
        $this->watchlistRepository->method('find')->willReturn($entry);
        $this->em->expects($this->once())->method('remove')->with($entry);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->delete(1);

        $this->assertSame(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }
}
