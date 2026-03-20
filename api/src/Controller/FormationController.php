<?php

namespace App\Controller;

use App\Entity\Formation;
use App\Entity\FormationType;
use App\Entity\Team;
use App\Entity\User;
use App\Security\Voter\CoachTeamVoter;
use App\Security\Voter\FormationVoter;
use App\Service\CoachTeamPlayerService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class FormationController extends AbstractController
{
    public function __construct(
        private CoachTeamPlayerService $coachTeamPlayerService,
        private EntityManagerInterface $entityManager
    ) {
    }

    #[Route('/formations', name: 'formations_index')]
    public function index(EntityManagerInterface $em): Response
    {
        $user = $this->getUser();

        if (null === $user) {
            $user = $this->entityManager->getRepository(User::class)->find(1);
        }

        // Nur Aufstellungen des aktuellen Trainers anzeigen
        $formations = $em->getRepository(Formation::class)->findBy([
            'user' => $user
        ]);

        $formations = array_filter($formations, fn ($f) => $this->isGranted(FormationVoter::VIEW, $f));

        return $this->json(['formations' => array_map(fn (Formation $formation) => [
            'id' => $formation->getId(),
            'name' => $formation->getName(),
            'formationData' => $formation->getFormationData(),
            'formationType' => [
                'id' => $formation->getFormationType()->getId(),
                'name' => $formation->getFormationType()->getName(),
                'backgroundPath' => $formation->getFormationType()->getBackgroundPath(),
                'cssClass' => $formation->getFormationType()->getCssClass(),
            ]
        ], $formations)]);
    }

    #[Route('/formation/new', name: 'formation_new')]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        if ($request->isMethod('POST')) {
            $formationType = $em->getRepository(FormationType::class)->findOneBy(['name' => 'fußball']);
            $data = json_decode($request->getContent(), true);
            $formation = new Formation();
            $formation->setUser($user);
            $formation->setFormationType($formationType);
            $formation->setName($data['name']);
            $formation->setFormationData($data['formationData']);
            $em->persist($formation);
            $em->flush();

            return $this->json(['success' => true, 'formation' => [
                'id' => $formation->getId(),
                'name' => $formation->getName(),
                'formationData' => $formation->getFormationData(),
                'formationType' => [
                    'id' => $formation->getFormationType()->getId(),
                    'name' => $formation->getFormationType()->getName(),
                    'backgroundPath' => $formation->getFormationType()->getBackgroundPath(),
                    'cssClass' => $formation->getFormationType()->getCssClass(),
                ],
            ]]);
        }

        return $this->json(['success' => true]);
    }

    #[Route('/formation/{id}/edit', name: 'formation_edit')]
    public function edit(Request $request, Formation $formation, EntityManagerInterface $em): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isGranted(FormationVoter::EDIT, $formation)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        if ($request->isMethod('POST')) {
            $formationType = $em->getRepository(FormationType::class)->findOneBy(['name' => 'fußball']);
            $data = json_decode($request->getContent(), true);
            $formation->setUser($user);
            $formation->setFormationType($formationType);
            $formation->setName($data['name']);
            $formation->setFormationData($data['formationData']);
            $em->flush();

            return $this->json(['success' => true, 'formation' => [
                'id' => $formation->getId(),
                'name' => $formation->getName(),
                'formationData' => $formation->getFormationData(),
                'formationType' => [
                    'id' => $formation->getFormationType()->getId(),
                    'name' => $formation->getFormationType()->getName(),
                    'backgroundPath' => $formation->getFormationType()->getBackgroundPath(),
                    'cssClass' => $formation->getFormationType()->getCssClass(),
                ],
            ]]);
        }

        /** @var User $user */
        $user = $this->getUser();
        $availablePlayers = $this->coachTeamPlayerService->resolveAvailablePlayersForCoach($user);

        return $this->json([
            'formation' => [
                'id' => $formation->getId(),
                'name' => $formation->getName(),
                'formationData' => $formation->getFormationData(),
                'formationType' => [
                    'id' => $formation->getFormationType()->getId(),
                    'name' => $formation->getFormationType()->getName(),
                    'backgroundPath' => $formation->getFormationType()->getBackgroundPath(),
                    'cssClass' => $formation->getFormationType()->getCssClass(),
                ]
            ],
            'availablePlayers' => $availablePlayers
        ]);
    }

    #[Route('/formation/team/{teamId}/players', name: 'formation_team_players', methods: ['GET'])]
    public function getTeamPlayers(int $teamId, EntityManagerInterface $em): Response
    {
        $team = $em->getRepository(Team::class)->find($teamId);

        if (!$team) {
            return $this->json(['error' => 'Team nicht gefunden'], 404);
        }

        if (!$this->isGranted(CoachTeamVoter::ACCESS, $team)) {
            return $this->json(['error' => 'Keine aktive Trainerzuordnung für dieses Team'], 403);
        }

        $players = $this->coachTeamPlayerService->collectTeamPlayers($team);

        $playersData = array_map(function ($playerData) {
            $player = $playerData['player'];

            /* @var array{player: array{id: int|null, name: string}, shirtNumber: int|null, position?: string|null, alternativePositions?: string[]} $playerData */
            return [
                'id' => $player['id'],
                'name' => $player['name'],
                'shirtNumber' => $playerData['shirtNumber'],
                'position' => $playerData['position'] ?? null,
                'alternativePositions' => $playerData['alternativePositions'] ?? [],
            ];
        }, $players);

        return $this->json([
            'players' => $playersData,
            'teamName' => $team->getName()
        ]);
    }

    #[Route('/formation/coach-teams', name: 'formation_coach_teams', methods: ['GET'])]
    public function coachTeams(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $teams = $this->coachTeamPlayerService->collectCoachTeams($user);

        return $this->json([
            'teams' => array_values(array_map(fn ($team) => [
                'id' => $team->getId(),
                'name' => $team->getName(),
            ], $teams)),
        ]);
    }

    #[Route('/formation/{id}/duplicate', name: 'formation_duplicate', methods: ['POST'])]
    public function duplicate(Formation $formation, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted(FormationVoter::VIEW, $formation)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();
        $copy = new Formation();
        $copy->setUser($user);
        $copy->setFormationType($formation->getFormationType());
        $copy->setName($formation->getName());
        $copy->setFormationData($formation->getFormationData());
        $em->persist($copy);
        $em->flush();

        return $this->json(['formation' => [
            'id' => $copy->getId(),
            'name' => $copy->getName(),
            'formationData' => $copy->getFormationData(),
            'formationType' => [
                'id' => $copy->getFormationType()->getId(),
                'name' => $copy->getFormationType()->getName(),
                'backgroundPath' => $copy->getFormationType()->getBackgroundPath(),
                'cssClass' => $copy->getFormationType()->getCssClass(),
            ],
        ]]);
    }

    #[Route('/formation/{id}/delete', name: 'formation_delete', methods: ['DELETE'])]
    public function delete(Request $request, Formation $formation, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isGranted(FormationVoter::DELETE, $formation)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $em->remove($formation);
        $em->flush();

        return $this->json(['success' => true]);
    }
}
