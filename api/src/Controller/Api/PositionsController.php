<?php

namespace App\Controller\Api;

use App\Entity\Position;
use App\Security\Voter\PositionVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/positions', name: 'api_positions_')]
class PositionsController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $positions = $this->entityManager->getRepository(Position::class)->findAll();

        // Filtere Positionen basierend auf VIEW-Berechtigung
        $positions = array_filter($positions, fn ($position) => $this->isGranted(PositionVoter::VIEW, $position));

        return $this->json([
            'positions' => array_map(fn ($position) => [
                'id' => $position->getId(),
                'name' => $position->getName(),
                'shortName' => $position->getShortName(),
                'description' => $position->getDescription(),
                'permissions' => [
                    'canView' => $this->isGranted(PositionVoter::VIEW, $position),
                    'canCreate' => $this->isGranted(PositionVoter::CREATE, $position),
                    'canEdit' => $this->isGranted(PositionVoter::EDIT, $position),
                    'canDelete' => $this->isGranted(PositionVoter::DELETE, $position)
                ],
            ], $positions)
        ]);
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(int $id): JsonResponse
    {
        $position = $this->entityManager->getRepository(Position::class)->find($id);

        if (!$position) {
            return $this->json(['error' => 'Position not found'], 404);
        }

        if (!$this->isGranted(PositionVoter::VIEW, $position)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        return $this->json([
            'position' => [
                'id' => $position->getId(),
                'name' => $position->getName(),
                'shortName' => $position->getShortName(),
                'description' => $position->getDescription(),
                'permissions' => [
                    'canView' => $this->isGranted(PositionVoter::VIEW, $position),
                    'canCreate' => $this->isGranted(PositionVoter::CREATE, $position),
                    'canEdit' => $this->isGranted(PositionVoter::EDIT, $position),
                    'canDelete' => $this->isGranted(PositionVoter::DELETE, $position)
                ],
            ]
        ]);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(Request $request, int $id): JsonResponse
    {
        $position = $this->entityManager->getRepository(Position::class)->find($id);

        if (!$position) {
            return $this->json(['error' => 'Position not found'], 404);
        }

        if (!$this->isGranted(PositionVoter::EDIT, $position)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $positionData = json_decode($request->getContent(), true);
        $position->setName($positionData['name']);
        $position->setShortName($positionData['shortName']);
        $position->setDescription($positionData['description']);

        $this->entityManager->flush();

        return $this->json(['success' => 'Position updated']);
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        if (!$this->isGranted(PositionVoter::CREATE, Position::class)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $position = new Position();
        $positionData = json_decode($request->getContent(), true);
        $position->setName($positionData['name']);
        $position->setShortName($positionData['shortName']);
        $position->setDescription($positionData['description']);

        $this->entityManager->persist($position);
        $this->entityManager->flush();

        return $this->json(['success' => 'Position created', 'id' => $position->getId()]);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(int $id): JsonResponse
    {
        $position = $this->entityManager->getRepository(Position::class)->find($id);

        if (!$position) {
            return $this->json(['error' => 'Position not found'], 404);
        }

        if (!$this->isGranted(PositionVoter::DELETE, $position)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($position);
        $this->entityManager->flush();

        return $this->json(['success' => 'Position deleted']);
    }
}
