<?php

namespace App\Controller\Api;

use App\Entity\StaffClubAssignmentType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/staff-club-assignment-types', name: 'api_staff_club_assignment_types_')]
class StaffClubAssignmentTypesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $types = $this->entityManager->getRepository(StaffClubAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);

        return $this->json([
            'staffClubAssignmentTypes' => array_map(fn ($t) => [
                'id' => $t->getId(),
                'name' => $t->getName(),
                'description' => $t->getDescription(),
            ], $types),
        ]);
    }
}
