<?php

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\Survey;
use App\Entity\SurveyOption;
use App\Entity\SurveyQuestion;
use App\Entity\SurveyResponse;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\SurveyOptionTypeRepository;
use App\Repository\SurveyRepository;
use App\Repository\SurveyResponseRepository;
use App\Repository\UserRepository;
use App\Security\Voter\SurveyVoter;
use App\Service\SurveyNotificationService;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/surveys', name: 'api_surveys_')]
class SurveyController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private SurveyNotificationService $surveyNotificationService,
        private UserRepository $userRepository
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(SurveyRepository $surveyRepository, SurveyResponseRepository $responseRepo): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $surveys = $surveyRepository->findAll();

        // Filtere basierend auf VIEW-Berechtigung
        $surveys = array_values(array_filter($surveys, fn ($survey) => $this->isGranted(SurveyVoter::VIEW, $survey)));

        $data = array_map(function ($survey) use ($responseRepo, $user) {
            $responseCount = $responseRepo->count(['survey' => $survey]);
            $hasAnswered = $responseRepo->count(['survey' => $survey, 'userId' => $user->getId()]) > 0;

            return [
                'id' => $survey->getId(),
                'title' => $survey->getTitle(),
                'description' => $survey->getDescription(),
                'questionCount' => $survey->getQuestions()->count(),
                'responseCount' => $responseCount,
                'dueDate' => $survey->getDueDate()?->format('c'),
                'hasAnswered' => $hasAnswered,
                'isPlatform' => $survey->isPlatform(),
                'canViewStats' => $this->isGranted(SurveyVoter::VIEW_STATS, $survey),
            ];
        }, $surveys);

        return $this->json($data);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Survey $survey): JsonResponse
    {
        if (!$this->isGranted(SurveyVoter::VIEW, $survey)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $questions = $survey->getQuestions()->map(fn ($q) => [
            'id' => $q->getId(),
            'questionText' => $q->getQuestionText(),
            'type' => $q->getType()?->getTypeKey(),
            'options' => $q->getOptions()->map(fn ($o) => [
                'id' => $o->getId(),
                'optionText' => $o->getOptionText(),
            ])->toArray(),
        ])->toArray();
        $data = [
            'id' => $survey->getId(),
            'title' => $survey->getTitle(),
            'description' => $survey->getDescription(),
            'dueDate' => $survey->getDueDate() ? $survey->getDueDate()->format('Y-m-d') : null,
            'teamIds' => $survey->getTeams()->map(fn ($t) => $t->getId())->toArray(),
            'clubIds' => $survey->getClubs()->map(fn ($c) => $c->getId())->toArray(),
            'platform' => $survey->isPlatform(),
            'questions' => $questions,
        ];

        return $this->json($data);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request, SurveyOptionTypeRepository $typeRepo): JsonResponse
    {
        $survey = new Survey();
        if (!$this->isGranted(SurveyVoter::CREATE, $survey)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data || !isset($data['title'], $data['questions'])) {
            return $this->json(['error' => 'Invalid payload'], 400);
        }

        $survey->setTitle($data['title']);
        $survey->setDescription($data['description'] ?? null);
        if (!empty($data['dueDate'])) {
            $survey->setDueDate(new DateTime($data['dueDate']));
        }
        if (!empty($data['teamIds']) && is_array($data['teamIds'])) {
            foreach ($data['teamIds'] as $teamId) {
                $team = $this->em->getRepository(Team::class)->find($teamId);
                if ($team) {
                    $survey->addTeam($team);
                }
            }
        }
        if (!empty($data['clubIds']) && is_array($data['clubIds'])) {
            foreach ($data['clubIds'] as $clubId) {
                $club = $this->em->getRepository(Club::class)->find($clubId);
                if ($club) {
                    $survey->addClub($club);
                }
            }
        }
        if (!empty($data['platform'])) {
            $survey->setPlatform((bool) $data['platform']);
        }

        foreach ($data['questions'] as $q) {
            if (!isset($q['questionText'], $q['type'])) {
                continue;
            }
            $question = new SurveyQuestion();
            $question->setSurvey($survey);
            $question->setQuestionText($q['questionText']);
            $type = $typeRepo->findOneBy(['typeKey' => $q['type']]);
            if (!$type) {
                return $this->json(['error' => 'Unknown question type: ' . $q['type']], 400);
            }
            $question->setType($type);

            // Optionen zuordnen (immer für Auswahlfragen, egal ob single_choice oder multiple_choice)
            if (in_array($q['type'], ['single_choice', 'multiple_choice'], true) && isset($q['options']) && is_array($q['options']) && count($q['options']) > 0) {
                /** @var User $currentUser */
                $currentUser = $this->getUser();
                foreach ($q['options'] as $optionItem) {
                    $option = $this->resolveOrCreateOption($optionItem, $currentUser);
                    if ($option) {
                        $question->addOption($option);
                    }
                }
            }

            $survey->getQuestions()->add($question);
        }

        $this->em->persist($survey);
        $this->em->flush();

        // Send push notification to all targeted users
        $this->surveyNotificationService->sendSurveyCreatedNotification($survey);

        return $this->json(['id' => $survey->getId()], 201);
    }

    #[Route('/{id}/submit', name: 'answer', methods: ['POST'])]
    public function answer(Survey $survey, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);

        $surveyResponse = $this->em->getRepository(SurveyResponse::class)->findOneBy(['survey' => $survey, 'userId' => $user->getId()]);

        if ($surveyResponse) {
            return $this->json(['error' => 'You have already submitted this survey.'], 400);
        }

        $surveyResponse = new SurveyResponse();
        $surveyResponse->setAnswers($data['answers']);
        $surveyResponse->setSurvey($survey);
        $surveyResponse->setCreatedAt(new DateTimeImmutable());
        $surveyResponse->setUserId($user->getId());

        $this->em->persist($surveyResponse);
        $this->em->flush();

        return $this->json(['id' => $survey->getId()], 201);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(Request $request, Survey $survey, SurveyOptionTypeRepository $typeRepo): JsonResponse
    {
        if (!$this->isGranted(SurveyVoter::EDIT, $survey)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data || !isset($data['title'], $data['questions'])) {
            return $this->json(['error' => 'Invalid payload'], 400);
        }

        $survey->setTitle($data['title']);
        $survey->setDescription($data['description'] ?? null);
        $survey->setDueDate(!empty($data['dueDate']) ? new DateTime($data['dueDate']) : null);
        $survey->getTeams()->clear();
        if (!empty($data['teamIds']) && is_array($data['teamIds'])) {
            foreach ($data['teamIds'] as $teamId) {
                $team = $this->em->getRepository(Team::class)->find($teamId);
                if ($team) {
                    $survey->addTeam($team);
                }
            }
        }
        $survey->getClubs()->clear();
        if (!empty($data['clubIds']) && is_array($data['clubIds'])) {
            foreach ($data['clubIds'] as $clubId) {
                $club = $this->em->getRepository(Club::class)->find($clubId);
                if ($club) {
                    $survey->addClub($club);
                }
            }
        }
        $survey->setPlatform((bool) ($data['platform'] ?? false));

        foreach ($survey->getQuestions() as $q) {
            $this->em->remove($q);
        }
        $survey->getQuestions()->clear();
        foreach ($data['questions'] as $q) {
            if (!isset($q['questionText'], $q['type'])) {
                continue;
            }
            $question = new SurveyQuestion();
            $question->setSurvey($survey);
            $question->setQuestionText($q['questionText']);
            $type = $typeRepo->findOneBy(['typeKey' => $q['type']]);
            if (!$type) {
                return $this->json(['error' => 'Unknown question type: ' . $q['type']], 400);
            }
            $question->setType($type);
            if (in_array($q['type'], ['single_choice', 'multiple_choice'], true) && isset($q['options']) && is_array($q['options']) && count($q['options']) > 0) {
                /** @var User $currentUser */
                $currentUser = $this->getUser();
                foreach ($q['options'] as $optionItem) {
                    $option = $this->resolveOrCreateOption($optionItem, $currentUser);
                    if ($option) {
                        $question->addOption($option);
                    }
                }
            }
            $survey->getQuestions()->add($question);
        }

        $this->em->persist($survey);
        $this->em->flush();

        return $this->json(['id' => $survey->getId()]);
    }

    #[Route('/{id}/results', name: 'results', methods: ['GET'])]
    public function results(Survey $survey): JsonResponse
    {
        if (!$this->isGranted(SurveyVoter::VIEW, $survey)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $results = [];
        $questions = $this->prepareQuestions($survey);
        $answers = $this->collectAnswers($questions, $survey->getId());

        foreach ($questions as $question) {
            $qData = [
                'id' => $question->getId(),
                'questionText' => $question->getQuestionText(),
                'type' => $question->getType()?->getTypeKey(),
                'options' => [],
                'answers' => $answers[$question->getId()] ?? [],
            ];
            if (in_array($qData['type'], ['single_choice', 'multiple_choice', 'scale_1_5', 'scale_1_10'])) {
                foreach ($question->getOptions() as $option) {
                    $qData['options'][] = [
                        'id' => $option->getId(),
                        'optionText' => $option->getOptionText(),
                        'count' => $answers[$question->getId()][$option->getId()] ?? 0,
                    ];
                }
            }
            // Für Freitext: Leeres Array (oder später: Liste der Antworten)
            $results[] = $qData;
        }

        return $this->json([
            'answers_total' => $answers['answers_total'],
            'answers' => $answers,
            'surveyId' => $survey->getId(),
            'title' => $survey->getTitle(),
            'results' => $results,
        ]);
    }

    #[Route('/{id}/stats', name: 'stats', methods: ['GET'])]
    public function stats(Survey $survey): JsonResponse
    {
        if (!$this->isGranted(SurveyVoter::VIEW_STATS, $survey)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        // Get all target users
        $targetUsers = $this->surveyNotificationService->getTargetUsersForSurvey($survey);
        $totalTargeted = count($targetUsers);

        // Get all responses with user info
        /** @var SurveyResponse[] $responses */
        $responses = $this->em->getRepository(SurveyResponse::class)->findBy(
            ['survey' => $survey],
            ['createdAt' => 'ASC']
        );

        $respondedUserIds = array_map(
            fn (SurveyResponse $r) => $r->getUserId(),
            $responses
        );

        // Build participants list (who responded and when)
        $participants = [];
        foreach ($responses as $response) {
            $user = $this->userRepository->find($response->getUserId());
            $participants[] = [
                'userId' => $response->getUserId(),
                'firstName' => $user?->getFirstName() ?? 'Unbekannt',
                'lastName' => $user?->getLastName() ?? '',
                'respondedAt' => $response->getCreatedAt()?->format('Y-m-d H:i:s'),
            ];
        }

        // Build non-participants list
        $nonParticipants = [];
        foreach ($targetUsers as $user) {
            if (!in_array($user->getId(), $respondedUserIds, true)) {
                $nonParticipants[] = [
                    'userId' => $user->getId(),
                    'firstName' => $user->getFirstName(),
                    'lastName' => $user->getLastName(),
                ];
            }
        }

        // Participation rate
        $participationRate = $totalTargeted > 0
            ? round((count($responses) / $totalTargeted) * 100, 1)
            : 0;

        // Response timeline (responses per day)
        $timeline = [];
        foreach ($responses as $response) {
            $date = $response->getCreatedAt()?->format('Y-m-d') ?? 'unknown';
            $timeline[$date] = ($timeline[$date] ?? 0) + 1;
        }

        // Per-question detailed results
        $questions = $this->prepareQuestions($survey);
        $answers = $this->collectAnswers($questions, $survey->getId());

        $questionStats = [];
        foreach ($questions as $question) {
            $typeKey = $question->getType()?->getTypeKey();
            $qStat = [
                'id' => $question->getId(),
                'questionText' => $question->getQuestionText(),
                'type' => $typeKey,
                'options' => [],
                'answers' => $answers[$question->getId()] ?? [],
            ];

            if (in_array($typeKey, ['single_choice', 'multiple_choice', 'scale_1_5', 'scale_1_10'])) {
                foreach ($question->getOptions() as $option) {
                    $count = $answers[$question->getId()][$option->getId()] ?? 0;
                    $qStat['options'][] = [
                        'id' => $option->getId(),
                        'optionText' => $option->getOptionText(),
                        'count' => $count,
                        'percentage' => count($responses) > 0
                            ? round(($count / count($responses)) * 100, 1)
                            : 0,
                    ];
                }
            }

            // For scale questions: compute average
            if (in_array($typeKey, ['scale_1_5', 'scale_1_10'])) {
                $scaleSum = $answers[$question->getId()] ?? 0;
                $qStat['scaleAverage'] = count($responses) > 0
                    ? round($scaleSum / count($responses), 2)
                    : 0;
            }

            // For text questions: collect individual answers
            if ('text' === $typeKey) {
                $textAnswers = [];
                foreach ($responses as $response) {
                    $responseAnswers = $response->getAnswers();
                    if (isset($responseAnswers[$question->getId()])) {
                        $textAnswers[] = $responseAnswers[$question->getId()];
                    }
                }
                $qStat['textAnswers'] = $textAnswers;
            }

            $questionStats[] = $qStat;
        }

        // Target group info
        $targetInfo = [];
        if ($survey->isPlatform()) {
            $targetInfo['type'] = 'platform';
            $targetInfo['label'] = 'Gesamte Plattform';
        } elseif (!$survey->getTeams()->isEmpty()) {
            $targetInfo['type'] = 'teams';
            $targetInfo['items'] = $survey->getTeams()->map(fn ($t) => [
                'id' => $t->getId(),
                'name' => $t->getName(),
            ])->toArray();
        } elseif (!$survey->getClubs()->isEmpty()) {
            $targetInfo['type'] = 'clubs';
            $targetInfo['items'] = $survey->getClubs()->map(fn ($c) => [
                'id' => $c->getId(),
                'name' => $c->getName(),
            ])->toArray();
        }

        // Reminders info
        $remindersSent = $survey->getRemindersSent();

        return $this->json([
            'surveyId' => $survey->getId(),
            'title' => $survey->getTitle(),
            'description' => $survey->getDescription(),
            'dueDate' => $survey->getDueDate()?->format('Y-m-d'),
            'isExpired' => $survey->getDueDate() && $survey->getDueDate() < new DateTime(),
            'targetGroup' => $targetInfo,
            'totalTargeted' => $totalTargeted,
            'totalResponded' => count($responses),
            'totalNotResponded' => $totalTargeted - count($responses),
            'participationRate' => $participationRate,
            'participants' => $participants,
            'nonParticipants' => $nonParticipants,
            'timeline' => $timeline,
            'questionStats' => $questionStats,
            'remindersSent' => $remindersSent,
            'initialNotificationSent' => $survey->isInitialNotificationSent(),
        ]);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Survey $survey): JsonResponse
    {
        if (!$this->isGranted(SurveyVoter::DELETE, $survey)) {
            return $this->json(['error' => 'You do not have permission to delete this survey.'], 403);
        }

        /** @var SurveyResponseRepository $surveyResponseRepository */
        $surveyResponseRepository = $this->em->getRepository(SurveyResponse::class);
        $surveyResponseRepository->deleteBySurvey($survey);

        foreach ($survey->getQuestions() as $question) {
            $this->em->remove($question);
        }

        $this->em->remove($survey);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * @return array<int, SurveyQuestion>
     */
    private function prepareQuestions(Survey $survey): array
    {
        $sortedQuestions = [];
        foreach ($survey->getQuestions() as $question) {
            $sortedQuestions[$question->getId()] = $question;
        }

        return $sortedQuestions;
    }

    /**
     * @param array<int, SurveyQuestion> $sortedQuestions
     *
     * @return array<mixed>
     */
    private function collectAnswers(array $sortedQuestions, int $surveyId)
    {
        $answers = [];
        $rawAnswers = $this->em->getRepository(SurveyResponse::class)->findBy(['survey' => $surveyId]);
        foreach ($rawAnswers as $response) {
            $answer = $response->getAnswers();
            foreach ($answer as $questionId => $ans) {
                $questionTypeKey = $sortedQuestions[$questionId]->getType()?->getTypeKey();
                if (in_array($questionTypeKey, ['scale_1_5', 'scale_1_10'])) {
                    if (!isset($answers[$questionId])) {
                        $answers[$questionId] = 0;
                    }
                    $answers[$questionId] += $ans;
                    continue;
                }

                if (!isset($answers[$questionId])) {
                    $answers[$questionId] = [];
                }
                if (is_array($ans)) {
                    foreach ($ans as $a) {
                        $answers[$questionId][$a] = isset($answers[$questionId][$a]) ? $answers[$questionId][$a] + 1 : 1;
                    }
                    continue;
                }
                if (is_numeric($ans)) {
                    $answers[$questionId][$ans] = isset($answers[$questionId][$ans]) ? $answers[$questionId][$ans] + 1 : 1;
                    continue;
                }

                $answers[$questionId][] = $ans;
            }
        }
        $answers['answers_total'] = count($rawAnswers);

        return $answers;
    }

    /**
     * Löst eine Option auf: Wenn $optionItem eine Zahl (ID) ist, wird die vorhandene Option geladen.
     * Wenn es ein String ist, wird eine neue benutzerdefinierte Option erstellt.
     */
    private function resolveOrCreateOption(mixed $optionItem, User $user): ?SurveyOption
    {
        if (is_int($optionItem) || (is_string($optionItem) && ctype_digit($optionItem))) {
            // Existierende Option anhand ID laden
            return $this->em->getRepository(SurveyOption::class)->find((int) $optionItem);
        }

        if (is_string($optionItem) && '' !== trim($optionItem)) {
            // Neue benutzerdefinierte Option erstellen
            $option = new SurveyOption();
            $option->setOptionText(trim($optionItem));
            $option->setCreatedBy($user);
            $this->em->persist($option);

            return $option;
        }

        return null;
    }
}
