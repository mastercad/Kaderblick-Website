<?php

namespace App\Controller\Admin;

use App\Service\DataConsistencyService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/consistency', name: 'admin_consistency_')]
#[IsGranted('ROLE_SUPERADMIN')]
class DataConsistencyController extends AbstractController
{
    public function __construct(
        private DataConsistencyService $consistencyService
    ) {
    }

    #[Route('', name: 'index')]
    public function index(): Response
    {
        $issues = $this->consistencyService->checkConsistency();

        return $this->render('admin/consistency/index.html.twig', [
            'issues' => $issues
        ]);
    }

    #[Route('/fix-coach-clubs', name: 'fix_coach_clubs', methods: ['POST'])]
    public function fixCoachClubs(): JsonResponse
    {
        $fixed = $this->consistencyService->autoFixCoachClubAssignments();

        return $this->json([
            'success' => true,
            'message' => "Es wurden {$fixed} Coach-Verein-Zuordnungen korrigiert.",
            'fixed' => $fixed
        ]);
    }

    #[Route('/fix-player-clubs', name: 'fix_player_clubs', methods: ['POST'])]
    public function fixPlayerClubs(): JsonResponse
    {
        $fixed = $this->consistencyService->autoFixPlayerClubAssignments();

        return $this->json([
            'success' => true,
            'message' => "Es wurden {$fixed} Spieler-Verein-Zuordnungen korrigiert.",
            'fixed' => $fixed
        ]);
    }

    #[Route('/check', name: 'check', methods: ['GET'])]
    public function check(): JsonResponse
    {
        $issues = $this->consistencyService->checkConsistency();

        return $this->json($issues);
    }
}
