<?php

namespace App\Controller\Api;

use App\Entity\Nationality;
use App\Security\Voter\NationalityVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/nationalities', name: 'api_nationalities_')]
class NationalitiesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $nationalities = $this->entityManager->getRepository(Nationality::class)->findAll();

        // Filtere Nationalitäten basierend auf VIEW-Berechtigung
        $nationalities = array_filter($nationalities, fn ($nationality) => $this->isGranted(NationalityVoter::VIEW, $nationality));

        return $this->json(
            [
                'nationalities' => array_map(fn ($nationality) => [
                    'id' => $nationality->getId(),
                    'name' => $nationality->getName(),
                    'isoCode' => $nationality->getIsoCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(NationalityVoter::VIEW, $nationality),
                        'canCreate' => $this->isGranted(NationalityVoter::CREATE, $nationality),
                        'canEdit' => $this->isGranted(NationalityVoter::EDIT, $nationality),
                        'canDelete' => $this->isGranted(NationalityVoter::DELETE, $nationality)
                    ]
                ], $nationalities)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(int $id): JsonResponse
    {
        $nationality = $this->entityManager->getRepository(Nationality::class)->find($id);

        if (!$nationality) {
            return $this->json(['error' => 'Nationality not found'], 404);
        }

        if (!$this->isGranted(NationalityVoter::VIEW, $nationality)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'nationality' => [
                    'id' => $nationality->getId(),
                    'name' => $nationality->getName(),
                    'isoCode' => $nationality->getIsoCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(NationalityVoter::VIEW, $nationality),
                        'canCreate' => $this->isGranted(NationalityVoter::CREATE, $nationality),
                        'canEdit' => $this->isGranted(NationalityVoter::EDIT, $nationality),
                        'canDelete' => $this->isGranted(NationalityVoter::DELETE, $nationality)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $nationality = new Nationality();

        if (!$this->isGranted(NationalityVoter::CREATE, $nationality)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $nationalityData = json_decode($request->getContent(), true);
        $nationality->setName($nationalityData['name']);
        $nationality->setIsoCode($nationalityData['isoCode']);

        $this->entityManager->persist($nationality);
        $this->entityManager->flush();

        return $this->json([
            'message' => 'Nationality created successfully',
            'nationality' => [
                'id' => $nationality->getId(),
                'name' => $nationality->getName(),
                'isoCode' => $nationality->getIsoCode(),
                'permissions' => [
                    'canView' => $this->isGranted(NationalityVoter::VIEW, $nationality),
                    'canCreate' => $this->isGranted(NationalityVoter::CREATE, $nationality),
                    'canEdit' => $this->isGranted(NationalityVoter::EDIT, $nationality),
                    'canDelete' => $this->isGranted(NationalityVoter::DELETE, $nationality)
                ]
            ]
        ], Response::HTTP_CREATED);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(Nationality $nationality, Request $request): JsonResponse
    {
        if (!$this->isGranted(NationalityVoter::EDIT, $nationality)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $nationalityData = json_decode($request->getContent(), true);
        $nationality->setName($nationalityData['name']);
        $nationality->setIsoCode($nationalityData['isoCode']);

        $this->entityManager->flush();

        return $this->json([
            'message' => 'Nationality updated successfully',
            'nationality' => [
                'id' => $nationality->getId(),
                'name' => $nationality->getName(),
                'isoCode' => $nationality->getIsoCode(),
                'permissions' => [
                    'canView' => $this->isGranted(NationalityVoter::VIEW, $nationality),
                    'canCreate' => $this->isGranted(NationalityVoter::CREATE, $nationality),
                    'canEdit' => $this->isGranted(NationalityVoter::EDIT, $nationality),
                    'canDelete' => $this->isGranted(NationalityVoter::DELETE, $nationality)
                ]
            ]
        ], Response::HTTP_OK);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(int $id): JsonResponse
    {
        $nationality = $this->entityManager->getRepository(Nationality::class)->find($id);

        if (!$nationality) {
            return $this->json(['error' => 'Nationality not found'], 404);
        }

        if (!$this->isGranted(NationalityVoter::DELETE, $nationality)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($nationality);
        $this->entityManager->flush();

        return $this->json(['message' => 'Nationality deleted successfully']);
    }
}
