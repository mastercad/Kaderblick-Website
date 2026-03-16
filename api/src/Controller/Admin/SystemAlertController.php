<?php

namespace App\Controller\Admin;

use App\Repository\SystemAlertOccurrenceRepository;
use App\Repository\SystemAlertRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/superadmin/system-alerts')]
#[IsGranted('ROLE_SUPERADMIN')]
class SystemAlertController extends AbstractController
{
    public function __construct(
        private readonly SystemAlertRepository $alertRepository,
        private readonly SystemAlertOccurrenceRepository $occurrenceRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * GET /api/superadmin/system-alerts
     * Gibt alle Alerts zurück, gruppiert in open/resolved, plus Kategorie-Statistiken.
     */
    #[Route('', name: 'api_superadmin_system_alerts_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $grouped = $this->alertRepository->findGrouped();
        $stats = $this->alertRepository->countOpenByCategory();
        $total = $this->alertRepository->countOpen();

        return $this->json([
            'open' => array_map(static fn ($a) => $a->toArray(), $grouped['open']),
            'resolved' => array_map(static fn ($a) => $a->toArray(), $grouped['resolved']),
            'stats' => [
                'total' => $total,
                'byCategory' => $stats,
            ],
        ]);
    }

    /**
     * GET /api/superadmin/system-alerts/stats?period=7d|30d|24h
     * Liefert Zeitreihen-Daten für Trend-Charts und Vergleichs-Statistiken.
     */
    #[Route('/stats', name: 'api_superadmin_system_alerts_stats', methods: ['GET'])]
    public function stats(Request $request): JsonResponse
    {
        $period = $request->query->getString('period', '7d');

        [$since, $prevSince, $bucketSize] = match ($period) {
            '24h' => [
                new DateTimeImmutable('-24 hours'),
                new DateTimeImmutable('-48 hours'),
                'hour',
            ],
            '30d' => [
                new DateTimeImmutable('-30 days'),
                new DateTimeImmutable('-60 days'),
                'day',
            ],
            default => [    // '7d'
                new DateTimeImmutable('-7 days'),
                new DateTimeImmutable('-14 days'),
                'day',
            ],
        };

        $timeSeries = $this->occurrenceRepository->getTimeSeries($since, $bucketSize);
        $trends = $this->occurrenceRepository->getTrendComparison($since, $prevSince);
        $totals = $this->occurrenceRepository->countSince($since);

        // Trends anreichern: Richtung bestimmen
        $trendData = [];
        foreach ($trends as $category => $counts) {
            $current = $counts['current'];
            $previous = $counts['previous'];
            $direction = 0 === $previous
                ? ($current > 0 ? 'up' : 'neutral')
                : ($current > $previous * 1.1 ? 'up' : ($current < $previous * 0.9 ? 'down' : 'neutral'));

            $changePercent = 0 === $previous
                ? ($current > 0 ? 100 : 0)
                : (int) round(($current - $previous) / $previous * 100);

            $trendData[$category] = [
                'current' => $current,
                'previous' => $previous,
                'direction' => $direction,
                'changePercent' => $changePercent,
            ];
        }

        return $this->json([
            'period' => $period,
            'bucketSize' => $bucketSize,
            'timeSeries' => $timeSeries,
            'trends' => $trendData,
            'totals' => $totals,
        ]);
    }

    /**
     * GET /api/superadmin/system-alerts/{id}
     * Gibt einen einzelnen Alert mit allen Details zurück.
     */
    #[Route('/{id}', name: 'api_superadmin_system_alerts_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        $alert = $this->alertRepository->find($id);

        if (null === $alert) {
            return $this->json(['error' => 'Alert not found.'], 404);
        }

        return $this->json($alert->toArray());
    }

    /**
     * POST /api/superadmin/system-alerts/{id}/resolve
     * Markiert einen Alert als erledigt. Body (optional): { "note": "..." }.
     */
    #[Route('/{id}/resolve', name: 'api_superadmin_system_alerts_resolve', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function resolve(int $id, Request $request): JsonResponse
    {
        $alert = $this->alertRepository->find($id);

        if (null === $alert) {
            return $this->json(['error' => 'Alert not found.'], 404);
        }

        $data = json_decode($request->getContent(), true);
        $note = isset($data['note']) ? (string) $data['note'] : null;

        $alert->resolve($note);
        $this->entityManager->flush();

        return $this->json($alert->toArray());
    }

    /**
     * POST /api/superadmin/system-alerts/{id}/reopen
     * Öffnet einen erledigten Alert erneut.
     */
    #[Route('/{id}/reopen', name: 'api_superadmin_system_alerts_reopen', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reopen(int $id): JsonResponse
    {
        $alert = $this->alertRepository->find($id);

        if (null === $alert) {
            return $this->json(['error' => 'Alert not found.'], 404);
        }

        $alert->reopen();
        $this->entityManager->flush();

        return $this->json($alert->toArray());
    }
}
