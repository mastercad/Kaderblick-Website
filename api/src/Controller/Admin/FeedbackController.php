<?php

namespace App\Controller\Admin;

use App\Entity\Feedback;
use App\Entity\FeedbackComment;
use App\Entity\GithubIssueState;
use App\Entity\User;
use App\Repository\FeedbackRepository;
use App\Repository\GithubIssueStateRepository;
use App\Service\GithubService;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/feedback')]
#[IsGranted('ROLE_SUPERADMIN')]
class FeedbackController extends AbstractController
{
    /** @return array<string, mixed> */
    private function serializeComment(FeedbackComment $comment): array
    {
        return [
            'id' => $comment->getId(),
            'content' => $comment->getContent(),
            'isAdminMessage' => $comment->isAdminMessage(),
            'authorName' => $comment->getAuthor()?->getFullname() ?? 'Admin',
            'createdAt' => $comment->getCreatedAt()->format('c'),
            'isReadByRecipient' => $comment->isReadByRecipient(),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeFeedback(Feedback $feedback): array
    {
        return [
            'id' => $feedback->getId(),
            'source' => 'feedback',
            'userId' => $feedback->getUser()->getId(),
            'userName' => $feedback->getUser()->getFullname(),
            'type' => $feedback->getType(),
            'title' => null,
            'message' => $feedback->getMessage(),
            'url' => $feedback->getUrl(),
            'userAgent' => $feedback->getUserAgent(),
            'createdAt' => $feedback->getCreatedAt()->format('c'),
            'isRead' => $feedback->isRead(),
            'isResolved' => $feedback->isResolved(),
            'adminNote' => $feedback->getAdminNote(),
            'screenshotPath' => $feedback->getScreenshotPath(),
            'githubIssueNumber' => $feedback->getGithubIssueNumber(),
            'githubIssueUrl' => $feedback->getGithubIssueUrl(),
            'comments' => array_map($this->serializeComment(...), $feedback->getComments()->toArray()),
            'hasUnreadUserReplies' => $feedback->hasUnreadUserReplies(),
        ];
    }

    /**
     * @param array<string, mixed> $issue
     *
     * @return array<string, mixed>
     */
    private function serializeGithubIssue(array $issue, bool $isRead, bool $isResolved, ?string $adminNote): array
    {
        return [
            'id' => -$issue['number'],
            'source' => 'github',
            'userId' => null,
            'userName' => $issue['user']['login'] ?? 'GitHub',
            'type' => 'github',
            'title' => $issue['title'],
            'message' => $issue['body'] ?? '',
            'url' => $issue['html_url'],
            'userAgent' => null,
            'createdAt' => $issue['created_at'],
            'isRead' => $isRead,
            'isResolved' => $isResolved,
            'adminNote' => $adminNote,
            'screenshotPath' => null,
            'githubIssueNumber' => $issue['number'],
            'githubIssueUrl' => $issue['html_url'],
        ];
    }

    #[Route('/', name: 'admin_feedback_index', methods: ['GET'])]
    public function index(
        FeedbackRepository $feedbackRepository,
        GithubIssueStateRepository $githubStateRepo,
        GithubService $githubService
    ): Response {
        $unresolved = array_map($this->serializeFeedback(...), $feedbackRepository->findUnresolved());
        $read = array_map($this->serializeFeedback(...), $feedbackRepository->findByIsReadAndUnresolved());
        $resolved = array_map($this->serializeFeedback(...), $feedbackRepository->findByResolved());

        // Issue numbers already linked to a platform feedback entry
        $linkedNumbers = array_filter(
            array_map(fn (array $f) => $f['githubIssueNumber'], array_merge($unresolved, $read, $resolved))
        );

        // Merge orphan GitHub issues into the respective bucket
        try {
            $ghIssues = $githubService->retrieveIssues('all');
            $stateMap = $githubStateRepo->findAllKeyedByNumber();

            foreach ($ghIssues as $issue) {
                if (isset($issue['pull_request'])) {
                    continue;
                }
                if (in_array($issue['number'], $linkedNumbers, true)) {
                    continue;
                }

                $state = $stateMap[$issue['number']] ?? null;
                $isResolved = 'closed' === $issue['state'];
                $isRead = $state?->isRead() ?? false;
                $adminNote = $state?->getAdminNote();

                $serialized = $this->serializeGithubIssue($issue, $isRead, $isResolved, $adminNote);

                if ($isResolved) {
                    $resolved[] = $serialized;
                } elseif ($isRead) {
                    $read[] = $serialized;
                } else {
                    $unresolved[] = $serialized;
                }
            }
        } catch (Throwable) {
            // GitHub unavailable – show platform feedback only
        }

        return $this->json([
            'unresolved' => $unresolved,
            'read' => $read,
            'resolved' => $resolved,
            'statistics' => $feedbackRepository->fetchTypeStatistics(),
        ]);
    }

    #[Route('/{id}', name: 'admin_feedback_show', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(Feedback $feedback): Response
    {
        return $this->json($this->serializeFeedback($feedback));
    }

    #[Route('/{id}/mark-read', name: 'admin_feedback_mark_read', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function markRead(Feedback $feedback, EntityManagerInterface $entityManager): Response
    {
        $feedback->setIsRead(true);
        $entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/{id}/comment', name: 'admin_feedback_comment', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function addComment(
        Request $request,
        Feedback $feedback,
        EntityManagerInterface $em,
        NotificationService $notificationService,
        GithubService $githubService
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];
        $content = trim((string) ($data['content'] ?? ''));

        if ('' === $content) {
            return $this->json(['error' => 'Content darf nicht leer sein.'], 400);
        }

        /** @var User $admin */
        $admin = $this->getUser();

        $comment = new FeedbackComment();
        $comment->setAuthor($admin);
        $comment->setContent($content);
        $comment->setIsAdminMessage(true);

        $feedback->addComment($comment);
        $feedback->setIsRead(true); // also move to "In Bearbeitung" automatically
        $em->flush();

        // Mark previous user-written comments as read by admin
        foreach ($feedback->getComments() as $c) {
            if (!$c->isAdminMessage() && !$c->isReadByRecipient()) {
                $c->setIsReadByRecipient(true);
            }
        }
        $em->flush();

        // If linked to a GitHub issue, also post the comment there
        if (null !== $feedback->getGithubIssueNumber()) {
            try {
                $githubService->addComment(
                    $feedback->getGithubIssueNumber(),
                    "**Admin-Antwort (Kaderblick):**\n\n" . $content
                );
            } catch (Throwable) {
            }
        }

        // Create in-app notification (saves to DB for history + sends push)
        try {
            $adminName = $admin->getFullname() ?: 'Admin';

            $typeLabel = match ($feedback->getType()) {
                'bug' => 'Bug-Meldung',
                'feature' => 'Verbesserungsvorschlag',
                'question' => 'Frage',
                default => 'Feedback',
            };

            // Subject line: first line of original feedback (max 40 chars)
            $feedbackFirstLine = trim(explode("\n", $feedback->getMessage())[0]);
            $feedbackSubject = mb_strlen($feedbackFirstLine) > 40
                ? mb_substr($feedbackFirstLine, 0, 40) . '…'
                : $feedbackFirstLine;

            // Preview of the reply: first line, max 120 chars
            $replyFirstLine = trim(explode("\n", $content)[0]);
            $replyPreview = mb_strlen($replyFirstLine) > 120
                ? mb_substr($replyFirstLine, 0, 120) . '…'
                : $replyFirstLine;

            $title = "💬 {$adminName} hat auf deine {$typeLabel} geantwortet";
            $message = "Dein Feedback: \"{$feedbackSubject}\"\n\nAntwort: {$replyPreview}";

            $notificationService->createNotification(
                $feedback->getUser(),
                'feedback',
                $title,
                $message,
                ['url' => '/mein-feedback/' . $feedback->getId(), 'feedbackId' => $feedback->getId()]
            );
        } catch (Throwable) {
        }

        return $this->json([
            'success' => true,
            'comment' => $this->serializeComment($comment),
            'feedback' => $this->serializeFeedback($feedback),
        ]);
    }

    #[Route('/{id}/mark-user-replies-read', name: 'admin_feedback_mark_user_replies_read', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function markUserRepliesRead(Feedback $feedback, EntityManagerInterface $em): Response
    {
        foreach ($feedback->getComments() as $comment) {
            if (!$comment->isAdminMessage() && !$comment->isReadByRecipient()) {
                $comment->setIsReadByRecipient(true);
            }
        }
        $em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/{id}/resolve', name: 'admin_feedback_resolve', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function resolve(
        Request $request,
        Feedback $feedback,
        EntityManagerInterface $entityManager,
        GithubService $githubService
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];

        $feedback->setResolved(true);
        $feedback->setIsRead(true);
        $feedback->setAdminNote($data['adminNote'] ?? null);
        $entityManager->flush();

        // If linked to a GitHub issue, post a status comment and close it
        if (null !== $feedback->getGithubIssueNumber()) {
            try {
                $comment = '**Status: Erledigt ✅**';
                if (!empty($data['adminNote'])) {
                    $comment .= "\n\n> " . $data['adminNote'];
                }
                $githubService->addComment($feedback->getGithubIssueNumber(), $comment);
                $githubService->closeIssue($feedback->getGithubIssueNumber());
            } catch (Throwable) {
            }
        }

        return $this->json(['success' => true, 'feedback' => $this->serializeFeedback($feedback)]);
    }

