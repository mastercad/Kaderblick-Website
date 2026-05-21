<?php

namespace App\Controller\Api;

use App\Entity\SurfaceType;
use App\Security\Voter\SurfaceTypeVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/surface-types', name: 'api_surface_types_')]
class SurfaceTypesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $surfaceTypes = $this->entityManager->getRepository(SurfaceType::class)->findAll();

        // Filtere Oberflächentypen basierend auf VIEW-Berechtigung
        $surfaceTypes = array_filter($surfaceTypes, fn ($surfaceType) => $this->isGranted(SurfaceTypeVoter::VIEW, $surfaceType));

        return $this->json(
            [
                'surfaceTypes' => array_map(fn ($surfaceType) => [
                    'id' => $surfaceType->getId(),
                    'name' => $surfaceType->getName(),
                    'description' => $surfaceType->getDescription(),
                    'permissions' => [
                        'canView' => $this->isGranted(SurfaceTypeVoter::VIEW, $surfaceType),
                        'canCreate' => $this->isGranted(SurfaceTypeVoter::CREATE, $surfaceType),
                        'canEdit' => $this->isGranted(SurfaceTypeVoter::EDIT, $surfaceType),
                        'canDelete' => $this->isGranted(SurfaceTypeVoter::DELETE, $surfaceType)
                    ]
                ], $surfaceTypes)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(int $id): JsonResponse
    {
        $surfaceType = $this->entityManager->getRepository(SurfaceType::class)->find($id);

        if (!$surfaceType) {
            return $this->json(['error' => 'SurfaceType not found'], 404);
        }

        if (!$this->isGranted(SurfaceTypeVoter::VIEW, $surfaceType)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'surfaceType' => [
                    'id' => $surfaceType->getId(),
                    'name' => $surfaceType->getName(),
                    'description' => $surfaceType->getDescription(),
                    'permissions' => [
                        'canView' => $this->isGranted(SurfaceTypeVoter::VIEW, $surfaceType),
                        'canCreate' => $this->isGranted(SurfaceTypeVoter::CREATE, $surfaceType),
                        'canEdit' => $this->isGranted(SurfaceTypeVoter::EDIT, $surfaceType),
                        'canDelete' => $this->isGranted(SurfaceTypeVoter::DELETE, $surfaceType)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $surfaceType = new SurfaceType();

        if (!$this->isGranted(SurfaceTypeVoter::CREATE, $surfaceType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $surfaceTypeData = json_decode($request->getContent(), true);
        $surfaceType->setName($surfaceTypeData['name']);
        $surfaceType->setDescription($surfaceTypeData['description']);

        $this->entityManager->persist($surfaceType);
        $this->entityManager->flush();

        return $this->json(['message' => 'SurfaceType created successfully'], 201);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(SurfaceType $surfaceType, Request $request): JsonResponse
    {
        if (!$this->isGranted(SurfaceTypeVoter::EDIT, $surfaceType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $surfaceTypeData = json_decode($request->getContent(), true);
        $surfaceType->setName($surfaceTypeData['name']);
        $surfaceType->setDescription($surfaceTypeData['description']);

        $this->entityManager->flush();

        return $this->json(['message' => 'SurfaceType updated successfully']);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(SurfaceType $surfaceType): JsonResponse
    {
        if (!$this->isGranted(SurfaceTypeVoter::DELETE, $surfaceType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($surfaceType);
        $this->entityManager->flush();

        return $this->json(['message' => 'SurfaceType deleted successfully']);
    }
}
