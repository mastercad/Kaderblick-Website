<?php

namespace App\Controller;

use App\Entity\Club;
use App\Entity\Message;
use App\Entity\MessageGroup;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\ClubRepository;
use App\Repository\MessageRepository;
use App\Repository\NotificationRepository;
use App\Repository\TeamRepository;
use App\Security\Voter\MessageVoter;
use App\Service\BulkRecipientResolverService;
use App\Service\NotificationService;
use App\Service\UserContactService;
use Doctrine\Common\Collections\Criteria;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class MessageController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private NotificationService $notificationService,
        private NotificationRepository $notificationRepository,
        private UserContactService $userContactService,
        private BulkRecipientResolverService $bulkResolver,
        private TeamRepository $teamRepository,
        private ClubRepository $clubRepository,
        private MessageRepository $messageRepository,
    ) {
    }

    #[Route('/messages', name: 'messages_index', methods: ['GET'])]
    public function inbox(): Response
    {
        return $this->render('messages/index.html.twig');
    }

    /**
     * GET /api/messages?page=1&limit=30.
     *
     * Returns paginated thread-root inbox messages (parent IS NULL) with reply counts.
     */
    #[Route('/api/messages', name: 'api_messages_index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 30)));

        ['messages' => $roots, 'total' => $total, 'hasMore' => $hasMore] =
            $this->messageRepository->findInboxRoots($user, $page, $limit);

        $rootIds = array_map(fn (Message $m) => (int) $m->getId(), $roots);
        $replyCounts = $this->messageRepository->countRepliesForRoots($rootIds);

        return $this->json([
            'messages' => array_map(fn (Message $message) => [
                'id' => $message->getId(),
                'subject' => $message->getSubject(),
                'snippet' => $message->getSnippet(),
                'sender' => $message->getSender()->getFullName(),
                'senderId' => $message->getSender()->getId(),
                'senderIsSuperAdmin' => in_array('ROLE_SUPERADMIN', $message->getSender()->getRoles(), true),
                'sentAt' => $message->getSentAt()->format('Y-m-d H:i:s'),
                'isRead' => $message->isReadBy($user),
                'parentId' => $message->getParent()?->getId(),
                'threadId' => $message->getThread()?->getId(),
                'replyCount' => $replyCounts[(int) $message->getId()] ?? 0,
            ], $roots),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => (int) ceil($total / $limit),
                'hasMore' => $hasMore,
            ],
        ]);
    }

    #[Route('/api/messages/unread-count', name: 'api_messages_unread_count', methods: ['GET'])]
    public function unreadCount(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $messages = $this->entityManager->getRepository(Message::class)
            ->createQueryBuilder('m')
            ->select('m')
            ->where(':user MEMBER OF m.recipients')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $count = count(array_filter($messages, function (Message $message) use ($user) {
            return !$message->isReadBy($user);
        }));

        return $this->json(['count' => $count]);
    }

    #[Route('/api/messages/{id}', name: 'api_messages_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(Message $message): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $user = $this->getUser();
        if (!$this->isGranted(MessageVoter::VIEW, $message)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        if (!$message->isReadBy($user)) {
            $message->markAsRead($user);
            $this->entityManager->flush();
        }

        // Mark related message-type notifications as read so the bell/profile badge clears.
        $relatedNotifications = $this->notificationRepository->findUnreadMessageNotificationsByMessageId(
            $user,
            $message->getId()
        );
        if (!empty($relatedNotifications)) {
            $this->notificationService->markAsReadBatch($relatedNotifications);
        }

        return $this->json([
            'id' => $message->getId(),
            'subject' => $message->getSubject(),
            'content' => $message->getContent(),
            'sender' => $message->getSender()->getFullName(),
            'senderId' => $message->getSender()->getId(),
            'senderIsSuperAdmin' => in_array('ROLE_SUPERADMIN', $message->getSender()->getRoles(), true),
            'recipients' => array_map(fn (User $u) => [
                'id' => $u->getId(),
                'name' => $u->getFullName(),
            ], $message->getRecipients()->toArray()),
            'recipientLabels' => $this->buildRecipientLabels($message),
            'sentAt' => $message->getSentAt()->format('Y-m-d H:i:s'),
            'isRead' => $message->isReadBy($user),
        ]);
    }

    #[Route('/api/messages', name: 'api_messages_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $data = json_decode($request->getContent(), true);

        // Unverknüpfte User (ohne Team/Club-Zugehörigkeit, kein Superadmin) dürfen nur an Superadmins schreiben
        $myContext = $this->userContactService->collectMyTeamsAndClubs($user);
        if (!$this->isGranted('ROLE_SUPERADMIN') && empty($myContext['teamIds']) && empty($myContext['clubIds'])) {
            $recipientIds = $data['recipientIds'] ?? [];
            if (!empty($recipientIds)) {
                $recipients = $this->entityManager->getRepository(User::class)->findBy(['id' => $recipientIds]);
                foreach ($recipients as $recipient) {
                    if (!in_array('ROLE_SUPERADMIN', $recipient->getRoles(), true)) {
                        return $this->json([
                            'error' => 'Du kannst nur Nachrichten an Administratoren senden, solange dein Konto nicht mit einem Spieler oder Trainer verknüpft ist.',
                        ], 403);
                    }
                }
            }
        }

        $message = new Message();
        $message->setSender($user);
        $message->setSubject($data['subject']);
        $message->setContent($data['content']);

        if (!empty($data['parentId'])) {
            $parent = $this->entityManager->getRepository(Message::class)->find((int) $data['parentId']);
            if (null !== $parent && $this->isGranted(MessageVoter::VIEW, $parent)) {
                $message->setParent($parent);
                // Thread root = parent's thread if it exists, otherwise parent itself
                $message->setThread($parent->getThread() ?? $parent);
            }
        }

        if (!empty($data['recipientIds'])) {
            $criteria = Criteria::create()
                ->where(Criteria::expr()->in('id', $data['recipientIds']));

            $recipients = $this->entityManager->getRepository(User::class)
                ->matching($criteria);

            foreach ($recipients as $recipient) {
                $message->addRecipient($recipient);
            }

            $message->setDirectRecipientIds(array_values(array_map('intval', $data['recipientIds'])));
        }

        if (!empty($data['groupId'])) {
            $group = $this->entityManager->getRepository(MessageGroup::class)
                ->find($data['groupId']);

            if ($group) {
                foreach ($group->getMembers() as $member) {
                    $message->addRecipient($member);
                }
                $message->setGroup($group);
            }
        }

        if (!empty($data['teamTargets'])) {
            $teamIds = array_unique(array_column($data['teamTargets'], 'teamId'));
            $teams = $this->teamRepository->findBy(['id' => $teamIds]);
            $teamIndex = [];
            foreach ($teams as $team) {
                $teamIndex[$team->getId()] = $team;
            }
            foreach ($this->bulkResolver->resolveTeamTargets($data['teamTargets'], $teamIndex) as $u) {
                $message->addRecipient($u);
            }
            $message->setTeamTargets($data['teamTargets']);
        }

        if (!empty($data['clubTargets'])) {
            $clubIds = array_unique(array_column($data['clubTargets'], 'clubId'));
            $clubs = $this->clubRepository->findBy(['id' => $clubIds]);
            $clubIndex = [];
            foreach ($clubs as $club) {
                $clubIndex[$club->getId()] = $club;
            }
            foreach ($this->bulkResolver->resolveClubTargets($data['clubTargets'], $clubIndex) as $u) {
                $message->addRecipient($u);
            }
            $message->setClubTargets($data['clubTargets']);
        }

        $this->entityManager->persist($message);
        $this->entityManager->flush();

        // Sender automatically counts their own message as read (they just wrote it)
        $message->markAsRead($user);
        $this->entityManager->flush();

        // Create notifications for message recipients
        foreach ($message->getRecipients() as $recipient) {
            $this->notificationService->createMessageNotification(
                $recipient,
                $user->getFullName(),
                $message->getSubject(),
                $message->getId()
            );
        }

        return $this->json(['message' => 'Nachricht gesendet']);
    }

    /**
     * GET /api/messages/outbox?page=1&limit=30.
     *
     * Returns paginated thread-root outbox messages (parent IS NULL) with reply counts.
     */
    #[Route('/api/messages/outbox', name: 'api_messages_outbox', methods: ['GET'])]
    public function retrieveSendMessage(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 30)));

        ['messages' => $roots, 'total' => $total, 'hasMore' => $hasMore] =
            $this->messageRepository->findOutboxRoots($user, $page, $limit);

        $rootIds = array_map(fn (Message $m) => (int) $m->getId(), $roots);
        $replyCounts = $this->messageRepository->countRepliesForRoots($rootIds);

        return $this->json([
            'messages' => array_map(fn (Message $message) => [
                'id' => $message->getId(),
                'subject' => $message->getSubject(),
                'snippet' => $message->getSnippet(),
                'sender' => $message->getSender()->getFullName(),
                'sentAt' => $message->getSentAt()->format('Y-m-d H:i:s'),
                'isRead' => $message->isReadBy($user),
                'recipients' => array_map(
                    fn (User $u) => ['id' => $u->getId(), 'name' => $u->getFullName()],
                    $message->getRecipients()->toArray()
                ),
                'recipientLabels' => $this->buildRecipientLabels($message),
                'parentId' => $message->getParent()?->getId(),
                'threadId' => $message->getThread()?->getId(),
                'replyCount' => $replyCounts[(int) $message->getId()] ?? 0,
            ], $roots),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => (int) ceil($total / $limit),
                'hasMore' => $hasMore,
            ],
        ]);
    }

    /**
     * GET /api/messages/conversations?page=1&limit=30.
     *
     * Returns paginated unified conversation roots (parent IS NULL) where the user
     * is either sender OR recipient — combining inbox + outbox for the thread view.
     */
    #[Route('/api/messages/conversations', name: 'api_messages_conversations', methods: ['GET'])]
    public function conversations(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 30)));

        ['messages' => $roots, 'total' => $total, 'hasMore' => $hasMore] =
            $this->messageRepository->findConversationRoots($user, $page, $limit);

        $rootIds = array_map(fn (Message $m) => (int) $m->getId(), $roots);
        $replyCounts = $this->messageRepository->countRepliesForRoots($rootIds);
        $unreadReplyCounts = $this->messageRepository->countUnreadRepliesForRoots($user, $rootIds);

        return $this->json([
            'messages' => array_map(fn (Message $message) => [
                'id' => $message->getId(),
                'subject' => $message->getSubject(),
                'snippet' => $message->getSnippet(),
                'sender' => $message->getSender()->getFullName(),
                'senderId' => $message->getSender()->getId(),
                'senderIsSuperAdmin' => in_array('ROLE_SUPERADMIN', $message->getSender()->getRoles(), true),
                'sentAt' => $message->getSentAt()->format('Y-m-d H:i:s'),
                'isRead' => $message->isReadBy($user),
                'recipients' => array_map(
                    fn (User $u) => ['id' => $u->getId(), 'name' => $u->getFullName()],
                    $message->getRecipients()->toArray()
                ),
                'recipientLabels' => $this->buildRecipientLabels($message),
                'parentId' => $message->getParent()?->getId(),
                'threadId' => $message->getThread()?->getId(),
                'replyCount' => $replyCounts[(int) $message->getId()] ?? 0,
                'hasUnreadReplies' => $unreadReplyCounts[(int) $message->getId()] ?? false,
            ], $roots),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => (int) ceil($total / $limit),
                'hasMore' => $hasMore,
            ],
        ]);
    }

    /**
     * GET /api/messages/thread/{threadId}.
     *
     * Returns all messages in a thread (root + all replies), sorted oldest-first.
     * Access: user must be sender or recipient of the thread root.
     */
    #[Route('/api/messages/thread/{threadId}', name: 'api_messages_thread', methods: ['GET'], requirements: ['threadId' => '\d+'])]
    public function thread(int $threadId): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var User $user */
        $threadRoot = $this->messageRepository->find($threadId);
        if (!$threadRoot) {
            return $this->json(['message' => 'Nicht gefunden'], 404);
        }

        // Thread root must be an actual root (parent IS NULL)
        if (null !== $threadRoot->getParent()) {
            return $this->json(['message' => 'Nicht gefunden'], 404);
        }

        // Access control: user must be able to view the root message
        if (!$this->isGranted(MessageVoter::VIEW, $threadRoot)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $allMessages = $this->messageRepository->findThreadMessages($threadRoot);

        // Filter to only messages the user may see
        $visible = array_filter(
            $allMessages,
            fn (Message $m) => $this->isGranted(MessageVoter::VIEW, $m)
        );

        return $this->json([
            'messages' => array_values(array_map(fn (Message $message) => [
                'id' => $message->getId(),
                'subject' => $message->getSubject(),
                'snippet' => $message->getSnippet(),
                'sender' => $message->getSender()->getFullName(),
                'senderId' => $message->getSender()->getId(),
                'senderIsSuperAdmin' => in_array('ROLE_SUPERADMIN', $message->getSender()->getRoles(), true),
                'sentAt' => $message->getSentAt()->format('Y-m-d H:i:s'),
                'isRead' => $message->isReadBy($user),
                'recipients' => array_map(
                    fn (User $u) => ['id' => $u->getId(), 'name' => $u->getFullName()],
                    $message->getRecipients()->toArray()
                ),
                'parentId' => $message->getParent()?->getId(),
                'threadId' => $message->getThread()?->getId(),
            ], $visible)),
        ]);
    }

    /**
     * PATCH /api/messages/{id}/unread
     * Marks a message as unread for the currently authenticated user.
     */
    #[Route('/api/messages/{id}/unread', name: 'api_messages_mark_unread', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function markAsUnread(Message $message): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        if (!$this->isGranted(MessageVoter::VIEW, $message)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $message->markAsUnread($user);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    /**
     * PATCH /api/messages/read-all
     * Marks all inbox messages as read for the currently authenticated user.
     */
    #[Route('/api/messages/read-all', name: 'api_messages_read_all', methods: ['PATCH'])]
    public function markAllAsRead(): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        /** @var Message[] $messages */
        $messages = $this->entityManager->getRepository(Message::class)
            ->createQueryBuilder('m')
            ->where(':user MEMBER OF m.recipients')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $changed = 0;
        foreach ($messages as $message) {
            if (!$message->isReadBy($user)) {
                $message->markAsRead($user);
                ++$changed;
            }
        }

        if ($changed > 0) {
            $this->entityManager->flush();
        }

        return $this->json(['marked' => $changed]);
    }

    /**
     * DELETE /api/messages/{id}.
     *
     * Sender:    deletes the message entirely.
     * Recipient: removes themselves from the recipient list (inbox-only delete).
     */
    #[Route('/api/messages/{id}', name: 'api_messages_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        $message = $this->entityManager->getRepository(Message::class)->find($id);
        if (!$message) {
            return $this->json(['message' => 'Nicht gefunden'], 404);
        }

        if ($message->getSender() === $user) {
            // Sender deletes the whole message
            $this->entityManager->remove($message);
        } elseif ($message->getRecipients()->contains($user)) {
            // Recipient removes themselves (hides message from their inbox)
            $message->removeRecipient($user);
        } else {
            return $this->json(['message' => 'Forbidden'], 403);
        }

        $this->entityManager->flush();

        return $this->json(['message' => 'Nachricht gelöscht'], 200);
    }

    /**
     * Builds a human-readable recipient label list from the stored context.
     *
     * Returns an array of entries like:
     *   ['type' => 'team',  'label' => 'U17',              'detail' => 'Alle Mitglieder']
     *   ['type' => 'club',  'label' => 'FC Kaderblick',    'detail' => 'Nur Trainer']
     *   ['type' => 'group', 'label' => 'Trainer-Runde']
     *   ['type' => 'user',  'label' => 'Max Mustermann']
     *
     * Falls back to null when no context was stored (older messages).
     *
     * @return list<array{type: string, label: string, detail?: string}>|null
     */
    private function buildRecipientLabels(Message $message): ?array
    {
        $roleLabel = static function (string $role): string {
            return match ($role) {
                'players' => 'Nur Spieler',
                'coaches' => 'Nur Trainer',
                'parents' => 'Nur Eltern',
                default => 'Alle Mitglieder',
            };
        };

        $hasContext = null !== $message->getTeamTargets()
            || null !== $message->getClubTargets()
            || null !== $message->getGroup()
            || null !== $message->getDirectRecipientIds();

        if (!$hasContext) {
            return null;
        }

        $labels = [];
        /** @var array<int, true> tracks user IDs already added to avoid duplicates */
        $seenUserIds = [];

        foreach ($message->getTeamTargets() ?? [] as $t) {
            $teamId = (int) ($t['teamId'] ?? 0);
            $team = $teamId ? $this->teamRepository->find($teamId) : null;
            $labels[] = [
                'type' => 'team',
                'label' => $team ? $team->getName() : "Team #{$teamId}",
                'detail' => $roleLabel($t['role'] ?? 'all'),
            ];
        }

        foreach ($message->getClubTargets() ?? [] as $c) {
            $clubId = (int) ($c['clubId'] ?? 0);
            $club = $clubId ? $this->clubRepository->find($clubId) : null;
            $labels[] = [
                'type' => 'club',
                'label' => $club ? $club->getName() : "Verein #{$clubId}",
                'detail' => $roleLabel($c['role'] ?? 'all'),
            ];
        }

        if (null !== $message->getGroup()) {
            foreach ($message->getGroup()->getMembers() as $member) {
                $uid = (int) $member->getId();
                if (!isset($seenUserIds[$uid])) {
                    $seenUserIds[$uid] = true;
                    $labels[] = ['type' => 'user', 'label' => $member->getFullName()];
                }
            }
        }

        foreach ($message->getDirectRecipientIds() ?? [] as $userId) {
            $uid = (int) $userId;
            if (isset($seenUserIds[$uid])) {
                continue;
            }
            $u = $this->entityManager->getRepository(User::class)->find($uid);
            if ($u) {
                $seenUserIds[$uid] = true;
                $labels[] = ['type' => 'user', 'label' => $u->getFullName()];
            }
        }

        return $labels;
    }
}