    #[Route('/{id}/reopen', name: 'admin_feedback_reopen', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function reopen(
        Feedback $feedback,
        EntityManagerInterface $entityManager,
        GithubService $githubService
    ): Response {
        $feedback->setResolved(false);
        $feedback->setIsRead(true);
        $entityManager->flush();

        // Reopen linked GitHub issue
        if (null !== $feedback->getGithubIssueNumber()) {
            try {
                $githubService->addComment($feedback->getGithubIssueNumber(), '**Status:** Wieder geöffnet – wird erneut bearbeitet. 🔄');
                $githubService->reopenIssue($feedback->getGithubIssueNumber());
            } catch (Throwable) {
            }
        }

        return $this->json(['success' => true, 'feedback' => $this->serializeFeedback($feedback)]);
    }

    #[Route('/{id}/create-github-issue', name: 'admin_feedback_create_github_issue', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function createGithubIssue(
        Request $request,
        Feedback $feedback,
        EntityManagerInterface $entityManager,
        GithubService $githubService
    ): Response {
        if (null !== $feedback->getGithubIssueNumber()) {
            return $this->json([
                'success' => true,
                'issueNumber' => $feedback->getGithubIssueNumber(),
                'issueUrl' => $feedback->getGithubIssueUrl(),
                'alreadyExisted' => true,
            ]);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $title = $data['title'] ?? sprintf('[Feedback] %s', mb_substr($feedback->getMessage(), 0, 80));
        $labels = match ($feedback->getType()) {
            'bug' => ['bug'],
            'feature' => ['enhancement'],
            default => [],
        };

        $body = "**Feedback von:** {$feedback->getUser()->getFullname()}\n\n";
        $body .= "**Typ:** {$feedback->getType()}\n";
        $body .= "**Datum:** {$feedback->getCreatedAt()->format('d.m.Y H:i')}\n";
        $body .= "**URL:** {$feedback->getUrl()}\n\n";
        $body .= "---\n\n{$feedback->getMessage()}";

        $issue = $githubService->createIssue($title, $body, $labels);

        $feedback->setGithubIssueNumber($issue['number']);
        $feedback->setGithubIssueUrl($issue['html_url']);
        $entityManager->flush();

        return $this->json([
            'success' => true,
            'issueNumber' => $issue['number'],
            'issueUrl' => $issue['html_url'],
        ]);
    }

    /* ─── Orphan GitHub issue actions (not linked to a Feedback entity) ─── */

    /** @return array<string, mixed> */
    private function buildGithubIssuePayload(
        int $number,
        GithubService $githubService,
        GithubIssueStateRepository $stateRepo
    ): array {
        $issue = $githubService->getIssue($number);
        $ghComments = $githubService->getIssueComments($number);
        $state = $stateRepo->find($number);

        return [
            'number' => $number,
            'title' => $issue['title'],
            'body' => $issue['body'] ?? '',
            'state' => $issue['state'],
            'htmlUrl' => $issue['html_url'],
            'createdAt' => $issue['created_at'],
            'userName' => $issue['user']['login'] ?? 'unknown',
            'isRead' => $state?->isRead() ?? false,
            'isResolved' => 'closed' === $issue['state'],
            'adminNote' => $state?->getAdminNote(),
            'comments' => array_map(fn (array $c) => [
                'id' => $c['id'],
                'body' => $c['body'] ?? '',
                'userName' => $c['user']['login'] ?? 'unknown',
                'createdAt' => $c['created_at'],
            ], $ghComments),
        ];
    }

    #[Route('/github-issue/{number}', name: 'admin_github_issue_show', requirements: ['number' => '\d+'], methods: ['GET'])]
    public function showGithubIssue(
        int $number,
        GithubService $githubService,
        GithubIssueStateRepository $stateRepo
    ): Response {
        try {
            return $this->json($this->buildGithubIssuePayload($number, $githubService, $stateRepo));
        } catch (Throwable) {
            return $this->json(['error' => 'GitHub nicht erreichbar.'], 503);
        }
    }

    #[Route('/github-issue/{number}/comment', name: 'admin_github_issue_comment', requirements: ['number' => '\d+'], methods: ['POST'])]
    public function addGithubIssueComment(
        Request $request,
        int $number,
        EntityManagerInterface $em,
        GithubService $githubService,
        GithubIssueStateRepository $stateRepo
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];
        $content = trim((string) ($data['content'] ?? ''));

        if ('' === $content) {
            return $this->json(['error' => 'Content darf nicht leer sein.'], 400);
        }

        try {
            $githubService->addComment($number, $content);
        } catch (Throwable) {
            return $this->json(['error' => 'GitHub nicht erreichbar.'], 503);
        }

        // Mark as read (In Bearbeitung)
        $state = $stateRepo->find($number);
        if (!$state) {
            $state = new GithubIssueState();
            $state->setIssueNumber($number);
            $em->persist($state);
        }
        $state->setIsRead(true);
        $em->flush();

        try {
            return $this->json([
                'success' => true,
                'issue' => $this->buildGithubIssuePayload($number, $githubService, $stateRepo),
            ]);
        } catch (Throwable) {
            return $this->json(['success' => true]);
        }
    }

    #[Route('/github-issue/{number}/mark-read', name: 'admin_github_issue_mark_read', requirements: ['number' => '\d+'], methods: ['POST'])]
    public function markGithubIssueRead(
        int $number,
        EntityManagerInterface $em,
        GithubIssueStateRepository $stateRepo,
        GithubService $githubService
    ): Response {
        $state = $stateRepo->find($number);
        if (!$state) {
            $state = new GithubIssueState();
            $state->setIssueNumber($number);
            $em->persist($state);
        }
        $state->setIsRead(true);
        $em->flush();

        try {
            $githubService->addComment($number, '**Status:** In Bearbeitung – wird im Kaderblick-System bearbeitet. 🔧');
        } catch (Throwable) {
        }

        return $this->json(['success' => true]);
    }

    #[Route('/github-issue/{number}/resolve', name: 'admin_github_issue_resolve', requirements: ['number' => '\d+'], methods: ['POST'])]
    public function resolveGithubIssue(
        Request $request,
        int $number,
        EntityManagerInterface $em,
        GithubIssueStateRepository $stateRepo,
        GithubService $githubService
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];
        $note = $data['adminNote'] ?? null;

        $state = $stateRepo->find($number);
        if (!$state) {
            $state = new GithubIssueState();
            $state->setIssueNumber($number);
            $em->persist($state);
        }
        $state->setIsRead(true);
        $state->setAdminNote($note);
        $em->flush();

        try {
            $comment = '**Status: Erledigt ✅**';
            if ($note) {
                $comment .= "\n\n> $note";
            }
            $githubService->addComment($number, $comment);
            $githubService->closeIssue($number);
        } catch (Throwable) {
        }

        return $this->json(['success' => true]);
    }

    #[Route('/github-issue/{number}/reopen', name: 'admin_github_issue_reopen', requirements: ['number' => '\d+'], methods: ['POST'])]
    public function reopenGithubIssue(
        int $number,
        EntityManagerInterface $em,
        GithubIssueStateRepository $stateRepo,
        GithubService $githubService
    ): Response {
        $state = $stateRepo->find($number);
        if ($state) {
            $state->setIsRead(false);
            $state->setAdminNote(null);
            $em->flush();
        }

        try {
            $githubService->addComment($number, '**Status:** Wieder geöffnet – wird erneut bearbeitet. 🔄');
            $githubService->reopenIssue($number);
        } catch (Throwable) {
        }

        return $this->json(['success' => true]);
    }
}
