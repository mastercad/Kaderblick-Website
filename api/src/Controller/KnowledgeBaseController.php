<?php

namespace App\Controller;

use App\Entity\CoachTeamAssignment;
use App\Entity\KnowledgeBaseCategory;
use App\Entity\KnowledgeBasePost;
use App\Entity\KnowledgeBasePostComment;
use App\Entity\KnowledgeBasePostLike;
use App\Entity\KnowledgeBasePostMedia;
use App\Entity\KnowledgeBaseTag;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\KnowledgeBaseCategoryRepository;
use App\Repository\KnowledgeBasePostCommentRepository;
use App\Repository\KnowledgeBasePostLikeRepository;
use App\Repository\KnowledgeBasePostRepository;
use App\Repository\KnowledgeBaseTagRepository;
use App\Security\Voter\KnowledgeBaseVoter;
use App\Service\MediaUrlParserService;
use App\Service\NotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/knowledge-base', name: 'app_knowledge_base_')]
class KnowledgeBaseController extends AbstractController
{
    private KnowledgeBaseCategoryRepository $categoryRepo;
    private KnowledgeBasePostRepository $postRepo;
    private KnowledgeBaseTagRepository $tagRepo;
    private KnowledgeBasePostLikeRepository $likeRepo;
    private KnowledgeBasePostCommentRepository $commentRepo;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly MediaUrlParserService $urlParser,
        private readonly NotificationService $notificationService,
    ) {
        $categoryRepo = $em->getRepository(KnowledgeBaseCategory::class);
        assert($categoryRepo instanceof KnowledgeBaseCategoryRepository);
        $this->categoryRepo = $categoryRepo;

        $postRepo = $em->getRepository(KnowledgeBasePost::class);
        assert($postRepo instanceof KnowledgeBasePostRepository);
        $this->postRepo = $postRepo;

        $tagRepo = $em->getRepository(KnowledgeBaseTag::class);
        assert($tagRepo instanceof KnowledgeBaseTagRepository);
        $this->tagRepo = $tagRepo;

        $likeRepo = $em->getRepository(KnowledgeBasePostLike::class);
        assert($likeRepo instanceof KnowledgeBasePostLikeRepository);
        $this->likeRepo = $likeRepo;

        $commentRepo = $em->getRepository(KnowledgeBasePostComment::class);
        assert($commentRepo instanceof KnowledgeBasePostCommentRepository);
        $this->commentRepo = $commentRepo;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CATEGORIES
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/categories', name: 'category_list', methods: ['GET'])]
    public function listCategories(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $teamId = $request->query->getInt('teamId');
        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team instanceof Team) {
            return new JsonResponse(['error' => 'Team nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_VIEW, $team)) {
            return new JsonResponse(['error' => 'Kein Zugriff auf dieses Team.'], 403);
        }

        $categories = $this->categoryRepo->findForTeam($team);

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        $canManage = $isSuperAdmin || $this->isGranted(KnowledgeBaseVoter::POST_CREATE, $team);

        return new JsonResponse([
            'categories' => array_map(fn (KnowledgeBaseCategory $c) => $this->serializeCategory($c), $categories),
            'canManageCategories' => $canManage,
        ]);
    }

    #[Route(path: '/categories', name: 'category_create', methods: ['POST'])]
    public function createCategory(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Ungültige Anfrage.'], 400);
        }

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);

        // Global categories only by SUPERADMIN
        $teamId = isset($data['teamId']) ? (int) $data['teamId'] : null;
        $team = null;
        if (!$isSuperAdmin) {
            if (!$teamId) {
                return new JsonResponse(['error' => 'teamId fehlt.'], 400);
            }
            $team = $this->em->getRepository(Team::class)->find($teamId);
            if (!$team instanceof Team) {
                return new JsonResponse(['error' => 'Team nicht gefunden.'], 404);
            }
            if (!$this->isGranted(KnowledgeBaseVoter::POST_CREATE, $team)) {
                return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
            }
        } elseif ($teamId) {
            $team = $this->em->getRepository(Team::class)->find($teamId);
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ('' === $name) {
            return new JsonResponse(['error' => 'Name darf nicht leer sein.'], 400);
        }

        $category = new KnowledgeBaseCategory();
        $category->setName($name);
        $category->setIcon(isset($data['icon']) ? mb_substr((string) $data['icon'], 0, 10) : null);
        $category->setSortOrder((int) ($data['sortOrder'] ?? 0));
        $category->setTeam($team);
        $category->setCreatedBy($user);

        $this->em->persist($category);
        $this->em->flush();

        return new JsonResponse($this->serializeCategory($category), 201);
    }

    #[Route(path: '/categories/{id}', name: 'category_delete', methods: ['DELETE'])]
    public function deleteCategory(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $category = $this->categoryRepo->find($id);
        if (!$category instanceof KnowledgeBaseCategory) {
            return new JsonResponse(['error' => 'Kategorie nicht gefunden.'], 404);
        }

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        $team = $category->getTeam();

        // Global categories: only SUPERADMIN
        if (null === $team && !$isSuperAdmin) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        // Team categories: must be able to create in that team
        if (null !== $team && !$isSuperAdmin && !$this->isGranted(KnowledgeBaseVoter::POST_CREATE, $team)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $this->em->remove($category);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAGS
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/tags', name: 'tag_list', methods: ['GET'])]
    public function listTags(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $teamId = $request->query->getInt('teamId');
        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team instanceof Team) {
            return new JsonResponse(['error' => 'Team nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_VIEW, $team)) {
            return new JsonResponse(['error' => 'Kein Zugriff.'], 403);
        }

        $tags = $this->tagRepo->findForTeam($team);

        return new JsonResponse([
            'tags' => array_map(fn (KnowledgeBaseTag $t) => ['id' => $t->getId(), 'name' => $t->getName()], $tags),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – LIST
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '', name: 'post_list', methods: ['GET'])]
    public function listPosts(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $teamId = $request->query->getInt('teamId');
        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team instanceof Team) {
            return new JsonResponse(['error' => 'Team nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_VIEW, $team)) {
            return new JsonResponse(['error' => 'Kein Zugriff auf dieses Team.'], 403);
        }

        $categoryId = $request->query->getInt('categoryId', 0);
        $category = $categoryId > 0 ? $this->categoryRepo->find($categoryId) : null;
        $search = $request->query->getString('search', '');
        $tag = $request->query->getString('tag', '');

        $posts = $this->postRepo->findByTeamAndFilters($team, $category ?: null, $search ?: null, $tag ?: null);

        $likedPostIds = [];
        foreach ($posts as $post) {
            if (null !== $this->likeRepo->findByPostAndUser($post, $user)) {
                $likedPostIds[] = $post->getId();
            }
        }

        $canCreate = $this->isGranted(KnowledgeBaseVoter::POST_CREATE, $team);

        return new JsonResponse([
            'posts' => array_map(fn (KnowledgeBasePost $p) => $this->serializePostCard($p, $likedPostIds), $posts),
            'canCreate' => $canCreate,
            'likedPostIds' => $likedPostIds,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – DETAIL
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}', name: 'post_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function showPost(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_VIEW, $post)) {
            return new JsonResponse(['error' => 'Kein Zugriff.'], 403);
        }

        $liked = null !== $this->likeRepo->findByPostAndUser($post, $user);

        return new JsonResponse($this->serializePostDetail($post, $liked, $user));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – CREATE
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '', name: 'post_create', methods: ['POST'])]
    public function createPost(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Ungültige Anfrage.'], 400);
        }

        $teamId = isset($data['teamId']) ? (int) $data['teamId'] : 0;
        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team instanceof Team) {
            return new JsonResponse(['error' => 'Team nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_CREATE, $team)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $categoryId = isset($data['categoryId']) ? (int) $data['categoryId'] : 0;
        $category = $this->categoryRepo->find($categoryId);
        if (!$category instanceof KnowledgeBaseCategory) {
            return new JsonResponse(['error' => 'Kategorie nicht gefunden.'], 404);
        }

        $title = trim((string) ($data['title'] ?? ''));
        if ('' === $title) {
            return new JsonResponse(['error' => 'Titel darf nicht leer sein.'], 400);
        }

        $post = new KnowledgeBasePost();
        $post->setTeam($team);
        $post->setCategory($category);
        $post->setTitle($title);
        $post->setDescription(isset($data['description']) ? trim((string) $data['description']) : null);
        $post->setIsPinned(false);
        $post->setSendNotification((bool) ($data['sendNotification'] ?? false));
        $post->setCreatedBy($user);

        // Media links
        if (isset($data['mediaLinks']) && is_array($data['mediaLinks'])) {
            foreach ($data['mediaLinks'] as $linkData) {
                $url = trim((string) ($linkData['url'] ?? ''));
                if ('' === $url) {
                    continue;
                }
                $parsed = $this->urlParser->parse($url);
                $media = new KnowledgeBasePostMedia();
                $media->setUrl($url);
                $media->setMediaType($parsed['mediaType']);
                $media->setExternalId($parsed['externalId']);
                $media->setThumbnailUrl($parsed['thumbnailUrl']);
                $media->setLabel(isset($linkData['label']) ? trim((string) $linkData['label']) : null);
                $post->addMediaLink($media);
                $this->em->persist($media);
            }
        }

        // Tags
        if (isset($data['tags']) && is_array($data['tags'])) {
            $this->syncTags($post, $data['tags'], $team);
        }

        $this->em->persist($post);
        $this->em->flush();

        // Push notification
        if ($post->isSendNotification()) {
            $teamUsers = $this->getTeamUsers($team, $user);
            if (!empty($teamUsers)) {
                $this->notificationService->createNotificationForUsers(
                    $teamUsers,
                    'knowledge_base_post',
                    sprintf('Neuer Beitrag im Wissenspool: %s', $post->getTitle()),
                    sprintf('%s hat einen neuen Beitrag im Wissenspool veröffentlicht.', trim($user->getFirstName() . ' ' . $user->getLastName())),
                    ['postId' => $post->getId(), 'teamId' => $team->getId(), 'url' => '/wissenspool?teamId=' . $team->getId()]
                );
            }
        }

        return new JsonResponse($this->serializePostDetail($post, false, $user), 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – UPDATE
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}', name: 'post_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function updatePost(int $id, Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_EDIT, $post)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Ungültige Anfrage.'], 400);
        }

        if (isset($data['title'])) {
            $title = trim((string) $data['title']);
            if ('' === $title) {
                return new JsonResponse(['error' => 'Titel darf nicht leer sein.'], 400);
            }
            $post->setTitle($title);
        }

        if (array_key_exists('description', $data)) {
            $post->setDescription(isset($data['description']) ? trim((string) $data['description']) : null);
        }

        if (isset($data['categoryId'])) {
            $category = $this->categoryRepo->find((int) $data['categoryId']);
            if (!$category instanceof KnowledgeBaseCategory) {
                return new JsonResponse(['error' => 'Kategorie nicht gefunden.'], 404);
            }
            $post->setCategory($category);
        }

        // Replace media links if provided
        if (isset($data['mediaLinks']) && is_array($data['mediaLinks'])) {
            foreach ($post->getMediaLinks() as $old) {
                $this->em->remove($old);
            }
            foreach ($data['mediaLinks'] as $linkData) {
                $url = trim((string) ($linkData['url'] ?? ''));
                if ('' === $url) {
                    continue;
                }
                $parsed = $this->urlParser->parse($url);
                $media = new KnowledgeBasePostMedia();
                $media->setUrl($url);
                $media->setMediaType($parsed['mediaType']);
                $media->setExternalId($parsed['externalId']);
                $media->setThumbnailUrl($parsed['thumbnailUrl']);
                $media->setLabel(isset($linkData['label']) ? trim((string) $linkData['label']) : null);
                $post->addMediaLink($media);
                $this->em->persist($media);
            }
        }

        // Tags
        if (isset($data['tags']) && is_array($data['tags'])) {
            foreach ($post->getTags() as $tag) {
                $post->removeTag($tag);
            }
            $this->syncTags($post, $data['tags'], $post->getTeam());
        }

        $post->setUpdatedBy($user);
        $post->setUpdatedAt(new DateTimeImmutable());

        $this->em->flush();

        $liked = null !== $this->likeRepo->findByPostAndUser($post, $user);

        return new JsonResponse($this->serializePostDetail($post, $liked, $user));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – DELETE
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}', name: 'post_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deletePost(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_DELETE, $post)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $this->em->remove($post);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POSTS – PIN / UNPIN
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}/pin', name: 'post_pin', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function togglePin(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_PIN, $post)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $post->setIsPinned(!$post->isPinned());
        $this->em->flush();

        return new JsonResponse(['isPinned' => $post->isPinned()]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LIKES
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}/like', name: 'post_like', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function toggleLike(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::POST_VIEW, $post)) {
            return new JsonResponse(['error' => 'Kein Zugriff.'], 403);
        }

        $existing = $this->likeRepo->findByPostAndUser($post, $user);
        if (null !== $existing) {
            $this->em->remove($existing);
            $liked = false;
        } else {
            $like = new KnowledgeBasePostLike();
            $like->setPost($post);
            $like->setUser($user);
            $this->em->persist($like);
            $liked = true;
        }

        $this->em->flush();

        return new JsonResponse([
            'liked' => $liked,
            'likeCount' => $post->getLikes()->count(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMMENTS
    // ─────────────────────────────────────────────────────────────────────────

    #[Route(path: '/{id}/comments', name: 'post_comments_list', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function listComments(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::COMMENT_VIEW, $post)) {
            return new JsonResponse(['error' => 'Kein Zugriff.'], 403);
        }

        $comments = $post->getComments()->toArray();
        usort($comments, fn (KnowledgeBasePostComment $a, KnowledgeBasePostComment $b) => $a->getCreatedAt() <=> $b->getCreatedAt());

        $canCreate = $this->isGranted(KnowledgeBaseVoter::COMMENT_ADD, $post);

        return new JsonResponse([
            'comments' => array_map(fn (KnowledgeBasePostComment $c) => $this->serializeComment($c, $user), $comments),
            'canCreate' => $canCreate,
        ]);
    }

    #[Route(path: '/{id}/comments', name: 'post_comment_create', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function addComment(int $id, Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $post = $this->postRepo->find($id);
        if (!$post instanceof KnowledgeBasePost) {
            return new JsonResponse(['error' => 'Beitrag nicht gefunden.'], 404);
        }

        if (!$this->isGranted(KnowledgeBaseVoter::COMMENT_ADD, $post)) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $content = trim((string) ($data['content'] ?? ''));
        if ('' === $content) {
            return new JsonResponse(['error' => 'Kommentar darf nicht leer sein.'], 400);
        }

        $comment = new KnowledgeBasePostComment();
        $comment->setPost($post);
        $comment->setUser($user);
        $comment->setContent($content);

        $this->em->persist($comment);
        $this->em->flush();

        return new JsonResponse($this->serializeComment($comment, $user), 201);
    }

    #[Route(path: '/comments/{id}', name: 'post_comment_delete', methods: ['DELETE'])]
    public function deleteComment(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $comment = $this->commentRepo->find($id);
        if (!$comment instanceof KnowledgeBasePostComment) {
            return new JsonResponse(['error' => 'Kommentar nicht gefunden.'], 404);
        }

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        $isAuthor = $comment->getUser()->getId() === $user->getId();

        // Admin of the team may also delete comments
        $isTeamAdmin = !$isSuperAdmin && !$isAuthor
            && in_array('ROLE_ADMIN', $user->getRoles(), true)
            && $this->isGranted(KnowledgeBaseVoter::POST_CREATE, $comment->getPost()->getTeam());

        if (!$isSuperAdmin && !$isAuthor && !$isTeamAdmin) {
            return new JsonResponse(['error' => 'Keine Berechtigung.'], 403);
        }

        $this->em->remove($comment);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SERIALIZATION HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param int[] $likedPostIds
     *
     * @return array<string, mixed>
     */
    private function serializePostCard(KnowledgeBasePost $post, array $likedPostIds): array
    {
        $mediaLinks = $post->getMediaLinks();
        // Pick the first medium that has a resolved thumbnail (detected at save time via HTTP probe).
        // Falls back to the first medium if none has a thumbnail.
        $firstMedia = $mediaLinks->filter(fn (KnowledgeBasePostMedia $m) => null !== $m->getThumbnailUrl())->first()
            ?: $mediaLinks->first();

        return [
            'id' => $post->getId(),
            'title' => $post->getTitle(),
            'isPinned' => $post->isPinned(),
            'categoryId' => $post->getCategory()->getId(),
            'category' => $post->getCategory()->getName(),
            'tags' => array_map(fn (KnowledgeBaseTag $t) => ['id' => $t->getId(), 'name' => $t->getName()], $post->getTags()->toArray()),
            'likeCount' => $post->getLikes()->count(),
            'commentCount' => $post->getComments()->count(),
            'liked' => in_array($post->getId(), $likedPostIds, true),
            'createdAt' => $post->getCreatedAt()->format('c'),
            'createdBy' => [
                'id' => $post->getCreatedBy()->getId(),
                'name' => trim($post->getCreatedBy()->getFirstName() . ' ' . $post->getCreatedBy()->getLastName()),
            ],
            // First media for card thumbnail / preview
            'primaryMedia' => $firstMedia instanceof KnowledgeBasePostMedia ? [
                'url' => $firstMedia->getUrl(),
                'mediaType' => $firstMedia->getMediaType(),
                'externalId' => $firstMedia->getExternalId(),
                'thumbnailUrl' => $firstMedia->getThumbnailUrl(),
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    private function serializePostDetail(KnowledgeBasePost $post, bool $liked, User $currentUser): array
    {
        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $currentUser->getRoles(), true);

        return [
            'id' => $post->getId(),
            'title' => $post->getTitle(),
            'description' => $post->getDescription(),
            'isPinned' => $post->isPinned(),
            'sendNotification' => $post->isSendNotification(),
            'categoryId' => $post->getCategory()->getId(),
            'category' => $post->getCategory()->getName(),
            'tags' => array_map(fn (KnowledgeBaseTag $t) => ['id' => $t->getId(), 'name' => $t->getName()], $post->getTags()->toArray()),
            'mediaLinks' => array_map(fn (KnowledgeBasePostMedia $m) => [
                'id' => $m->getId(),
                'url' => $m->getUrl(),
                'mediaType' => $m->getMediaType(),
                'externalId' => $m->getExternalId(),
                'thumbnailUrl' => $m->getThumbnailUrl(),
                'label' => $m->getLabel(),
            ], $post->getMediaLinks()->toArray()),
            'likeCount' => $post->getLikes()->count(),
            'commentCount' => $post->getComments()->count(),
            'liked' => $liked,
            'createdAt' => $post->getCreatedAt()->format('c'),
            'updatedAt' => $post->getUpdatedAt()?->format('c'),
            'createdBy' => [
                'id' => $post->getCreatedBy()->getId(),
                'name' => trim($post->getCreatedBy()->getFirstName() . ' ' . $post->getCreatedBy()->getLastName()),
            ],
            'canEdit' => $isSuperAdmin || $this->isGranted(KnowledgeBaseVoter::POST_EDIT, $post),
            'canDelete' => $isSuperAdmin || $this->isGranted(KnowledgeBaseVoter::POST_DELETE, $post),
            'canPin' => $isSuperAdmin || $this->isGranted(KnowledgeBaseVoter::POST_PIN, $post),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeCategory(KnowledgeBaseCategory $c): array
    {
        return [
            'id' => $c->getId(),
            'name' => $c->getName(),
            'icon' => $c->getIcon(),
            'sortOrder' => $c->getSortOrder(),
            'isGlobal' => $c->isGlobal(),
            'teamId' => $c->getTeam()?->getId(),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeComment(KnowledgeBasePostComment $comment, User $currentUser): array
    {
        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $currentUser->getRoles(), true);
        $isAuthor = $comment->getUser()->getId() === $currentUser->getId();

        return [
            'id' => $comment->getId(),
            'content' => $comment->getContent(),
            'createdAt' => $comment->getCreatedAt()->format('c'),
            'updatedAt' => $comment->getUpdatedAt()?->format('c'),
            'user' => [
                'id' => $comment->getUser()->getId(),
                'name' => trim($comment->getUser()->getFirstName() . ' ' . $comment->getUser()->getLastName()),
            ],
            'canDelete' => $isSuperAdmin || $isAuthor,
        ];
    }

    /**
     * Returns all Users linked to the team (via player or coach assignments),
     * excluding the given $excludeUser (typically the author).
     *
     * @return User[]
     */
    private function getTeamUsers(Team $team, User $excludeUser): array
    {
        $userIds = [];
        $users = [];

        $playerAssignments = $this->em->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->innerJoin('pta.player', 'p')
            ->innerJoin('p.userRelations', 'ur')
            ->innerJoin('ur.user', 'u')
            ->where('pta.team = :team')
            ->andWhere('u.id != :excludeId')
            ->setParameter('team', $team)
            ->setParameter('excludeId', $excludeUser->getId())
            ->select('u')
            ->getQuery()
            ->getResult();

        foreach ($playerAssignments as $u) {
            if ($u instanceof User && !in_array($u->getId(), $userIds, true)) {
                $userIds[] = $u->getId();
                $users[] = $u;
            }
        }

        $coachAssignments = $this->em->getRepository(CoachTeamAssignment::class)
            ->createQueryBuilder('cta')
            ->innerJoin('cta.coach', 'c')
            ->innerJoin('c.userRelations', 'ur')
            ->innerJoin('ur.user', 'u')
            ->where('cta.team = :team')
            ->andWhere('u.id != :excludeId')
            ->setParameter('team', $team)
            ->setParameter('excludeId', $excludeUser->getId())
            ->select('u')
            ->getQuery()
            ->getResult();

        foreach ($coachAssignments as $u) {
            if ($u instanceof User && !in_array($u->getId(), $userIds, true)) {
                $userIds[] = $u->getId();
                $users[] = $u;
            }
        }

        return $users;
    }

    /**
     * Syncs tags from an array of tag names (strings), creating new ones as needed.
     *
     * @param string[] $tagNames
     */
    private function syncTags(KnowledgeBasePost $post, array $tagNames, Team $team): void
    {
        foreach ($tagNames as $rawName) {
            $name = mb_strtolower(trim((string) $rawName));
            if ('' === $name) {
                continue;
            }

            // Find existing (global or team-specific)
            $tag = $this->tagRepo->findOneBy(['name' => $name, 'team' => null])
                ?? $this->tagRepo->findOneBy(['name' => $name, 'team' => $team]);

            if (!$tag instanceof KnowledgeBaseTag) {
                $tag = new KnowledgeBaseTag();
                $tag->setName($name);
                $tag->setTeam($team);
                $this->em->persist($tag);
            }

            $post->addTag($tag);
        }
    }
}
