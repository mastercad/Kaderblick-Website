<?php

namespace App\Controller\Api;

use App\Entity\Cup;
use App\Repository\GameRepository;
use App\Security\Voter\CupVoter;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/cups', name: 'api_cups_')]
class CupsController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private GameRepository $gameRepository,
    ) {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $cups = $this->entityManager->getRepository(Cup::class)->findAll();

        $cups = array_filter($cups, fn ($cup) => $this->isGranted(CupVoter::VIEW, $cup));

        $gameCounts = $this->gameRepository->countGroupedByCupId();

        return $this->json([
            'cups' => array_map(fn ($cup) => [
                'id' => $cup->getId(),
                'name' => $cup->getName(),
                'gameCount' => $gameCounts[$cup->getId()] ?? 0,
                'permissions' => [
                    'canView' => $this->isGranted(CupVoter::VIEW, $cup),
                    'canCreate' => $this->isGranted(CupVoter::CREATE, $cup),
                    'canEdit' => $this->isGranted(CupVoter::EDIT, $cup),
                    'canDelete' => $this->isGranted(CupVoter::DELETE, $cup),
                ],
            ], $cups),
        ]);
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(Cup $cup): JsonResponse
    {
        if (!$this->isGranted(CupVoter::VIEW, $cup)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json([
            'cup' => [
                'id' => $cup->getId(),
                'name' => $cup->getName(),
                'permissions' => [
                    'canView' => $this->isGranted(CupVoter::VIEW, $cup),
                    'canCreate' => $this->isGranted(CupVoter::CREATE, $cup),
                    'canEdit' => $this->isGranted(CupVoter::EDIT, $cup),
                    'canDelete' => $this->isGranted(CupVoter::DELETE, $cup),
                ],
            ],
        ]);
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $cup = new Cup();

        if (!$this->isGranted(CupVoter::CREATE, $cup)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $cup->setName($data['name']);

        $this->entityManager->persist($cup);
        $this->entityManager->flush();

        return $this->json([
            'message' => 'Cup created successfully',
            'cup' => ['id' => $cup->getId(), 'name' => $cup->getName()],
        ], 201);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(Cup $cup, Request $request): JsonResponse
    {
        if (!$this->isGranted(CupVoter::EDIT, $cup)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $cup->setName($data['name']);

        $this->entityManager->flush();

        return $this->json(['message' => 'Cup updated successfully']);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(Cup $cup): JsonResponse
    {
        if (!$this->isGranted(CupVoter::DELETE, $cup)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($cup);
        $this->entityManager->flush();

        return $this->json(['message' => 'Cup deleted successfully']);
    }

    #[Route('/{id}/games', methods: ['GET'], name: 'games')]
    public function games(Cup $cup): JsonResponse
    {
        if (!$this->isGranted(CupVoter::VIEW, $cup)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $games = $this->gameRepository->findForListByCup($cup->getId());

        return $this->json([
            'games' => array_map(fn ($g) => [
                'id' => $g['id'],
                'homeTeamName' => $g['homeTeamName'],
                'awayTeamName' => $g['awayTeamName'],
                'homeScore' => $g['homeScore'],
                'awayScore' => $g['awayScore'],
                'isFinished' => (bool) $g['isFinished'],
                'calendarEventId' => $g['calendarEventId'],
                'date' => $g['date'] instanceof DateTimeInterface ? $g['date']->format(DateTimeInterface::ATOM) : $g['date'],
            ], $games),
        ]);
    }
}
