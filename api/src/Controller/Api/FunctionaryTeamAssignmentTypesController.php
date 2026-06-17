<?php

namespace App\Controller\Api;

use App\Entity\FunctionaryTeamAssignmentType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/functionary-team-assignment-types', name: 'api_functionary_team_assignment_types_')]
class FunctionaryTeamAssignmentTypesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $types = $this->entityManager->getRepository(FunctionaryTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);

        return $this->json([
            'functionaryTeamAssignmentTypes' => array_map(fn ($t) => [
                'id' => $t->getId(),
                'name' => $t->getName(),
                'description' => $t->getDescription(),
            ], $types),
        ]);
    }
}
