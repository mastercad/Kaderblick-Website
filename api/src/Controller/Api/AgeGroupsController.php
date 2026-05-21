<?php

namespace App\Controller\Api;

use App\Entity\AgeGroup;
use App\Security\Voter\AgeGroupVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/age-groups', name: 'api_age_groups_')]
class AgeGroupsController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('/', methods: ['GET'])]
    public function index(): JsonResponse
    {
        $ageGroups = $this->entityManager->getRepository(AgeGroup::class)->findAll();

        // Filtere Altersklassen basierend auf VIEW-Berechtigung
        $ageGroups = array_filter($ageGroups, fn ($ageGroup) => $this->isGranted(AgeGroupVoter::VIEW, $ageGroup));

        return $this->json([
            'ageGroups' => array_map(fn ($ageGroup) => [
                'id' => $ageGroup->getId(),
                'name' => $ageGroup->getName(),
                'code' => $ageGroup->getCode(),
                'minAge' => $ageGroup->getMinAge(),
                'maxAge' => $ageGroup->getMaxAge(),
                'description' => $ageGroup->getDescription(),
                'englishName' => $ageGroup->getEnglishName(),
                'referenceDate' => $ageGroup->getReferenceDate(),
                'permissions' => [
                    'canView' => $this->isGranted(AgeGroupVoter::VIEW, $ageGroup),
                    'canCreate' => $this->isGranted(AgeGroupVoter::CREATE, $ageGroup),
                    'canEdit' => $this->isGranted(AgeGroupVoter::EDIT, $ageGroup),
                    'canDelete' => $this->isGranted(AgeGroupVoter::DELETE, $ageGroup)
                ],
            ], $ageGroups)
        ]);
    }

    #[Route('/{id}', methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        $ageGroup = $this->entityManager->getRepository(AgeGroup::class)->find($id);

        if (!$ageGroup) {
            return $this->json(['error' => 'Age group not found'], 404);
        }

        if (!$this->isGranted(AgeGroupVoter::VIEW, $ageGroup)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json([
            'ageGroup' => [
                'id' => $ageGroup->getId(),
                'name' => $ageGroup->getName(),
                'code' => $ageGroup->getCode(),
                'minAge' => $ageGroup->getMinAge(),
                'maxAge' => $ageGroup->getMaxAge(),
                'description' => $ageGroup->getDescription(),
                'englishName' => $ageGroup->getEnglishName(),
                'referenceDate' => $ageGroup->getReferenceDate(),
                'permissions' => [
                    'canView' => $this->isGranted(AgeGroupVoter::VIEW, $ageGroup),
                    'canCreate' => $this->isGranted(AgeGroupVoter::CREATE, $ageGroup),
                    'canEdit' => $this->isGranted(AgeGroupVoter::EDIT, $ageGroup),
                    'canDelete' => $this->isGranted(AgeGroupVoter::DELETE, $ageGroup)
                ],
            ]
        ]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $ageGroup = new AgeGroup();
        $ageGroup->setName($data['name']);
        $ageGroup->setCode($data['code']);
        $ageGroup->setMinAge($data['minAge']);
        $ageGroup->setMaxAge($data['maxAge']);
        $ageGroup->setDescription($data['description']);
        $ageGroup->setEnglishName($data['englishName']);
        $ageGroup->setReferenceDate($data['referenceDate']);

        $this->entityManager->persist($ageGroup);
        $this->entityManager->flush();

        return $this->json(['message' => 'Age group created successfully'], 201);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(Request $request, int $id): JsonResponse
    {
        $ageGroup = $this->entityManager->getRepository(AgeGroup::class)->find($id);

        if (!$ageGroup) {
            return $this->json(['error' => 'Age group not found'], 404);
        }

        $data = json_decode($request->getContent(), true);
        $ageGroup->setName($data['name']);
        $ageGroup->setCode($data['code']);
        $ageGroup->setMinAge($data['minAge']);
        $ageGroup->setMaxAge($data['maxAge']);
        $ageGroup->setDescription($data['description']);
        $ageGroup->setEnglishName($data['englishName']);
        $ageGroup->setReferenceDate($data['referenceDate']);

        $this->entityManager->flush();

        return $this->json(['message' => 'Age group updated successfully']);
    }

    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $ageGroup = $this->entityManager->getRepository(AgeGroup::class)->find($id);

        if (!$ageGroup) {
            return $this->json(['error' => 'Age group not found'], 404);
        }

        if (!$this->isGranted(AgeGroupVoter::DELETE, $ageGroup)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($ageGroup);
        $this->entityManager->flush();

        return $this->json(['message' => 'Age group deleted successfully']);
    }
}
