<?php

namespace App\Controller\Api;

use App\Entity\SurveyResponse;
use App\Entity\User;
use App\Event\SurveyCompletedEvent;
use App\Repository\SurveyRepository;
use App\Repository\SurveyResponseRepository;
use App\Security\Voter\SurveyResponseVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/survey-responses', name: 'api_survey_responses_')]
class SurveyResponseController extends AbstractController
{
    public function __construct(private EventDispatcherInterface $dispatcher)
    {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SurveyResponseRepository $repo): JsonResponse
    {
        $responses = $repo->findAll();

        $responses = array_filter($responses, fn ($r) => $this->isGranted(SurveyResponseVoter::VIEW, $r));

        $data = array_map(fn ($r) => [
            'id' => $r->getId(),
            'userId' => $r->getUserId(),
            'survey' => $r->getSurvey()?->getId(),
            'answers' => $r->getAnswers(),
            'createdAt' => $r->getCreatedAt()?->format('c'),
        ], $responses);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(SurveyResponse $response): JsonResponse
    {
        if (!$this->isGranted(SurveyResponseVoter::VIEW, $response)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = [
            'id' => $response->getId(),
            'userId' => $response->getUserId(),
            'survey' => $response->getSurvey()?->getId(),
            'answers' => $response->getAnswers(),
            'createdAt' => $response->getCreatedAt()?->format('c'),
        ];

        return $this->json($data);
    }

    #[Route('/survey/{surveyId}', name: 'by_survey', methods: ['GET'])]
    public function bySurvey(int $surveyId, SurveyResponseRepository $repo, SurveyRepository $surveyRepo): JsonResponse
    {
        $survey = $surveyRepo->find($surveyId);
        if (!$survey) {
            return $this->json(['error' => 'Survey not found'], 404);
        }
        $responses = $repo->findBy(['survey' => $survey]);

        $responses = array_filter($responses, fn ($r) => $this->isGranted(SurveyResponseVoter::VIEW, $r));

        $data = array_map(fn ($r) => [
            'id' => $r->getId(),
            'userId' => $r->getUserId(),
            'answers' => $r->getAnswers(),
            'createdAt' => $r->getCreatedAt()?->format('c'),
        ], $responses);

        return $this->json($data);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em, SurveyRepository $surveyRepo): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!isset($data['surveyId'], $data['answers'])) {
            return $this->json(['error' => 'surveyId and answers required'], 400);
        }
        $survey = $surveyRepo->find($data['surveyId']);
        if (!$survey) {
            return $this->json(['error' => 'Survey not found'], 404);
        }
        $response = new SurveyResponse();
        $response->setSurvey($survey);
        $response->setUserId($data['userId'] ?? null);
        $response->setAnswers($data['answers']);
        $em->persist($response);
        $em->flush();

        /** @var User|null $currentUser */
        $currentUser = $this->getUser();
        if ($currentUser instanceof User) {
            $this->dispatcher->dispatch(new SurveyCompletedEvent($currentUser, $survey));
        }

        return $this->json(['id' => $response->getId()], 201);
    }
}
