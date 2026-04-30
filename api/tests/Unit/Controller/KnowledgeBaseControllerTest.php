<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\KnowledgeBaseController;
use App\Entity\KnowledgeBaseCategory;
use App\Entity\KnowledgeBasePost;
use App\Entity\KnowledgeBasePostComment;
use App\Entity\KnowledgeBasePostLike;
use App\Entity\KnowledgeBaseTag;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\KnowledgeBaseCategoryRepository;
use App\Repository\KnowledgeBasePostCommentRepository;
use App\Repository\KnowledgeBasePostLikeRepository;
use App\Repository\KnowledgeBasePostRepository;
use App\Repository\KnowledgeBaseTagRepository;
use App\Service\MediaUrlParserService;
use App\Service\NotificationService;
use DateTimeImmutable;
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
 * Unit-Tests für KnowledgeBaseController.
 *
 * Getestete Bereiche:
 *  - listCategories: unauthorized (401), team not found (404), success
 *  - createCategory: unauthorized (401), leerer Name (400)
 *  - deleteCategory: not found (404)
 *  - listPosts: unauthorized (401), team not found (404)
 *  - createPost: team not found (404), leerer Titel (400), Kategorie not found (404)
 *  - updatePost: not found (404), leerer Titel (400)
 *  - deletePost: not found (404)
 *  - togglePin / toggleLike: not found (404)
 *  - listComments / addComment / deleteComment: not found (404), leerer Kommentar (400)
 */
#[AllowMockObjectsWithoutExpectations]
class KnowledgeBaseControllerTest extends TestCase
{
    private KnowledgeBaseController $controller;

    /** @var EntityManagerInterface&MockObject */
    private EntityManagerInterface $em;

    /** @var AuthorizationCheckerInterface&MockObject */
    private AuthorizationCheckerInterface $authChecker;

    /** @var KnowledgeBaseCategoryRepository&MockObject */
    private KnowledgeBaseCategoryRepository $categoryRepo;

    /** @var KnowledgeBasePostRepository&MockObject */
    private KnowledgeBasePostRepository $postRepo;

    /** @var KnowledgeBaseTagRepository&MockObject */
    private KnowledgeBaseTagRepository $tagRepo;

    /** @var KnowledgeBasePostLikeRepository&MockObject */
    private KnowledgeBasePostLikeRepository $likeRepo;

    /** @var KnowledgeBasePostCommentRepository&MockObject */
    private KnowledgeBasePostCommentRepository $commentRepo;

    /** @var \Doctrine\ORM\EntityRepository<Team>&MockObject */
    private \Doctrine\ORM\EntityRepository $teamRepo;

    /** @var TokenStorageInterface&MockObject */
    private TokenStorageInterface $tokenStorage;

    /** @var NotificationService&MockObject */
    private NotificationService $notificationService;

    protected function setUp(): void
    {
        $this->categoryRepo = $this->createMock(KnowledgeBaseCategoryRepository::class);
        $this->postRepo = $this->createMock(KnowledgeBasePostRepository::class);
        $this->tagRepo = $this->createMock(KnowledgeBaseTagRepository::class);
        $this->likeRepo = $this->createMock(KnowledgeBasePostLikeRepository::class);
        $this->commentRepo = $this->createMock(KnowledgeBasePostCommentRepository::class);
        // Default: find() returns null → team not found (404 tests rely on this)
        $this->teamRepo = $this->createMock(\Doctrine\ORM\EntityRepository::class);

        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $this->em->method('getRepository')->willReturnCallback(
            function (string $class) {
                return match ($class) {
                    KnowledgeBaseCategory::class => $this->categoryRepo,
                    KnowledgeBasePost::class => $this->postRepo,
                    KnowledgeBaseTag::class => $this->tagRepo,
                    KnowledgeBasePostLike::class => $this->likeRepo,
                    KnowledgeBasePostComment::class => $this->commentRepo,
                    Team::class => $this->teamRepo,
                    default => $this->createMock(\Doctrine\ORM\EntityRepository::class),
                };
            }
        );

        $this->notificationService = $this->createMock(NotificationService::class);
        $this->controller = new KnowledgeBaseController(
            $this->em,
            $this->createMock(MediaUrlParserService::class),
            $this->notificationService,
        );

        $container = new ContainerBuilder();
        $container->set('security.authorization_checker', $this->authChecker);

        $this->tokenStorage = $this->createMock(TokenStorageInterface::class);
        $container->set('security.token_storage', $this->tokenStorage);

        $this->controller->setContainer($container);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** @param array<string> $roles */
    private function loginAs(int $id = 1, array $roles = ['ROLE_USER']): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getRoles')->willReturn($roles);
        $user->method('getFirstName')->willReturn('Max');
        $user->method('getLastName')->willReturn('Mustermann');

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $this->tokenStorage->method('getToken')->willReturn($token);

        return $user;
    }

