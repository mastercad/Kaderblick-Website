<?php

namespace App\Controller\Admin;

use App\Entity\SupporterRequest;
use App\Entity\User;
use App\Repository\SupporterRequestRepository;
use App\Service\SupporterRequestNotificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/supporter-requests', name: 'admin_supporter_requests_')]
#[IsGranted('ROLE_ADMIN')]
class SupporterRequestAdminController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private SupporterRequestRepository $supporterRequestRepository,
        private SupporterRequestNotificationService $notificationService
    ) {
    }

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $statusFilter = (string) $request->query->get('status', 'pending');
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(5, (int) $request->query->get('limit', 25)));
        $offset = ($page - 1) * $limit;
        $search = trim((string) $request->query->get('search', ''));
        $requestId = (int) $request->query->get('requestId', 0);

        $qb = $this->em->getRepository(SupporterRequest::class)
            ->createQueryBuilder('r')
            ->join('r.user', 'u')
            ->orderBy('r.createdAt', 'DESC');

        if ($requestId > 0) {
            $qb->andWhere('r.id = :requestId')->setParameter('requestId', $requestId);
        } else {
            if ('all' !== $statusFilter) {
                $qb->andWhere('r.status = :status')->setParameter('status', $statusFilter);
            }

            if ('' !== $search) {
                $qb->andWhere('u.firstName LIKE :search OR u.lastName LIKE :search OR u.email LIKE :search')
                    ->setParameter('search', '%' . $search . '%');
            }
        }

        $total = (int) (clone $qb)->select('COUNT(r.id)')->getQuery()->getSingleScalarResult();

        $requests = $qb
            ->select('r')
            ->setFirstResult($requestId > 0 ? 0 : $offset)
            ->setMaxResults($requestId > 0 ? 1 : $limit)
            ->getQuery()
            ->getResult();

        return $this->json([
            'requests' => array_map(fn (SupporterRequest $r) => $this->serialize($r), $requests),
            'counts' => [
                'pending' => $this->supporterRequestRepository->count(['status' => SupporterRequest::STATUS_PENDING]),
                'approved' => $this->supporterRequestRepository->count(['status' => SupporterRequest::STATUS_APPROVED]),
                'rejected' => $this->supporterRequestRepository->count(['status' => SupporterRequest::STATUS_REJECTED]),
            ],
            'total' => $total,
            'page' => $requestId > 0 ? 1 : $page,
            'limit' => $requestId > 0 ? max(1, $total) : $limit,
        ]);
    }

    #[Route('/{id}/approve', name: 'approve', methods: ['POST'])]
    public function approve(SupporterRequest $supporterRequest): JsonResponse
    {
        if (!$supporterRequest->isPending()) {
            return $this->json(['error' => 'Diese Anfrage ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();
        $user = $supporterRequest->getUser();
        $user->addRole('ROLE_SUPPORTER');

        $supporterRequest->setStatus(SupporterRequest::STATUS_APPROVED)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin);

        $this->em->flush();

        try {
            $this->notificationService->notifyUserAboutApprovedRequest($supporterRequest);
        } catch (Throwable) {
        }

        return $this->json([
            'success' => true,
            'message' => 'Supporter-Anfrage wurde genehmigt und die Rolle wurde vergeben.',
        ]);
    }

    #[Route('/{id}/reject', name: 'reject', methods: ['POST'])]
    public function reject(SupporterRequest $supporterRequest, Request $request): JsonResponse
    {
        if (!$supporterRequest->isPending()) {
            return $this->json(['error' => 'Diese Anfrage ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $reason = isset($data['reason']) ? trim((string) $data['reason']) : null;

        $supporterRequest->setStatus(SupporterRequest::STATUS_REJECTED)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin)
            ->setNote(
                $reason ?
                    ($supporterRequest->getNote() ? $supporterRequest->getNote() . "\n\nAblehnungsgrund: " . $reason :
                'Ablehnungsgrund: ' . $reason) : $supporterRequest->getNote()
            );

        $this->em->flush();

        try {
            $this->notificationService->notifyUserAboutRejectedRequest($supporterRequest, $reason);
        } catch (Throwable) {
        }

        return $this->json([
            'success' => true,
            'message' => 'Supporter-Anfrage wurde abgelehnt.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(SupporterRequest $request): array
    {
        return [
            'id' => $request->getId(),
            'status' => $request->getStatus(),
            'note' => $request->getNote(),
            'createdAt' => $request->getCreatedAt()->format('d.m.Y H:i'),
            'processedAt' => $request->getProcessedAt()?->format('d.m.Y H:i'),
            'processedBy' => $request->getProcessedBy() ? [
                'id' => $request->getProcessedBy()->getId(),
                'name' => $request->getProcessedBy()->getFullName(),
            ] : null,
            'user' => [
                'id' => $request->getUser()->getId(),
                'fullName' => $request->getUser()->getFullName(),
                'email' => $request->getUser()->getEmail(),
            ],
        ];
    }
}
