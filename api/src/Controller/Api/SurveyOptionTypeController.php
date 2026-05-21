<?php

namespace App\Controller\Api;

use App\Entity\SurveyOptionType;
use App\Repository\SurveyOptionTypeRepository;
use App\Security\Voter\SurveyOptionTypeVoter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/survey-option-types', name: 'api_survey_option_types_')]
class SurveyOptionTypeController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SurveyOptionTypeRepository $repo): JsonResponse
    {
        $types = $repo->findAll();

        $types = array_filter($types, fn ($t) => $this->isGranted(SurveyOptionTypeVoter::VIEW, $t));

        $data = array_map(fn ($type) => [
            'id' => $type->getId(),
            'name' => $type->getName(),
            'typeKey' => $type->getTypeKey(),
        ], $types);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(SurveyOptionType $type): JsonResponse
    {
        if (!$this->isGranted(SurveyOptionTypeVoter::VIEW, $type)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = [
            'id' => $type->getId(),
            'typeKey' => $type->getTypeKey(),
        ];

        return $this->json($data);
    }
}
