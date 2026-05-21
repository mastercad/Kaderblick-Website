<?php

namespace App\Controller\Api;

use App\Repository\SubstitutionReasonRepository;
use App\Security\Voter\SubstitutionReasonVoter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/substitution-reasons', name: 'api_substitution_reasons_')]
class SubstitutionReasonsController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SubstitutionReasonRepository $repo): JsonResponse
    {
        $reasons = $repo->fetchFullList();

        // Filtere basierend auf VIEW-Berechtigung
        $reasons = array_filter($reasons, fn ($reason) => $this->isGranted(SubstitutionReasonVoter::VIEW, $reason));

        $reasons = $repo->fetchFullList();

        return $this->json($reasons);
    }
}
