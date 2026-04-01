<?php

namespace App\Controller\Api;

use App\Entity\SupporterRequest;
use App\Entity\User;
use App\Repository\SupporterRequestRepository;
use App\Service\SupporterRequestNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/supporter-request', name: 'api_supporter_request_')]
class SupporterRequestController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private SupporterRequestNotificationService $notificationService,
        private SupporterRequestRepository $supporterRequestRepository
    ) {
    }

    #[Route('', name: 'submit', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function submit(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (in_array('ROLE_SUPPORTER', $user->getRoles(), true)) {
            return $this->json(['error' => 'Du hast bereits Supporter-Rechte.'], 409);
        }

        $existing = $this->supporterRequestRepository->findOneByUserPending($user->getId());
        if ($existing) {
            return $this->json([
                'error' => 'Du hast bereits eine offene Supporter-Anfrage. Bitte warte auf die Bearbeitung durch einen Administrator.'
            ], 409);
        }

        $data = json_decode($request->getContent(), true);
        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        $supporterRequest = new SupporterRequest();
        $supporterRequest->setUser($user)
            ->setNote($note ?: null);

        $this->em->persist($supporterRequest);
        $this->em->flush();

        try {
            $this->notificationService->notifyAdminsAboutNewRequest($supporterRequest);
        } catch (Throwable) {
        }

        return $this->json([
            'message' => 'Deine Supporter-Anfrage wurde erfolgreich eingereicht.',
            'request' => $this->serializeRequest($supporterRequest),
        ], 201);
    }

    #[Route('/mine', name: 'mine', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function mine(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'request' => ($request = $this->supporterRequestRepository->findOneByUserPending($user->getId()))
                ? $this->serializeRequest($request)
                : null,
            'hasSupporterRole' => in_array('ROLE_SUPPORTER', $user->getRoles(), true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRequest(SupporterRequest $request): array
    {
        return [
            'id' => $request->getId(),
            'status' => $request->getStatus(),
            'note' => $request->getNote(),
            'createdAt' => $request->getCreatedAt()->format('d.m.Y H:i'),
            'processedAt' => $request->getProcessedAt()?->format('d.m.Y H:i'),
        ];
    }
}
