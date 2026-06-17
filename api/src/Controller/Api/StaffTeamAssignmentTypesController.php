<?php

namespace App\Controller\Api;

use App\Entity\StaffTeamAssignmentType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/staff-team-assignment-types', name: 'api_staff_team_assignment_types_')]
class StaffTeamAssignmentTypesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $types = $this->entityManager->getRepository(StaffTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);

        return $this->json([
            'staffTeamAssignmentTypes' => array_map(fn ($t) => [
                'id' => $t->getId(),
                'name' => $t->getName(),
                'description' => $t->getDescription(),
            ], $types),
        ]);
    }
}
