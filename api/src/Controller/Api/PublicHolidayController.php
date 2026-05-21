<?php

namespace App\Controller\Api;

use App\Service\PublicHolidayService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/holidays', name: 'api_holidays_')]
class PublicHolidayController extends AbstractController
{
    /** Erlaubte Bundesland-Codes laut feiertage-api.de */
    private const VALID_STATE_CODES = [
        'NATIONAL', 'BW', 'BY', 'BE', 'BB', 'HB', 'HH',
        'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
    ];

    public function __construct(
        private readonly PublicHolidayService $publicHolidayService,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $year = (int) $request->query->get('year', (int) date('Y'));
        $stateCode = strtoupper((string) $request->query->get('state', 'NATIONAL'));

        if ($year < 1990 || $year > 2100) {
            return $this->json(['error' => 'Invalid year'], 400);
        }

        if (!in_array($stateCode, self::VALID_STATE_CODES, true)) {
            return $this->json(['error' => 'Invalid state code'], 400);
        }

        $holidays = $this->publicHolidayService->getHolidays($year, $stateCode);

        return $this->json($holidays);
    }
}
