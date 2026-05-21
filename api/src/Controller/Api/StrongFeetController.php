<?php

namespace App\Controller\Api;

use App\Entity\StrongFoot;
use App\Security\Voter\StrongFeetVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/strong-feet', name: 'api_strong_feet_')]
class StrongFeetController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $strongFeets = $this->entityManager->getRepository(StrongFoot::class)->findAll();

        // Filtere basierend auf VIEW-Berechtigung
        $strongFeets = array_filter($strongFeets, fn ($strongFeet) => $this->isGranted(StrongFeetVoter::VIEW, $strongFeet));

        return $this->json(
            [
                'strongFeets' => array_map(fn ($strongFeet) => [
                    'id' => $strongFeet->getId(),
                    'name' => $strongFeet->getName(),
                    'code' => $strongFeet->getCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(StrongFeetVoter::VIEW, $strongFeet),
                        'canCreate' => $this->isGranted(StrongFeetVoter::CREATE, $strongFeet),
                        'canEdit' => $this->isGranted(StrongFeetVoter::EDIT, $strongFeet),
                        'canDelete' => $this->isGranted(StrongFeetVoter::DELETE, $strongFeet)
                    ]
                ], $strongFeets)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(StrongFoot $strongFeet): JsonResponse
    {
        if (!$this->isGranted(StrongFeetVoter::VIEW, $strongFeet)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'strongFeet' => [
                    'id' => $strongFeet->getId(),
                    'name' => $strongFeet->getName(),
                    'code' => $strongFeet->getCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(StrongFeetVoter::VIEW, $strongFeet),
                        'canCreate' => $this->isGranted(StrongFeetVoter::CREATE, $strongFeet),
                        'canEdit' => $this->isGranted(StrongFeetVoter::EDIT, $strongFeet),
                        'canDelete' => $this->isGranted(StrongFeetVoter::DELETE, $strongFeet)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $strongFeet = new StrongFoot();

        if (!$this->isGranted(StrongFeetVoter::CREATE, $strongFeet)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $strongFeetData = json_decode($request->getContent(), true);
        $strongFeet->setName($strongFeetData['name']);
        $strongFeet->setCode($strongFeetData['code']);

        $this->entityManager->persist($strongFeet);
        $this->entityManager->flush();

        return $this->json(['message' => 'StrongFoot created successfully'], 201);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(StrongFoot $strongFeet, Request $request): JsonResponse
    {
        if (!$this->isGranted(StrongFeetVoter::EDIT, $strongFeet)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $strongFeetData = json_decode($request->getContent(), true);
        $strongFeet->setName($strongFeetData['name']);
        $strongFeet->setCode($strongFeetData['code']);

        $this->entityManager->flush();

        return $this->json(['message' => 'StrongFoot updated successfully']);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(StrongFoot $strongFeet): JsonResponse
    {
        if (!$this->isGranted(StrongFeetVoter::DELETE, $strongFeet)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($strongFeet);
        $this->entityManager->flush();

        return $this->json(['message' => 'StrongFoot deleted successfully']);
    }
}
