<?php

namespace App\Controller\Api;

use App\Entity\Feedback;
use App\Entity\FeedbackComment;
use App\Entity\User;
use App\Repository\FeedbackRepository;
use App\Repository\UserRepository;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/feedback')]
class FeedbackController extends AbstractController
{
    /** @return array<string, mixed> */
    private function serializeFeedbackForUser(Feedback $feedback): array
    {
        $comments = array_map(fn (FeedbackComment $comment) => [
            'id' => $comment->getId(),
            'content' => $comment->getContent(),
            'isAdminMessage' => $comment->isAdminMessage(),
            'authorName' => $comment->isAdminMessage() ? 'Admin' : ($comment->getAuthor()?->getFullname() ?? 'Ich'),
            'createdAt' => $comment->getCreatedAt()->format('c'),
        ], $feedback->getComments()->toArray());

        $hasUnreadAdminReply = false;
        foreach ($feedback->getComments() as $comment) {
            if ($comment->isAdminMessage() && !$comment->isReadByRecipient()) {
                $hasUnreadAdminReply = true;
                break;
            }
        }

        return [
            'id' => $feedback->getId(),
            'type' => $feedback->getType(),
            'message' => $feedback->getMessage(),
            'url' => $feedback->getUrl(),
            'createdAt' => $feedback->getCreatedAt()->format('c'),
            'isRead' => $feedback->isRead(),
            'isResolved' => $feedback->isResolved(),
            'adminNote' => $feedback->getAdminNote(),
            'screenshotPath' => $feedback->getScreenshotPath(),
            'githubIssueNumber' => $feedback->getGithubIssueNumber(),
            'githubIssueUrl' => $feedback->getGithubIssueUrl(),
            'comments' => $comments,
            'hasUnreadAdminReply' => $hasUnreadAdminReply,
        ];
    }

    #[Route('/create', name: 'api_feedback_create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function create(Request $request, EntityManagerInterface $entityManager, LoggerInterface $logger): JsonResponse
    {
        try {
            /** @var User $user */
            $user = $this->getUser();

            $jsonData = json_decode($request->getContent(), true);

            $feedback = new Feedback();
            $feedback->setUser($user);
            $feedback->setType($jsonData['type']);
            $feedback->setMessage($jsonData['message']);
            $feedback->setUrl($jsonData['url']);
            $feedback->setUserAgent($jsonData['userAgent']);

            if (
                isset($jsonData['screenshot'])
                && is_string($jsonData['screenshot'])
                && str_starts_with($jsonData['screenshot'], 'data:image/png;base64,')
            ) {
                $fileName = 'feedback_' . uniqid() . '.png';
                $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/feedback';

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                $base64 = substr($jsonData['screenshot'], strlen('data:image/png;base64,'));
                $binaryData = base64_decode($base64);
                $filePath = $uploadDir . '/' . $fileName;
                if (false === file_put_contents($filePath, $binaryData)) {
                    throw new Exception('Screenshot konnte nicht gespeichert werden');
                }
                $feedback->setScreenshotPath('/uploads/feedback/' . $fileName);
            }

            $entityManager->persist($feedback);
            $entityManager->flush();

            return $this->json(['status' => 'success']);
        } catch (Exception $e) {
            $logger->critical('Feedback error: ' . $e->getMessage());

            return $this->json([
                'status' => 'error',
                'message' => 'Fehler beim Speichern des Feedbacks: ' . $e->getMessage()
            ], 500);
        }
    }

    #[Route('/my', name: 'api_feedback_my', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function my(FeedbackRepository $feedbackRepository): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json(array_map($this->serializeFeedbackForUser(...), $feedbackRepository->findByUser($user)));
    }

    #[Route('/{id}', name: 'api_feedback_show', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function show(Feedback $feedback, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if ($feedback->getUser()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Keine Berechtigung.'], 403);
        }

        // Mark unread admin comments as read when user opens detail view
        $needsFlush = false;
        foreach ($feedback->getComments() as $comment) {
            if ($comment->isAdminMessage() && !$comment->isReadByRecipient()) {
                $comment->setIsReadByRecipient(true);
                $needsFlush = true;
            }
        }
        if ($needsFlush) {
            $em->flush();
        }

        return $this->json($this->serializeFeedbackForUser($feedback));
    }

    #[Route('/{id}/comment', name: 'api_feedback_comment', requirements: ['id' => '\d+'], methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function addComment(
        Request $request,
        Feedback $feedback,
        EntityManagerInterface $em,
        NotificationService $notificationService,
        UserRepository $userRepository
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();

        if ($feedback->getUser()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Keine Berechtigung.'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $content = trim((string) ($data['content'] ?? ''));

        if ('' === $content) {
            return $this->json(['error' => 'Inhalt darf nicht leer sein.'], 400);
        }

        $comment = new FeedbackComment();
        $comment->setAuthor($user);
        $comment->setContent($content);
        $comment->setIsAdminMessage(false);

        $feedback->addComment($comment);
        $em->flush();

        // Notify all admins about the new user reply
        try {
            $userName = $user->getFullname() ?: 'Ein Nutzer';

            $typeLabel = match ($feedback->getType()) {
                'bug' => 'Bug-Meldung',
                'feature' => 'Verbesserungsvorschlag',
                'question' => 'Frage',
                default => 'Feedback',
            };

            $feedbackFirstLine = trim(explode("\n", $feedback->getMessage())[0]);
            $feedbackSubject = mb_strlen($feedbackFirstLine) > 40
                ? mb_substr($feedbackFirstLine, 0, 40) . '…'
                : $feedbackFirstLine;

            $replyFirstLine = trim(explode("\n", $content)[0]);
            $replyPreview = mb_strlen($replyFirstLine) > 120
                ? mb_substr($replyFirstLine, 0, 120) . '…'
                : $replyFirstLine;

            $title = "💬 {$userName} hat auf seine {$typeLabel} geantwortet";
            $message = "Feedback: \"{$feedbackSubject}\"\n\nAntwort: {$replyPreview}";

            $admins = $userRepository->findAdmins();
            $notificationService->createNotificationForUsers(
                $admins,
                'feedback',
                $title,
                $message,
                ['url' => '/admin/feedback/' . $feedback->getId(), 'feedbackId' => $feedback->getId()]
            );
        } catch (Throwable) {
        }

        return $this->json([
            'success' => true,
            'comment' => [
                'id' => $comment->getId(),
                'content' => $comment->getContent(),
                'isAdminMessage' => false,
                'authorName' => 'Ich',
                'createdAt' => $comment->getCreatedAt()->format('c'),
            ],
        ]);
    }
}
