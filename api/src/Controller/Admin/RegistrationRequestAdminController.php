<?php

namespace App\Controller\Admin;

use App\Entity\RegistrationRequest;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\RegistrationRequestRepository;
use App\Service\RegistrationNotificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/registration-requests', name: 'admin_registration_requests_')]
#[IsGranted('ROLE_SUPERADMIN')]
class RegistrationRequestAdminController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private RegistrationRequestRepository $requestRepository,
        private RegistrationNotificationService $notificationService
    ) {
    }

    /**
     * List registration requests with server-side pagination and optional status filter.
     *
     * Query params:
     *   status  – "pending" | "approved" | "rejected" | "all"  (default: "pending")
     *   page    – 1-based page number                           (default: 1)
     *   limit   – rows per page, clamped to [5, 100]           (default: 25)
     */
    #[Route('', name: 'index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $statusFilter = $request->query->get('status', 'pending');
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(5, (int) $request->query->get('limit', 25)));
        $offset = ($page - 1) * $limit;
        $search = trim((string) $request->query->get('search', ''));

        $qb = $this->em->getRepository(RegistrationRequest::class)
            ->createQueryBuilder('r')
            ->join('r.user', 'u')
            ->orderBy('r.createdAt', 'DESC');

        if ('all' !== $statusFilter) {
            $qb->andWhere('r.status = :status')->setParameter('status', $statusFilter);
        }

        if ('' !== $search) {
            $qb->andWhere('u.firstName LIKE :search OR u.lastName LIKE :search OR u.email LIKE :search')
               ->setParameter('search', '%' . $search . '%');
        }

        // Count before slicing
        $total = (int) (clone $qb)->select('COUNT(r.id)')->getQuery()->getSingleScalarResult();

        // Paginated result
        $requests = $qb
            ->select('r')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        return $this->json([
            'requests' => array_map(fn (RegistrationRequest $r) => $this->serialize($r), $requests),
            'counts' => [
                'pending' => $this->requestRepository->count(['status' => RegistrationRequest::STATUS_PENDING]),
                'approved' => $this->requestRepository->count(['status' => RegistrationRequest::STATUS_APPROVED]),
                'rejected' => $this->requestRepository->count(['status' => RegistrationRequest::STATUS_REJECTED]),
            ],
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
        ]);
    }

    /**
     * Approve a request → create UserRelation + mark as approved.
     */
    #[Route('/{id}/approve', name: 'approve', methods: ['POST'])]
    public function approve(RegistrationRequest $registrationRequest): JsonResponse
    {
        if (!$registrationRequest->isPending()) {
            return $this->json(['error' => 'Dieser Antrag ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();

        // Create the actual UserRelation
        $userRelation = new UserRelation();
        $userRelation->setUser($registrationRequest->getUser())
            ->setRelationType($registrationRequest->getRelationType())
            ->setPermissions([]);

        if ($registrationRequest->getPlayer()) {
            $userRelation->setPlayer($registrationRequest->getPlayer());
        } elseif ($registrationRequest->getCoach()) {
            $userRelation->setCoach($registrationRequest->getCoach());
        }

        $this->em->persist($userRelation);

        // Mark request as approved
        $registrationRequest->setStatus(RegistrationRequest::STATUS_APPROVED)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin);

        $this->em->flush();

        // Notify the requesting user about the approval
        try {
            $this->notificationService->notifyUserAboutApprovedRequest($registrationRequest);
        } catch (Throwable) {
            // Non-critical
        }

        return $this->json([
            'success' => true,
            'message' => 'Antrag wurde genehmigt und die Benutzerverknüpfung wurde erstellt.',
            'userRelationId' => $userRelation->getId(),
        ]);
    }

    /**
     * Reject a request.
     */
    #[Route('/{id}/reject', name: 'reject', methods: ['POST'])]
    public function reject(RegistrationRequest $registrationRequest, Request $request): JsonResponse
    {
        if (!$registrationRequest->isPending()) {
            return $this->json(['error' => 'Dieser Antrag ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();

        $data = json_decode($request->getContent(), true);
        $reason = $data['reason'] ?? null;

        $registrationRequest->setStatus(RegistrationRequest::STATUS_REJECTED)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin)
            ->setNote($reason ? ($registrationRequest->getNote() . "\n[Ablehnungsgrund: {$reason}]") : $registrationRequest->getNote());

        $this->em->flush();

        return $this->json([
            'success' => true,
            'message' => 'Antrag wurde abgelehnt.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(RegistrationRequest $r): array
    {
        $entityType = null;
        $entityId = null;
        $entityName = null;

        if ($r->getPlayer()) {
            $entityType = 'player';
            $entityId = $r->getPlayer()->getId();
            $entityName = $r->getPlayer()->getFullName();
        } elseif ($r->getCoach()) {
            $entityType = 'coach';
            $entityId = $r->getCoach()->getId();
            $entityName = $r->getCoach()->getFullName();
        }

        return [
            'id' => $r->getId(),
            'status' => $r->getStatus(),
            'note' => $r->getNote(),
            'createdAt' => $r->getCreatedAt()->format('d.m.Y H:i'),
            'processedAt' => $r->getProcessedAt()?->format('d.m.Y H:i'),
            'processedBy' => $r->getProcessedBy() ? ['id' => $r->getProcessedBy()->getId(), 'name' => $r->getProcessedBy()->getFullName()] : null,
            'user' => [
                'id' => $r->getUser()->getId(),
                'fullName' => $r->getUser()->getFullName(),
                'email' => $r->getUser()->getEmail(),
            ],
            'entityType' => $entityType,
            'entityId' => $entityId,
            'entityName' => $entityName,
            'relationType' => [
                'id' => $r->getRelationType()->getId(),
                'name' => $r->getRelationType()->getName(),
                'identifier' => $r->getRelationType()->getIdentifier(),
                'category' => $r->getRelationType()->getCategory(),
            ],
        ];
    }
}
