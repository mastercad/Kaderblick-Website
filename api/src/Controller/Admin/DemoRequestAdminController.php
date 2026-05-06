<?php

namespace App\Controller\Admin;

use App\Entity\DemoRequest;
use App\Entity\User;
use App\Repository\DemoRequestRepository;
use App\Service\DemoProvisioningService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/demo-requests', name: 'admin_demo_requests_')]
#[IsGranted('ROLE_ADMIN')]
class DemoRequestAdminController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DemoRequestRepository $demoRequestRepository,
        private readonly DemoProvisioningService $demoProvisioningService,
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

        $qb = $this->em->getRepository(DemoRequest::class)
            ->createQueryBuilder('r')
            ->orderBy('r.createdAt', 'DESC');

        if ($requestId > 0) {
            $qb->andWhere('r.id = :requestId')->setParameter('requestId', $requestId);
        } else {
            if ('all' !== $statusFilter) {
                $qb->andWhere('r.status = :status')->setParameter('status', $statusFilter);
            }

            if ('' !== $search) {
                $qb->andWhere('r.name LIKE :search OR r.email LIKE :search OR r.clubName LIKE :search')
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
            'requests' => array_map(fn (DemoRequest $r) => $this->serialize($r), $requests),
            'counts' => [
                'pending' => $this->demoRequestRepository->count(['status' => DemoRequest::STATUS_PENDING]),
                'demo_sent' => $this->demoRequestRepository->count(['status' => DemoRequest::STATUS_DEMO_SENT]),
                'contacted' => $this->demoRequestRepository->count(['status' => DemoRequest::STATUS_CONTACTED]),
                'rejected' => $this->demoRequestRepository->count(['status' => DemoRequest::STATUS_REJECTED]),
            ],
            'total' => $total,
            'page' => $requestId > 0 ? 1 : $page,
            'limit' => $requestId > 0 ? max(1, $total) : $limit,
        ]);
    }

    #[Route('/{id}/contact', name: 'contact', methods: ['POST'])]
    public function sendDemoAccess(DemoRequest $demoRequest, Request $request): JsonResponse
    {
        if (!$demoRequest->isPending()) {
            return $this->json(['error' => 'Diese Anfrage ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        try {
            $this->demoProvisioningService->sendDemoAccess($demoRequest);
        } catch (Throwable $e) {
            return $this->json(['error' => 'Demo-Zugangsdaten konnten nicht gesendet werden. Bitte versuche es erneut.'], 500);
        }

        $demoRequest->setStatus(DemoRequest::STATUS_DEMO_SENT)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin)
            ->setAdminNote($note ?: null);

        $this->em->flush();

        return $this->json(['success' => true, 'message' => 'Demo-Zugangsdaten wurden erfolgreich an ' . $demoRequest->getEmail() . ' gesendet.']);
    }

    #[Route('/{id}/reject', name: 'reject', methods: ['POST'])]
    public function reject(DemoRequest $demoRequest, Request $request): JsonResponse
    {
        if (!$demoRequest->isPending()) {
            return $this->json(['error' => 'Diese Anfrage ist nicht mehr offen.'], 409);
        }

        /** @var User $admin */
        $admin = $this->getUser();
        $data = json_decode($request->getContent(), true);
        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        $demoRequest->setStatus(DemoRequest::STATUS_REJECTED)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin)
            ->setAdminNote($note ?: null);

        $this->em->flush();

        return $this->json(['success' => true, 'message' => 'Anfrage abgelehnt.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(DemoRequest $request): array
    {
        return [
            'id' => $request->getId(),
            'name' => $request->getName(),
            'email' => $request->getEmail(),
            'clubName' => $request->getClubName(),
            'league' => $request->getLeague(),
            'ageGroup' => $request->getAgeGroup(),
            'phone' => $request->getPhone(),
            'message' => $request->getMessage(),
            'status' => $request->getStatus(),
            'adminNote' => $request->getAdminNote(),
            'createdAt' => $request->getCreatedAt()->format('d.m.Y H:i'),
            'processedAt' => $request->getProcessedAt()?->format('d.m.Y H:i'),
            'processedBy' => $request->getProcessedBy() ? [
                'id' => $request->getProcessedBy()->getId(),
                'name' => $request->getProcessedBy()->getFullName(),
            ] : null,
        ];
    }
}
