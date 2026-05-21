<?php

namespace App\Controller\Api;

use App\Entity\SurveyQuestion;
use App\Repository\SurveyQuestionRepository;
use App\Security\Voter\SurveyQuestionVoter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/survey-questions', name: 'api_survey_questions_')]
class SurveyQuestionController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SurveyQuestionRepository $repo): JsonResponse
    {
        $questions = $repo->findAll();

        $questions = array_filter($questions, fn ($q) => $this->isGranted(SurveyQuestionVoter::VIEW, $q));

        $data = array_map(fn ($q) => [
            'id' => $q->getId(),
            'survey' => $q->getSurvey()?->getId(),
            'questionText' => $q->getQuestionText(),
            'type' => $q->getType()?->getTypeKey(),
        ], $questions);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(SurveyQuestion $question): JsonResponse
    {
        if (!$this->isGranted(SurveyQuestionVoter::VIEW, $question)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = [
            'id' => $question->getId(),
            'survey' => $question->getSurvey()?->getId(),
            'questionText' => $question->getQuestionText(),
            'type' => $question->getType()?->getTypeKey(),
            'options' => $question->getOptions()->map(fn ($o) => [
                'id' => $o->getId(),
                'optionText' => $o->getOptionText(),
            ])->toArray(),
        ];

        return $this->json($data);
    }
}
