<?php

namespace App\Controller\Admin;

use App\Entity\DemoInstance;
use App\Entity\DemoRequest;
use App\Entity\User;
use App\Repository\DemoInstanceRepository;
use App\Repository\DemoRequestRepository;
use App\Service\DemoProvisioningService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/demo-requests', name: 'admin_demo_requests_')]
#[IsGranted('ROLE_ADMIN')]
class DemoRequestAdminController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DemoRequestRepository $demoRequestRepository,
        private readonly DemoInstanceRepository $demoInstanceRepository,
        private readonly DemoProvisioningService $demoProvisioningService,
        private readonly string $githubToken,
        private readonly string $githubRepoOwner,
        private readonly string $githubRepoName,
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

        $demoRequest->setStatus(DemoRequest::STATUS_PROVISIONING)
            ->setProcessedAt(new DateTime())
            ->setProcessedBy($admin)
            ->setAdminNote($note ?: null);

        $this->em->flush();

        return $this->json(['success' => true, 'message' => 'Demo-Instanz wird provisioniert. Der Anfragende erhält eine E-Mail, sobald die Instanz bereit ist.']);
    }

    #[Route('/{id}/revoke', name: 'revoke', methods: ['POST'])]
    public function revoke(DemoRequest $demoRequest): JsonResponse
    {
        $instance = $this->demoInstanceRepository->findOneBy(['demoRequest' => $demoRequest]);

        if (!$instance instanceof DemoInstance || !$instance->isActive()) {
            return $this->json(['error' => 'Keine aktive Demo-Instanz für diese Anfrage vorhanden.'], 409);
        }

        try {
            $this->dispatchTeardownWorkflow($instance->getDemoToken(), (string) $demoRequest->getId());
        } catch (Throwable $e) {
            return $this->json(['error' => 'Teardown-Workflow konnte nicht ausgelöst werden. Bitte versuche es erneut.'], 500);
        }

        $demoRequest->setStatus(DemoRequest::STATUS_REVOKING);
        $instance->setStatus(DemoInstance::STATUS_REVOKED);
        $this->em->flush();

        return $this->json(['success' => true, 'message' => 'Demo-Instanz wird abgebaut.']);
    }

    private function dispatchTeardownWorkflow(string $demoToken, string $requestId): void
    {
        $url = sprintf(
            'https://api.github.com/repos/%s/%s/actions/workflows/teardown-demo-instance.yml/dispatches',
            $this->githubRepoOwner,
            $this->githubRepoName
        );

        $payload = json_encode([
            'ref' => 'main',
            'inputs' => [
                'demo_token' => $demoToken,
                'request_id' => $requestId,
                'teardown_alfahosting' => 'true',
                'teardown_hetzner' => 'false',
            ],
        ]);

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", [
                    'Authorization: Bearer ' . $this->githubToken,
                    'Accept: application/vnd.github+json',
                    'X-GitHub-Api-Version: 2022-11-28',
                    'Content-Type: application/json',
                    'User-Agent: kaderblick-backend',
                ]),
                'content' => $payload,
                'ignore_errors' => true,
            ],
        ]);

        file_get_contents($url, false, $context);
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