    private function makeTeam(int $id = 10): Team&MockObject
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);

        return $team;
    }

    private function makeCategory(int $id = 1, ?Team $team = null): KnowledgeBaseCategory&MockObject
    {
        $cat = $this->createMock(KnowledgeBaseCategory::class);
        $cat->method('getId')->willReturn($id);
        $cat->method('getName')->willReturn('Kategorie');
        $cat->method('getIcon')->willReturn(null);
        $cat->method('getSortOrder')->willReturn(0);
        $cat->method('isGlobal')->willReturn(null === $team);
        $cat->method('getTeam')->willReturn($team);

        return $cat;
    }

    /** @param ArrayCollection<int, KnowledgeBasePostLike>|null $likes */
    private function makePost(int $id = 1, ?Team $team = null, ?User $author = null, ?ArrayCollection $likes = null): KnowledgeBasePost&MockObject
    {
        $post = $this->createMock(KnowledgeBasePost::class);
        $post->method('getId')->willReturn($id);
        $post->method('getTitle')->willReturn('Test-Beitrag');
        $post->method('getDescription')->willReturn(null);
        $post->method('isPinned')->willReturn(false);
        $post->method('isSendNotification')->willReturn(false);
        $post->method('getCreatedAt')->willReturn(new DateTimeImmutable());
        $post->method('getUpdatedAt')->willReturn(null);
        $post->method('getTeam')->willReturn($team ?? $this->makeTeam());
        $post->method('getCreatedBy')->willReturn($author ?? $this->createMock(User::class));
        $post->method('getMediaLinks')->willReturn(new ArrayCollection());
        $post->method('getTags')->willReturn(new ArrayCollection());
        $post->method('getLikes')->willReturn($likes ?? new ArrayCollection());
        $post->method('getComments')->willReturn(new ArrayCollection());
        $cat = $this->makeCategory();
        $post->method('getCategory')->willReturn($cat);

        return $post;
    }

    private function jsonRequest(string $method, string $uri, mixed $body = null): Request
    {
        return Request::create($uri, $method, [], [], [], [], null !== $body ? json_encode($body) : null);
    }

    // ─── listCategories ───────────────────────────────────────────────────────

    public function testListCategoriesReturns401WhenNotLoggedIn(): void
    {
        // No user set (getUser returns null from token storage)
        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testListCategoriesReturns404WhenTeamNotFound(): void
    {
        $this->loginAs();
        // Default callback returns a repo mock with find() → null, so team is not found
        $request = Request::create('/', 'GET', ['teamId' => 999]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── createCategory ───────────────────────────────────────────────────────

    public function testCreateCategoryReturns401WhenNotLoggedIn(): void
    {
        $request = $this->jsonRequest('POST', '/', ['name' => 'Test']);
        $response = $this->controller->createCategory($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testCreateCategoryReturns400WhenNameIsEmpty(): void
    {
        $user = $this->loginAs(1, ['ROLE_SUPERADMIN']);

        $request = $this->jsonRequest('POST', '/', ['name' => '   ']);
        $response = $this->controller->createCategory($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testCreateCategoryReturns400WhenBodyIsInvalid(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);

        $request = Request::create('/', 'POST', [], [], [], [], 'no-json');
        $response = $this->controller->createCategory($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ─── deleteCategory ───────────────────────────────────────────────────────

    public function testDeleteCategoryReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->deleteCategory(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testDeleteCategoryReturns404WhenNotFound(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']);
        $this->categoryRepo->method('find')->willReturn(null);

        $response = $this->controller->deleteCategory(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── listPosts ────────────────────────────────────────────────────────────

    public function testListPostsReturns401WhenNotLoggedIn(): void
    {
        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testListPostsReturns404WhenTeamNotFound(): void
    {
        $this->loginAs();
        // Default callback returns a repo mock with find() → null, so team is not found
        $request = Request::create('/', 'GET', ['teamId' => 999]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── showPost ─────────────────────────────────────────────────────────────

    public function testShowPostReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->showPost(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testShowPostReturns404WhenNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $response = $this->controller->showPost(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── createPost ───────────────────────────────────────────────────────────

    public function testCreatePostReturns401WhenNotLoggedIn(): void
    {
        $request = $this->jsonRequest('POST', '/', ['teamId' => 1, 'title' => 'Test']);
        $response = $this->controller->createPost($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testCreatePostReturns400WhenBodyIsInvalid(): void
    {
        $this->loginAs();

        $request = Request::create('/', 'POST', [], [], [], [], 'no-json');
        $response = $this->controller->createPost($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testCreatePostReturns404WhenTeamNotFound(): void
    {
        $this->loginAs();
        // Default callback returns a repo mock with find() → null, so team is not found
        $request = $this->jsonRequest('POST', '/', ['teamId' => 999, 'categoryId' => 1, 'title' => 'Test']);
        $response = $this->controller->createPost($request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testCreatePostReturns400WhenTitleIsEmpty(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']);

        $team = $this->makeTeam();
        $this->teamRepo->method('find')->willReturn($team);

        // Authorization passes
        $this->authChecker->method('isGranted')->willReturn(true);

        // Category found
        $this->categoryRepo->method('find')->willReturn($this->makeCategory());

        $request = $this->jsonRequest('POST', '/', ['teamId' => 10, 'categoryId' => 1, 'title' => '   ']);
        $response = $this->controller->createPost($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ─── updatePost ───────────────────────────────────────────────────────────

    public function testUpdatePostReturns401WhenNotLoggedIn(): void
    {
        $request = $this->jsonRequest('PUT', '/', ['title' => 'New']);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testUpdatePostReturns404WhenNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $request = $this->jsonRequest('PUT', '/', ['title' => 'New']);
        $response = $this->controller->updatePost(999, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdatePostReturns400WhenTitleBecomesEmpty(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $post = $this->makePost(1, null, $user);
        $this->postRepo->method('find')->willReturn($post);
        // Grant edit access so the controller proceeds to the title validation
        $this->authChecker->method('isGranted')->willReturn(true);

        $request = $this->jsonRequest('PUT', '/', ['title' => '']);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testUpdatePostReturns400WhenBodyIsInvalid(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $post = $this->makePost(1, null, $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);

        // Send raw text instead of JSON so json_decode returns null
        $request = Request::create('/', 'PUT', [], [], [], [], 'not-json-content');
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testUpdatePostReturns404WhenCategoryNotFound(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $post = $this->makePost(1, null, $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        // categoryRepo->find returns null by default

        $request = $this->jsonRequest('PUT', '/', ['categoryId' => 999]);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── deletePost ───────────────────────────────────────────────────────────

    public function testDeletePostReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->deletePost(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testDeletePostReturns404WhenNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $response = $this->controller->deletePost(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── togglePin ────────────────────────────────────────────────────────────

    public function testTogglePinReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->togglePin(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testTogglePinReturns404WhenPostNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $response = $this->controller->togglePin(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── toggleLike ───────────────────────────────────────────────────────────

    public function testToggleLikeReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->toggleLike(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testToggleLikeReturns404WhenPostNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $response = $this->controller->toggleLike(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── listComments ─────────────────────────────────────────────────────────

    public function testListCommentsReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->listComments(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testListCommentsReturns404WhenPostNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $response = $this->controller->listComments(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── addComment ───────────────────────────────────────────────────────────

    public function testAddCommentReturns401WhenNotLoggedIn(): void
    {
        $request = $this->jsonRequest('POST', '/', ['content' => 'Hallo']);
        $response = $this->controller->addComment(1, $request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testAddCommentReturns404WhenPostNotFound(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn(null);

        $request = $this->jsonRequest('POST', '/', ['content' => 'Hallo']);
        $response = $this->controller->addComment(999, $request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testAddCommentReturns400WhenContentIsEmpty(): void
    {
        $this->loginAs();
        $team = $this->makeTeam();
        $post = $this->makePost(1, $team);
        $this->postRepo->method('find')->willReturn($post);
        // Grant comment access so the controller proceeds to content validation
        $this->authChecker->method('isGranted')->willReturn(true);

        $request = $this->jsonRequest('POST', '/', ['content' => '   ']);
        $response = $this->controller->addComment(1, $request);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ─── deleteComment ────────────────────────────────────────────────────────

    public function testDeleteCommentReturns401WhenNotLoggedIn(): void
    {
        $response = $this->controller->deleteComment(1);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testDeleteCommentReturns404WhenNotFound(): void
    {
        $this->loginAs();
        $this->commentRepo->method('find')->willReturn(null);

        $response = $this->controller->deleteComment(999);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testDeleteCommentDeniedForStranger(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $author = $this->createMock(User::class);
        $author->method('getId')->willReturn(99);

        $comment = $this->createMock(KnowledgeBasePostComment::class);
        $comment->method('getUser')->willReturn($author);
        $comment->method('getPost')->willReturn($this->makePost());
        $this->commentRepo->method('find')->willReturn($comment);

        $this->authChecker->method('isGranted')->willReturn(false);

        $response = $this->controller->deleteComment(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testDeleteCommentReturns204ForAuthor(): void
    {
        $user = $this->loginAs(7, ['ROLE_USER']);

        $author = $this->createMock(User::class);
        $author->method('getId')->willReturn(7);

        $comment = $this->createMock(KnowledgeBasePostComment::class);
        $comment->method('getUser')->willReturn($author);
        $this->commentRepo->method('find')->willReturn($comment);

        $response = $this->controller->deleteComment(1);

        $this->assertSame(204, $response->getStatusCode());
    }

    // ─── listTags ─────────────────────────────────────────────────────────────

    public function testListTagsReturns401WhenNotLoggedIn(): void
    {
        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listTags($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    public function testListTagsReturns404WhenTeamNotFound(): void
    {
        $this->loginAs();
        $request = Request::create('/', 'GET', ['teamId' => 999]);
        $response = $this->controller->listTags($request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testListTagsReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        // authChecker defaults to false

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listTags($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testListTagsReturns200OnSuccess(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->tagRepo->method('findForTeam')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listTags($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('tags', $data);
    }

    // ─── 403 branches ─────────────────────────────────────────────────────────

    public function testListCategoriesReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        // authChecker defaults to false → 403

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCreateCategoryReturns403WhenNotGranted(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']); // not superadmin
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        // authChecker defaults to false → 403

        $request = $this->jsonRequest('POST', '/', ['teamId' => 10, 'name' => 'Test']);
        $response = $this->controller->createCategory($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testDeleteCategoryReturns403ForGlobalCategoryWhenNotSuperadmin(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']); // not superadmin
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, null)); // global (team=null)

        $response = $this->controller->deleteCategory(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testDeleteCategoryReturns403ForTeamCategoryWhenNotGranted(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']); // not superadmin
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, $this->makeTeam()));
        // authChecker defaults to false → 403

        $response = $this->controller->deleteCategory(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testListPostsReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testShowPostReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $response = $this->controller->showPost(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCreatePostReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        // authChecker defaults to false → 403

        $request = $this->jsonRequest('POST', '/', ['teamId' => 10, 'categoryId' => 1, 'title' => 'Test']);
        $response = $this->controller->createPost($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCreatePostReturns404WhenCategoryNotFound(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']);
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        $this->authChecker->method('isGranted')->willReturn(true);
        // categoryRepo->find returns null (default)

        $request = $this->jsonRequest('POST', '/', ['teamId' => 10, 'categoryId' => 999, 'title' => 'Test']);
        $response = $this->controller->createPost($request);

        $this->assertSame(404, $response->getStatusCode());
    }

    public function testUpdatePostReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());
        // authChecker defaults to false → 403

        $request = $this->jsonRequest('PUT', '/', ['title' => 'Neu']);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testDeletePostReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $response = $this->controller->deletePost(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testTogglePinReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $response = $this->controller->togglePin(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testToggleLikeReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $response = $this->controller->toggleLike(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testListCommentsReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $response = $this->controller->listComments(1);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testAddCommentReturns403WhenNotGranted(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());

        $request = $this->jsonRequest('POST', '/', ['content' => 'Hallo']);
        $response = $this->controller->addComment(1, $request);

        $this->assertSame(403, $response->getStatusCode());
    }

    // ─── Success paths ────────────────────────────────────────────────────────

    public function testListCategoriesReturns200OnSuccess(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->categoryRepo->method('findForTeam')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('categories', $data);
        $this->assertArrayHasKey('canManageCategories', $data);
    }

    public function testCreateCategoryReturns201OnSuccess(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        // SUPERADMIN: no team check needed

        $request = $this->jsonRequest('POST', '/', ['name' => 'Neue Kategorie']);
        $response = $this->controller->createCategory($request);

        $this->assertSame(201, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertSame('Neue Kategorie', $data['name']);
    }

    public function testDeleteCategoryReturns204OnSuccess(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, null)); // global

        $response = $this->controller->deleteCategory(1);

        $this->assertSame(204, $response->getStatusCode());
    }

    public function testListPostsReturns200OnSuccess(): void
    {
        $this->loginAs();
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->postRepo->method('findByTeamAndFilters')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('posts', $data);
        $this->assertArrayHasKey('canCreate', $data);
    }

    public function testShowPostReturns200OnSuccess(): void
    {
        $user = $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $post = $this->makePost(1, null, $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null);

        $response = $this->controller->showPost(1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('id', $data);
        $this->assertArrayHasKey('canEdit', $data);
    }

    public function testCreatePostReturns201OnSuccess(): void
    {
        $user = $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->teamRepo->method('find')->willReturn($this->makeTeam());
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory());

        $request = $this->jsonRequest('POST', '/', [
            'teamId' => 10,
            'categoryId' => 1,
            'title' => 'Neuer Beitrag',
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(201, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertSame('Neuer Beitrag', $data['title']);
    }

    public function testUpdatePostReturns200OnSuccess(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $post = $this->makePost(1, null, $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null);

        $request = $this->jsonRequest('PUT', '/', ['title' => 'Aktualisierter Titel']);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testDeletePostReturns204OnSuccess(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());
        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->deletePost(1);

        $this->assertSame(204, $response->getStatusCode());
    }

    public function testTogglePinReturns200OnSuccess(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());
        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->togglePin(1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('isPinned', $data);
    }

    public function testToggleLikeReturns200WhenAddingLike(): void
    {
        $this->loginAs();
        // After flush, Doctrine includes the new like in the collection — simulate that here.
        /** @var ArrayCollection<int, KnowledgeBasePostLike> $likesAfterAdd */
        $likesAfterAdd = new ArrayCollection([$this->createMock(KnowledgeBasePostLike::class)]);
        $this->postRepo->method('find')->willReturn($this->makePost(likes: $likesAfterAdd));
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null); // no existing like

        $response = $this->controller->toggleLike(1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertTrue($data['liked']);
        $this->assertSame(1, $data['likeCount']);
    }

    public function testToggleLikeReturns200WhenRemovingLike(): void
    {
        $this->loginAs();
        // After flush, Doctrine removes the like from the collection — simulate that here.
        $this->postRepo->method('find')->willReturn($this->makePost(likes: new ArrayCollection()));
        $this->authChecker->method('isGranted')->willReturn(true);
        $existingLike = $this->createMock(KnowledgeBasePostLike::class);
        $this->likeRepo->method('findByPostAndUser')->willReturn($existingLike);

        $response = $this->controller->toggleLike(1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertFalse($data['liked']);
        $this->assertSame(0, $data['likeCount']);
    }

    public function testListCommentsReturns200OnSuccess(): void
    {
        $this->loginAs();
        $this->postRepo->method('find')->willReturn($this->makePost());
        $this->authChecker->method('isGranted')->willReturn(true);

        $response = $this->controller->listComments(1);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('comments', $data);
        $this->assertArrayHasKey('canCreate', $data);
    }

    public function testAddCommentReturns201OnSuccess(): void
    {
        $user = $this->loginAs(1, ['ROLE_USER']);
        $this->postRepo->method('find')->willReturn($this->makePost(1, $this->makeTeam(), $user));
        $this->authChecker->method('isGranted')->willReturn(true);

        $request = $this->jsonRequest('POST', '/', ['content' => 'Guter Beitrag!']);
        $response = $this->controller->addComment(1, $request);

        $this->assertSame(201, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertSame('Guter Beitrag!', $data['content']);
    }

    // ─── syncTags / tag handling ──────────────────────────────────────────────

    /**
     * Regression test: updatePost with tags must not throw a TypeError when the
     * post's team is null. Previously syncTags() required a non-nullable Team.
     */
    public function testUpdatePostWithTagsWhenPostHasNullTeamSucceeds(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);

        // Build a post whose getTeam() explicitly returns null
        $post = $this->createMock(KnowledgeBasePost::class);
        $post->method('getId')->willReturn(1);
        $post->method('getTitle')->willReturn('Beitrag');
        $post->method('getDescription')->willReturn(null);
        $post->method('isPinned')->willReturn(false);
        $post->method('isSendNotification')->willReturn(false);
        $post->method('getCreatedAt')->willReturn(new DateTimeImmutable());
        $post->method('getUpdatedAt')->willReturn(null);
        $post->method('getTeam')->willReturn(null); // <-- the critical null
        $post->method('getCreatedBy')->willReturn($user);
        $post->method('getMediaLinks')->willReturn(new ArrayCollection());
        $post->method('getTags')->willReturn(new ArrayCollection());
        $post->method('getLikes')->willReturn(new ArrayCollection());
        $post->method('getComments')->willReturn(new ArrayCollection());
        $post->method('getCategory')->willReturn($this->makeCategory());

        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null);
        $this->tagRepo->method('findOneBy')->willReturn(null);

        $request = $this->jsonRequest('PUT', '/', ['title' => 'Beitrag', 'tags' => ['php']]);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    /**
     * When syncTags finds an existing global tag (team=null), it reuses it
     * instead of creating a new one — em->persist must not be called.
     */
    public function testUpdatePostWithTagsReusesExistingGlobalTag(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $post = $this->makePost(1, $this->makeTeam(10), $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null);

        $existingTag = $this->createMock(KnowledgeBaseTag::class);
        $existingTag->method('getId')->willReturn(5);
        $existingTag->method('getName')->willReturn('php');
        // First findOneBy(['name' => 'php', 'team' => null]) returns the global tag
        $this->tagRepo->method('findOneBy')->willReturn($existingTag);

        $this->em->expects($this->never())->method('persist');

        $request = $this->jsonRequest('PUT', '/', ['title' => 'Beitrag', 'tags' => ['php']]);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    /**
     * When no existing tag is found (neither global nor team-scoped),
     * syncTags creates a new KnowledgeBaseTag and persists it.
     */
    public function testUpdatePostWithTagsCreatesNewTagWhenNoneExists(): void
    {
        $user = $this->loginAs(5, ['ROLE_USER']);
        $team = $this->makeTeam(10);
        $post = $this->makePost(1, $team, $user);
        $this->postRepo->method('find')->willReturn($post);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->likeRepo->method('findByPostAndUser')->willReturn(null);
        // Both findOneBy calls return null → new tag must be created and persisted
        $this->tagRepo->method('findOneBy')->willReturn(null);

        $this->em->expects($this->atLeastOnce())->method('persist');

        $request = $this->jsonRequest('PUT', '/', ['title' => 'Beitrag', 'tags' => ['taktik']]);
        $response = $this->controller->updatePost(1, $request);

        $this->assertSame(200, $response->getStatusCode());
    }

    /**
     * createPost with tags: new tags are created and persisted when no existing
     * tag matches.
     */
    public function testCreatePostWithTagsCreatesNewTag(): void
    {
        $this->loginAs(1, ['ROLE_ADMIN']);
        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->willReturn($team);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory());
        // No existing tag → new ones will be created
        $this->tagRepo->method('findOneBy')->willReturn(null);

        $this->em->expects($this->atLeastOnce())->method('persist');

        $request = $this->jsonRequest('POST', '/', [
            'teamId' => 10,
            'categoryId' => 1,
            'title' => 'Beitrag mit Tags',
            'tags' => ['technik', 'taktik'],
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(201, $response->getStatusCode());
    }

    // ─── listCategories – Global-Modus (teamId=0) ─────────────────────────────

    public function testListCategoriesReturns200ForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $cat = $this->makeCategory(1, null); // global category
        $this->categoryRepo->method('findGlobal')->willReturn([$cat]);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('categories', $data);
        $this->assertTrue($data['canManageCategories']);
    }

    public function testListCategoriesCallsFindGlobalForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->expects($this->once())->method('findGlobal')->willReturn([]);
        $this->categoryRepo->expects($this->never())->method('findForTeam');

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $this->controller->listCategories($request);
    }

    public function testListCategoriesReturns403ForNonSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_USER']);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listCategories($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testListCategoriesTeamId0ReturnsEmptyCategoriesWhenNoneExist(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->method('findGlobal')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listCategories($request);

        $data = json_decode((string) $response->getContent(), true);
        $this->assertSame([], $data['categories']);
    }

    // ─── listTags – Global-Modus (teamId=0) ───────────────────────────────────

    public function testListTagsReturns200ForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $tag = $this->createMock(KnowledgeBaseTag::class);
        $tag->method('getId')->willReturn(1);
        $tag->method('getName')->willReturn('Taktik');
        $this->tagRepo->method('findGlobal')->willReturn([$tag]);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listTags($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('tags', $data);
        $this->assertCount(1, $data['tags']);
        $this->assertSame('Taktik', $data['tags'][0]['name']);
    }

    public function testListTagsCallsFindGlobalForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->tagRepo->expects($this->once())->method('findGlobal')->willReturn([]);
        $this->tagRepo->expects($this->never())->method('findForTeam');

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $this->controller->listTags($request);
    }

    public function testListTagsReturns403ForNonSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_USER']);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listTags($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    // ─── listPosts – Global-Modus (teamId=0) ──────────────────────────────────

    public function testListPostsReturns200ForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->postRepo->method('findGlobalWithFilters')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertTrue($data['isSuperAdmin']);
        $this->assertTrue($data['canCreate']);
        $this->assertArrayHasKey('posts', $data);
    }

    public function testListPostsCallsFindGlobalWithFiltersForSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->postRepo->expects($this->once())->method('findGlobalWithFilters')->willReturn([]);
        $this->postRepo->expects($this->never())->method('findByTeamAndFilters');

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $this->controller->listPosts($request);
    }

    public function testListPostsReturns403ForNonSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_USER']);

        $request = Request::create('/', 'GET', ['teamId' => 0]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testListPostsResponseContainsIsSuperAdminFieldForRegularTeam(): void
    {
        $user = $this->loginAs(1, ['ROLE_USER']); // not a super admin
        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->willReturn($team);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->postRepo->method('findByTeamAndFilters')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listPosts($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('isSuperAdmin', $data);
        $this->assertFalse($data['isSuperAdmin']);
    }

    public function testListPostsResponseIsSuperAdminTrueForSuperAdmin(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $team = $this->makeTeam(10);
        $this->teamRepo->method('find')->willReturn($team);
        $this->authChecker->method('isGranted')->willReturn(true);
        $this->postRepo->method('findByTeamAndFilters')->willReturn([]);

        $request = Request::create('/', 'GET', ['teamId' => 10]);
        $response = $this->controller->listPosts($request);

        $data = json_decode((string) $response->getContent(), true);
        $this->assertTrue($data['isSuperAdmin']);
    }

    // ─── createPost – Global-Modus (kein teamId / teamId=0) ──────────────────

    public function testCreatePostReturns201ForSuperAdminWithoutTeamId(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, null));

        $request = $this->jsonRequest('POST', '/', [
            'categoryId' => 1,
            'title' => 'Globaler Beitrag',
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(201, $response->getStatusCode());
    }

    public function testCreatePostReturns403ForNonSuperAdminWithoutTeamId(): void
    {
        $this->loginAs(1, ['ROLE_USER']);

        $request = $this->jsonRequest('POST', '/', [
            'categoryId' => 1,
            'title' => 'Globaler Beitrag',
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(403, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true);
        $this->assertStringContainsString('SuperAdmin', $data['error']);
    }

    public function testCreatePostReturns403ForNonSuperAdminWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_USER']);

        $request = $this->jsonRequest('POST', '/', [
            'teamId' => 0,
            'categoryId' => 1,
            'title' => 'Globaler Beitrag',
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testCreatePostDoesNotSendNotificationWhenTeamIsNull(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, null));
        // Notification service must NOT be called because team is null
        $this->notificationService
            ->expects($this->never())
            ->method('createNotificationForUsers');

        $request = $this->jsonRequest('POST', '/', [
            'categoryId' => 1,
            'title' => 'Globaler Beitrag',
            'sendNotification' => true, // requested, but must be suppressed
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(201, $response->getStatusCode());
    }

    public function testCreatePostSuperAdminCanCreateGlobalPostWithTeamId0(): void
    {
        $this->loginAs(1, ['ROLE_SUPERADMIN']);
        $this->categoryRepo->method('find')->willReturn($this->makeCategory(1, null));

        $request = $this->jsonRequest('POST', '/', [
            'teamId' => 0,
            'categoryId' => 1,
            'title' => 'Globaler Beitrag via teamId=0',
        ]);
        $response = $this->controller->createPost($request);

        $this->assertSame(201, $response->getStatusCode());
    }
}
